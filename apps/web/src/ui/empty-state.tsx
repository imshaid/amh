import type { ReactNode } from "react";

import { cn } from "./cn";
import type { IconComponent } from "./icons";

type EmptyKind = "empty" | "no-results" | "error" | "unavailable";

const ICON_TILE: Record<EmptyKind, string> = {
  /** Nothing here yet: invites the first action. */
  empty: "bg-brand-soft text-brand",
  /** A search or filter found nothing. */
  "no-results": "bg-surface-2 text-muted",
  /** Loading failed: says what happened and offers a retry. */
  error: "bg-crit-soft text-crit-ink",
  /** Not possible right now (offline, server not set up). */
  unavailable: "bg-warn-soft text-warn-ink",
};

/**
 * What a screen or panel shows when it has nothing to show. Every empty state says what happened
 * and what to do next (BLUEPRINT §7). `md` stands alone on a screen; `sm` sits inside a panel or a
 * table.
 */
export function EmptyState({
  icon: Icon,
  title,
  body,
  actions,
  kind = "empty",
  size = "md",
  className,
}: {
  icon: IconComponent;
  title: ReactNode;
  body?: ReactNode;
  actions?: ReactNode;
  kind?: EmptyKind;
  size?: "md" | "sm";
  className?: string;
}) {
  return (
    <div
      role={kind === "error" ? "alert" : undefined}
      className={cn(
        "flex min-w-0 items-start gap-4",
        size === "md"
          ? "flex-col rounded-xl border border-dashed border-line-strong p-5 sm:flex-row sm:p-6"
          : "py-3",
        className,
      )}
    >
      <span
        className={cn(
          "grid shrink-0 place-items-center",
          size === "md" ? "size-12 rounded-xl [&_svg]:size-6" : "size-9 rounded-lg [&_svg]:size-5",
          ICON_TILE[kind],
        )}
      >
        <Icon aria-hidden="true" />
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <p className={size === "md" ? "type-heading" : "font-semibold"}>{title}</p>
        {body ? <p className="max-w-[60ch] text-sm text-ink-2">{body}</p> : null}
        {actions ? <div className="mt-2.5 flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
