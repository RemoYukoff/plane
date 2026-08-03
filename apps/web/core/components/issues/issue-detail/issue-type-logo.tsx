/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// plane imports
import { Logo } from "@plane/propel/emoji-icon-picker";
import { Tooltip } from "@plane/propel/tooltip";
import type { TIssueIdentifierSize, TLogoProps } from "@plane/types";
import { cn } from "@plane/utils";
// hooks
import { useIssueType } from "@/hooks/store/use-issue-type";

const SIZE_MAP: Record<TIssueIdentifierSize, number> = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
};

/** Falls back to a neutral square so a type without a logo still reads as a type. */
const DEFAULT_LOGO_PROPS: TLogoProps = {
  in_use: "icon",
  icon: { name: "widgets" },
};

type TIssueTypeLogoProps = {
  issueTypeId: string | null | undefined;
  size?: TIssueIdentifierSize;
  showTooltip?: boolean;
  containerClassName?: string;
};

export const IssueTypeLogo = observer(function IssueTypeLogo(props: TIssueTypeLogoProps) {
  const { issueTypeId, size = "md", showTooltip = true, containerClassName } = props;
  // store hooks
  const { getIssueTypeById } = useIssueType();
  // derived values
  const issueType = getIssueTypeById(issueTypeId);

  if (!issueType) return null;

  const logoSize = SIZE_MAP[size];
  const logo = issueType.logo_props?.in_use ? issueType.logo_props : DEFAULT_LOGO_PROPS;

  return (
    <Tooltip tooltipContent={issueType.name} disabled={!showTooltip} position="top">
      <div
        className={cn("flex shrink-0 items-center justify-center", containerClassName)}
        style={{ height: logoSize, width: logoSize }}
      >
        <Logo logo={logo} size={logoSize} />
      </div>
    </Tooltip>
  );
});
