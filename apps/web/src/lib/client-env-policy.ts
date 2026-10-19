/**
 * What may be compiled into the browser bundle. Used at build time by vite.config.ts and at run
 * time by env.ts. Vite inlines every VITE_* variable into the bundle, so this check has to run at
 * build time: refusing a secret at run time would be too late.
 */

/** The only VITE_* variables the app may read. Each one is public by design. */
export const CLIENT_ENV_KEYS = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"] as const;

export type SupabaseKeyKind = "publishable" | "secret" | "unknown";

function jwtRole(token: string): string | null {
  const parts = token.split(".");
  const payload = parts[1];
  if (parts.length !== 3 || !payload) return null;
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const claims: unknown = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")));
    if (typeof claims === "object" && claims !== null && "role" in claims) {
      return typeof claims.role === "string" ? claims.role : null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Tells a browser-safe Supabase key from a secret one. Handles the current key format
 * (sb_publishable_… / sb_secret_…) and legacy JWT keys (role "anon" / "service_role").
 */
export function classifySupabaseKey(key: string): SupabaseKeyKind {
  if (key.startsWith("sb_publishable_")) return "publishable";
  if (key.startsWith("sb_secret_")) return "secret";
  const role = jwtRole(key);
  if (role === "anon") return "publishable";
  // service_role, or any other role, must never ship to browsers.
  if (role !== null) return "secret";
  return "unknown";
}

/** Returns why this environment must not be bundled, or an empty list if it is safe. */
export function findClientEnvProblems(env: Record<string, unknown>): string[] {
  const allowed = new Set<string>(CLIENT_ENV_KEYS);
  const problems: string[] = [];
  for (const name of Object.keys(env)) {
    if (name.startsWith("VITE_") && !allowed.has(name)) {
      problems.push(
        `${name} would be bundled into the app. Add it to CLIENT_ENV_KEYS only if it is safe to publish.`,
      );
    }
  }
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (typeof key === "string" && key !== "" && classifySupabaseKey(key) !== "publishable") {
    problems.push(
      "VITE_SUPABASE_PUBLISHABLE_KEY is not a publishable key. Secret and service-role keys must never reach the frontend.",
    );
  }
  return problems;
}
