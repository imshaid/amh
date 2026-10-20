import { Link, useMatchRoute } from "@tanstack/react-router";
import * as m from "motion/react-m";
import { useTranslation } from "react-i18next";

import { NAV_GROUPS } from "@/app/navigation";
import { cn } from "@/ui/cn";
import { DURATION, EASE_OUT } from "@/ui/motion/tokens";

import { BrandMark } from "./brand-mark";

/** The hotel's mark and name, linking home. */
export function Brand({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <Link
      to="/"
      className={cn("flex min-w-0 items-center gap-2.5 rounded-lg px-1.5 py-1", className)}
    >
      <BrandMark className="size-9.5" />
      <span className="flex min-w-0 flex-col">
        <span className="font-display text-lg leading-tight font-strong text-balance">
          {t("app.name")}
        </span>
        <span className="truncate text-xs text-muted">{t("app.tagline")}</span>
      </span>
    </Link>
  );
}

/** The wide-screen menu. The highlight slides to the section you open. */
export function Sidebar({ className }: { className?: string }) {
  const { t } = useTranslation();
  const matchRoute = useMatchRoute();
  return (
    <aside
      className={cn(
        "sticky top-0 h-dvh flex-col gap-5 overflow-y-auto border-r border-line bg-surface px-3 py-4.5",
        className,
      )}
    >
      <Brand />
      <nav aria-label={t("nav.label")} className="flex flex-col gap-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-0.5">
            <p className="px-2.5 pb-1 type-overline">{t(group.label)}</p>
            {group.items.map((item) => {
              const active = Boolean(matchRoute({ to: item.to, fuzzy: !item.exact }));
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  activeOptions={{ exact: item.exact }}
                  className={cn(
                    "relative flex h-10 items-center gap-3 rounded-lg px-2.5 font-medium text-ink-2 transition-colors duration-150",
                    "hover:bg-surface-2 hover:text-ink aria-[current=page]:text-brand-strong aria-[current=page]:hover:bg-transparent",
                  )}
                >
                  {active ? (
                    <m.span
                      layoutId="sidebar-active"
                      className="absolute inset-0 rounded-lg bg-brand-soft"
                      transition={{ duration: DURATION.slow, ease: EASE_OUT }}
                      aria-hidden="true"
                    />
                  ) : null}
                  <Icon className="relative size-4.5 shrink-0" aria-hidden="true" />
                  <span className="relative truncate">{t(item.label)}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
