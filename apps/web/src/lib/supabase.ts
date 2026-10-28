import { createClient } from "@supabase/supabase-js";

import { sessionStorageAdapter } from "./auth/device-trust";
import type { Database } from "./database.gen";
import { clientEnv } from "./env";
import type { ClientEnv } from "./env";

export function createSupabaseClient(env: ClientEnv) {
  return createClient<Database>(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Members sign in with a PIN through member-auth, never through a link.
      detectSessionInUrl: false,
      storage: sessionStorageAdapter,
      storageKey: "amh:session",
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
