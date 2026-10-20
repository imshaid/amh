import { useTranslation } from "react-i18next";

import { useLanguage } from "@/i18n/hooks";
import { setLanguage } from "@/i18n/i18n";
import { LANGUAGES } from "@/i18n/languages";
import { THEME_PREFERENCES, useThemePreference } from "@/lib/theme";
import type { ThemePreference } from "@/lib/theme";
import { Button } from "@/ui/button";
import { cn } from "@/ui/cn";
import { IconDark, IconDevice, IconLight } from "@/ui/icons";
import type { IconComponent } from "@/ui/icons";
import {
  Menu,
  MenuContent,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
} from "@/ui/menu";

/** বাং | EN: the language switch, one press away on every screen. */
export function LanguageSwitch({ className }: { className?: string }) {
  const { t } = useTranslation();
  const current = useLanguage();
  return (
    <div
      role="group"
      aria-label={t("preferences.language")}
      className={cn("flex rounded-lg border border-line bg-surface p-0.5", className)}
    >
      {LANGUAGES.map((language) => (
        <button
          key={language}
          type="button"
          lang={language}
          aria-pressed={current === language}
          aria-label={t(`preferences.languageNames.${language}`)}
          onClick={() => void setLanguage(language)}
          className={cn(
            "h-8 min-w-10 rounded-md px-2 text-sm font-semibold text-muted transition-colors duration-150 coarse:h-9",
            "hover:text-ink aria-pressed:bg-brand aria-pressed:text-brand-ink",
          )}
        >
          {t(`preferences.languageShort.${language}`)}
        </button>
      ))}
    </div>
  );
}

const THEME_ICONS: Record<ThemePreference, IconComponent> = {
  system: IconDevice,
  light: IconLight,
  dark: IconDark,
};

/** The theme menu: follow the device, or always light, or always dark. */
export function ThemeMenu() {
  const { t } = useTranslation();
  const [preference, setPreference] = useThemePreference();
  const Current = THEME_ICONS[preference];
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button
          size="icon"
          aria-label={t("preferences.themeMenu", { theme: t(`preferences.themes.${preference}`) })}
          title={t("preferences.theme")}
        >
          <Current aria-hidden="true" />
        </Button>
      </MenuTrigger>
      <MenuContent>
        <MenuLabel>{t("preferences.theme")}</MenuLabel>
        <MenuRadioGroup
          value={preference}
          onValueChange={(value) => {
            setPreference(value as ThemePreference);
          }}
        >
          {THEME_PREFERENCES.map((option) => {
            const Icon = THEME_ICONS[option];
            return (
              <MenuRadioItem key={option} value={option}>
                <Icon aria-hidden="true" />
                {t(`preferences.themes.${option}`)}
              </MenuRadioItem>
            );
          })}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}
