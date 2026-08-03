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
from plane.api.serializers.work_item_type import WorkItemTypeSerializer
from plane.app.permissions import ProjectEntityPermission, WorkspaceEntityPermission
from plane.db.models import Issue, IssueType, Project, ProjectIssueType, Workspace
from .base import BaseAPIView


def _issue_type_queryset(slug):
    """Base queryset for work item types in a workspace, with project links prefetched."""
    return (
        IssueType.objects.filter(workspace__slug=slug)
        .prefetch_related(
            Prefetch(
                "project_issue_types",
                queryset=ProjectIssueType.objects.filter(deleted_at__isnull=True),
            )
        )
        .select_related("workspace")
    )


class WorkspaceWorkItemTypeListCreateAPIEndpoint(BaseAPIView):
    """Workspace level work item type list and create endpoint."""

    serializer_class = WorkItemTypeSerializer
    model = IssueType
    permission_classes = [WorkspaceEntityPermission]
    use_read_replica = True

    def get_queryset(self):
        return _issue_type_queryset(self.kwargs.get("slug"))

    def get(self, request, slug):
        """List all work item types in the workspace."""
        serializer = WorkItemTypeSerializer(
            self.get_queryset(), many=True, fields=self.fields, expand=self.expand
        )
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, slug):
        """Create a workspace level work item type."""
        workspace = Workspace.objects.get(slug=slug)

        name = (request.data.get("name") or "").strip()
        if name and IssueType.objects.filter(workspace__slug=slug, name=name).exists():
            existing = IssueType.objects.filter(workspace__slug=slug, name=name).first()
            return Response(
                {
                    "error": "Work item type with the same name already exists in the workspace",
                    "id": str(existing.id),
                },
                status=status.HTTP_409_CONFLICT,
            )

        # ``project_ids`` is a write-only convenience: link the new type to those
        # projects right away so a caller can create and import in one request.
        project_ids = request.data.get("project_ids") or []

        serializer = WorkItemTypeSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            issue_type = serializer.save(workspace=workspace)
        except IntegrityError:
            return Response(
                {"error": "Work item type with the same name already exists in the workspace"},
                status=status.HTTP_409_CONFLICT,
            )

        if project_ids:
            _link_types_to_projects(slug, project_ids, [issue_type.id])

        return Response(
            WorkItemTypeSerializer(_issue_type_queryset(slug).get(pk=issue_type.id)).data,
            status=status.HTTP_201_CREATED,
        )


class WorkspaceWorkItemTypeDetailAPIEndpoint(BaseAPIView):
    """Workspace level work item type detail endpoint."""

    serializer_class = WorkItemTypeSerializer
    model = IssueType
    permission_classes = [WorkspaceEntityPermission]
    use_read_replica = True

    def get_queryset(self):
        return _issue_type_queryset(self.kwargs.get("slug"))

    def get(self, request, slug, type_id):
        """Retrieve a workspace level work item type."""
        serializer = WorkItemTypeSerializer(
            self.get_queryset().get(pk=type_id), fields=self.fields, expand=self.expand
        )
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request, slug, type_id):
        """Update a workspace level work item type."""
        issue_type = IssueType.objects.get(workspace__slug=slug, pk=type_id)
        serializer = WorkItemTypeSerializer(issue_type, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()

        project_ids = request.data.get("project_ids")
        if project_ids:
            _link_types_to_projects(slug, project_ids, [issue_type.id])

        return Response(
            WorkItemTypeSerializer(_issue_type_queryset(slug).get(pk=issue_type.id)).data,
            status=status.HTTP_200_OK,
        )

    def delete(self, request, slug, type_id):
        """Delete a workspace level work item type."""
        issue_type = IssueType.objects.get(workspace__slug=slug, pk=type_id)

        if Issue.objects.filter(type_id=type_id).exists():
            return Response(
                {"error": "The work item type is in use, only unused types can be deleted"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        issue_type.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class WorkItemTypeListCreateAPIEndpoint(BaseAPIView):
    """Project scoped work item type list and create endpoint."""

    serializer_class = WorkItemTypeSerializer
    model = IssueType
    permission_classes = [ProjectEntityPermission]
    use_read_replica = True

    def get_queryset(self):
        return _issue_type_queryset(self.kwargs.get("slug")).filter(
            project_issue_types__project_id=self.kwargs.get("project_id"),
            project_issue_types__deleted_at__isnull=True,
        ).distinct()

    def get(self, request, slug, project_id):
        """List the work item types usable in a project."""
        serializer = WorkItemTypeSerializer(
            self.get_queryset(), many=True, fields=self.fields, expand=self.expand
        )
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, slug, project_id):
        """Create a work item type and make it usable in this project."""
        workspace = Workspace.objects.get(slug=slug)

        name = (request.data.get("name") or "").strip()
        existing = IssueType.objects.filter(workspace__slug=slug, name=name).first() if name else None

        if existing is not None:
            # The type already exists at the workspace level: link it to this
            # project instead of failing, so the endpoint is idempotent.
            _link_types_to_projects(slug, [project_id], [existing.id])
            return Response(
                WorkItemTypeSerializer(_issue_type_queryset(slug).get(pk=existing.id)).data,
                status=status.HTTP_200_OK,
            )

        serializer = WorkItemTypeSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            issue_type = serializer.save(workspace=workspace)
        except IntegrityError:
            return Response(
                {"error": "Work item type with the same name already exists in the workspace"},
                status=status.HTTP_409_CONFLICT,
            )

        _link_types_to_projects(slug, [project_id], [issue_type.id])

        return Response(
            WorkItemTypeSerializer(_issue_type_queryset(slug).get(pk=issue_type.id)).data,
            status=status.HTTP_201_CREATED,
        )


class WorkItemTypeDetailAPIEndpoint(BaseAPIView):
    """Project scoped work item type detail endpoint."""

    serializer_class = WorkItemTypeSerializer
    model = IssueType
    permission_classes = [ProjectEntityPermission]
    use_read_replica = True

    def get_queryset(self):
        return _issue_type_queryset(self.kwargs.get("slug")).filter(
            project_issue_types__project_id=self.kwargs.get("project_id"),
            project_issue_types__deleted_at__isnull=True,
        ).distinct()

    def get(self, request, slug, project_id, work_item_type_id):
        """Retrieve a work item type visible to this project."""
        serializer = WorkItemTypeSerializer(
            self.get_queryset().get(pk=work_item_type_id),
            fields=self.fields,
            expand=self.expand,
        )
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request, slug, project_id, work_item_type_id):
        """Update a work item type visible to this project."""
        issue_type = self.get_queryset().get(pk=work_item_type_id)
        serializer = WorkItemTypeSerializer(issue_type, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(
            WorkItemTypeSerializer(_issue_type_queryset(slug).get(pk=issue_type.id)).data,
            status=status.HTTP_200_OK,
        )

    def delete(self, request, slug, project_id, work_item_type_id):
        """Unlink a work item type from this project.

        The type itself is workspace level, so this removes the project link
        rather than deleting the type for the whole workspace.
        """
        if Issue.objects.filter(type_id=work_item_type_id, project_id=project_id).exists():
            return Response(
                {"error": "The work item type is in use in this project, only unused types can be removed"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ProjectIssueType.objects.filter(project_id=project_id, issue_type_id=work_item_type_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class WorkItemTypeImportAPIEndpoint(BaseAPIView):
    """Bulk link workspace level work item types into a project."""

    serializer_class = WorkItemTypeSerializer
    model = IssueType
    permission_classes = [ProjectEntityPermission]

    def post(self, request, slug, project_id):
        """Import one or more workspace work item types into a project."""
        work_item_type_ids = request.data.get("work_item_types") or []

        if not isinstance(work_item_type_ids, list) or not work_item_type_ids:
            return Response(
                {"error": "work_item_types must be a non-empty list of work item type ids"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        valid_ids = list(
            IssueType.objects.filter(workspace__slug=slug, pk__in=work_item_type_ids).values_list(
                "id", flat=True
            )
        )

        missing = set(str(type_id) for type_id in work_item_type_ids) - set(
            str(type_id) for type_id in valid_ids
        )
        if missing:
            return Response(
                {"error": "Some work item types do not exist in this workspace", "ids": sorted(missing)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        _link_types_to_projects(slug, [project_id], valid_ids)

        serializer = WorkItemTypeSerializer(
            _issue_type_queryset(slug).filter(pk__in=valid_ids), many=True
        )
        return Response(serializer.data, status=status.HTTP_200_OK)


def _link_types_to_projects(slug, project_ids, issue_type_ids):
    """Create the ProjectIssueType links, skipping any that already exist."""
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
