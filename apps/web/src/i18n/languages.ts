export const LANGUAGES = ["bn", "en"] as const;

export type Language = (typeof LANGUAGES)[number];

/** Bangla is the default for everyone until they choose otherwise (BLUEPRINT §2). */
export const DEFAULT_LANGUAGE: Language = "bn";

/** Also read by public/theme-boot.js, which sets <html lang> before the app loads. */
export const LANGUAGE_STORAGE_KEY = "amh:language";

export function isLanguage(value: unknown): value is Language {
  return value === "bn" || value === "en";
}
