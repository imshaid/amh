import { describe, expect, it } from "vitest";

import { buildContentSecurityPolicy, buildHeadersFile } from "./security-headers";

describe("buildContentSecurityPolicy", () => {
  it("allows the hosted Supabase project over HTTPS and secure WebSocket only", () => {
    const csp = buildContentSecurityPolicy("https://abcd.supabase.co");
    expect(csp).toContain("connect-src 'self' https://abcd.supabase.co wss://abcd.supabase.co");
    expect(csp).toContain("img-src 'self' data: blob: https://abcd.supabase.co");
    expect(csp).toContain("script-src 'self';");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("*");
  });

  it("supports the local stack", () => {
    expect(buildContentSecurityPolicy("http://127.0.0.1:54421")).toContain(
      "connect-src 'self' http://127.0.0.1:54421 ws://127.0.0.1:54421",
    );
  });

  it("allows only the app itself without a backend", () => {
    expect(buildContentSecurityPolicy(undefined)).toContain("connect-src 'self';");
    expect(buildContentSecurityPolicy("not a url")).toContain("connect-src 'self';");
  });
});

describe("buildHeadersFile", () => {
  const file = buildHeadersFile("https://abcd.supabase.co");

  it("applies the policy to every path and keeps the app out of search engines", () => {
    expect(file.startsWith("/*\n  Content-Security-Policy: default-src 'self';")).toBe(true);
    expect(file).toContain("  X-Robots-Tag: noindex, nofollow");
  });

  it("caches hashed assets forever but never the service worker or theme script", () => {
    expect(file).toContain("/assets/*\n  Cache-Control: public, max-age=31536000, immutable");
    expect(file).toContain("/sw.js\n  Cache-Control: no-cache");
    expect(file).toContain("/theme-boot.js\n  Cache-Control: no-cache");
  });
});
