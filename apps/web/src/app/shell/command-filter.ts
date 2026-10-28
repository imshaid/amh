import { matchesAllWords } from "@/lib/search";

/** The command bar's matching (cmdk's filter): every typed word in the name or keywords. */
export function matchCommand(
  value: string,
  search: string,
  keywords: readonly string[] = [],
): number {
  return matchesAllWords(search, [value, ...keywords]) ? 1 : 0;
}
