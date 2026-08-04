# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Module imports
from plane.db.models import DEFAULT_ISSUE_TYPES


def seed_project_issue_types(project, actor_id=None, issue_type_model=None, project_issue_type_model=None):
    """Give a project the default work item types.

    Types are workspace owned, so an existing type with the same name is reused
    rather than duplicated — creating a second "Epic" per project is exactly the
    bug this avoids. Only the project link is per project.

    The model arguments let data migrations pass their historical models in;
    application code leaves them out.
    """
    if issue_type_model is None or project_issue_type_model is None:
        from plane.db.models import IssueType, ProjectIssueType

        issue_type_model = issue_type_model or IssueType
        project_issue_type_model = project_issue_type_model or ProjectIssueType

    workspace_id = project.workspace_id

    for definition in DEFAULT_ISSUE_TYPES:
        # ``deleted_at`` matters: these models are soft deleted, and a removed
        # type must not be reused — it would come back with its old links.
        issue_type = (
            issue_type_model.objects.filter(
                workspace_id=workspace_id,
                name=definition["name"],
                deleted_at__isnull=True,
            )
            .order_by("created_at")
            .first()
        )

        if issue_type is None:
            issue_type = issue_type_model.objects.create(
                workspace_id=workspace_id,
                created_by_id=actor_id,
                **definition,
            )

        link_exists = project_issue_type_model.objects.filter(
            project_id=project.id, issue_type_id=issue_type.id, deleted_at__isnull=True
        ).exists()

        if not link_exists:
            project_issue_type_model.objects.create(
                project_id=project.id,
                issue_type_id=issue_type.id,
                workspace_id=workspace_id,
                level=definition["level"],
                is_default=definition["is_default"],
                created_by_id=actor_id,
            )

    # the flag is derived from the links, so it is only true once they exist
    if not project.is_issue_type_enabled:
        project.is_issue_type_enabled = True
        project.save(update_fields=["is_issue_type_enabled"])
