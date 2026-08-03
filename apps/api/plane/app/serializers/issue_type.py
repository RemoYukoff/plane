# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Third party imports
from rest_framework import serializers

# Module imports
from .base import BaseSerializer
from plane.db.models import IssueType


class IssueTypeSerializer(BaseSerializer):
    """
    Work item types for the web app.

    Types are workspace owned and become usable in a project through the
    ProjectIssueType link table, so ``project_ids`` is what the UI reads to know
    where a type applies.
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
        # The views prefetch ``project_issue_types`` so this does not run a query
        # per type when serializing a list.
        return [str(project_issue_type.project_id) for project_issue_type in obj.project_issue_types.all()]

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Name cannot be empty")
        return value
