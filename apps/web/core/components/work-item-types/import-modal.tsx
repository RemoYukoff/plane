/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { Logo } from "@plane/propel/emoji-icon-picker";
import { CheckIcon } from "@plane/propel/icons";
import { setToast, TOAST_TYPE } from "@plane/propel/toast";
import { EModalPosition, EModalWidth, ModalCore } from "@plane/ui";
import { cn } from "@plane/utils";
// hooks
import { useIssueType } from "@/hooks/store/use-issue-type";

type TImportIssueTypesModalProps = {
  isOpen: boolean;
  handleClose: () => void;
};

/**
 * Types are workspace owned, so a project can pull in ones that already exist
 * elsewhere in the workspace instead of creating duplicates.
 */
export const ImportIssueTypesModal = observer(function ImportIssueTypesModal(props: TImportIssueTypesModalProps) {
  const { isOpen, handleClose } = props;
  // router
  const { workspaceSlug, projectId } = useParams();
  // i18n
  const { t } = useTranslation();
  // states
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // store hooks
  const { getWorkspaceIssueTypes, getProjectIssueTypeIds, fetchWorkspaceIssueTypes, importIssueTypes } = useIssueType();
  // derived values
  const projectIssueTypeIds = getProjectIssueTypeIds(projectId?.toString());
  const importableIssueTypes = getWorkspaceIssueTypes().filter(
    (issueType) => !projectIssueTypeIds.includes(issueType.id)
  );

  useEffect(() => {
    if (!isOpen || !workspaceSlug) return;
    setSelectedIds([]);
    void fetchWorkspaceIssueTypes(workspaceSlug.toString());
  }, [isOpen, workspaceSlug, fetchWorkspaceIssueTypes]);

  const toggleSelection = (issueTypeId: string) =>
    setSelectedIds((prev) =>
      prev.includes(issueTypeId) ? prev.filter((id) => id !== issueTypeId) : [...prev, issueTypeId]
    );

  const handleImport = async () => {
    if (!workspaceSlug || !projectId || selectedIds.length === 0) return;
    setIsSubmitting(true);
    try {
      await importIssueTypes(workspaceSlug.toString(), projectId.toString(), selectedIds);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: t("common.success"),
        message: "Work item types imported successfully.",
      });
      handleClose();
    } catch (error) {
      const errorMessage = (error as { error?: string })?.error;
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("common.error"),
        message: errorMessage ?? "Something went wrong. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalCore isOpen={isOpen} handleClose={handleClose} position={EModalPosition.CENTER} width={EModalWidth.XXL}>
      <div className="space-y-4 p-5">
        <h3 className="text-h4-medium text-primary">Import from workspace</h3>
        {importableIssueTypes.length === 0 ? (
          <p className="text-body-xs-regular text-tertiary">
            There are no other work item types in this workspace to import.
          </p>
        ) : (
          <div className="vertical-scrollbar scrollbar-sm max-h-64 space-y-1 overflow-y-auto">
            {importableIssueTypes.map((issueType) => {
              const isSelected = selectedIds.includes(issueType.id);
              return (
                <button
                  key={issueType.id}
                  type="button"
                  onClick={() => toggleSelection(issueType.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left",
                    isSelected ? "bg-layer-transparent-hover" : "hover:bg-layer-transparent-hover"
                  )}
                >
                  <span className="flex items-center gap-2 truncate">
                    <Logo logo={issueType.logo_props} size={14} />
                    <span className="truncate text-body-xs-regular text-secondary">{issueType.name}</span>
                    {issueType.is_epic && (
                      <span className="rounded-sm bg-layer-2 px-1.5 py-0.5 text-caption-sm-regular text-tertiary">
                        Epic
                      </span>
                    )}
                  </span>
                  {isSelected && <CheckIcon className="size-3.5 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div className="flex items-center justify-end gap-2 border-t-[0.5px] border-subtle px-5 py-4">
        <Button variant="secondary" size="sm" onClick={handleClose} type="button">
          {t("common.cancel")}
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleImport}
          loading={isSubmitting}
          disabled={selectedIds.length === 0}
        >
          {isSubmitting ? "Importing" : "Import"}
        </Button>
      </div>
    </ModalCore>
  );
});
