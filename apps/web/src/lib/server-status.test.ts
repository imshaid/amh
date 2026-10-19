import { afterEach, describe, expect, it, vi } from "vitest";

import { checkServerHealth } from "./server-status";

const env = {
  VITE_SUPABASE_URL: "http://127.0.0.1:54421",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abc",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("checkServerHealth", () => {
  it("asks the Auth health endpoint with the publishable key", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response("{}", { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);

    await expect(checkServerHealth(env)).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(new URL("http://127.0.0.1:54421/auth/v1/health"), {
      headers: { apikey: "sb_publishable_abc" },
      signal: null,
    });
  });

  it("is false when the server answers with an error", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(new Response("", { status: 503 })));
    await expect(checkServerHealth(env)).resolves.toBe(false);
  });

  it("is false when the server cannot be reached", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new TypeError("Failed to fetch")));
    await expect(checkServerHealth(env)).resolves.toBe(false);
  });
});
