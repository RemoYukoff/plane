# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.db import IntegrityError
from django.db.models import Prefetch

# Third party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from .. import BaseAPIView
from plane.app.permissions import ROLE, allow_permission
from plane.app.serializers import IssueTypeSerializer
from plane.db.models import Issue, IssueType, Project, ProjectIssueType, Workspace


def issue_type_queryset(slug):
    """Work item types in a workspace, with the project links prefetched."""
    return (
        IssueType.objects.filter(workspace__slug=slug)
        .prefetch_related(
            Prefetch(
                "project_issue_types",
                queryset=ProjectIssueType.objects.filter(deleted_at__isnull=True),
            )
        )
        .select_related("workspace")
        .order_by("level", "name")
    )


def link_types_to_projects(slug, project_ids, issue_type_ids):
    """Create the ProjectIssueType links, skipping the ones that already exist."""
    projects = Project.objects.filter(workspace__slug=slug, pk__in=project_ids)

    existing = set(
        ProjectIssueType.objects.filter(
            project_id__in=[project.id for project in projects],
            issue_type_id__in=issue_type_ids,
        ).values_list("project_id", "issue_type_id")
    )

    links = [
        ProjectIssueType(
            project=project,
            issue_type_id=issue_type_id,
            workspace_id=project.workspace_id,
        )
        for project in projects
        for issue_type_id in issue_type_ids
        if (project.id, issue_type_id) not in existing
    ]

    if links:
        ProjectIssueType.objects.bulk_create(links, batch_size=100, ignore_conflicts=True)

    sync_issue_type_enabled_flag([project.id for project in projects])


def sync_issue_type_enabled_flag(project_ids):
    """Keep ``Project.is_issue_type_enabled`` in step with the actual links.

    The flag reports a fact — "this project has at least one type" — rather than
    a preference, so it is derived here instead of being toggled by hand. It is
    the single source of truth the frontend reads.
    """
    for project_id in set(project_ids):
        has_types = ProjectIssueType.objects.filter(project_id=project_id, deleted_at__isnull=True).exists()
        Project.objects.filter(pk=project_id).exclude(is_issue_type_enabled=has_types).update(
            is_issue_type_enabled=has_types
        )


class WorkspaceIssueTypeEndpoint(BaseAPIView):
    """Work item types across the whole workspace."""

    model = IssueType
    use_read_replica = True

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def get(self, request, slug):
        serializer = IssueTypeSerializer(issue_type_queryset(slug), many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def post(self, request, slug):
        workspace = Workspace.objects.get(slug=slug)

        name = (request.data.get("name") or "").strip()
        if name and IssueType.objects.filter(workspace__slug=slug, name=name).exists():
            return Response(
                {"error": "A work item type with that name already exists in this workspace"},
                status=status.HTTP_409_CONFLICT,
            )

        serializer = IssueTypeSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            issue_type = serializer.save(workspace=workspace)
        except IntegrityError:
            return Response(
                {"error": "A work item type with that name already exists in this workspace"},
                status=status.HTTP_409_CONFLICT,
            )

        # ``project_ids`` lets the caller create the type and link it to projects
        # in a single request.
        project_ids = request.data.get("project_ids") or []
        if project_ids:
            link_types_to_projects(slug, project_ids, [issue_type.id])

        return Response(
            IssueTypeSerializer(issue_type_queryset(slug).get(pk=issue_type.id)).data,
            status=status.HTTP_201_CREATED,
        )


class WorkspaceIssueTypeDetailEndpoint(BaseAPIView):
    """Detail endpoint for a workspace level work item type."""

    model = IssueType
    use_read_replica = True

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def get(self, request, slug, pk):
        serializer = IssueTypeSerializer(issue_type_queryset(slug).get(pk=pk))
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def patch(self, request, slug, pk):
        issue_type = IssueType.objects.get(workspace__slug=slug, pk=pk)
        serializer = IssueTypeSerializer(issue_type, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            serializer.save()
        except IntegrityError:
            return Response(
                {"error": "A work item type with that name already exists in this workspace"},
                status=status.HTTP_409_CONFLICT,
            )

        project_ids = request.data.get("project_ids")
        if project_ids:
            link_types_to_projects(slug, project_ids, [issue_type.id])

        return Response(
            IssueTypeSerializer(issue_type_queryset(slug).get(pk=issue_type.id)).data,
            status=status.HTTP_200_OK,
        )

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def delete(self, request, slug, pk):
        issue_type = IssueType.objects.get(workspace__slug=slug, pk=pk)

        if Issue.objects.filter(type_id=pk).exists():
            return Response(
                {"error": "This work item type is in use, only unused types can be deleted"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # the links cascade with the type, so the projects that carried it may
        # be left with none
        affected_project_ids = list(
            ProjectIssueType.objects.filter(issue_type_id=pk).values_list("project_id", flat=True)
        )

        issue_type.delete()
        sync_issue_type_enabled_flag(affected_project_ids)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProjectIssueTypeEndpoint(BaseAPIView):
    """Work item types usable inside a project."""

    model = IssueType
    use_read_replica = True

    def get_queryset(self, slug, project_id):
        return (
            issue_type_queryset(slug)
            .filter(
                project_issue_types__project_id=project_id,
                project_issue_types__deleted_at__isnull=True,
            )
            .distinct()
        )

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def get(self, request, slug, project_id):
        serializer = IssueTypeSerializer(self.get_queryset(slug, project_id), many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN])
    def post(self, request, slug, project_id):
        workspace = Workspace.objects.get(slug=slug)

        name = (request.data.get("name") or "").strip()
        existing = IssueType.objects.filter(workspace__slug=slug, name=name).first() if name else None

        if existing is not None:
            # Types are workspace owned: if one already carries this name, link it
            # to the project instead of failing.
            link_types_to_projects(slug, [project_id], [existing.id])
            return Response(
                IssueTypeSerializer(issue_type_queryset(slug).get(pk=existing.id)).data,
                status=status.HTTP_200_OK,
            )

        serializer = IssueTypeSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            issue_type = serializer.save(workspace=workspace)
        except IntegrityError:
            return Response(
                {"error": "A work item type with that name already exists in this workspace"},
                status=status.HTTP_409_CONFLICT,
            )

        link_types_to_projects(slug, [project_id], [issue_type.id])

        return Response(
            IssueTypeSerializer(issue_type_queryset(slug).get(pk=issue_type.id)).data,
            status=status.HTTP_201_CREATED,
        )


class ProjectIssueTypeDetailEndpoint(BaseAPIView):
    """Detail endpoint for a work item type in the context of a project."""

    model = IssueType
    use_read_replica = True

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def get(self, request, slug, project_id, pk):
        issue_type = (
            issue_type_queryset(slug)
            .filter(
                project_issue_types__project_id=project_id,
                project_issue_types__deleted_at__isnull=True,
            )
            .distinct()
            .get(pk=pk)
        )
        return Response(IssueTypeSerializer(issue_type).data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN])
    def patch(self, request, slug, project_id, pk):
        issue_type = IssueType.objects.get(workspace__slug=slug, pk=pk)
        serializer = IssueTypeSerializer(issue_type, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            serializer.save()
        except IntegrityError:
            return Response(
                {"error": "A work item type with that name already exists in this workspace"},
                status=status.HTTP_409_CONFLICT,
            )

        return Response(
            IssueTypeSerializer(issue_type_queryset(slug).get(pk=issue_type.id)).data,
            status=status.HTTP_200_OK,
        )

    @allow_permission([ROLE.ADMIN])
    def delete(self, request, slug, project_id, pk):
        """Unlink the type from this project.

        The type is workspace owned, so this drops the project link rather than
        deleting it for every project.
        """
        if Issue.objects.filter(type_id=pk, project_id=project_id).exists():
            return Response(
                {"error": "This work item type is in use in this project, only unused types can be removed"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ProjectIssueType.objects.filter(project_id=project_id, issue_type_id=pk).delete()
        sync_issue_type_enabled_flag([project_id])
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProjectIssueTypeImportEndpoint(BaseAPIView):
    """Bulk link workspace level work item types into a project."""

    model = IssueType

    @allow_permission([ROLE.ADMIN])
    def post(self, request, slug, project_id):
        issue_type_ids = request.data.get("issue_type_ids") or []

        if not isinstance(issue_type_ids, list) or not issue_type_ids:
            return Response(
                {"error": "issue_type_ids must be a non-empty list of work item type ids"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        valid_ids = list(
            IssueType.objects.filter(workspace__slug=slug, pk__in=issue_type_ids).values_list("id", flat=True)
        )

        missing = set(str(issue_type_id) for issue_type_id in issue_type_ids) - set(
            str(issue_type_id) for issue_type_id in valid_ids
        )
        if missing:
            return Response(
                {"error": "Some work item types do not exist in this workspace", "ids": sorted(missing)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        link_types_to_projects(slug, [project_id], valid_ids)

        serializer = IssueTypeSerializer(issue_type_queryset(slug).filter(pk__in=valid_ids), many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
