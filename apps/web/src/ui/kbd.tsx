import type { ComponentProps } from "react";

import { cn } from "./cn";

/** A keyboard key or shortcut, e.g. Ctrl K. */
export function Kbd({ className, ...props }: ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 items-center rounded-xs border border-line-strong bg-surface px-1.5 font-mono text-xs leading-none text-muted",
        className,
      )}
      {...props}
    />
  );
}
