import { useTranslation } from "react-i18next";

import { useLanguage } from "@/i18n/hooks";
import { setLanguage } from "@/i18n/i18n";
import { LANGUAGES } from "@/i18n/languages";
import { THEME_PREFERENCES, useThemePreference } from "@/lib/theme";
import type { ThemePreference } from "@/lib/theme";

export function LanguageSwitch() {
  const { t } = useTranslation();
  const current = useLanguage();
  return (
    <div
      role="group"
      aria-label={t("preferences.language")}
      className="flex rounded-[10px] border border-line bg-surface p-0.5"
    >
      {LANGUAGES.map((language) => (
        <button
          key={language}
          type="button"
          lang={language}
          aria-pressed={current === language}
          onClick={() => void setLanguage(language)}
          className="rounded-lg px-2.5 py-1 text-[13px] font-semibold text-muted aria-pressed:bg-brand aria-pressed:text-brand-ink"
        >
          {t(`preferences.languageNames.${language}`)}
        </button>
      ))}
    </div>
  );
}

export function ThemeSelect() {
  const { t } = useTranslation();
  const [preference, setPreference] = useThemePreference();
  return (
    <select
      aria-label={t("preferences.theme")}
      value={preference}
      onChange={(event) => {
        setPreference(event.target.value as ThemePreference);
      }}
      className="rounded-[10px] border border-line bg-surface px-2 py-1.5 text-[13px] font-semibold text-ink-2"
    >
      {THEME_PREFERENCES.map((option) => (
        <option key={option} value={option}>
          {t(`preferences.themes.${option}`)}
        </option>
      ))}
    </select>
  );
}
