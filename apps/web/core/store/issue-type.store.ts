/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { set, sortBy } from "lodash-es";
import { action, makeObservable, observable, runInAction } from "mobx";
import { computedFn } from "mobx-utils";
// types
import type { TIssueType, TIssueTypePayload } from "@plane/types";
// services
import { IssueTypeService } from "@/services/issue_type.service";
// store
import type { CoreRootStore } from "./root.store";

export interface IIssueTypeStore {
  // observables
  issueTypeMap: Record<string, TIssueType>;
  fetchedMap: Record<string, boolean>;
  // computed actions
  getIssueTypeById: (issueTypeId: string | null | undefined) => TIssueType | undefined;
  getProjectIssueTypes: (projectId: string | null | undefined, includeInactive?: boolean) => TIssueType[];
  getProjectIssueTypeIds: (projectId: string | null | undefined) => string[];
  getProjectDefaultIssueTypeId: (projectId: string | null | undefined) => string | undefined;
  getProjectEpicTypeId: (projectId: string | null | undefined) => string | undefined;
  getWorkspaceIssueTypes: () => TIssueType[];
  isIssueTypeEnabledForProject: (projectId: string | null | undefined) => boolean;
  // fetch actions
  fetchWorkspaceIssueTypes: (workspaceSlug: string) => Promise<TIssueType[]>;
  fetchProjectIssueTypes: (workspaceSlug: string, projectId: string) => Promise<TIssueType[]>;
  // crud actions
  createIssueType: (workspaceSlug: string, projectId: string, data: TIssueTypePayload) => Promise<TIssueType>;
  updateIssueType: (
    workspaceSlug: string,
    projectId: string,
    issueTypeId: string,
    data: TIssueTypePayload
  ) => Promise<TIssueType>;
  removeIssueTypeFromProject: (workspaceSlug: string, projectId: string, issueTypeId: string) => Promise<void>;
  importIssueTypes: (workspaceSlug: string, projectId: string, issueTypeIds: string[]) => Promise<TIssueType[]>;
}

export class IssueTypeStore implements IIssueTypeStore {
  // observables
  issueTypeMap: Record<string, TIssueType> = {};
  fetchedMap: Record<string, boolean> = {};
  // root store
  rootStore;
  // services
  issueTypeService;

  constructor(_rootStore: CoreRootStore) {
    makeObservable(this, {
      issueTypeMap: observable,
      fetchedMap: observable,
      // actions
      fetchWorkspaceIssueTypes: action,
      fetchProjectIssueTypes: action,
      createIssueType: action,
      updateIssueType: action,
      removeIssueTypeFromProject: action,
      importIssueTypes: action,
    });

    this.rootStore = _rootStore;
    this.issueTypeService = new IssueTypeService();
  }

  getIssueTypeById = computedFn((issueTypeId: string | null | undefined): TIssueType | undefined => {
    if (!issueTypeId) return undefined;
    return this.issueTypeMap[issueTypeId];
  });

  /**
   * Types linked to a project, ordered the way they are shown in pickers.
   *
   * Inactive types are left out by default so they stop being offered when
   * creating work items. Settings passes ``includeInactive`` — hiding them
   * there would make deactivating a type look like deleting it, with no way
   * back short of recreating it.
   */
  getProjectIssueTypes = computedFn((projectId: string | null | undefined, includeInactive = false): TIssueType[] => {
    if (!projectId) return [];
    return sortBy(
      Object.values(this.issueTypeMap).filter(
        (issueType) => (includeInactive || issueType.is_active) && issueType.project_ids?.includes(projectId)
      ),
      ["level", "name"]
    );
  });

  getProjectIssueTypeIds = computedFn(
    (projectId: string | null | undefined): string[] =>
      this.getProjectIssueTypes(projectId).map((issueType) => issueType.id) ?? []
  );

  getProjectDefaultIssueTypeId = computedFn((projectId: string | null | undefined): string | undefined => {
    const issueTypes = this.getProjectIssueTypes(projectId);
    // fall back to the first non-epic type so new work items always get a type
    const defaultType = issueTypes.find((issueType) => issueType.is_default && !issueType.is_epic);
    return (defaultType ?? issueTypes.find((issueType) => !issueType.is_epic))?.id;
  });

  getProjectEpicTypeId = computedFn(
    (projectId: string | null | undefined): string | undefined =>
      this.getProjectIssueTypes(projectId).find((issueType) => issueType.is_epic)?.id
  );

  getWorkspaceIssueTypes = computedFn((): TIssueType[] => sortBy(Object.values(this.issueTypeMap), ["level", "name"]));

  /**
   * Whether the project has any type to show. Nothing type related is rendered
   * for a project that has not imported one.
   *
   * Reads ``Project.is_issue_type_enabled``, which the API derives from the
   * links — so this holds before the types themselves have been fetched, and
   * there is no second source of truth to drift.
   */
  isIssueTypeEnabledForProject = computedFn((projectId: string | null | undefined): boolean => {
    if (!projectId) return false;
    return !!this.rootStore.projectRoot.project.getProjectById(projectId)?.is_issue_type_enabled;
  });

  fetchWorkspaceIssueTypes = async (workspaceSlug: string) => {
    const response = await this.issueTypeService.getWorkspaceIssueTypes(workspaceSlug);
    runInAction(() => {
      response.forEach((issueType) => set(this.issueTypeMap, [issueType.id], issueType));
      set(this.fetchedMap, workspaceSlug, true);
    });
    return response;
  };

  fetchProjectIssueTypes = async (workspaceSlug: string, projectId: string) => {
    const response = await this.issueTypeService.getProjectIssueTypes(workspaceSlug, projectId);
    runInAction(() => {
      response.forEach((issueType) => set(this.issueTypeMap, [issueType.id], issueType));
      set(this.fetchedMap, projectId, true);
    });
    return response;
  };

  createIssueType = async (workspaceSlug: string, projectId: string, data: TIssueTypePayload) => {
    const response = await this.issueTypeService.createIssueType(workspaceSlug, projectId, data);
    runInAction(() => {
      set(this.issueTypeMap, [response.id], response);
    });
    return response;
  };

  updateIssueType = async (workspaceSlug: string, projectId: string, issueTypeId: string, data: TIssueTypePayload) => {
    const originalIssueType = this.issueTypeMap[issueTypeId];
    try {
      runInAction(() => {
        set(this.issueTypeMap, [issueTypeId], { ...originalIssueType, ...data });
      });
      const response = await this.issueTypeService.updateIssueType(workspaceSlug, projectId, issueTypeId, data);
      runInAction(() => {
        set(this.issueTypeMap, [issueTypeId], response);
      });
      return response;
    } catch (error) {
      runInAction(() => {
        set(this.issueTypeMap, [issueTypeId], originalIssueType);
      });
      throw error;
    }
  };

  removeIssueTypeFromProject = async (workspaceSlug: string, projectId: string, issueTypeId: string) => {
    await this.issueTypeService.removeIssueTypeFromProject(workspaceSlug, projectId, issueTypeId);
    runInAction(() => {
      const issueType = this.issueTypeMap[issueTypeId];
      if (!issueType) return;
      set(
        this.issueTypeMap,
        [issueTypeId, "project_ids"],
        (issueType.project_ids ?? []).filter((id: string) => id !== projectId)
      );
    });
  };

  importIssueTypes = async (workspaceSlug: string, projectId: string, issueTypeIds: string[]) => {
    const response = await this.issueTypeService.importIssueTypes(workspaceSlug, projectId, issueTypeIds);
    runInAction(() => {
      response.forEach((issueType) => set(this.issueTypeMap, [issueType.id], issueType));
    });
    return response;
  };
}
