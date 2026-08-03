/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TLogoProps } from "../common";

/**
 * A work item type. Types are workspace owned and become usable inside a
 * project through the project link, which is what `project_ids` reflects.
 */
export type TIssueType = {
  id: string;
  name: string;
  description: string;
  logo_props: TLogoProps;
  is_epic: boolean;
  is_default: boolean;
  is_active: boolean;
  level: number;
  external_source: string | null;
  external_id: string | null;
  project_ids: string[];
  workspace: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
};

/** Payload accepted when creating or updating a work item type. */
export type TIssueTypePayload = Partial<
  Pick<TIssueType, "name" | "description" | "logo_props" | "is_epic" | "is_active" | "is_default" | "level">
> & {
  project_ids?: string[];
};
