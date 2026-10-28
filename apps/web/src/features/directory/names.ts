import type { Language } from "@/i18n/languages";

/**
 * A directory name in the interface language. Records keep English (what clients write and what is
 * printed) and Bangla (for the app and datasheets); Bangla mode falls back to English when a
 * record has no Bangla name yet.
 */
export function localName(language: Language, names: { en: string; bn: string }): string {
  return language === "bn" && names.bn.trim() !== "" ? names.bn : names.en;
}
