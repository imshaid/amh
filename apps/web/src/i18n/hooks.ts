import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { formatDate, formatMoney, formatNumber, toBanglaDigits } from "./format";
import type { NumericValue } from "./format";
import { DEFAULT_LANGUAGE, isLanguage } from "./languages";
import type { Language } from "./languages";

export function useLanguage(): Language {
  const { i18n } = useTranslation();
  return isLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : DEFAULT_LANGUAGE;
}

/** Formatters bound to the current UI language; Bangla mode shows Bangla digits. */
export function useFormat() {
  const language = useLanguage();
  return useMemo(
    () => ({
      number: (value: NumericValue, fractionDigits?: number) =>
        formatNumber(value, language, fractionDigits),
      money: (value: NumericValue, options?: Parameters<typeof formatMoney>[2]) =>
        formatMoney(value, language, options),
      /** For codes and numbers that are not quantities, e.g. "0047" or a date string. */
      digits: (text: string) => (language === "bn" ? toBanglaDigits(text) : text),
      date: (date: Date, style?: Parameters<typeof formatDate>[2]) =>
        formatDate(date, language, style),
    }),
    [language],
  );
}
