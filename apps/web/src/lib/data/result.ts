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

type Response = { data: unknown; error: null } | { data: null; error: PostgrestError };

/** What a successful response carries (inferring from both branches would add null). */
type SuccessData<TResponse> = Extract<TResponse, { error: null; data: unknown }>["data"];

/** The data of a Supabase result, or a thrown DataError. */
export function unwrap<TResponse extends Response>(result: TResponse): SuccessData<TResponse> {
  if (result.error) throw new DataError(result.error);
  return result.data;
}

/** Like `unwrap`, for writes that return nothing worth keeping. */
export function check(result: { error: PostgrestError | null }): void {
  if (result.error) throw new DataError(result.error);
}
