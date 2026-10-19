import { z } from "zod";

import { classifySupabaseKey } from "./client-env-policy";

const clientEnvSchema = z.object({
  VITE_SUPABASE_URL: z.url({ protocol: /^https?$/ }),
  VITE_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .refine((key) => classifySupabaseKey(key) === "publishable", "must be a publishable key"),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

export type ClientEnvResult = { ok: true; env: ClientEnv } | { ok: false; issues: string[] };

export function parseClientEnv(source: unknown): ClientEnvResult {
  const result = clientEnvSchema.safeParse(source);
  if (result.success) return { ok: true, env: result.data };
  return {
    ok: false,
    issues: result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
  };
}

/**
 * The app still starts without a backend configured (useful for UI work and previews); screens
 * that need the server show that it is not set up yet.
 */
export const clientEnv = parseClientEnv(import.meta.env);

if (!clientEnv.ok && import.meta.env.DEV && import.meta.env.MODE !== "test") {
  console.warn(
    `Supabase is not configured (${clientEnv.issues.join("; ")}). Run \`npm run db:start\` and \`npm run db:env\`.`,
  );
}
