/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Fragment, useState } from "react";
import { observer } from "mobx-react";
// types
import type { TPageNavigationTabs } from "@plane/types";
// components
import { ListLayout } from "@/components/core/list";
// plane web hooks
import type { EPageStoreType } from "@/hooks/store";
import { usePageStore } from "@/hooks/store";
// local imports
import { PageListBlock } from "./block";
import { buildPageTree } from "./tree";

type TPagesListRoot = {
  pageType: TPageNavigationTabs;
  storeType: EPageStoreType;
};

export const PagesListRoot = observer(function PagesListRoot(props: TPagesListRoot) {
  const { pageType, storeType } = props;
  // states
  const [expandedPageIds, setExpandedPageIds] = useState<Set<string>>(new Set());
  // store hooks
  const { getCurrentProjectFilteredPageIdsByTab, getPageById, filters } = usePageStore(storeType);
  // derived values
  const filteredPageIds = getCurrentProjectFilteredPageIdsByTab(pageType);
  // while searching, matches must stay visible, so keep every subtree expanded
  const isSearchActive = !!filters.searchQuery;

  if (!filteredPageIds) return <></>;

  const tree = buildPageTree(
    filteredPageIds.map((pageId) => ({
      id: pageId,
      parent: getPageById(pageId)?.parent,
    }))
  );
  const isTreeActive = Object.keys(tree.childrenByParentId).length > 0;

  const toggleExpanded = (pageId: string) =>
    setExpandedPageIds((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });

  const renderSubTree = (pageId: string, depth: number): React.ReactNode => {
    const childPageIds = tree.childrenByParentId[pageId] ?? [];
    const isExpanded = isSearchActive || expandedPageIds.has(pageId);
    return (
      <Fragment key={pageId}>
        <PageListBlock
          pageId={pageId}
          storeType={storeType}
          depth={depth}
          showTreeControls={isTreeActive}
          hasChildren={childPageIds.length > 0}
          isExpanded={isExpanded}
          onToggleExpanded={() => toggleExpanded(pageId)}
        />
        {isExpanded && childPageIds.map((childPageId) => renderSubTree(childPageId, depth + 1))}
      </Fragment>
    );
  };

  return <ListLayout>{tree.rootIds.map((pageId) => renderSubTree(pageId, 0))}</ListLayout>;
});
