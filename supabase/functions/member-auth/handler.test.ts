import { createHmac } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { authPassword, pinDigest, timingSafeEqual } from "../_shared/crypto.ts";
import { createHandler, MEMBER_EMAIL_DOMAIN, readConfig } from "./handler.ts";
import type { MemberAuthConfig } from "./handler.ts";

const PEPPER = "a-test-pepper-that-is-long-enough-to-use";
const URL_BASE = "http://supabase.test";
const PUBLISHABLE = "sb_publishable_test";
const SECRET = "sb_secret_test";

const config: MemberAuthConfig = {
  supabaseUrl: URL_BASE,
  publishableKey: PUBLISHABLE,
  secretKeys: [SECRET],
  pepper: PEPPER,
};

interface Call {
  method: string;
  path: string;
  headers: Headers;
  body: Record<string, unknown> | null;
}

type Route = (call: Call) => Response | Promise<Response>;

function json(status: number, body: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const MOTHER = {
  id: "11111111-1111-4111-8111-111111111111",
  phone: "01711000001",
  display_name_bn: "মা",
  display_name_en: "Ma",
  active: true,
};

/** A stand-in for the Data API and Auth: routes by "METHOD /path", records every call. */
function fakeSupabase(routes: Record<string, Route>) {
  const calls: Call[] = [];
  const fetchFn = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
    );
    const text = typeof init?.body === "string" ? init.body : null;
    const call: Call = {
      method: init?.method ?? "GET",
      path: url.pathname,
      headers: new Headers(init?.headers),
      body: text === null ? null : (JSON.parse(text) as Record<string, unknown>),
    };
    calls.push(call);
    const route =
      routes[`${call.method} ${call.path}`] ??
      routes[`${call.method} ${call.path.replace(/[^/]+$/, ":id")}`];
    if (!route) throw new Error(`Unexpected call: ${call.method} ${call.path}`);
    return route(call);
  });
  return { fetch: fetchFn as unknown as typeof fetch, calls };
}

function handlerWith(routes: Record<string, Route>, ids: string[] = []) {
  const backend = fakeSupabase(routes);
  const log = vi.fn<(message: string) => void>();
  const handle = createHandler(config, {
    fetch: backend.fetch,
    randomUUID: () => ids.shift() ?? "00000000-0000-4000-8000-000000000000",
    log,
  });
  return { handle, calls: backend.calls, log };
}

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`${URL_BASE}/functions/v1/member-auth`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: PUBLISHABLE,
      Authorization: `Bearer ${PUBLISHABLE}`,
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function read(
  response: Response,
): Promise<{ status: number; body: Record<string, unknown> }> {
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

const SESSION = {
  access_token: "access",
  refresh_token: "refresh",
  expires_in: 3600,
  expires_at: 1,
  token_type: "bearer",
};

/** Auth that accepts only the member's derived password. */
async function authAccepting(userId: string): Promise<Route> {
  const password = await authPassword(PEPPER, userId);
  return (call) =>
    call.body?.password === password
      ? json(200, { ...SESSION, user: { id: userId } })
      : json(400, {
          code: 400,
          error_code: "invalid_credentials",
          msg: "Invalid login credentials",
        });
}

describe("crypto", () => {
  it("peppers PINs with HMAC-SHA256, in hex", async () => {
    const expected = createHmac("sha256", PEPPER).update("amh:pin:v1:482913").digest("hex");
    expect(await pinDigest(PEPPER, "482913")).toBe(expected);
  });

  it("derives a different, URL-safe Auth password for each member", async () => {
    const expected = createHmac("sha256", PEPPER)
      .update(`amh:auth-password:v1:${MOTHER.id}`)
      .digest("base64url");
    const password = await authPassword(PEPPER, MOTHER.id);
    expect(password).toBe(expected);
    expect(password).toHaveLength(43);
    expect(await authPassword(PEPPER, "another-member")).not.toBe(password);
  });

  it("compares secrets", () => {
    expect(timingSafeEqual("sb_secret_abc", "sb_secret_abc")).toBe(true);
    expect(timingSafeEqual("sb_secret_abc", "sb_secret_abd")).toBe(false);
    expect(timingSafeEqual("sb_secret_abc", "sb_secret_ab")).toBe(false);
  });
});

describe("configuration", () => {
  const complete: Record<string, string> = {
    SUPABASE_URL: URL_BASE,
    SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({ default: PUBLISHABLE }),
    SUPABASE_SECRET_KEYS: JSON.stringify({ default: SECRET }),
    SUPABASE_SERVICE_ROLE_KEY: "legacy-service-role-jwt",
    AUTH_PIN_PEPPER: PEPPER,
  };

  it("reads the Edge Runtime's keys and the pepper", () => {
    expect(readConfig((name) => complete[name])).toEqual({
      supabaseUrl: URL_BASE,
      publishableKey: PUBLISHABLE,
      secretKeys: [SECRET, "legacy-service-role-jwt"],
      pepper: PEPPER,
    });
  });

  it("falls back to the legacy keys", () => {
    const legacy: Record<string, string> = {
      SUPABASE_URL: URL_BASE,
      SUPABASE_ANON_KEY: "legacy-anon-jwt",
      SUPABASE_SERVICE_ROLE_KEY: "legacy-service-role-jwt",
      AUTH_PIN_PEPPER: PEPPER,
    };
    expect(readConfig((name) => legacy[name])).toMatchObject({
      publishableKey: "legacy-anon-jwt",
      secretKeys: ["legacy-service-role-jwt"],
    });
  });

  it("names what is missing, and refuses a short pepper", () => {
    expect(readConfig((name) => ({ ...complete, AUTH_PIN_PEPPER: "short" })[name])).toEqual({
      missing: ["AUTH_PIN_PEPPER (at least 32 characters)"],
    });
    expect(readConfig(() => undefined)).toEqual({
      missing: [
        "SUPABASE_URL",
        "SUPABASE_PUBLISHABLE_KEYS",
        "SUPABASE_SECRET_KEYS",
        "AUTH_PIN_PEPPER (at least 32 characters)",
      ],
    });
  });

  it("answers every request with not_configured until it is set up", async () => {
    const log = vi.fn<(message: string) => void>();
    const handle = createHandler(
      { missing: ["AUTH_PIN_PEPPER"] },
      { fetch, randomUUID: () => "x", log },
    );
    expect(await read(await handle(post({ action: "sign-in" })))).toEqual({
      status: 500,
      body: { error: "not_configured" },
    });
    expect(log).toHaveBeenCalledWith("member-auth is not configured; missing: AUTH_PIN_PEPPER");
  });
});

describe("requests", () => {
  it("answers CORS preflights", async () => {
    const { handle } = handlerWith({});
    const response = await handle(new Request(`${URL_BASE}/x`, { method: "OPTIONS" }));
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Headers")).toContain("apikey");
  });

  it("takes only POSTed JSON objects with a known action", async () => {
    const { handle } = handlerWith({});
    expect((await handle(new Request(`${URL_BASE}/x`, { method: "GET" }))).status).toBe(405);
    expect((await read(await handle(post("{not json")))).body).toEqual({ error: "bad_request" });
    expect((await read(await handle(post("[1, 2]")))).body).toEqual({ error: "bad_request" });
    expect(
      (await read(await handle(post({ action: "sign-in", phone: "x".repeat(5000) })))).body,
    ).toEqual({
      error: "bad_request",
    });
    expect((await read(await handle(post({ action: "fly" })))).body).toEqual({
      error: "unknown_action",
    });
  });
});

describe("sign-in", () => {
  it("checks a peppered digest, never the PIN, and returns a session", async () => {
    const { handle, calls } = handlerWith({
      "POST /rest/v1/rpc/member_check_pin": () =>
        json(200, {
          status: "ok",
          user_id: MOTHER.id,
          email: `${MOTHER.id}@${MEMBER_EMAIL_DOMAIN}`,
        }),
      "POST /auth/v1/token": await authAccepting(MOTHER.id),
    });

    const response = await handle(
      post(
        { action: "sign-in", phone: "০১৭১১-০০০০০১", pin: "482913" },
        { "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
      ),
    );

    expect(await read(response)).toEqual({ status: 200, body: { session: SESSION } });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const [check, token] = calls;
    expect(check?.body).toEqual({
      p_phone: "০১৭১১-০০০০০১",
      p_pin_digest: await pinDigest(PEPPER, "482913"),
      p_purpose: "sign_in",
      p_client_ip: "203.0.113.7",
    });
    expect(check?.headers.get("apikey")).toBe(SECRET);
    expect(token?.headers.get("apikey")).toBe(PUBLISHABLE);
    expect(token?.body).toEqual({
      email: `${MOTHER.id}@${MEMBER_EMAIL_DOMAIN}`,
      password: await authPassword(PEPPER, MOTHER.id),
    });
    expect(JSON.stringify(calls.map((call) => call.body))).not.toContain("482913");
  });

  it("accepts a PIN typed in Bangla digits", async () => {
    const { handle, calls } = handlerWith({
      "POST /rest/v1/rpc/member_check_pin": () => json(200, { status: "invalid", remaining: 4 }),
    });
    await handle(post({ action: "sign-in", phone: "01711000001", pin: "৪৮২৯১৩" }));
    expect(calls[0]?.body?.p_pin_digest).toBe(await pinDigest(PEPPER, "482913"));
  });

  it("refuses malformed PINs and phones without asking the database", async () => {
    const { handle, calls } = handlerWith({});
    for (const pin of ["48291", "4829130", "48a913", 482913]) {
      expect(
        (await read(await handle(post({ action: "sign-in", phone: "01711000001", pin })))).body,
      ).toEqual({ error: "invalid_pin" });
    }
    expect(
      (await read(await handle(post({ action: "sign-in", phone: " ", pin: "482913" })))).body,
    ).toEqual({ error: "invalid_phone" });
    expect(calls).toEqual([]);
  });

  it.each([
    [{ status: "invalid", remaining: 3 }, 401, { error: "invalid_credentials", remaining: 3 }],
    [
      { status: "invalid", remaining: null },
      401,
      { error: "invalid_credentials", remaining: null },
    ],
    [
      { status: "locked", retry_at: "2026-10-20T12:15:00+06:00" },
      423,
      { error: "locked", retryAt: "2026-10-20T12:15:00+06:00" },
    ],
    [{ status: "inactive" }, 403, { error: "inactive" }],
  ])("explains a refused PIN: %j", async (answer, status, body) => {
    const { handle } = handlerWith({
      "POST /rest/v1/rpc/member_check_pin": () => json(200, answer),
    });
    expect(
      await read(await handle(post({ action: "sign-in", phone: "01711000001", pin: "000000" }))),
    ).toEqual({ status, body });
  });

  it("repairs a missing Auth password once the PIN is known to be right", async () => {
    let password: string | null = null;
    const { handle, calls } = handlerWith({
      "POST /rest/v1/rpc/member_check_pin": () =>
        json(200, { status: "ok", user_id: MOTHER.id, email: "m@x.invalid" }),
      "POST /auth/v1/token": (call) =>
        password !== null && call.body?.password === password
          ? json(200, SESSION)
          : json(400, { error: "invalid_grant", error_description: "Invalid login credentials" }),
      "PUT /auth/v1/admin/users/:id": (call) => {
        password = typeof call.body?.password === "string" ? call.body.password : null;
        return json(200, {});
      },
    });
    expect(
      (await handle(post({ action: "sign-in", phone: "01711000001", pin: "482913" }))).status,
    ).toBe(200);
    expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      "POST /rest/v1/rpc/member_check_pin",
      "POST /auth/v1/token",
      `PUT /auth/v1/admin/users/${MOTHER.id}`,
      "POST /auth/v1/token",
    ]);
  });

  it("reports a server error, without details, when something unexpected happens", async () => {
    const { handle, log } = handlerWith({
      "POST /rest/v1/rpc/member_check_pin": () => json(200, { status: "maybe" }),
    });
    expect(
      await read(await handle(post({ action: "sign-in", phone: "01711000001", pin: "482913" }))),
    ).toEqual({
      status: 500,
      body: { error: "server_error" },
    });
    expect(log).toHaveBeenCalledWith(
      "member-auth sign-in failed: Error: member_check_pin returned an unexpected answer",
    );
  });
});

describe("change-pin", () => {
  const memberRoutes: Record<string, Route> = {
    "GET /auth/v1/user": (call) =>
      call.headers.get("authorization") === "Bearer member-token"
        ? json(200, { id: MOTHER.id })
        : json(401, { msg: "bad jwt" }),
    "GET /rest/v1/profiles": () =>
      json(200, [{ id: MOTHER.id, phone: MOTHER.phone, active: true }]),
  };

  it("needs a signed-in member", async () => {
    const { handle } = handlerWith(memberRoutes);
    const body = { action: "change-pin", currentPin: "482913", newPin: "739104" };
    expect(await read(await handle(post(body)))).toEqual({
      status: 401,
      body: { error: "not_signed_in" },
    });
    expect((await handle(post(body, { Authorization: "Bearer someone-else" }))).status).toBe(401);
  });

  it("confirms the current PIN, then sets the new one", async () => {
    const { handle, calls } = handlerWith({
      ...memberRoutes,
      "POST /rest/v1/rpc/member_check_pin": () =>
        json(200, { status: "ok", user_id: MOTHER.id, email: "m@x.invalid" }),
      "POST /rest/v1/rpc/member_set_pin": () => json(204, undefined),
    });
    const response = await handle(
      post(
        { action: "change-pin", currentPin: "482913", newPin: "739104" },
        { Authorization: "Bearer member-token" },
      ),
    );
    expect(await read(response)).toEqual({ status: 200, body: { ok: true } });
    const check = calls.find((call) => call.path.endsWith("member_check_pin"));
    expect(check?.body).toMatchObject({
      p_phone: MOTHER.phone,
      p_purpose: "verify",
      p_pin_digest: await pinDigest(PEPPER, "482913"),
    });
    const set = calls.find((call) => call.path.endsWith("member_set_pin"));
    expect(set?.body).toEqual({
      p_user_id: MOTHER.id,
      p_pin_digest: await pinDigest(PEPPER, "739104"),
    });
  });

  it("refuses a wrong current PIN", async () => {
    const { handle, calls } = handlerWith({
      ...memberRoutes,
      "POST /rest/v1/rpc/member_check_pin": () => json(200, { status: "invalid", remaining: 2 }),
    });
    const response = await handle(
      post(
        { action: "change-pin", currentPin: "000000", newPin: "739104" },
        { Authorization: "Bearer member-token" },
      ),
    );
    expect(await read(response)).toEqual({
      status: 401,
      body: { error: "invalid_credentials", remaining: 2 },
    });
    expect(calls.some((call) => call.path.endsWith("member_set_pin"))).toBe(false);
  });
});

describe("managing members", () => {
  const NEW_ID = "22222222-2222-4222-8222-222222222222";
  const asOperator = { apikey: SECRET, Authorization: `Bearer ${SECRET}` };
  const addFather = {
    action: "add-member",
    phone: "01937581298",
    nameBn: "বাবা",
    nameEn: "Baba",
    pin: "550011",
  };

  it("is closed to callers who are neither members nor the operator", async () => {
    const { handle, calls } = handlerWith({});
    for (const action of ["add-member", "reset-pin", "set-active"]) {
      expect(await read(await handle(post({ ...addFather, action, active: false })))).toEqual({
        status: 401,
        body: { error: "not_allowed" },
      });
    }
    expect(calls).toEqual([]);
  });

  it("adds a member: an Auth user with a derived password, then the profile and PIN", async () => {
    const { handle, calls } = handlerWith(
      {
        "POST /auth/v1/admin/users": () => json(200, { id: NEW_ID }),
        "POST /rest/v1/rpc/member_create": () =>
          json(200, {
            id: NEW_ID,
            phone: "01937581298",
            display_name_bn: "বাবা",
            display_name_en: "Baba",
            active: true,
            language: "bn",
          }),
      },
      [NEW_ID],
    );
    const response = await handle(post(addFather, asOperator));
    expect(await read(response)).toEqual({
      status: 201,
      body: {
        member: {
          id: NEW_ID,
          phone: "01937581298",
          displayNameBn: "বাবা",
          displayNameEn: "Baba",
          active: true,
        },
      },
    });
    expect(calls[0]?.body).toEqual({
      id: NEW_ID,
      email: `${NEW_ID}@${MEMBER_EMAIL_DOMAIN}`,
      password: await authPassword(PEPPER, NEW_ID),
      email_confirm: true,
    });
    expect(calls[1]?.body).toEqual({
      p_user_id: NEW_ID,
      p_phone: "01937581298",
      p_name_bn: "বাবা",
      p_name_en: "Baba",
      p_pin_digest: await pinDigest(PEPPER, "550011"),
    });
  });

  it.each([
    [409, "23505", 409, "phone_taken"],
    [400, "22023", 400, "invalid_phone"],
  ])(
    "removes the Auth user again when the profile is refused (%i %s)",
    async (rpcStatus, code, status, error) => {
      const { handle, calls } = handlerWith(
        {
          "POST /auth/v1/admin/users": () => json(200, { id: NEW_ID }),
          "POST /rest/v1/rpc/member_create": () => json(rpcStatus, { code, message: "refused" }),
          "DELETE /auth/v1/admin/users/:id": () => json(200, {}),
        },
        [NEW_ID],
      );
      expect(await read(await handle(post(addFather, asOperator)))).toEqual({
        status,
        body: { error },
      });
      expect(calls.at(-1)).toMatchObject({
        method: "DELETE",
        path: `/auth/v1/admin/users/${NEW_ID}`,
      });
    },
  );

  it("lets a signed-in member add someone too", async () => {
    const { handle } = handlerWith(
      {
        "GET /auth/v1/user": () => json(200, { id: MOTHER.id }),
        "GET /rest/v1/profiles": () =>
          json(200, [{ id: MOTHER.id, phone: MOTHER.phone, active: true }]),
        "POST /auth/v1/admin/users": () => json(200, { id: NEW_ID }),
        "POST /rest/v1/rpc/member_create": () =>
          json(200, {
            id: NEW_ID,
            phone: "01937581298",
            display_name_bn: "বাবা",
            display_name_en: "",
            active: true,
          }),
      },
      [NEW_ID],
    );
    expect((await handle(post(addFather, { Authorization: "Bearer member-token" }))).status).toBe(
      201,
    );
  });

  it("checks the new member's details first", async () => {
    const { handle, calls } = handlerWith({});
    expect(
      (await read(await handle(post({ ...addFather, nameBn: "  " }, asOperator)))).body,
    ).toEqual({ error: "invalid_name" });
    expect((await read(await handle(post({ ...addFather, pin: "12" }, asOperator)))).body).toEqual({
      error: "invalid_pin",
    });
    expect((await read(await handle(post({ ...addFather, phone: 1 }, asOperator)))).body).toEqual({
      error: "invalid_phone",
    });
    expect(calls).toEqual([]);
  });

  it("resets a PIN by phone number", async () => {
    const { handle, calls } = handlerWith({
      "POST /rest/v1/rpc/member_lookup": (call) =>
        json(200, call.body?.p_phone === "01711000001" ? MOTHER : null),
      "POST /rest/v1/rpc/member_set_pin": () => json(204, undefined),
    });
    expect(
      await read(
        await handle(
          post({ action: "reset-pin", phone: "01799999999", pin: "123456" }, asOperator),
        ),
      ),
    ).toEqual({
      status: 404,
      body: { error: "not_found" },
    });
    expect(
      await read(
        await handle(
          post({ action: "reset-pin", phone: "01711000001", pin: "123456" }, asOperator),
        ),
      ),
    ).toEqual({
      status: 200,
      body: { ok: true },
    });
    expect(calls.at(-1)?.body).toEqual({
      p_user_id: MOTHER.id,
      p_pin_digest: await pinDigest(PEPPER, "123456"),
    });
  });

  it("switches a member off and bans their Auth user, or back on", async () => {
    const { handle, calls } = handlerWith({
      "POST /rest/v1/rpc/member_lookup": () => json(200, MOTHER),
      "POST /rest/v1/rpc/member_set_active": (call) =>
        json(200, { ...MOTHER, active: call.body?.p_active }),
      "PUT /auth/v1/admin/users/:id": () => json(200, {}),
    });
    const off = await read(
      await handle(post({ action: "set-active", phone: MOTHER.phone, active: false }, asOperator)),
    );
    expect(off).toMatchObject({ status: 200, body: { member: { active: false } } });
    expect(calls.at(-1)?.body).toEqual({ ban_duration: "876000h" });

    await handle(post({ action: "set-active", phone: MOTHER.phone, active: true }, asOperator));
    expect(calls.at(-1)?.body).toEqual({ ban_duration: "none" });
  });

  it("does not let members switch themselves off", async () => {
    const { handle, calls } = handlerWith({
      "GET /auth/v1/user": () => json(200, { id: MOTHER.id }),
      "GET /rest/v1/profiles": () =>
        json(200, [{ id: MOTHER.id, phone: MOTHER.phone, active: true }]),
      "POST /rest/v1/rpc/member_lookup": () => json(200, MOTHER),
    });
    expect(
      await read(
        await handle(
          post(
            { action: "set-active", phone: MOTHER.phone, active: false },
            { Authorization: "Bearer member-token" },
          ),
        ),
      ),
    ).toEqual({ status: 400, body: { error: "cannot_deactivate_self" } });
    expect(calls.some((call) => call.path.endsWith("member_set_active"))).toBe(false);
  });
});
