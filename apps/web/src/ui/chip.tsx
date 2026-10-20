import { ToggleGroup } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "./cn";
import { useFormat } from "@/i18n/hooks";

/**
 * A row of filter chips where exactly one is chosen (status filter, day filter). Arrow keys move
 * between chips; the chosen chip is filled with ink so it reads at a glance.
 */
export function ChipGroup<TValue extends string>({
  value,
  onValueChange,
  label,
  className,
  children,
}: {
  value: TValue;
  onValueChange: (value: TValue) => void;
  /** Names the group for screen readers, e.g. "Filter by status". */
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(next) => {
        // A single-choice filter always has a choice: ignore the press that would clear it.
        if (next) onValueChange(next as TValue);
      }}
      aria-label={label}
      className={cn("flex flex-wrap gap-1.5", className)}
    >
      {children}
    </ToggleGroup.Root>
  );
}

export function Chip({
  className,
  count,
  children,
  ...props
}: ComponentProps<typeof ToggleGroup.Item> & {
  /** How many items the chip would show, e.g. orders in this status. */
  count?: number;
}) {
  const { number } = useFormat();
  return (
    <ToggleGroup.Item
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3 text-sm font-medium whitespace-nowrap text-ink-2",
        "transition-colors duration-150 hover:border-ink-2/60 hover:text-ink coarse:h-10 coarse:px-3.5",
        "data-[state=on]:border-ink data-[state=on]:bg-ink data-[state=on]:text-surface",
        className,
      )}
      {...props}
    >
      {children}
      {count === undefined ? null : (
        <span className="font-semibold tabular opacity-70">{number(count)}</span>
      )}
    </ToggleGroup.Item>
  );
}
