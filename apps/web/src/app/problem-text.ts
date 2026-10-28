import { useTranslation } from "react-i18next";

import { problemOf } from "@/lib/data/problems";

/** Turns any error from the data layer into a sentence that says what happened and what to do. */
export function useProblemText() {
  const { t } = useTranslation();
  return (error: unknown): string => t(`data.problems.${problemOf(error).kind}`);
}
