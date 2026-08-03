/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { observer } from "mobx-react";
import type { Control } from "react-hook-form";
import { Controller, useWatch } from "react-hook-form";
// plane imports
import { ETabIndices } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import type { TIssue } from "@plane/types";
import { getTabIndex } from "@plane/utils";
// components
import { IssueTypeDropdown } from "@/components/dropdowns/issue-type";
// hooks
import { useIssueType } from "@/hooks/store/use-issue-type";
import { usePlatformOS } from "@/hooks/use-platform-os";

type TIssueTypeSelectProps = {
  control: Control<TIssue>;
  disabled?: boolean;
  handleFormChange: () => void;
};

export const IssueTypeSelect = observer(function IssueTypeSelect(props: TIssueTypeSelectProps) {
  const { control, disabled = false, handleFormChange } = props;
  // i18n
  const { t } = useTranslation();
  // store hooks
  const { isMobile } = usePlatformOS();
  const { isIssueTypeEnabledForProject } = useIssueType();
  // form values
  const projectId = useWatch({ control, name: "project_id" });

  const { getIndex } = getTabIndex(ETabIndices.ISSUE_FORM, isMobile);

  // nothing to pick from until the project has imported at least one type
  if (!isIssueTypeEnabledForProject(projectId)) return null;

  return (
    <Controller
      control={control}
      name="type_id"
      render={({ field: { value, onChange } }) => (
        <div className="h-7">
          <IssueTypeDropdown
            value={value}
            onChange={(issueTypeId) => {
              onChange(issueTypeId ?? null);
              handleFormChange();
            }}
            projectId={projectId ?? undefined}
            placeholder={t("work_item_types.label")}
            buttonVariant="border-with-text"
            dropdownArrow
            tabIndex={getIndex("type_id")}
            disabled={disabled}
          />
        </div>
      )}
    />
  );
});
