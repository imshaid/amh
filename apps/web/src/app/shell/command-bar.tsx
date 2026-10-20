import { useNavigate } from "@tanstack/react-router";
import { Command } from "cmdk";
import type { ParseKeys } from "i18next";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { NAV_ITEMS } from "@/app/navigation";
import { useLanguage } from "@/i18n/hooks";
import { i18n, setLanguage } from "@/i18n/i18n";
import { setThemePreference, THEME_PREFERENCES } from "@/lib/theme";
import { cn } from "@/ui/cn";
import {
  IconDark,
  IconDevice,
  IconEnterKey,
  IconGallery,
  IconLanguage,
  IconLight,
  IconPlus,
  IconSearch,
} from "@/ui/icons";
import type { IconComponent } from "@/ui/icons";
import { Kbd } from "@/ui/kbd";

import { commandBar, useCommandBarOpen } from "./command-bar-store";
import { matchCommand } from "./command-filter";

const THEME_ICONS = { system: IconDevice, light: IconLight, dark: IconDark } as const;

/** Both languages' names, so English words find items in Bangla mode and the other way round. */
function bothLanguages(key: ParseKeys): string[] {
  return [i18n.t(key, { lng: "bn" }), i18n.t(key, { lng: "en" })];
}

function Item({
  value,
  keywords,
  icon: Icon,
  onSelect,
  children,
}: {
  value: string;
  keywords?: string[];
  icon: IconComponent;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <Command.Item
      value={value}
      keywords={keywords}
      onSelect={() => {
        commandBar.close();
        onSelect();
      }}
      className={cn(
        "group flex h-11 cursor-default items-center gap-3 rounded-lg px-3 text-base text-ink select-none",
        "data-[selected=true]:bg-brand-soft data-[selected=true]:text-brand-strong",
      )}
    >
      <Icon
        className="size-4.5 shrink-0 text-muted group-data-[selected=true]:text-brand-strong"
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </Command.Item>
  );
}

function Group({ heading, children }: { heading: string; children: ReactNode }) {
  return <Command.Group heading={heading}>{children}</Command.Group>;
}

/**
 * Ctrl+K (⌘K on a Mac): jump to any screen or run an everyday action by typing. Searching orders,
 * prices and locations joins it as those screens are built; the AI assistant lives here later.
 */
export function CommandBar() {
  const { t } = useTranslation();
  const open = useCommandBarOpen();
  const navigate = useNavigate();
  const language = useLanguage();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        commandBar.setOpen(!open);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const otherLanguage = language === "bn" ? "en" : "bn";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={commandBar.setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            "fixed top-[10dvh] left-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden",
            "rounded-2xl border border-line bg-surface-raised shadow-raised",
            "data-[state=closed]:animate-pop-out data-[state=open]:animate-pop-in",
          )}
        >
          <DialogPrimitive.Title className="sr-only">{t("commandBar.title")}</DialogPrimitive.Title>
          <Command label={t("commandBar.title")} filter={matchCommand} loop>
            <div className="flex items-center gap-3 border-b border-line px-4">
              <IconSearch className="size-5 shrink-0 text-muted" aria-hidden="true" />
              <Command.Input
                placeholder={t("commandBar.placeholder")}
                className="h-14 w-full min-w-0 bg-transparent text-lg text-ink outline-none placeholder:text-muted"
              />
            </div>
            <Command.List className="max-h-[min(26rem,55dvh)] overflow-y-auto overscroll-contain p-1.5">
              <Command.Empty className="px-3 py-6 text-sm text-muted">
                <p className="font-semibold text-ink-2">{t("commandBar.empty")}</p>
                <p className="mt-1">{t("commandBar.comingSoon")}</p>
              </Command.Empty>
              <Group heading={t("commandBar.groups.pages")}>
                {NAV_ITEMS.map((item) => (
                  <Item
                    key={item.to}
                    value={`page:${item.to}`}
                    keywords={[...bothLanguages(item.label), item.to]}
                    icon={item.icon}
                    onSelect={() => void navigate({ to: item.to })}
                  >
                    {t(item.label)}
                  </Item>
                ))}
                <Item
                  value="page:/dev/gallery"
                  keywords={[...bothLanguages("nav.gallery"), "gallery", "design"]}
                  icon={IconGallery}
                  onSelect={() => void navigate({ to: "/dev/gallery" })}
                >
                  {t("nav.gallery")}
                </Item>
              </Group>
              <Group heading={t("commandBar.groups.actions")}>
                <Item
                  value="action:new-order"
                  keywords={bothLanguages("commandBar.actions.newOrder")}
                  icon={IconPlus}
                  onSelect={() => void navigate({ to: "/new" })}
                >
                  {t("commandBar.actions.newOrder")}
                </Item>
                <Item
                  value="action:language"
                  keywords={[...bothLanguages("preferences.language"), "bangla", "english"]}
                  icon={IconLanguage}
                  onSelect={() => void setLanguage(otherLanguage)}
                >
                  {t(`commandBar.actions.switchLanguage.${otherLanguage}`)}
                </Item>
                {THEME_PREFERENCES.map((theme) => (
                  <Item
                    key={theme}
                    value={`action:theme-${theme}`}
                    keywords={[
                      ...bothLanguages("preferences.theme"),
                      ...bothLanguages(`preferences.themes.${theme}`),
                    ]}
                    icon={THEME_ICONS[theme]}
                    onSelect={() => {
                      setThemePreference(theme);
                    }}
                  >
                    {t("commandBar.actions.theme", { theme: t(`preferences.themes.${theme}`) })}
                  </Item>
                ))}
              </Group>
            </Command.List>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line bg-surface-2 px-4 py-2.5 text-xs text-muted max-sm:hidden">
              <span className="flex items-center gap-1.5">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd>
                {t("commandBar.hints.move")}
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd>
                  <IconEnterKey className="size-3" aria-hidden="true" />
                </Kbd>
                {t("commandBar.hints.open")}
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd>{t("commandBar.hints.escKey")}</Kbd>
                {t("commandBar.hints.close")}
              </span>
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
