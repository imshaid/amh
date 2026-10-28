import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";
import { vi } from "vitest";

import type { Member } from "@/lib/auth/membership";

/**
 * A stand-in for the Supabase client, enough for signing in and the membership check. Tests set
 * what the server would say: the stored session, the member's profile (null when RLS hides it),
 * and member-auth's answers.
 */

type AuthEvent = "SIGNED_IN" | "SIGNED_OUT" | "TOKEN_REFRESHED";

export interface FakeServer {
  session: { access_token: string; refresh_token: string; user: { id: string } } | null;
  /** What `profiles` shows the signed-in user: their row, or nothing (not an active member). */
  profile: Member | null;
  /** member-auth's reply to each call. */
  memberAuth: (body: Record<string, unknown>) => FunctionReply;
}

export type FunctionReply =
  | { status: 200; body: unknown }
  | { status: 401 | 403 | 423 | 400 | 500; body: unknown }
  | { status: "network" };

export const MOTHER: Member = {
  id: "11111111-1111-4111-8111-111111111111",
  phone: "01711000001",
  display_name_bn: "মা",
  display_name_en: "Ma",
  language: "bn",
  theme: "system",
};

/** member-auth handing out a session for the right PIN. */
export function sessionReply(): FunctionReply {
  return { status: 200, body: { session: { access_token: "access", refresh_token: "refresh" } } };
}

export function createFakeSupabase(server: FakeServer) {
  const listeners = new Set<(event: AuthEvent) => void>();
  const emit = (event: AuthEvent) => {
    for (const listener of listeners) listener(event);
  };

  const client = {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: server.session }, error: null })),
      setSession: vi.fn(
        ({ access_token, refresh_token }: { access_token: string; refresh_token: string }) => {
          server.session = {
            access_token,
            refresh_token,
            user: { id: server.profile?.id ?? "someone" },
          };
          emit("SIGNED_IN");
          return Promise.resolve({ data: { session: server.session }, error: null });
        },
      ),
      signOut: vi.fn(() => {
        server.session = null;
        emit("SIGNED_OUT");
        return Promise.resolve({ error: null });
      }),
      onAuthStateChange: vi.fn((listener: (event: AuthEvent) => void) => {
        listeners.add(listener);
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                listeners.delete(listener);
              },
            },
          },
        };
      }),
    },
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: server.profile, error: null }),
        }),
      }),
      update: vi.fn((change: Partial<Member>) => ({
        eq: () => {
          if (server.profile) server.profile = { ...server.profile, ...change };
          return Promise.resolve({ error: null });
        },
      })),
    })),
    functions: {
      invoke: vi.fn((_name: string, { body }: { body: Record<string, unknown> }) => {
        const reply = server.memberAuth(body);
        if (reply.status === "network") {
          return Promise.resolve({
            data: null,
            error: new FunctionsFetchError(new TypeError("Failed to fetch")),
          });
        }
        if (reply.status === 200) return Promise.resolve({ data: reply.body, error: null });
        const response = new Response(JSON.stringify(reply.body), { status: reply.status });
        return Promise.resolve({ data: null, error: new FunctionsHttpError(response) });
      }),
    },
  };
  return { client, emit };
}

/** Environment for a configured backend; the values are placeholders, never contacted. */
export const CONFIGURED_ENV = {
  ok: true as const,
  env: {
    VITE_SUPABASE_URL: "http://supabase.test",
    VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  },
};
