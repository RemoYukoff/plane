/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { Tooltip } from "@plane/propel/tooltip";
import type { ICustomSearchSelectOption } from "@plane/types";
import { Breadcrumbs, CustomSearchSelect } from "@plane/ui";
import { cn } from "@plane/utils";

type Props = {
  options: ICustomSearchSelectOption[];
  onSelect: (pageId: string) => void;
};

/**
 * @description trailing breadcrumb chevron that lists the current page's whole subtree
 * (children and sub-children, indented), file-explorer style: `... / Current ▾ / ›`.
 * Renders nothing when the page has no children.
 */
export function PageChildPagesDropdown(props: Props) {
  const { options, onSelect } = props;
  // state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  if (options.length === 0) return null;

  return (
    <CustomSearchSelect
      onOpen={() => {
        setIsDropdownOpen(true);
      }}
      onClose={() => {
        setIsDropdownOpen(false);
      }}
      options={options}
      value=""
      onChange={(value: string) => onSelect(value)}
      customButton={
        <Tooltip tooltipContent="Sub-pages" position="bottom" disabled={isDropdownOpen}>
          <div>
            <Breadcrumbs.Separator
              className={cn("rounded-sm", {
                "bg-layer-1": isDropdownOpen,
              })}
              containerClassName="p-0"
              iconClassName={cn("hover:text-primary", {
                "rotate-90 text-primary": isDropdownOpen,
              })}
              showDivider={false}
            />
          </div>
        </Tooltip>
      }
      className="h-full rounded-sm"
      customButtonClassName={cn(
        "group flex h-full cursor-pointer items-center rounded-sm outline-none hover:bg-surface-2",
        {
          "bg-surface-2": isDropdownOpen,
        }
      )}
    />
  );
}
