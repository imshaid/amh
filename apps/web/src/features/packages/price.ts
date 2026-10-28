import { toLatinDigits } from "@/i18n/format";

/*
 * Packages are known by price (BLUEPRINT §2.3): "৫২০ টাকার লাঞ্চ", "Lunch-430". These helpers read
 * prices as people type them and compare rates as exact decimal strings; nothing here calculates
 * money.
 */

const RATE_PATTERN = /^\d{1,8}(\.\d{1,2})?$/;

function stripLeadingZeros(digits: string): string {
  return digits.replace(/^0+(?=\d)/, "");
}

/** A rate as typed: "৩৫৫", "355.5", "৳ 1,200", "৫২০ টাকা" -> "355", "355.5", "1200", "520". */
export function parseRate(input: string): string | null {
  const text = toLatinDigits(input)
    .trim()
    .replace(/(টাকা|taka|tk\.?)$/i, "")
    .replace(/[৳,\s]/g, "");
  return RATE_PATTERN.test(text) ? stripLeadingZeros(text) : null;
}

/** A rate read from a spreadsheet number; null when it has more than two decimals. */
export function rateFromNumber(value: number): string | null {
  if (!Number.isFinite(value) || value < 0) return null;
  // Fifteen significant digits drop binary noise (19.990000000000002 -> 19.99) without rounding
  // anything a person typed.
  let text = value.toPrecision(15);
  if (text.includes(".") && !text.includes("e")) text = text.replace(/0+$/, "").replace(/\.$/, "");
  return RATE_PATTERN.test(text) ? text : null;
}

/** The same price written differently ("60", "60.0", "60.00") gets the same key: "60.00". */
export function rateKey(rate: string): string {
  const [whole = "0", fraction = ""] = rate.split(".");
  return `${stripLeadingZeros(whole)}.${fraction.padEnd(2, "0").slice(0, 2)}`;
}

/** The taka of a rate: "355.50" -> "355". */
export function wholeTaka(rate: string): string {
  return stripLeadingZeros(rate.split(".")[0] ?? rate);
}

/** The digits of a search that is a price ("৪৩০", "৳430"), or null for a search by name. */
export function priceSearch(search: string): string | null {
  const text = toLatinDigits(search).replace(/[৳,\s]/g, "");
  return /^\d+$/.test(text) ? stripLeadingZeros(text) : null;
}

/** How a rate meets a typed price: exactly, as the start of a longer price, or not at all. */
export function priceMatch(rate: string, digits: string): "exact" | "prefix" | null {
  const whole = wholeTaka(rate);
  if (whole === digits) return "exact";
  return whole.startsWith(digits) ? "prefix" : null;
}

/** The rates that two or more active packages share: picking by price must then ask. */
export function sharedRates(packages: readonly { rate: string; active: boolean }[]): Set<string> {
  const counts = new Map<string, number>();
  for (const item of packages) {
    if (!item.active) continue;
    const key = rateKey(item.rate);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return new Set([...counts].filter(([, count]) => count > 1).map(([key]) => key));
}
