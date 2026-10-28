import { FunctionsHttpError } from "@supabase/supabase-js";

import { clientEnv } from "@/lib/env";
import { getSupabase } from "@/lib/supabase";

import { setTrustedDevice } from "./device-trust";

/**
 * Calls to the member-auth Edge Function (supabase/functions/member-auth): signing in with a phone
 * number and PIN, and changing one's PIN. Every answer is turned into something a screen can say.
 */

export type MemberAuthFailure =
  /** Wrong phone or PIN; `remaining` tries before the number locks, when known. */
  | { reason: "invalid"; remaining: number | null }
  | { reason: "locked"; retryAt: Date }
  /** The PIN was right, but this member has been switched off. */
  | { reason: "inactive" }
  /** The session ended before the request (changing a PIN). */
  | { reason: "signedOut" }
  | { reason: "offline" }
  | { reason: "unreachable" }
  | { reason: "notConfigured" };

export type MemberAuthResult = { ok: true } | ({ ok: false } & MemberAuthFailure);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function failureFrom(payload: unknown): MemberAuthFailure {
  const body = isRecord(payload) ? payload : {};
  switch (body.error) {
    case "invalid_credentials":
      return {
        reason: "invalid",
        remaining: typeof body.remaining === "number" ? body.remaining : null,
      };
    case "invalid_phone":
    case "invalid_pin":
      return { reason: "invalid", remaining: null };
    case "locked": {
      const retryAt = typeof body.retryAt === "string" ? new Date(body.retryAt) : null;
      return retryAt && !Number.isNaN(retryAt.getTime())
        ? { reason: "locked", retryAt }
        : { reason: "unreachable" };
    }
    case "inactive":
      return { reason: "inactive" };
    case "not_signed_in":
      return { reason: "signedOut" };
    default:
      return { reason: "unreachable" };
  }
}

async function callMemberAuth(
  body: Record<string, unknown>,
): Promise<{ ok: true; data: unknown } | ({ ok: false } & MemberAuthFailure)> {
  if (!clientEnv.ok) return { ok: false, reason: "notConfigured" };
  const reply = await getSupabase().functions.invoke<unknown>("member-auth", { body });
  // supabase-js types the error loosely; it is one of the Functions*Error classes or null.
  const error: unknown = reply.error;
  if (error === null) return { ok: true, data: reply.data };
  if (error instanceof FunctionsHttpError) {
    const response = error.context as Response;
    const payload: unknown = await response.json().catch(() => null);
    return { ok: false, ...failureFrom(payload) };
  }
  // No answer at all: the network, or the function is not deployed.
  return { ok: false, reason: navigator.onLine ? "unreachable" : "offline" };
}

function readSession(data: unknown): { access_token: string; refresh_token: string } | null {
  const session: unknown = isRecord(data) ? data.session : null;
  if (!isRecord(session)) return null;
  const accessToken = session.access_token;
  const refreshToken = session.refresh_token;
  return typeof accessToken === "string" && typeof refreshToken === "string"
    ? { access_token: accessToken, refresh_token: refreshToken }
    : null;
}

/** Signs in on this device. On someone else's device the session ends when the browser closes. */
export async function signInWithPin({
  phone,
  pin,
  trustDevice,
}: {
  phone: string;
  pin: string;
  trustDevice: boolean;
}): Promise<MemberAuthResult> {
  const result = await callMemberAuth({ action: "sign-in", phone, pin });
  if (!result.ok) return result;
  const session = readSession(result.data);
  if (!session) return { ok: false, reason: "unreachable" };
  setTrustedDevice(trustDevice);
  const { error } = await getSupabase().auth.setSession(session);
  return error ? { ok: false, reason: "unreachable" } : { ok: true };
}

export async function changePin({
  currentPin,
  newPin,
}: {
  currentPin: string;
  newPin: string;
}): Promise<MemberAuthResult> {
  const result = await callMemberAuth({ action: "change-pin", currentPin, newPin });
  return result.ok ? { ok: true } : result;
}
