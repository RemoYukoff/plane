/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { action, computed, makeObservable, observable, runInAction } from "mobx";
import type { TPage, TPageExtended } from "@plane/types";
import type { CoreRootStore } from "@/store/root.store";
import type { TBasePageServices } from "@/store/pages/base-page";

export type TExtendedPageInstance = TPageExtended & {
  asJSONExtended: TPageExtended;
  setParent: (parentId: string | null) => Promise<void>;
};

export class ExtendedBasePage implements TExtendedPageInstance {
  parent: string | null | undefined;
  private extendedServices: TBasePageServices;

  // oxlint-disable-next-line no-unused-vars
  constructor(store: CoreRootStore, page: TPage, services: TBasePageServices) {
    this.parent = page?.parent ?? null;
    this.extendedServices = services;

    makeObservable(this, {
      parent: observable.ref,
      asJSONExtended: computed,
      setParent: action,
    });
  }

  get asJSONExtended(): TExtendedPageInstance["asJSONExtended"] {
    return {
      parent: this.parent,
    };
  }

  /**
   * @description update the page's parent (nesting) with optimistic update and rollback
   * @param {string | null} parentId
   */
  setParent = async (parentId: string | null) => {
    const previousParent = this.parent;
    runInAction(() => {
      this.parent = parentId;
    });
    try {
      await this.extendedServices.update({ parent: parentId });
    } catch (error) {
      runInAction(() => {
        this.parent = previousParent;
      });
      throw error;
    }
  };
}
