import { useTranslation } from "react-i18next";

import { IconButton } from "@/ui/button";
import { cn } from "@/ui/cn";
import { IconSearch } from "@/ui/icons";
import { Kbd } from "@/ui/kbd";

import { commandBar } from "./command-bar-store";
import { LiveIndicator } from "./live-indicator";
import { useCurrentPageTitle } from "./page-title-context";
import { LanguageSwitch, ThemeMenu } from "./preference-controls";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/** Sticky across the top: where you are, search, whether you are live, and your preferences. */
export function TopBar() {
  const { t } = useTranslation();
  const title = useCurrentPageTitle();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="flex h-15 items-center gap-2.5 px-4 sm:px-6 lg:px-7">
        <p
          className="min-w-0 flex-1 truncate font-display text-lg font-semibold"
          aria-hidden="true"
        >
          {title}
        </p>
        <div className="relative hidden lg:block">
          <button
            type="button"
            onClick={commandBar.open}
            aria-keyshortcuts="Control+K Meta+K"
            className={cn(
              "flex h-10 w-64 items-center gap-2 rounded-lg border border-line bg-surface pr-16 pl-3 text-ui text-muted transition-colors duration-150 xl:w-72",
              "hover:border-line-strong hover:text-ink-2",
            )}
          >
            <IconSearch className="size-4.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-left">{t("shell.searchHint")}</span>
          </button>
          {/* Decorative: aria-keyshortcuts already tells assistive technology. */}
          <Kbd
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2"
          >
            {isMac ? t("shell.shortcutMac") : t("shell.shortcut")}
          </Kbd>
        </div>
        <IconButton
          label={t("shell.search")}
          icon={IconSearch}
          onClick={commandBar.open}
          aria-keyshortcuts="Control+K Meta+K"
          className="lg:hidden"
        />
        <LiveIndicator className="px-1" />
        <LanguageSwitch />
        <ThemeMenu />
      </div>
    </header>
  );
}
