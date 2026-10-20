import { Select as SelectPrimitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "./cn";
import { fieldClasses, useFieldControl } from "./field-control";
import { IconCheck, IconSelect } from "./icons";

export interface SelectOption<TValue extends string = string> {
  value: TValue;
  label: string;
  /** A second line, e.g. a package's items or a location's union. */
  description?: string;
  disabled?: boolean;
}

/**
 * A single choice from a short list, styled like the other fields. For long lists that need typing
 * (locations, packages) use a combobox instead.
 */
export function Select<TValue extends string>({
  value,
  onValueChange,
  options,
  placeholder,
  disabled,
  className,
  id,
  name,
  "aria-label": ariaLabel,
}: {
  value: TValue | undefined;
  onValueChange: (value: TValue) => void;
  options: readonly SelectOption<TValue>[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  "aria-label"?: string;
}) {
  const field = useFieldControl();
  return (
    <SelectPrimitive.Root
      value={value ?? ""}
      onValueChange={(next) => {
        onValueChange(next as TValue);
      }}
      disabled={disabled}
      name={name}
      required={field?.required}
    >
      <SelectPrimitive.Trigger
        id={id ?? field?.id}
        aria-label={ariaLabel}
        aria-describedby={field?.describedBy}
        aria-invalid={field?.invalid ? true : undefined}
        className={cn(
          fieldClasses,
          "flex h-10 items-center justify-between gap-2 px-3 text-left coarse:h-11",
          "data-placeholder:text-muted [&>span]:truncate",
          className,
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon asChild>
          <IconSelect className="size-4 shrink-0 text-muted" aria-hidden="true" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            description={option.description}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </SelectPrimitive.Root>
  );
}

function SelectContent({ children }: { children: ReactNode }) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position="popper"
        sideOffset={6}
        className={cn(
          "z-50 max-h-(--radix-select-content-available-height) min-w-(--radix-select-trigger-width) overflow-hidden",
          "rounded-xl border border-line bg-surface-raised p-1 shadow-raised",
          "origin-(--radix-select-content-transform-origin) data-[state=closed]:animate-popover-out data-[state=open]:animate-popover-in",
        )}
      >
        <SelectPrimitive.Viewport className="max-h-80">{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

function SelectItem({
  className,
  children,
  description,
  ...props
}: ComponentProps<typeof SelectPrimitive.Item> & { description?: string | undefined }) {
  return (
    <SelectPrimitive.Item
      className={cn(
        "relative flex cursor-default flex-col rounded-md py-2 pr-9 pl-3 text-ui outline-none select-none coarse:py-3",
        "data-disabled:opacity-45 data-highlighted:bg-brand-soft data-highlighted:text-brand-strong",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      {description ? <span className="text-xs text-muted">{description}</span> : null}
      <SelectPrimitive.ItemIndicator className="absolute top-2.5 right-2.5">
        <IconCheck className="size-4" aria-hidden="true" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}
