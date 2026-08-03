/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef } from "react";
import { observer } from "mobx-react";
import { ChevronRight } from "lucide-react";
import { Logo } from "@plane/propel/emoji-icon-picker";
import { PageIcon } from "@plane/propel/icons";
// plane imports
import { cn, getPageName } from "@plane/utils";
// components
import { ListItem } from "@/components/core/list";
import { BlockItemAction } from "@/components/pages/list/block-item-action";
// hooks
import { usePlatformOS } from "@/hooks/use-platform-os";
// plane web hooks
import type { EPageStoreType } from "@/hooks/store";
import { usePage } from "@/hooks/store";

// cap the indentation so very deep nesting stays readable and never overflows
const MAX_INDENT_DEPTH = 8;
const INDENT_WIDTH_PX = 20;

type TPageListBlock = {
  pageId: string;
  storeType: EPageStoreType;
  // tree props
  depth?: number;
  showTreeControls?: boolean;
  hasChildren?: boolean;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
};

export const PageListBlock = observer(function PageListBlock(props: TPageListBlock) {
  const {
    pageId,
    storeType,
    depth = 0,
    showTreeControls = false,
    hasChildren = false,
    isExpanded = false,
    onToggleExpanded,
  } = props;
  // refs
  const parentRef = useRef(null);
  // hooks
  const page = usePage({
    pageId,
    storeType,
  });
  const { isMobile } = usePlatformOS();
  // handle page check
  if (!page) return null;
  // derived values
  const { name, logo_props, getRedirectionLink } = page;

  return (
    <ListItem
      prependTitleElement={
        <>
          {showTreeControls && (
            <>
              {depth > 0 && (
                <span
                  className="flex-shrink-0"
                  style={{ width: Math.min(depth, MAX_INDENT_DEPTH) * INDENT_WIDTH_PX }}
                />
              )}
              <span className="mr-1 grid size-5 flex-shrink-0 place-items-center">
                {hasChildren && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onToggleExpanded?.();
                    }}
                    className="grid place-items-center rounded p-0.5 hover:bg-layer-1"
                    aria-label={isExpanded ? "Collapse sub-pages" : "Expand sub-pages"}
                  >
                    <ChevronRight
                      className={cn("h-3.5 w-3.5 text-tertiary transition-transform", isExpanded && "rotate-90")}
                    />
                  </button>
                )}
              </span>
            </>
          )}
          {logo_props?.in_use ? (
            <Logo logo={logo_props} size={16} type="lucide" />
          ) : (
            <PageIcon className="h-4 w-4 text-tertiary" />
          )}
        </>
      }
      title={getPageName(name)}
      itemLink={getRedirectionLink()}
      actionableItems={<BlockItemAction page={page} parentRef={parentRef} storeType={storeType} />}
      isMobile={isMobile}
      parentRef={parentRef}
    />
  );
});
