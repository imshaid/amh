import { Link, Outlet } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { NAV_GROUPS, NAV_ITEMS } from "../navigation";
import { LanguageSwitch, ThemeSelect } from "./preference-controls";

/*
 * Foundation shell: routing, landmarks and preferences. Segment 1 replaces the look with the
 * designed sidebar, top bar, phone bottom bar and command bar.
 */

function Brand() {
  const { t } = useTranslation();
  return (
    <Link to="/" className="flex items-center gap-2.5 rounded-lg px-1 py-0.5">
      <span
        aria-hidden="true"
        className="grid size-9.5 shrink-0 place-items-center rounded-[10px] bg-brand font-display text-[13px] font-bold text-brand-ink"
      >
        AMH
      </span>
      {/* On phones the controls need the room; the name stays available to screen readers. */}
      <span className="flex min-w-0 flex-col leading-tight max-sm:sr-only">
        <span className="truncate font-display text-[17px] font-semibold">{t("app.name")}</span>
        <span className="truncate text-xs text-muted">{t("app.tagline")}</span>
      </span>
    </Link>
  );
}

const linkClass =
  "block rounded-[9px] px-2.5 py-2 font-medium whitespace-nowrap text-ink-2 hover:bg-surface-2 hover:text-ink aria-[current=page]:bg-brand-soft aria-[current=page]:text-brand-strong";

function SideNav() {
  const { t } = useTranslation();
  return (
    <nav aria-label={t("nav.label")} className="flex flex-col gap-4">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          <p className="px-2.5 pb-1 text-[11px] tracking-[0.08em] text-muted uppercase">
            {t(group.label)}
          </p>
          {group.items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.exact }}
              className={linkClass}
            >
              {t(item.label)}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}

function PhoneNav() {
  const { t } = useTranslation();
  return (
    <nav aria-label={t("nav.label")} className="px-2 pb-2">
      <div className="flex flex-wrap gap-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: item.exact }}
            className={linkClass}
          >
            {t(item.label)}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function AppShell() {
  const { t } = useTranslation();
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-surface px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {t("nav.skipToContent")}
      </a>
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 overflow-y-auto border-r border-line bg-surface px-3 py-5 md:flex">
        <Brand />
        <SideNav />
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="z-30 border-b border-line bg-bg/85 backdrop-blur-md md:sticky md:top-0">
          <div className="flex items-center gap-3 px-4 py-2.5 md:px-7">
            <div className="min-w-0 md:hidden">
              <Brand />
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <LanguageSwitch />
              <ThemeSelect />
            </div>
          </div>
          <div className="md:hidden">
            <PhoneNav />
          </div>
        </header>
        <main id="main" tabIndex={-1} className="w-full max-w-360 px-4 pt-6 pb-14 md:px-7">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
