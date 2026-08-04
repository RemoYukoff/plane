# Seed the default work item types for projects created before they existed.

from django.db import migrations

from plane.db.models.issue_type import DEFAULT_ISSUE_TYPES


def seed_default_issue_types(apps, schema_editor):
    Project = apps.get_model("db", "Project")
    IssueType = apps.get_model("db", "IssueType")
    ProjectIssueType = apps.get_model("db", "ProjectIssueType")

    for project in Project.objects.filter(deleted_at__isnull=True).iterator():
        workspace_id = project.workspace_id

        for definition in DEFAULT_ISSUE_TYPES:
            # Types are workspace owned: reuse one with the same name instead of
            # adding another. Instances that already created types by hand may
            # have duplicates, so take the oldest and leave the rest alone.
            issue_type = (
                IssueType.objects.filter(
                    workspace_id=workspace_id,
                    name=definition["name"],
                    deleted_at__isnull=True,
                )
                .order_by("created_at")
                .first()
            )

            if issue_type is None:
                issue_type = IssueType.objects.create(workspace_id=workspace_id, **definition)

            if not ProjectIssueType.objects.filter(
                project_id=project.id, issue_type_id=issue_type.id, deleted_at__isnull=True
            ).exists():
                ProjectIssueType.objects.create(
                    project_id=project.id,
                    issue_type_id=issue_type.id,
                    workspace_id=workspace_id,
                    level=definition["level"],
                    is_default=definition["is_default"],
                )

        if not project.is_issue_type_enabled:
            project.is_issue_type_enabled = True
            project.save(update_fields=["is_issue_type_enabled"])


def unseed(apps, schema_editor):
    """Deliberately a no-op.

    Types may have been edited or attached to work items after seeding, so
    removing them on reverse would destroy real data. Reversing this migration
    simply leaves them in place.
    """


class Migration(migrations.Migration):
    dependencies = [
        ("db", "0122_alter_draftissue_assignees_alter_issue_assignees_and_more"),
    ]

    operations = [
        migrations.RunPython(seed_default_issue_types, unseed),
    ]
