/*
 * The house style for item lines (BLUEPRINT §2): one food per line, "Name (variety/brand) —
 * quantity"; units g, ml, L, pc/pcs; ± after approximate amounts; options separated by " / ".
 * These hints never block saving; they only point out what does not follow the style.
 */

export type ItemStyleHint = "separator" | "units" | "approx";

const LONG_UNITS = /\b(grams?|gms?|gm|kgs|litres?|liters?|ltrs?|pieces?|piece|pcs\.|nos?)\b/i;
const OLD_APPROX = /\+\s*\/\s*-|\(\s*±\s*\)/;

export function itemStyleHints(line: string): ItemStyleHint[] {
  const text = line.trim();
  if (text === "") return [];
  const hints: ItemStyleHint[] = [];
  // A quantity with no " — " before it.
  if (/\d/.test(text) && !text.includes(" — ")) hints.push("separator");
  if (LONG_UNITS.test(text)) hints.push("units");
  if (OLD_APPROX.test(text)) hints.push("approx");
  return hints;
}
