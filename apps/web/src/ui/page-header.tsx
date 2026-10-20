import type { ReactNode } from "react";

import { cn } from "./cn";

/** The top of a screen: an optional eyebrow, the title (the page's only h1), and its actions. */
export function PageHeader({
  title,
  eyebrow,
  subtitle,
  actions,
  className,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-x-4 gap-y-3", className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="mb-0.5 text-sm text-muted">{eyebrow}</p> : null}
        <h1 className="type-title">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-[68ch] text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
