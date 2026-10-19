import type { Language } from "./languages";

/**
 * Display formatting only. Money arrives from the server as exact decimal strings and is never
 * calculated here (BLUEPRINT §2.7).
 */

const LOCALES: Record<Language, string> = {
  // Both use South Asian grouping (1,11,880), as bills and clients do.
  bn: "bn-BD",
  en: "en-IN",
};

const BANGLA_DIGITS = "০১২৩৪৫৬৭৮৯";
const MINUS = "−";
const DECIMAL_PATTERN = /^-?\d+(?:\.\d+)?$/;

/** A number, or an exact decimal string such as "78669.74" from a Postgres `numeric`. */
export type NumericValue = number | string;

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(language: Language, fractionDigits: number): Intl.NumberFormat {
  const key = `${language}:${String(fractionDigits)}`;
  let cached = formatters.get(key);
  if (!cached) {
    cached = new Intl.NumberFormat(LOCALES[language], {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    formatters.set(key, cached);
  }
  return cached;
}

function toDecimalString(value: NumericValue): `${number}` {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new RangeError(`Cannot format ${String(value)}`);
    }
    return `${value}`;
  }
  if (!DECIMAL_PATTERN.test(value)) {
    throw new RangeError(`Not a decimal number: "${value}"`);
  }
  return value as `${number}`;
}

function hasFraction(decimal: string): boolean {
  return /\.\d*[1-9]/.test(decimal);
}

/** Replaces ASCII digits with Bangla digits, leaving everything else as it is. */
export function toBanglaDigits(text: string): string {
  return text.replace(/[0-9]/g, (digit) => BANGLA_DIGITS.charAt(Number(digit)));
}

/** Replaces Bangla digits with ASCII digits, so "৪৩০" can be read as 430. */
export function toLatinDigits(text: string): string {
  return text.replace(/[০-৯]/g, (digit) => String(BANGLA_DIGITS.indexOf(digit)));
}

/** Formats a count or quantity: whole numbers with grouping, in the language's digits. */
export function formatNumber(value: NumericValue, language: Language, fractionDigits = 0): string {
  return formatter(language, fractionDigits).format(toDecimalString(value));
}

/**
 * Formats taka as "৳1,02,620" or "৳৭৮,৬৬৯.৭৪". With `decimals: "auto"` paisa are shown only when
 * the amount has them. Negative amounts read "−৳1,200".
 */
export function formatMoney(
  value: NumericValue,
  language: Language,
  { decimals = "auto" }: { decimals?: "auto" | 0 | 2 } = {},
): string {
  const decimal = toDecimalString(value);
  const negative = decimal.startsWith("-");
  const magnitude = (negative ? decimal.slice(1) : decimal) as `${number}`;
  const digits = decimals === "auto" ? (hasFraction(magnitude) ? 2 : 0) : decimals;
  const isZero = !/[1-9]/.test(magnitude);
  const formatted = formatter(language, digits).format(magnitude);
  return `${negative && !isZero ? MINUS : ""}৳${formatted}`;
}
