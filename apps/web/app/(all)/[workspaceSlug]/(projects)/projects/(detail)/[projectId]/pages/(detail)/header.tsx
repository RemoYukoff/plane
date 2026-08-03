/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import { PageIcon } from "@plane/propel/icons";
import type { ICustomSearchSelectOption } from "@plane/types";
import { Breadcrumbs, Header, BreadcrumbNavigationSearchDropdown } from "@plane/ui";
import { getPageName } from "@plane/utils";
// components
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
import { PageAccessIcon } from "@/components/common/page-access-icon";
import { SwitcherIcon, SwitcherLabel } from "@/components/common/switcher-label";
import { PageHeaderActions } from "@/components/pages/header/actions";
import { PageChildPagesDropdown } from "@/components/pages/header/child-pages-dropdown";
import { buildPageTree } from "@/components/pages/list/tree";
import { PageSyncingBadge } from "@/components/pages/header/syncing-badge";
import { CommonProjectBreadcrumbs } from "@/components/breadcrumbs/common";
// hooks
import { useProject } from "@/hooks/store/use-project";
import type { TPageInstance } from "@/store/pages/base-page";
import { useAppRouter } from "@/hooks/use-app-router";
import { EPageStoreType, usePage, usePageStore } from "@/hooks/store";

export interface IPagesHeaderProps {
  showButton?: boolean;
}

const storeType = EPageStoreType.PROJECT;

// cap the switcher indentation so very deep nesting stays readable, mirroring the pages list
const MAX_INDENT_DEPTH = 8;
const INDENT_WIDTH_PX = 12;

export const PageDetailsHeader = observer(function PageDetailsHeader() {
  // router
  const router = useAppRouter();
  const { workspaceSlug, pageId, projectId } = useParams();
  // store hooks
  const { loader } = useProject();
  const { getPageById, getCurrentProjectPageIds } = usePageStore(storeType);
  const page = usePage({
    pageId: pageId?.toString() ?? "",
    storeType,
  });
  // derived values
  const projectPageIds = getCurrentProjectPageIds(projectId?.toString());

  // ancestor chain of the current page, root first; guards against parent cycles
  const ancestorPages: TPageInstance[] = [];
  const visitedPageIds = new Set<string>([pageId?.toString() ?? ""]);
  let ancestorId = page?.parent;
  while (ancestorId && !visitedPageIds.has(ancestorId)) {
    const ancestor = getPageById(ancestorId);
    if (!ancestor) break;
    visitedPageIds.add(ancestorId);
    ancestorPages.unshift(ancestor);
    ancestorId = ancestor.parent;
  }

  const resolvePage = (id: string) => (id === pageId ? page : getPageById(id));
  const pageTree = buildPageTree(
    projectPageIds.map((id) => resolvePage(id)).filter((_page): _page is TPageInstance => !!_page)
  );

  const getPageOption = (id: string, depth = 0): ICustomSearchSelectOption | undefined => {
    const _page = resolvePage(id);
    if (!_page) return undefined;
    return {
      value: _page.id,
      query: getPageName(_page.name),
      content: (
        <div
          className="flex w-full items-center justify-between gap-2"
          style={{ paddingLeft: Math.min(depth, MAX_INDENT_DEPTH) * INDENT_WIDTH_PX }}
        >
          <SwitcherLabel logo_props={_page.logo_props} name={getPageName(_page.name)} LabelIcon={PageIcon} />
          <PageAccessIcon {..._page} />
        </div>
      ),
    };
  };

  // full project switcher in tree order, indented by depth
  const switcherOptions: ICustomSearchSelectOption[] = [];
  const collectSwitcherOptions = (ids: string[], depth: number) => {
    for (const id of ids) {
      const option = getPageOption(id, depth);
      if (option) switcherOptions.push(option);
      collectSwitcherOptions(pageTree.childrenByParentId[id] ?? [], depth + 1);
    }
  };
  collectSwitcherOptions(pageTree.rootIds, 0);

  const getChildOptions = (parentId: string | undefined): ICustomSearchSelectOption[] =>
    (parentId ? (pageTree.childrenByParentId[parentId] ?? []) : [])
      .map((id) => getPageOption(id))
      .filter((option): option is ICustomSearchSelectOption => !!option);

  const childPageOptions = getChildOptions(pageId?.toString());

  const navigateToPage = (id: string) => {
    router.push(`/${workspaceSlug}/projects/${projectId}/pages/${id}`);
  };

  if (!page) return null;

  return (
    <Header>
      <Header.LeftItem>
        <div>
          <Breadcrumbs isLoading={loader === "init-loader"}>
            <CommonProjectBreadcrumbs workspaceSlug={workspaceSlug?.toString()} projectId={projectId?.toString()} />
            <Breadcrumbs.Item
              component={
                <BreadcrumbLink
                  label="Pages"
                  href={`/${workspaceSlug}/projects/${projectId}/pages/`}
                  icon={<PageIcon className="h-4 w-4 text-tertiary" />}
                />
              }
            />

            {ancestorPages.map((ancestor, index) => (
              <Breadcrumbs.Item
                key={ancestor.id}
                showSeparator={false}
                component={
                  <BreadcrumbNavigationSearchDropdown
                    selectedItem={ancestorPages[index + 1]?.id ?? pageId?.toString() ?? ""}
                    navigationItems={getChildOptions(ancestor.id)}
                    onChange={navigateToPage}
                    title={getPageName(ancestor.name)}
                    icon={
                      <Breadcrumbs.Icon>
                        <SwitcherIcon logo_props={ancestor.logo_props} LabelIcon={PageIcon} size={16} />
                      </Breadcrumbs.Icon>
                    }
                    handleOnClick={() => {
                      if (ancestor.id) navigateToPage(ancestor.id);
                    }}
                  />
                }
              />
            ))}

            <Breadcrumbs.Item
              showSeparator={false}
              component={
                <BreadcrumbNavigationSearchDropdown
                  selectedItem={pageId?.toString() ?? ""}
                  navigationItems={switcherOptions}
                  onChange={navigateToPage}
                  title={getPageName(page?.name)}
                  icon={
                    <Breadcrumbs.Icon>
                      <SwitcherIcon logo_props={page.logo_props} LabelIcon={PageIcon} size={16} />
                    </Breadcrumbs.Icon>
                  }
                  isLast
                />
              }
            />

            {childPageOptions.length > 0 && (
              <Breadcrumbs.Item
                showSeparator={false}
                component={<PageChildPagesDropdown options={childPageOptions} onSelect={navigateToPage} />}
              />
            )}
          </Breadcrumbs>
        </div>
      </Header.LeftItem>
      <Header.RightItem>
        <PageSyncingBadge syncStatus={page.isSyncingWithServer} />
        <PageHeaderActions page={page} storeType={storeType} />
      </Header.RightItem>
    </Header>
  );
});
