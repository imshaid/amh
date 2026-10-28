import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeSupabase, MOTHER, sessionReply } from "@/test/fake-supabase";
import type { FakeServer } from "@/test/fake-supabase";

import { changePin, signInWithPin } from "./member-auth";
import { safeRedirect } from "./membership";

const backend = vi.hoisted((): { client: unknown; configured: boolean } => ({
  client: null,
  configured: true,
}));
vi.mock("@/lib/env", async () => {
  const { CONFIGURED_ENV } = await import("@/test/fake-supabase");
  return {
    get clientEnv() {
      return backend.configured ? CONFIGURED_ENV : { ok: false, issues: ["not set"] };
    },
  };
});
vi.mock("@/lib/supabase", () => ({ getSupabase: () => backend.client }));

let server: FakeServer;
let fake: ReturnType<typeof createFakeSupabase>;

beforeEach(() => {
  localStorage.clear();
  backend.configured = true;
  server = { session: null, profile: MOTHER, memberAuth: () => sessionReply() };
  fake = createFakeSupabase(server);
  backend.client = fake.client;
});

const pin = { phone: "01711000001", pin: "482913", trustDevice: true };

describe("signInWithPin", () => {
  it("stores the session member-auth hands out", async () => {
    expect(await signInWithPin(pin)).toEqual({ ok: true });
    expect(fake.client.auth.setSession).toHaveBeenCalledWith({
      access_token: "access",
      refresh_token: "refresh",
    });
  });

  it.each([
    [
      { status: 401, body: { error: "invalid_credentials", remaining: 3 } },
      { reason: "invalid", remaining: 3 },
    ],
    [
      { status: 400, body: { error: "invalid_pin" } },
      { reason: "invalid", remaining: null },
    ],
    [{ status: 403, body: { error: "inactive" } }, { reason: "inactive" }],
    [
      { status: 423, body: { error: "locked", retryAt: "2026-10-20T15:00:00Z" } },
      { reason: "locked", retryAt: new Date("2026-10-20T15:00:00Z") },
    ],
    [{ status: 423, body: { error: "locked", retryAt: "soon" } }, { reason: "unreachable" }],
    [{ status: 500, body: { error: "server_error" } }, { reason: "unreachable" }],
    [{ status: 200, body: { nothing: true } }, { reason: "unreachable" }],
  ] as const)("turns %j into a reason a screen can explain", async (reply, failure) => {
    server.memberAuth = () => reply;
    expect(await signInWithPin(pin)).toEqual({ ok: false, ...failure });
    expect(fake.client.auth.setSession).not.toHaveBeenCalled();
  });

  it("tells offline from unreachable", async () => {
    server.memberAuth = () => ({ status: "network" });
    expect(await signInWithPin(pin)).toEqual({ ok: false, reason: "unreachable" });
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    expect(await signInWithPin(pin)).toEqual({ ok: false, reason: "offline" });
  });

  it("does not try without a backend", async () => {
    backend.configured = false;
    expect(await signInWithPin(pin)).toEqual({ ok: false, reason: "notConfigured" });
    expect(fake.client.functions.invoke).not.toHaveBeenCalled();
  });
});

describe("changePin", () => {
  it("sends both PINs and reports a session that ended", async () => {
    server.memberAuth = () => ({ status: 401, body: { error: "not_signed_in" } });
    expect(await changePin({ currentPin: "482913", newPin: "739104" })).toEqual({
      ok: false,
      reason: "signedOut",
    });
    expect(fake.client.functions.invoke).toHaveBeenCalledWith("member-auth", {
      body: { action: "change-pin", currentPin: "482913", newPin: "739104" },
    });
  });
});

describe("safeRedirect", () => {
  it.each([
    ["/orders/0047?tab=bill", "/orders/0047?tab=bill"],
    [undefined, "/"],
    ["https://evil.example", "/"],
    ["//evil.example", "/"],
    ["/\\evil.example", "/"],
    ["/sign-in?redirect=/", "/"],
  ])("goes from %j to %j", (target, expected) => {
    expect(safeRedirect(target)).toBe(expected);
  });
});
