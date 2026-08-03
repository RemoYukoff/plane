/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

type TTreePage = {
  id: string | undefined;
  parent?: string | null;
};

export type TPageTree = {
  rootIds: string[];
  childrenByParentId: Record<string, string[]>;
};

/**
 * @description builds a parent → children adjacency structure from an ordered, filtered list
 * of pages. The input order is preserved within each level. Defensive rules:
 * - a page whose parent is not present in the list (orphan) is rendered at the root
 * - parent cycles are broken by rendering every page on the cycle at the root
 */
export const buildPageTree = (pages: TTreePage[]): TPageTree => {
  const parentById = new Map<string, string | null>();
  for (const page of pages) {
    if (page.id) parentById.set(page.id, page.parent ?? null);
  }

  // detect parent cycles among the listed pages
  const cyclePageIds = new Set<string>();
  const visitState = new Map<string, "visiting" | "done">();
  for (const startId of parentById.keys()) {
    if (visitState.has(startId)) continue;
    const path: string[] = [];
    let currentId: string | null | undefined = startId;
    while (currentId && parentById.has(currentId) && visitState.get(currentId) !== "done") {
      if (visitState.get(currentId) === "visiting") {
        // found a cycle: every page from the first occurrence on the path is part of it
        for (let i = path.indexOf(currentId); i < path.length; i++) cyclePageIds.add(path[i]);
        break;
      }
      visitState.set(currentId, "visiting");
      path.push(currentId);
      currentId = parentById.get(currentId);
    }
    for (const id of path) visitState.set(id, "done");
  }

  const rootIds: string[] = [];
  const childrenByParentId: Record<string, string[]> = {};
  for (const page of pages) {
    if (!page.id) continue;
    const parentId = page.parent ?? null;
    if (parentId && parentById.has(parentId) && !cyclePageIds.has(page.id)) {
      (childrenByParentId[parentId] ??= []).push(page.id);
    } else {
      rootIds.push(page.id);
    }
  }

  return { rootIds, childrenByParentId };
};
