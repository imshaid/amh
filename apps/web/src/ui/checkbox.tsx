import { Checkbox as CheckboxPrimitive } from "radix-ui";
import { useId } from "react";

import { cn } from "./cn";
import { IconCheck } from "./icons";

/** A yes/no choice with its label and an optional hint; the whole label is a large tap target. */
export function Checkbox({
  label,
  hint,
  checked,
  onCheckedChange,
  disabled,
  className,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <CheckboxPrimitive.Root
        id={id}
        checked={checked}
        onCheckedChange={(state) => {
          onCheckedChange(state === true);
        }}
        disabled={disabled}
        aria-describedby={hintId}
        className={cn(
          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-[5px] border border-field bg-surface transition-colors duration-150 coarse:size-6",
          "hover:border-ink-2/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
          "disabled:opacity-45 data-[state=checked]:border-brand data-[state=checked]:bg-brand",
        )}
      >
        <CheckboxPrimitive.Indicator>
          <IconCheck
            className="size-3.5 text-brand-ink coarse:size-4"
            strokeWidth={3}
            aria-hidden="true"
          />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      <div className="min-w-0">
        <label htmlFor={id} className="cursor-pointer font-medium text-ink">
          {label}
        </label>
        {hint ? (
          <p id={hintId} className="mt-0.5 text-sm text-muted">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}
