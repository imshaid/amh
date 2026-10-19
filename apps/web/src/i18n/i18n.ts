import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { DEFAULT_LANGUAGE, isLanguage, LANGUAGE_STORAGE_KEY, LANGUAGES } from "./languages";
import type { Language } from "./languages";
import bn from "./locales/bn.json";
import en from "./locales/en.json";

export const resources = {
  bn: { common: bn },
  en: { common: en },
} as const;

function readStoredLanguage(): Language | null {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguage(stored) ? stored : null;
  } catch {
    return null;
  }
}

// Resources are bundled, so initialisation is synchronous and the first render is translated.
void i18n.use(initReactI18next).init({
  resources,
  lng: readStoredLanguage() ?? DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: LANGUAGES,
  ns: ["common"],
  defaultNS: "common",
  initAsync: false,
  interpolation: {
    // React already escapes rendered strings.
    escapeValue: false,
  },
});

document.documentElement.lang = i18n.language;
i18n.on("languageChanged", (language) => {
  document.documentElement.lang = language;
});

/** Switches the UI language and remembers the choice on this device. */
export async function setLanguage(language: Language): Promise<void> {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Without storage the choice lasts until the page reloads.
  }
  await i18n.changeLanguage(language);
}

export { i18n };
