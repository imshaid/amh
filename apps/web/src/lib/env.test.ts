import { describe, expect, it } from "vitest";

import { clientEnv, parseClientEnv } from "./env";

describe("parseClientEnv", () => {
  it("accepts a local or hosted Supabase URL with a publishable key", () => {
    expect(
      parseClientEnv({
        VITE_SUPABASE_URL: "http://127.0.0.1:54421",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abc",
      }),
    ).toEqual({
      ok: true,
      env: {
        VITE_SUPABASE_URL: "http://127.0.0.1:54421",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abc",
      },
    });
  });

  it("reports what is missing or wrong", () => {
    const result = parseClientEnv({
      VITE_SUPABASE_URL: "ftp://example.com",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_secret_abc",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toHaveLength(2);
      expect(result.issues.join(" ")).toContain("VITE_SUPABASE_PUBLISHABLE_KEY");
    }
  });

  it("is not configured in tests, which never read .env.local", () => {
    expect(clientEnv.ok).toBe(false);
  });
});
