# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.app.views import (
    WorkspaceIssueTypeEndpoint,
    WorkspaceIssueTypeDetailEndpoint,
    ProjectIssueTypeEndpoint,
    ProjectIssueTypeDetailEndpoint,
    ProjectIssueTypeImportEndpoint,
)


urlpatterns = [
    path(
        "workspaces/<str:slug>/issue-types/",
        WorkspaceIssueTypeEndpoint.as_view(),
        name="workspace-issue-types",
    ),
    path(
        "workspaces/<str:slug>/issue-types/<uuid:pk>/",
        WorkspaceIssueTypeDetailEndpoint.as_view(),
        name="workspace-issue-type",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/issue-types/",
        ProjectIssueTypeEndpoint.as_view(),
        name="project-issue-types",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/issue-types/<uuid:pk>/",
        ProjectIssueTypeDetailEndpoint.as_view(),
        name="project-issue-type",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/import-issue-types/",
        ProjectIssueTypeImportEndpoint.as_view(),
        name="project-import-issue-types",
    ),
]
