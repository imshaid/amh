import { describe, expect, it } from "vitest";

import { classifySupabaseKey, findClientEnvProblems } from "./client-env-policy";

/** A legacy Supabase JWT key with the given role; the signature is irrelevant here. */
function jwtWithRole(role: string): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ iss: "supabase", role })}.signature`;
}

describe("classifySupabaseKey", () => {
  it("accepts publishable and anon keys", () => {
    expect(classifySupabaseKey("sb_publishable_fake")).toBe("publishable");
    expect(classifySupabaseKey(jwtWithRole("anon"))).toBe("publishable");
  });

  it("recognises secret and service-role keys", () => {
    expect(classifySupabaseKey("sb_secret_fake")).toBe("secret");
    expect(classifySupabaseKey(jwtWithRole("service_role"))).toBe("secret");
    expect(classifySupabaseKey(jwtWithRole("supabase_admin"))).toBe("secret");
  });

  it("does not trust anything else", () => {
    expect(classifySupabaseKey("")).toBe("unknown");
    expect(classifySupabaseKey("not.a.jwt")).toBe("unknown");
    expect(classifySupabaseKey("AIzaSyD-example-google-key")).toBe("unknown");
  });
});

describe("findClientEnvProblems", () => {
  it("passes the allowlisted public values", () => {
    expect(
      findClientEnvProblems({
        MODE: "production",
        VITE_SUPABASE_URL: "https://abc.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abc",
      }),
    ).toEqual([]);
  });

  it("refuses VITE_ variables that are not on the allowlist", () => {
    const problems = findClientEnvProblems({ VITE_GEMINI_API_KEY: "AIza…" });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("VITE_GEMINI_API_KEY");
  });

  it("refuses a secret key posing as the publishable key", () => {
    expect(
      findClientEnvProblems({ VITE_SUPABASE_PUBLISHABLE_KEY: jwtWithRole("service_role") }),
    ).toHaveLength(1);
    expect(findClientEnvProblems({ VITE_SUPABASE_PUBLISHABLE_KEY: "sb_secret_abc" })).toHaveLength(
      1,
    );
  });

  it("ignores variables that Vite does not expose", () => {
    expect(findClientEnvProblems({ GOOGLE_AI_STUDIO_API_KEY: "secret", BASE_URL: "/" })).toEqual(
      [],
    );
  });
});
