import { Link, useMatchRoute } from "@tanstack/react-router";
import * as m from "motion/react-m";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { BOTTOM_BAR } from "@/app/navigation";
import type { BottomTab } from "@/app/navigation";
import { cn } from "@/ui/cn";
import { IconForward, IconMore, IconPlus, IconSearch } from "@/ui/icons";
import { DURATION, EASE_OUT } from "@/ui/motion/tokens";
import { Sheet } from "@/ui/sheet";

import { commandBar } from "./command-bar-store";
import { SheetMember } from "./member-menu";

const tabClasses =
  "relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl pt-2 pb-1.5 text-xs font-medium text-muted transition-colors duration-150 aria-[current=page]:text-brand-strong";

function Tab({ item }: { item: BottomTab }) {
  const { t } = useTranslation();
  const matchRoute = useMatchRoute();
  const active = Boolean(matchRoute({ to: item.to, fuzzy: !item.exact }));
  const Icon = item.icon;
  return (
    <Link to={item.to} activeOptions={{ exact: item.exact }} className={tabClasses}>
      <span className="relative grid h-7 w-14 place-items-center">
        {active ? (
          <m.span
            layoutId="bottom-bar-active"
            className="absolute inset-0 rounded-full bg-brand-soft"
            transition={{ duration: DURATION.slow, ease: EASE_OUT }}
            aria-hidden="true"
          />
        ) : null}
        <Icon className="relative size-5.5" aria-hidden="true" />
      </span>
      <span className="max-w-full truncate">{t(item.short)}</span>
    </Link>
  );
}

/**
 * The phone's main menu (BLUEPRINT §5.1): Home, Orders, a raised New button in the middle,
 * Receivables, and More for the directories and search.
 */
export function BottomBar({ className }: { className?: string }) {
  const { t } = useTranslation();
  const [moreOpen, setMoreOpen] = useState(false);
  const matchRoute = useMatchRoute();
  const inMore = BOTTOM_BAR.more.some((item) => matchRoute({ to: item.to, fuzzy: true }));

  return (
    <nav
      aria-label={t("nav.label")}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md",
        className,
      )}
    >
      <div className="mx-auto flex max-w-xl items-end px-1.5">
        {BOTTOM_BAR.start.map((item) => (
          <Tab key={item.to} item={item} />
        ))}
        <Link
          to={BOTTOM_BAR.newOrder.to}
          className="group flex min-w-0 flex-1 flex-col items-center gap-1 pb-1.5 text-xs font-semibold text-brand-strong"
        >
          <span className="-mt-5 grid size-13 place-items-center rounded-2xl bg-brand text-brand-ink shadow-fab transition-transform duration-150 group-active:scale-95">
            <IconPlus className="size-6" aria-hidden="true" />
          </span>
          <span>{t("nav.short.new")}</span>
        </Link>
        {BOTTOM_BAR.end.map((item) => (
          <Tab key={item.to} item={item} />
        ))}
        <Sheet
          open={moreOpen}
          onOpenChange={setMoreOpen}
          title={t("nav.more")}
          trigger={
            <button type="button" className={tabClasses} aria-current={inMore ? "page" : undefined}>
              <span className="relative grid h-7 w-14 place-items-center">
                {inMore ? (
                  <m.span
                    layoutId="bottom-bar-active"
                    className="absolute inset-0 rounded-full bg-brand-soft"
                    transition={{ duration: DURATION.slow, ease: EASE_OUT }}
                    aria-hidden="true"
                  />
                ) : null}
                <IconMore className="relative size-5.5" aria-hidden="true" />
              </span>
              <span>{t("nav.short.more")}</span>
            </button>
          }
        >
          <ul className="flex flex-col gap-1">
            {BOTTOM_BAR.more.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={() => {
                      setMoreOpen(false);
                    }}
                    className="flex h-13 items-center gap-3 rounded-xl px-3 text-base font-medium text-ink hover:bg-surface-2 aria-[current=page]:bg-brand-soft aria-[current=page]:text-brand-strong"
                  >
                    <Icon className="size-5 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{t(item.label)}</span>
                    <IconForward className="size-4 shrink-0 text-muted" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
            <li>
              <button
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  commandBar.open();
                }}
                className="flex h-13 w-full items-center gap-3 rounded-xl px-3 text-base font-medium text-ink hover:bg-surface-2"
              >
                <IconSearch className="size-5 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-left">{t("shell.search")}</span>
              </button>
            </li>
          </ul>
          <SheetMember
            onAction={() => {
              setMoreOpen(false);
            }}
          />
        </Sheet>
      </div>
    </nav>
  );
}
