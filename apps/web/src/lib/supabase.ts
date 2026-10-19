import { createClient } from "@supabase/supabase-js";

import { clientEnv } from "./env";
import type { ClientEnv } from "./env";

// Segment 2 adds the generated `Database` type as createClient's type parameter.
export function createSupabaseClient(env: ClientEnv) {
  return createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

export type AppSupabaseClient = ReturnType<typeof createSupabaseClient>;

let client: AppSupabaseClient | undefined;

/** The app's single Supabase client. Throws if the backend is not configured. */
export function getSupabase(): AppSupabaseClient {
  if (!clientEnv.ok) {
    throw new Error(`Supabase is not configured: ${clientEnv.issues.join("; ")}`);
  }
  client ??= createSupabaseClient(clientEnv.env);
  return client;
}
