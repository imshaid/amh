import { cva } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "./cn";
import { IconError, IconInfo, IconLock, IconSuccess, IconWarning } from "./icons";
import type { IconComponent } from "./icons";

const noteVariants = cva(
  "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm [&>svg]:mt-0.5 [&>svg]:size-4.5 [&>svg]:shrink-0",
  {
    variants: {
      tone: {
        info: "border-line bg-surface-2 text-ink-2 [&>svg]:text-brand",
        locked: "border-line bg-surface-2 text-ink-2 [&>svg]:text-ink-2",
        success: "border-good/35 bg-good-soft text-good-ink",
        warning: "border-warn/50 bg-warn-soft text-warn-ink",
        error: "border-crit/40 bg-crit-soft text-crit-ink",
      },
    },
    defaultVariants: { tone: "info" },
  },
);

type NoteTone = "info" | "locked" | "success" | "warning" | "error";

const NOTE_ICONS: Record<NoteTone, IconComponent> = {
  info: IconInfo,
  locked: IconLock,
  success: IconSuccess,
  warning: IconWarning,
  error: IconError,
};

/** A short message inside a screen: what is true here, or what needs attention. */
export function Note({
  tone = "info",
  className,
  children,
  ...props
}: ComponentProps<"div"> & { tone?: NoteTone }) {
  const Icon = NOTE_ICONS[tone];
  return (
    <div className={cn(noteVariants({ tone }), className)} {...props}>
      <Icon aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
