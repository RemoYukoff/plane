/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import { setToast, TOAST_TYPE } from "@plane/propel/toast";
// components
import { IssueTypeDropdown } from "@/components/dropdowns/issue-type";
import { IssueIdentifier } from "@/components/issues/issue-detail/issue-identifier";
// store hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useIssueType } from "@/hooks/store/use-issue-type";

export type TIssueTypeSwitcherProps = {
  issueId: string;
  disabled: boolean;
};

export const IssueTypeSwitcher = observer(function IssueTypeSwitcher(props: TIssueTypeSwitcherProps) {
  const { issueId, disabled } = props;
  // router
  const { workspaceSlug } = useParams();
  // store hooks
  const {
    issue: { getIssueById },
    updateIssue,
  } = useIssueDetail();
  const { isIssueTypeEnabledForProject } = useIssueType();
  // derived values
  const issue = getIssueById(issueId);

  if (!issue || !issue.project_id) return <></>;

  const projectId = issue.project_id;
  // with no types imported into the project there is nothing to switch between
  const canSwitchType = !disabled && isIssueTypeEnabledForProject(projectId);

  const handleIssueTypeChange = async (typeId: string | undefined) => {
    if (!workspaceSlug || !typeId || typeId === issue.type_id) return;
    try {
      await updateIssue(workspaceSlug.toString(), projectId, issueId, { type_id: typeId });
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error!",
        message: "Failed to update the work item type. Please try again.",
      });
    }
  };

  return (
    <div className="flex items-center gap-2">
      {canSwitchType && (
        <IssueTypeDropdown
          value={issue.type_id}
          onChange={handleIssueTypeChange}
          projectId={projectId}
          buttonVariant="border-with-text"
          dropdownArrow
          // an epic stays an epic: only offer epic types when it already is one
          includeEpics={!!issue.is_epic}
        />
      )}
      <IssueIdentifier
        issueId={issueId}
        projectId={projectId}
        size="md"
        enableClickToCopyIdentifier
        // the dropdown already shows the type, so don't render the logo twice
        displayProperties={canSwitchType ? { key: true, issue_type: false } : undefined}
      />
    </div>
  );
});
