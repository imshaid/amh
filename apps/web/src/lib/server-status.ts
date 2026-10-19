import { useQuery } from "@tanstack/react-query";

import { clientEnv } from "./env";
import type { ClientEnv } from "./env";

export type ServerStatus = "notConfigured" | "checking" | "connected" | "unreachable";

/** Asks the Supabase gateway whether Auth is up. Resolves false on any failure. */
export async function checkServerHealth(env: ClientEnv, signal?: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch(new URL("/auth/v1/health", env.VITE_SUPABASE_URL), {
      headers: { apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY },
      signal: signal ?? null,
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function useServerStatus(): ServerStatus {
  const query = useQuery({
    queryKey: ["server-health"],
    queryFn: ({ signal }) => (clientEnv.ok ? checkServerHealth(clientEnv.env, signal) : false),
    enabled: clientEnv.ok,
    refetchInterval: 60_000,
    retry: false,
  });
  if (!clientEnv.ok) return "notConfigured";
  if (query.isPending) return "checking";
  return query.data ? "connected" : "unreachable";
}
