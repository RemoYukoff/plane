/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import { Button } from "@plane/propel/button";
import { Logo } from "@plane/propel/emoji-icon-picker";
import { PageIcon } from "@plane/propel/icons";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { ICustomSearchSelectOption } from "@plane/types";
import { CustomSearchSelect, EModalPosition, EModalWidth, ModalCore } from "@plane/ui";
import { getPageName } from "@plane/utils";
// plane web hooks
import type { EPageStoreType } from "@/hooks/store";
import { usePageStore } from "@/hooks/store";
// store
import type { TPageInstance } from "@/store/pages/base-page";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  page: TPageInstance;
  storeType: EPageStoreType;
};

export const SetParentPageModal = observer(function SetParentPageModal(props: Props) {
  const { isOpen, onClose, page, storeType } = props;
  // states
  const [selectedParentId, setSelectedParentId] = useState<string | null>(page.parent ?? null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // params
  const { projectId } = useParams();
  // store hooks
  const { getCurrentProjectPageIds, getPageById } = usePageStore(storeType);

  // a page cannot be nested under itself or under any of its descendants
  const isSelfOrDescendant = (candidateId: string): boolean => {
    let currentId: string | null | undefined = candidateId;
    const visited = new Set<string>();
    while (currentId) {
      if (currentId === page.id) return true;
      if (visited.has(currentId)) return false; // defensive: cycle in existing data
      visited.add(currentId);
      currentId = getPageById(currentId)?.parent;
    }
    return false;
  };

  const candidatePageIds = (projectId ? getCurrentProjectPageIds(projectId.toString()) : []).filter((pageId) => {
    const candidate = getPageById(pageId);
    if (!candidate || candidate.archived_at) return false;
    return !isSelfOrDescendant(pageId);
  });

  const options: ICustomSearchSelectOption[] = [
    {
      value: null,
      query: "no parent root",
      content: <span className="text-tertiary">No parent (top level)</span>,
    },
    ...candidatePageIds.map((pageId) => {
      const candidate = getPageById(pageId);
      const candidateName = getPageName(candidate?.name);
      return {
        value: pageId,
        query: candidateName,
        content: (
          <span className="flex items-center gap-2 truncate">
            {candidate?.logo_props?.in_use ? (
              <Logo logo={candidate.logo_props} size={14} type="lucide" />
            ) : (
              <PageIcon className="h-3.5 w-3.5 flex-shrink-0 text-tertiary" />
            )}
            <span className="truncate">{candidateName}</span>
          </span>
        ),
      };
    }),
  ];

  const selectedParent = selectedParentId ? getPageById(selectedParentId) : undefined;

  const handleClose = () => {
    setIsSubmitting(false);
    onClose();
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await page.setParent(selectedParentId);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Success!",
        message: selectedParentId
          ? `Page moved under "${getPageName(getPageById(selectedParentId)?.name)}".`
          : "Page moved to the top level.",
      });
      handleClose();
    } catch {
      setIsSubmitting(false);
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error!",
        message: "Failed to update the parent page. Please try again.",
      });
    }
  };

  return (
    <ModalCore isOpen={isOpen} handleClose={handleClose} position={EModalPosition.TOP} width={EModalWidth.LG}>
      <div className="space-y-5 p-5">
        <h3 className="text-18 font-medium text-secondary">Set parent page</h3>
        <p className="text-13 text-tertiary">
          Nest <span className="font-medium text-secondary">{getPageName(page.name)}</span> under another page of this
          project, or move it to the top level.
        </p>
        <CustomSearchSelect
          options={options}
          value={selectedParentId}
          onChange={(value: string | null) => setSelectedParentId(value)}
          label={
            selectedParentId ? (
              <span className="flex items-center gap-2 truncate">
                {selectedParent?.logo_props?.in_use ? (
                  <Logo logo={selectedParent.logo_props} size={14} type="lucide" />
                ) : (
                  <PageIcon className="h-3.5 w-3.5 flex-shrink-0 text-tertiary" />
                )}
                <span className="truncate">{getPageName(selectedParent?.name)}</span>
              </span>
            ) : (
              "No parent (top level)"
            )
          }
          buttonClassName="w-full"
          className="w-full"
          input
        />
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-subtle px-5 py-4">
        <Button variant="secondary" size="lg" onClick={handleClose}>
          Cancel
        </Button>
        <Button variant="primary" size="lg" onClick={handleSubmit} loading={isSubmitting}>
          {isSubmitting ? "Moving" : "Move page"}
        </Button>
      </div>
    </ModalCore>
  );
});
