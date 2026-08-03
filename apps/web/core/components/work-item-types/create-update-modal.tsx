/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { EmojiIconPickerTypes, EmojiPicker, Logo } from "@plane/propel/emoji-icon-picker";
import { setToast, TOAST_TYPE } from "@plane/propel/toast";
import type { TIssueType, TIssueTypePayload, TLogoProps } from "@plane/types";
import { EModalPosition, EModalWidth, Input, ModalCore } from "@plane/ui";
// hooks
import { useIssueType } from "@/hooks/store/use-issue-type";

const DEFAULT_LOGO_PROPS: TLogoProps = {
  in_use: "icon",
  icon: { name: "widgets" },
};

type TCreateUpdateIssueTypeModalProps = {
  isOpen: boolean;
  handleClose: () => void;
  /** the type being edited, or undefined when creating a new one */
  data?: TIssueType;
};

type TIssueTypeFormValues = {
  name: string;
  description: string;
  logo_props: TLogoProps;
  is_epic: boolean;
};

export const CreateUpdateIssueTypeModal = observer(function CreateUpdateIssueTypeModal(
  props: TCreateUpdateIssueTypeModalProps
) {
  const { isOpen, handleClose, data } = props;
  // router
  const { workspaceSlug, projectId } = useParams();
  // i18n
  const { t } = useTranslation();
  // states
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  // store hooks
  const { createIssueType, updateIssueType } = useIssueType();
  // form
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    reset,
  } = useForm<TIssueTypeFormValues>({
    defaultValues: {
      name: "",
      description: "",
      logo_props: DEFAULT_LOGO_PROPS,
      is_epic: false,
    },
  });

  useEffect(() => {
    if (!isOpen) return;
    reset({
      name: data?.name ?? "",
      description: data?.description ?? "",
      logo_props: data?.logo_props?.in_use ? data.logo_props : DEFAULT_LOGO_PROPS,
      is_epic: data?.is_epic ?? false,
    });
  }, [isOpen, data, reset]);

  const onClose = () => {
    handleClose();
    setIsEmojiPickerOpen(false);
  };

  const handleFormSubmit = async (formData: TIssueTypeFormValues) => {
    if (!workspaceSlug || !projectId) return;

    const payload: TIssueTypePayload = {
      name: formData.name.trim(),
      description: formData.description,
      logo_props: formData.logo_props,
    };

    try {
      if (data) {
        await updateIssueType(workspaceSlug.toString(), projectId.toString(), data.id, payload);
      } else {
        // is_epic is fixed at creation: an existing type cannot change kind
        await createIssueType(workspaceSlug.toString(), projectId.toString(), {
          ...payload,
          is_epic: formData.is_epic,
        });
      }
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: t("common.success"),
        message: data ? "Work item type updated successfully." : "Work item type created successfully.",
      });
      onClose();
    } catch (error) {
      const errorMessage = (error as { error?: string })?.error;
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("common.error"),
        message: errorMessage ?? "Something went wrong. Please try again.",
      });
    }
  };

  return (
    <ModalCore isOpen={isOpen} handleClose={onClose} position={EModalPosition.CENTER} width={EModalWidth.XXL}>
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <div className="space-y-4 p-5">
          <h3 className="text-h4-medium text-primary">{data ? "Update work item type" : "Create work item type"}</h3>
          <div className="flex items-start gap-2">
            <Controller
              control={control}
              name="logo_props"
              render={({ field: { value, onChange } }) => (
                <EmojiPicker
                  iconType="material"
                  isOpen={isEmojiPickerOpen}
                  handleToggle={(val: boolean) => setIsEmojiPickerOpen(val)}
                  className="flex items-center justify-center"
                  buttonClassName="flex items-center justify-center"
                  label={
                    <span className="grid size-9 place-items-center rounded-md border border-subtle bg-layer-2">
                      <Logo logo={value} size={18} />
                    </span>
                  }
                  onChange={(val: { type: "emoji" | "icon"; value: unknown }) => {
                    const logoValue = val?.type === "emoji" ? { value: val.value } : val.value;
                    onChange({ in_use: val?.type, [val?.type]: logoValue });
                    setIsEmojiPickerOpen(false);
                  }}
                  defaultIconColor={value?.in_use === "icon" ? value.icon?.color : undefined}
                  defaultOpen={value?.in_use === "emoji" ? EmojiIconPickerTypes.EMOJI : EmojiIconPickerTypes.ICON}
                />
              )}
            />
            <div className="flex-grow space-y-1">
              <Controller
                control={control}
                name="name"
                rules={{
                  required: "Name is required",
                  maxLength: { value: 255, message: "Name should be less than 255 characters" },
                }}
                render={({ field: { value, onChange, ref } }) => (
                  <Input
                    id="name"
                    type="text"
                    value={value}
                    onChange={onChange}
                    ref={ref}
                    hasError={!!errors.name}
                    placeholder="Name"
                    className="w-full"
                    autoFocus
                  />
                )}
              />
              {errors.name && <p className="text-caption-sm-regular text-danger-primary">{errors.name.message}</p>}
            </div>
          </div>
          <Controller
            control={control}
            name="description"
            render={({ field: { value, onChange } }) => (
              <Input
                id="description"
                type="text"
                value={value}
                onChange={onChange}
                placeholder="Description (optional)"
                className="w-full"
              />
            )}
          />
          {!data && (
            <Controller
              control={control}
              name="is_epic"
              render={({ field: { value, onChange } }) => (
                <label className="flex items-center gap-2 text-body-xs-regular text-secondary">
                  <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
                  <span>Epic — work items of this type group other work items. This cannot be changed later.</span>
                </label>
              )}
            />
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t-[0.5px] border-subtle px-5 py-4">
          <Button variant="secondary" size="sm" onClick={onClose} type="button">
            {t("common.cancel")}
          </Button>
          <Button variant="primary" size="sm" type="submit" loading={isSubmitting}>
            {data
              ? isSubmitting
                ? t("common.updating")
                : t("common.update")
              : isSubmitting
                ? t("common.creating")
                : t("common.create")}
          </Button>
        </div>
      </form>
    </ModalCore>
  );
});
