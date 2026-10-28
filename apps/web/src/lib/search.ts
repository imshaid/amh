import { toLatinDigits } from "@/i18n/format";

/** Text as searches compare it: Latin digits, composed Bangla, lower case. */
export function searchable(text: string): string {
  return toLatinDigits(text).normalize("NFC").toLowerCase();
}

/**
 * Whether every word typed appears somewhere in the texts, in either language and with either
 * digit set ("৪৩০" finds 430). Plain substring matching, because fuzzy scoring is unreliable on
 * Bangla's combining marks.
 */
export function matchesAllWords(search: string, texts: readonly string[]): boolean {
  const words = searchable(search).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = searchable(texts.join(" "));
  return words.every((word) => haystack.includes(word));
}
