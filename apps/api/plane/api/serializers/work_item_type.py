# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Third party imports
from rest_framework import serializers

# Module imports
from .base import BaseSerializer
from plane.db.models import IssueType


class WorkItemTypeSerializer(BaseSerializer):
    """
    Serializer for work item types.

    Work item types are workspace level entities that are made usable inside a
    project through the ProjectIssueType link table. ``project_ids`` exposes the
    projects a type is currently linked to.
    """

    project_ids = serializers.SerializerMethodField()

    class Meta:
        model = IssueType
        fields = [
            "id",
            "name",
            "description",
            "logo_props",
            "is_epic",
            "is_default",
            "is_active",
            "level",
            "external_source",
            "external_id",
            "project_ids",
            "workspace",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
            "deleted_at",
        ]
        read_only_fields = [
            "id",
            "workspace",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
            "deleted_at",
        ]

    def get_project_ids(self, obj):
        # ``prefetched_project_ids`` is annotated by the views to avoid an N+1
        # query when serializing a list of types.
        if hasattr(obj, "prefetched_project_ids"):
            return [str(project_id) for project_id in obj.prefetched_project_ids]
        return [str(project_id) for project_id in obj.project_issue_types.values_list("project_id", flat=True)]

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Name cannot be empty")
        return value
