import { toLatinDigits } from "@/i18n/format";

function normalize(text: string): string {
  return toLatinDigits(text).normalize("NFC").toLowerCase();
}

/**
 * The command bar's matching: every word typed must appear in the item's name or keywords, in
 * either language and with either digit set ("৪৩০" finds 430). Plain substring matching, because
 * fuzzy scoring is unreliable on Bangla's combining marks.
 */
export function matchCommand(
  value: string,
  search: string,
  keywords: readonly string[] = [],
): number {
  const words = normalize(search).split(/\s+/).filter(Boolean);
  if (words.length === 0) return 1;
  const haystack = normalize([value, ...keywords].join(" "));
  return words.every((word) => haystack.includes(word)) ? 1 : 0;
}
