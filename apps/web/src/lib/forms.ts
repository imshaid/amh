import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { DefaultValues, FieldError, FieldValues } from "react-hook-form";
import { useTranslation } from "react-i18next";
import type { z } from "zod";

/*
 * Forms are react-hook-form with a zod schema (BLUEPRINT §3). Schemas carry translation keys as
 * their messages, from FORM_ERRORS, and fields show them through useFieldError.
 */

export const FORM_ERRORS = {
  required: "forms.errors.required",
  rate: "forms.errors.rate",
  phone: "forms.errors.phone",
  percent: "forms.errors.percent",
  code: "forms.errors.code",
  itemsRequired: "forms.errors.itemsRequired",
} as const;

export type FormErrorKey = (typeof FORM_ERRORS)[keyof typeof FORM_ERRORS];

/** A form checked by `schema`; errors show once a field has been left, or on sending. */
export function useZodForm<TInput extends FieldValues, TOutput extends FieldValues>(
  schema: z.ZodType<TOutput, TInput>,
  defaultValues: DefaultValues<TInput>,
) {
  return useForm<TInput, unknown, TOutput>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: "onTouched",
  });
}

function isFormErrorKey(message: string): message is FormErrorKey {
  return (Object.values(FORM_ERRORS) as string[]).includes(message);
}

/** Translates a field's error for the Field component's `error`. */
export function useFieldError() {
  const { t } = useTranslation();
  return (error: FieldError | undefined): string | undefined => {
    const message = error?.message;
    if (!message) return error ? t(FORM_ERRORS.required) : undefined;
    return isFormErrorKey(message) ? t(message) : message;
  };
}
