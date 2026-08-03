# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.api.views import (
    WorkItemTypeListCreateAPIEndpoint,
    WorkItemTypeDetailAPIEndpoint,
    WorkItemTypeImportAPIEndpoint,
    WorkspaceWorkItemTypeListCreateAPIEndpoint,
    WorkspaceWorkItemTypeDetailAPIEndpoint,
)

urlpatterns = [
    # Workspace level work item types
    path(
        "workspaces/<str:slug>/work-item-types/",
        WorkspaceWorkItemTypeListCreateAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="workspace-work-item-types",
    ),
    path(
        "workspaces/<str:slug>/work-item-types/<uuid:type_id>/",
        WorkspaceWorkItemTypeDetailAPIEndpoint.as_view(http_method_names=["get", "patch", "delete"]),
        name="workspace-work-item-types",
    ),
    # Project scoped work item types
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/work-item-types/",
        WorkItemTypeListCreateAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="work-item-types",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/work-item-types/<uuid:work_item_type_id>/",
        WorkItemTypeDetailAPIEndpoint.as_view(http_method_names=["get", "patch", "delete"]),
        name="work-item-types",
    ),
    # Bulk import workspace types into a project
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/import-work-item-types/",
        WorkItemTypeImportAPIEndpoint.as_view(http_method_names=["post"]),
        name="import-work-item-types",
    ),
]
