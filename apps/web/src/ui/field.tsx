import { useId } from "react";
import type { ReactNode } from "react";

import { cn } from "./cn";
import { FieldContext } from "./field-control";
import { IconError } from "./icons";

/**
 * A labelled form control with an optional hint and error. The control inside (Input, Textarea,
 * Select) is wired to the label, hint and error automatically.
 */
export function Field({
  label,
  hint,
  error,
  required = false,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <FieldContext value={{ id, describedBy, invalid: Boolean(error), required }}>
      <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
        <label htmlFor={id} className="text-sm font-medium text-ink-2">
          {label}
          {/* The control's required attribute tells screen readers; the star is for the eye. */}
          {required ? (
            <span className="ml-1 text-crit-ink" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
        {children}
        {error ? (
          <p id={errorId} className="flex items-start gap-1.5 text-sm text-crit-ink">
            <IconError className="mt-0.5 size-4" aria-hidden="true" />
            {error}
          </p>
        ) : null}
        {hint ? (
          <p id={hintId} className="text-sm text-muted">
            {hint}
          </p>
        ) : null}
      </div>
    </FieldContext>
  );
}
