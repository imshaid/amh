import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "./cn";
import { fieldClasses, useFieldProps } from "./field-control";
import { IconClose, IconSearch } from "./icons";

export function Input({ className, ...props }: ComponentProps<"input">) {
  const fieldProps = useFieldProps(props);
  return (
    <input
      className={cn(fieldClasses, "h-10 px-3 coarse:h-11", className)}
      {...fieldProps}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  const fieldProps = useFieldProps(props);
  return (
    <textarea
      className={cn(fieldClasses, "min-h-24 resize-y px-3 py-2", className)}
      {...fieldProps}
      {...props}
    />
  );
}

/**
 * A search box with a leading icon and a clear button. Controlled: pass `value` and `onValueChange`.
 */
export function SearchInput({
  className,
  value,
  onValueChange,
  ...props
}: Omit<ComponentProps<"input">, "value" | "onChange" | "type"> & {
  value: string;
  onValueChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const fieldProps = useFieldProps(props);
  return (
    <div className={cn("relative min-w-0", className)}>
      <IconSearch
        className="pointer-events-none absolute top-1/2 left-3 size-4.5 -translate-y-1/2 text-muted"
        aria-hidden="true"
      />
      <input
        type="search"
        className={cn(
          fieldClasses,
          "h-10 pr-10 pl-9.5 coarse:h-11 [&::-webkit-search-cancel-button]:appearance-none",
        )}
        value={value}
        onChange={(event) => {
          onValueChange(event.target.value);
        }}
        {...fieldProps}
        {...props}
      />
      {value ? (
        <button
          type="button"
          className="absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink coarse:size-9"
          aria-label={t("ui.clearSearch")}
          onClick={() => {
            onValueChange("");
          }}
        >
          <IconClose className="size-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
