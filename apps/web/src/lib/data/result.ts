import type { PostgrestError } from "@supabase/supabase-js";

/** A failed database request, thrown so TanStack Query and mutations see it as an error. */
export class DataError extends Error {
  readonly postgrest: PostgrestError;

  constructor(postgrest: PostgrestError) {
    super(postgrest.message);
    this.name = "DataError";
    this.postgrest = postgrest;
  }
}

type Result<T> = { data: T; error: null } | { data: null; error: PostgrestError };

/** The data of a Supabase result, or a thrown DataError. */
export function unwrap<T>(result: Result<T>): T {
  if (result.error) throw new DataError(result.error);
  return result.data;
}

/** Like `unwrap`, for writes that return nothing worth keeping. */
export function check(result: { error: PostgrestError | null }): void {
  if (result.error) throw new DataError(result.error);
}
