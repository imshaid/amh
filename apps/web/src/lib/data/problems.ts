import { DataError } from "./result";

/**
 * What went wrong with a database request, in terms a screen can explain (BLUEPRINT §7: say what
 * happened and what to do). Translations live under `data.problems`.
 */
export type ProblemKind =
  /** No internet on this device. */
  | "offline"
  /** The server did not answer. */
  | "unreachable"
  /** A name or code that must be unique is already used (23505). */
  | "duplicate"
  /** Still referred to by orders or documents, so it cannot be deleted (23503). */
  | "inUse"
  /** The database refused the values (a check constraint or a bad value). */
  | "invalid"
  /** The order or bill is issued and locked (AMH01). */
  | "locked"
  /** Not allowed: the session ended or the member was switched off (42501, JWT errors). */
  | "notAllowed"
  | "unknown";

export interface Problem {
  kind: ProblemKind;
  /** The constraint that refused the change, when Postgres names one. */
  constraint?: string;
}

function isOffline(): boolean {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

export function problemOf(error: unknown): Problem {
  if (isOffline()) return { kind: "offline" };
  if (!(error instanceof DataError)) {
    return error instanceof TypeError ? { kind: "unreachable" } : { kind: "unknown" };
  }
  const { code, message } = error.postgrest;
  const constraint = /constraint "([^"]+)"/.exec(message)?.[1];
  const named = constraint ? { constraint } : {};
  switch (code) {
    case "23505":
      return { kind: "duplicate", ...named };
    case "23503":
      return { kind: "inUse", ...named };
    case "23514":
    case "23502":
    case "22P02":
    case "22003":
    case "AMH05":
      return { kind: "invalid", ...named };
    case "AMH01":
    case "AMH02":
      return { kind: "locked" };
    case "42501":
    case "PGRST301":
    case "PGRST303":
      return { kind: "notAllowed" };
    case "":
      // supabase-js reports a failed fetch as an error without a code.
      return { kind: "unreachable" };
    default:
      return { kind: "unknown" };
  }
}
