import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { queryOptions, useQuery } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";

import type { Language } from "@/i18n/languages";
import type { Tables } from "@/lib/database.gen";
import { clientEnv } from "@/lib/env";
import { getSupabase } from "@/lib/supabase";

export type Member = Pick<
  Tables<"profiles">,
  "id" | "phone" | "display_name_bn" | "display_name_en" | "language" | "theme"
>;

/** Who is using this device. */
export type Membership =
  /** No backend is configured: the app is a UI preview without data or sign-in. */
  | { kind: "preview" }
  | { kind: "signedOut" }
  /** Signed in, but not (or no longer) a member. */
  | { kind: "noAccess" }
  /** Signed in here, but the server could not be asked (offline): let them in and check later. */
  | { kind: "unverified" }
  | { kind: "member"; member: Member };

const MEMBER_COLUMNS = "id, phone, display_name_bn, display_name_en, language, theme";

export async function loadMembership(): Promise<Membership> {
  if (!clientEnv.ok) return { kind: "preview" };
  const supabase = getSupabase();
  const { data, error: sessionError } = await supabase.auth.getSession();
  if (sessionError)
    return isAuthRetryableFetchError(sessionError) ? { kind: "unverified" } : { kind: "signedOut" };
  if (!data.session) return { kind: "signedOut" };

  // RLS shows profiles to active members only, so an empty answer means no access.
  const { data: profile, error } = await supabase
    .from("profiles")
    .select(MEMBER_COLUMNS)
    .eq("id", data.session.user.id)
    .maybeSingle();
  if (error) return { kind: "unverified" };
  return profile ? { kind: "member", member: profile } : { kind: "noAccess" };
}

/** Fetched once per sign-in; the auth watcher refreshes it when the session changes. */
export const membershipQuery = queryOptions({
  queryKey: ["membership"],
  queryFn: loadMembership,
  staleTime: Number.POSITIVE_INFINITY,
  gcTime: Number.POSITIVE_INFINITY,
  retry: false,
});

export function useMembership(): Membership | undefined {
  return useQuery(membershipQuery).data;
}

/** The signed-in member, or null (signed out, previewing, or not checked yet). */
export function useMember(): Member | null {
  const membership = useMembership();
  return membership?.kind === "member" ? membership.member : null;
}

/** Signs out on this device only, and forgets everything fetched for the member. */
export async function signOut(queryClient: QueryClient): Promise<void> {
  if (clientEnv.ok) await getSupabase().auth.signOut({ scope: "local" });
  queryClient.clear();
  queryClient.setQueryData(membershipQuery.queryKey, { kind: "signedOut" });
}

/**
 * Where to go after signing in: only a path inside the app, never another site. Browsers read
 * "/\evil.example" like "//evil.example", so a slash or backslash may not follow the first slash.
 */
export function safeRedirect(target: string | undefined): string {
  return target !== undefined && /^\/(?![/\\])/.test(target) && !target.startsWith("/sign-in")
    ? target
    : "/";
}

/** The member's name in the interface language; the Bangla name when there is no English one. */
export function memberName(member: Member, language: Language): string {
  return language === "en" && member.display_name_en.trim() !== ""
    ? member.display_name_en
    : member.display_name_bn;
}
