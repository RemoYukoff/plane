/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import useSWR from "swr";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { Logo } from "@plane/propel/emoji-icon-picker";
import { setToast, TOAST_TYPE } from "@plane/propel/toast";
import { Tooltip } from "@plane/propel/tooltip";
import type { TIssueType } from "@plane/types";
import { CustomMenu, Loader, ToggleSwitch } from "@plane/ui";
import { cn } from "@plane/utils";
// components
import { SettingsHeading } from "@/components/settings/heading";
import { CreateUpdateIssueTypeModal } from "@/components/work-item-types/create-update-modal";
import { ImportIssueTypesModal } from "@/components/work-item-types/import-modal";
// hooks
import { useIssueType } from "@/hooks/store/use-issue-type";
import { useUserPermissions } from "@/hooks/store/user";

export const ProjectSettingsIssueTypeList = observer(function ProjectSettingsIssueTypeList() {
  // router
  const { workspaceSlug, projectId } = useParams();
  // i18n
  const { t } = useTranslation();
  // states
  const [isCreateUpdateModalOpen, setIsCreateUpdateModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [issueTypeToUpdate, setIssueTypeToUpdate] = useState<TIssueType | undefined>(undefined);
  // store hooks
  const { getAllProjectIssueTypes, fetchProjectIssueTypes, updateIssueType, removeIssueTypeFromProject } =
    useIssueType();
  const { allowPermissions } = useUserPermissions();
  // derived values
  const isEditable = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.PROJECT);
  // settings is where an inactive type gets switched back on, so it has to list them
  const issueTypes = getAllProjectIssueTypes(projectId?.toString());

  const { isLoading } = useSWR(
    workspaceSlug && projectId ? `PROJECT_ISSUE_TYPES_${workspaceSlug}_${projectId}` : null,
    workspaceSlug && projectId ? () => fetchProjectIssueTypes(workspaceSlug.toString(), projectId.toString()) : null
  );

  const handleToggleActive = async (issueType: TIssueType) => {
    if (!workspaceSlug || !projectId) return;
    try {
      await updateIssueType(workspaceSlug.toString(), projectId.toString(), issueType.id, {
        is_active: !issueType.is_active,
      });
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("common.error"),
        message: "Failed to update the work item type. Please try again.",
      });
    }
  };

  const handleRemove = async (issueType: TIssueType) => {
    if (!workspaceSlug || !projectId) return;
    try {
      await removeIssueTypeFromProject(workspaceSlug.toString(), projectId.toString(), issueType.id);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: t("common.success"),
        message: "Work item type removed from this project.",
      });
    } catch (error) {
      const errorMessage = (error as { error?: string })?.error;
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("common.error"),
        message: errorMessage ?? "Failed to remove the work item type. Please try again.",
      });
    }
  };

  const handleEdit = (issueType: TIssueType) => {
    setIssueTypeToUpdate(issueType);
    setIsCreateUpdateModalOpen(true);
  };

  const handleCreate = () => {
    setIssueTypeToUpdate(undefined);
    setIsCreateUpdateModalOpen(true);
  };

  return (
    <>
      <CreateUpdateIssueTypeModal
        isOpen={isCreateUpdateModalOpen}
        handleClose={() => setIsCreateUpdateModalOpen(false)}
        data={issueTypeToUpdate}
      />
      <ImportIssueTypesModal isOpen={isImportModalOpen} handleClose={() => setIsImportModalOpen(false)} />
      <SettingsHeading
        title={t("work_item_types.label")}
        description={t("work_item_types.settings.description")}
        control={
          isEditable && (
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="lg" onClick={() => setIsImportModalOpen(true)}>
                {t("work_item_types.settings.properties.project.add_button.import_from_workspace")}
              </Button>
              <Button variant="primary" size="lg" onClick={handleCreate}>
                {t("common.create")}
              </Button>
            </div>
          )
        }
      />
      <div className="mt-4">
        {isLoading && issueTypes.length === 0 ? (
          <Loader className="space-y-2">
            <Loader.Item height="54px" />
            <Loader.Item height="54px" />
            <Loader.Item height="54px" />
          </Loader>
        ) : issueTypes.length === 0 ? (
          <p className="py-8 text-center text-body-xs-regular text-tertiary">
            No work item types in this project yet. Create one or import an existing type from the workspace.
          </p>
        ) : (
          <div className="divide-y-[0.5px] divide-subtle rounded-md border-[0.5px] border-subtle">
            {issueTypes.map((issueType) => (
              <div key={issueType.id} className="flex items-center justify-between gap-2 px-4 py-3">
                <div className={cn("flex min-w-0 items-center gap-3", !issueType.is_active && "opacity-60")}>
                  <Logo logo={issueType.logo_props} size={16} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-body-xs-medium text-primary">{issueType.name}</span>
                      {issueType.is_epic && (
                        <span className="rounded-sm bg-layer-2 px-1.5 py-0.5 text-caption-sm-regular text-tertiary">
                          Epic
                        </span>
                      )}
                      {!issueType.is_active && (
                        <span className="rounded-sm bg-layer-2 px-1.5 py-0.5 text-caption-sm-regular text-tertiary">
                          Inactive
                        </span>
                      )}
                    </div>
                    {issueType.description && (
                      <p className="truncate text-caption-sm-regular text-tertiary">{issueType.description}</p>
                    )}
                  </div>
                </div>
                {isEditable && (
                  <div className="flex flex-shrink-0 items-center gap-3">
                    {/* The tooltip clones its child to attach a trigger, so it wraps
                        the plain label only — wrapping the toggle breaks it. */}
                    <Tooltip
                      tooltipContent={
                        issueType.is_active
                          ? "Offered when creating work items. Turning this off only hides it from the pickers; existing work items keep their type."
                          : "Not offered when creating work items. Turn it back on to use it again."
                      }
                      position="top"
                    >
                      <span className="text-caption-sm-regular text-tertiary">
                        {issueType.is_active ? "Active" : "Inactive"}
                      </span>
                    </Tooltip>
                    <ToggleSwitch value={issueType.is_active} onChange={() => handleToggleActive(issueType)} />
                    <CustomMenu ellipsis placement="bottom-end">
                      <CustomMenu.MenuItem onClick={() => handleEdit(issueType)}>
                        {t("common.edit")}
                      </CustomMenu.MenuItem>
                      <CustomMenu.MenuItem onClick={() => handleRemove(issueType)}>
                        {t("common.remove")}
                      </CustomMenu.MenuItem>
                    </CustomMenu>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
});
