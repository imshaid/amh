// member-auth: signing in with a phone number and a 6-digit PIN, and managing members
// (BLUEPRINT §5.9). The database half is supabase/migrations/*_member_auth.sql.
//
// POST JSON { action, ... }:
//   sign-in     { phone, pin }                    anyone            -> 200 { session }
//   change-pin  { currentPin, newPin }            the member        -> 200 { ok }
//   add-member  { phone, nameBn, nameEn?, pin }   member/operator   -> 201 { member }
//   reset-pin   { phone, pin }                    member/operator   -> 200 { ok }
//   set-active  { phone, active }                 member/operator   -> 200 { member }
//
// "Operator" is a caller holding the project's secret key: `npm run members` on the developer's
// machine, which is how the first members are added. Failures are { error: code, ... } with an
// HTTP status; the app translates the codes. PINs never leave this function: the database gets a
// peppered digest, and Supabase Auth a derived password.

import { authPassword, pinDigest, timingSafeEqual } from "../_shared/crypto.ts";
import { errorResponse, jsonResponse, preflightResponse } from "../_shared/http.ts";
import { createSupabaseApi, isRecord, SupabaseApiError } from "../_shared/supabase-api.ts";
import type { Session } from "../_shared/supabase-api.ts";

export interface MemberAuthConfig {
  supabaseUrl: string;
  publishableKey: string;
  /** Every secret key of the project; the first is used for calls. */
  secretKeys: readonly [string, ...string[]];
  pepper: string;
}

export interface MemberAuthDeps {
  fetch: typeof fetch;
  randomUUID: () => string;
  log: (message: string) => void;
}

/** Auth needs an email; members never see or use it. `.invalid` can never receive mail. */
export const MEMBER_EMAIL_DOMAIN = "members.amh.invalid";
const MAX_BODY_BYTES = 4096;
/** How Supabase Auth bans a user: for a hundred years. */
const BANNED = "876000h";
const BANGLA_DIGITS = "০১২৩৪৫৬৭৮৯";

type Env = (name: string) => string | undefined;

function keysFrom(json: string | undefined): string[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    if (isRecord(parsed)) {
      return Object.values(parsed).filter(
        (value): value is string => typeof value === "string" && value !== "",
      );
    }
  } catch {
    // Not JSON: no keys.
  }
  return [];
}

/**
 * Reads the function's settings. The Edge Runtime provides the project's URL and keys (new keys
 * as JSON maps, legacy keys as plain variables); AUTH_PIN_PEPPER is set with `supabase secrets`.
 */
export function readConfig(env: Env): MemberAuthConfig | { missing: string[] } {
  const supabaseUrl = env("SUPABASE_URL");
  const publishableKey = keysFrom(env("SUPABASE_PUBLISHABLE_KEYS"))[0] ?? env("SUPABASE_ANON_KEY");
  const secretKeys = [
    ...keysFrom(env("SUPABASE_SECRET_KEYS")),
    env("SUPABASE_SERVICE_ROLE_KEY"),
  ].filter((key): key is string => typeof key === "string" && key !== "");
  const pepper = env("AUTH_PIN_PEPPER");
  const [firstSecretKey, ...otherSecretKeys] = secretKeys;
  if (
    !supabaseUrl ||
    !publishableKey ||
    firstSecretKey === undefined ||
    !pepper ||
    pepper.length < 32
  ) {
    return {
      missing: [
        ...(supabaseUrl ? [] : ["SUPABASE_URL"]),
        ...(publishableKey ? [] : ["SUPABASE_PUBLISHABLE_KEYS"]),
        ...(firstSecretKey === undefined ? ["SUPABASE_SECRET_KEYS"] : []),
        ...(pepper && pepper.length >= 32 ? [] : ["AUTH_PIN_PEPPER (at least 32 characters)"]),
      ],
    };
  }
  return { supabaseUrl, publishableKey, secretKeys: [firstSecretKey, ...otherSecretKeys], pepper };
}

// Input ----------------------------------------------------------------------------------------

/** A PIN of exactly six digits, Bangla or Latin, as Latin digits. */
function readPin(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const latin = value.replace(/[০-৯]/g, (digit) => String(BANGLA_DIGITS.indexOf(digit)));
  return /^[0-9]{6}$/.test(latin) ? latin : null;
}

function readText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > 0 && text.length <= maxLength ? text : null;
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return null;
  try {
    const body: unknown = JSON.parse(text);
    return isRecord(body) ? body : null;
  } catch {
    return null;
  }
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  const match = header ? /^Bearer\s+(\S+)$/i.exec(header) : null;
  return match?.[1] ?? null;
}

function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip =
    forwarded !== undefined && forwarded !== ""
      ? forwarded
      : request.headers.get("cf-connecting-ip");
  return ip ? ip.slice(0, 64) : null;
}

function describe(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

// The database's answers ---------------------------------------------------------------------

type PinCheck =
  | { status: "ok"; userId: string; email: string }
  | { status: "invalid"; remaining: number | null }
  | { status: "locked"; retryAt: string }
  | { status: "inactive" };

function parsePinCheck(value: unknown): PinCheck {
  if (isRecord(value)) {
    if (
      value.status === "ok" &&
      typeof value.user_id === "string" &&
      typeof value.email === "string"
    ) {
      return { status: "ok", userId: value.user_id, email: value.email };
    }
    if (value.status === "invalid") {
      return {
        status: "invalid",
        remaining: typeof value.remaining === "number" ? value.remaining : null,
      };
    }
    if (value.status === "locked" && typeof value.retry_at === "string") {
      return { status: "locked", retryAt: value.retry_at };
    }
    if (value.status === "inactive") return { status: "inactive" };
  }
  throw new Error("member_check_pin returned an unexpected answer");
}

interface Member {
  id: string;
  phone: string;
  displayNameBn: string;
  displayNameEn: string;
  active: boolean;
}

function parseMember(value: unknown): Member | null {
  if (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.phone === "string" &&
    typeof value.display_name_bn === "string" &&
    typeof value.display_name_en === "string" &&
    typeof value.active === "boolean"
  ) {
    return {
      id: value.id,
      phone: value.phone,
      displayNameBn: value.display_name_bn,
      displayNameEn: value.display_name_en,
      active: value.active,
    };
  }
  return null;
}

type Caller =
  { kind: "operator" } | { kind: "member"; userId: string; phone: string } | { kind: "anonymous" };

// The handler ----------------------------------------------------------------------------------

export function createHandler(
  settings: MemberAuthConfig | { missing: string[] },
  deps: MemberAuthDeps,
): (request: Request) => Promise<Response> {
  if ("missing" in settings) {
    deps.log(`member-auth is not configured; missing: ${settings.missing.join(", ")}`);
    return (request) =>
      Promise.resolve(
        request.method === "OPTIONS" ? preflightResponse() : errorResponse(500, "not_configured"),
      );
  }
  const config: MemberAuthConfig = settings;

  const api = createSupabaseApi({
    url: config.supabaseUrl,
    publishableKey: config.publishableKey,
    secretKey: config.secretKeys[0],
    fetch: deps.fetch,
  });

  async function identifyCaller(request: Request): Promise<Caller> {
    const presented = [request.headers.get("apikey"), bearerToken(request)];
    for (const key of presented) {
      if (key !== null && config.secretKeys.some((secret) => timingSafeEqual(secret, key))) {
        return { kind: "operator" };
      }
    }
    const token = bearerToken(request);
    // supabase-js sends the publishable key as the bearer when nobody is signed in.
    if (token === null || token === config.publishableKey || token.startsWith("sb_"))
      return { kind: "anonymous" };
    const userId = await api.getUserId(token);
    if (userId === null) return { kind: "anonymous" };
    const profile = await api.selectProfile(userId);
    return profile?.active
      ? { kind: "member", userId, phone: profile.phone }
      : { kind: "anonymous" };
  }

  async function checkPin(
    phone: string,
    pin: string,
    purpose: "sign_in" | "verify",
    request: Request,
  ) {
    return parsePinCheck(
      await api.rpc("member_check_pin", {
        p_phone: phone,
        p_pin_digest: await pinDigest(config.pepper, pin),
        p_purpose: purpose,
        p_client_ip: clientIp(request),
      }),
    );
  }

  function pinRefused(result: Exclude<PinCheck, { status: "ok" }>): Response {
    switch (result.status) {
      case "invalid":
        return errorResponse(401, "invalid_credentials", { remaining: result.remaining });
      case "locked":
        return errorResponse(423, "locked", { retryAt: result.retryAt });
      case "inactive":
        return errorResponse(403, "inactive");
    }
  }

  async function setPin(userId: string, pin: string): Promise<void> {
    await api.rpc("member_set_pin", {
      p_user_id: userId,
      p_pin_digest: await pinDigest(config.pepper, pin),
    });
  }

  async function lookup(phone: string): Promise<Member | null> {
    return parseMember(await api.rpc("member_lookup", { p_phone: phone }));
  }

  async function sessionFor(userId: string, email: string): Promise<Session> {
    const password = await authPassword(config.pepper, userId);
    const session = await api.signInWithPassword(email, password);
    if (session) return session;
    // The Auth password is missing or stale (a member made by hand, or a new pepper): the PIN was
    // right, so set the derived password and try once more.
    await api.updateUser(userId, { password });
    const retried = await api.signInWithPassword(email, password);
    if (!retried) throw new Error("Supabase Auth refused the derived password");
    return retried;
  }

  async function signIn(body: Record<string, unknown>, request: Request): Promise<Response> {
    const phone = readText(body.phone, 40);
    const pin = readPin(body.pin);
    if (phone === null) return errorResponse(400, "invalid_phone");
    if (pin === null) return errorResponse(400, "invalid_pin");
    const result = await checkPin(phone, pin, "sign_in", request);
    if (result.status !== "ok") return pinRefused(result);
    return jsonResponse(200, { session: await sessionFor(result.userId, result.email) });
  }

  async function changePin(body: Record<string, unknown>, request: Request): Promise<Response> {
    const caller = await identifyCaller(request);
    if (caller.kind !== "member") return errorResponse(401, "not_signed_in");
    const currentPin = readPin(body.currentPin);
    const newPin = readPin(body.newPin);
    if (currentPin === null || newPin === null) return errorResponse(400, "invalid_pin");
    const result = await checkPin(caller.phone, currentPin, "verify", request);
    if (result.status !== "ok") return pinRefused(result);
    if (result.userId !== caller.userId)
      throw new Error("The PIN check answered for another member");
    await setPin(caller.userId, newPin);
    return jsonResponse(200, { ok: true });
  }

  async function addMember(body: Record<string, unknown>, request: Request): Promise<Response> {
    if ((await identifyCaller(request)).kind === "anonymous")
      return errorResponse(401, "not_allowed");
    const phone = readText(body.phone, 40);
    const nameBn = readText(body.nameBn, 80);
    const nameEn = body.nameEn === undefined || body.nameEn === "" ? "" : readText(body.nameEn, 80);
    const pin = readPin(body.pin);
    if (phone === null) return errorResponse(400, "invalid_phone");
    if (nameBn === null || nameEn === null) return errorResponse(400, "invalid_name");
    if (pin === null) return errorResponse(400, "invalid_pin");

    const userId = deps.randomUUID();
    await api.createUser({
      id: userId,
      email: `${userId}@${MEMBER_EMAIL_DOMAIN}`,
      password: await authPassword(config.pepper, userId),
    });
    try {
      const member = parseMember(
        await api.rpc("member_create", {
          p_user_id: userId,
          p_phone: phone,
          p_name_bn: nameBn,
          p_name_en: nameEn,
          p_pin_digest: await pinDigest(config.pepper, pin),
        }),
      );
      return jsonResponse(201, { member });
    } catch (error) {
      await api.deleteUser(userId).catch((cleanupError: unknown) => {
        deps.log(
          `member-auth could not remove Auth user ${userId} after a failed add-member: ${describe(cleanupError)}`,
        );
      });
      if (error instanceof SupabaseApiError && error.code === "23505")
        return errorResponse(409, "phone_taken");
      if (error instanceof SupabaseApiError && error.code === "22023")
        return errorResponse(400, "invalid_phone");
      throw error;
    }
  }

  async function resetPin(body: Record<string, unknown>, request: Request): Promise<Response> {
    if ((await identifyCaller(request)).kind === "anonymous")
      return errorResponse(401, "not_allowed");
    const phone = readText(body.phone, 40);
    const pin = readPin(body.pin);
    if (phone === null) return errorResponse(400, "invalid_phone");
    if (pin === null) return errorResponse(400, "invalid_pin");
    const member = await lookup(phone);
    if (member === null) return errorResponse(404, "not_found");
    await setPin(member.id, pin);
    return jsonResponse(200, { ok: true });
  }

  async function setActive(body: Record<string, unknown>, request: Request): Promise<Response> {
    const caller = await identifyCaller(request);
    if (caller.kind === "anonymous") return errorResponse(401, "not_allowed");
    const phone = readText(body.phone, 40);
    if (phone === null) return errorResponse(400, "invalid_phone");
    if (typeof body.active !== "boolean") return errorResponse(400, "bad_request");
    const member = await lookup(phone);
    if (member === null) return errorResponse(404, "not_found");
    if (caller.kind === "member" && caller.userId === member.id && !body.active) {
      return errorResponse(400, "cannot_deactivate_self");
    }
    const updated = parseMember(
      await api.rpc("member_set_active", { p_user_id: member.id, p_active: body.active }),
    );
    // A switched-off member's sessions stop refreshing; RLS already refuses them everything.
    await api.updateUser(member.id, { ban_duration: body.active ? "none" : BANNED });
    return jsonResponse(200, { member: updated });
  }

  return async function handle(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") return preflightResponse();
    if (request.method !== "POST") return errorResponse(405, "method_not_allowed");
    const body = await readBody(request);
    if (body === null) return errorResponse(400, "bad_request");
    try {
      switch (body.action) {
        case "sign-in":
          return await signIn(body, request);
        case "change-pin":
          return await changePin(body, request);
        case "add-member":
          return await addMember(body, request);
        case "reset-pin":
          return await resetPin(body, request);
        case "set-active":
          return await setActive(body, request);
        default:
          return errorResponse(400, "unknown_action");
      }
    } catch (error) {
      deps.log(
        `member-auth ${typeof body.action === "string" ? body.action : "?"} failed: ${describe(error)}`,
      );
      return errorResponse(500, "server_error");
    }
  };
}
