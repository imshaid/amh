import { createContext, useContext } from "react";

import { cn } from "./cn";

export interface FieldContextValue {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
  required: boolean;
}

export const FieldContext = createContext<FieldContextValue | null>(null);

/** Lets a control inside a Field pick up its id, description and error state. */
export function useFieldControl(): FieldContextValue | null {
  return useContext(FieldContext);
}

/** The surrounding Field's id, description and error state, unless the control's props set them. */
export function useFieldProps(props: {
  id?: string | undefined;
  "aria-describedby"?: string | undefined;
}) {
  const field = useFieldControl();
  return {
    id: props.id ?? field?.id,
    "aria-describedby": props["aria-describedby"] ?? field?.describedBy,
    "aria-invalid": field?.invalid ? true : undefined,
    required: field?.required,
  };
}

/** Shared look of every text-like control: a 3:1 edge, an inset brand ring on focus. */
export const fieldClasses = cn(
  "w-full min-w-0 rounded-lg border border-field bg-surface text-input text-ink",
  "placeholder:text-muted transition-[border-color,box-shadow] duration-150",
  "hover:border-ink-2/70 focus-visible:border-brand focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-brand",
  "disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted",
  "aria-invalid:border-crit aria-invalid:focus-visible:outline-crit",
);
