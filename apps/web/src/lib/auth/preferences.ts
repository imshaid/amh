import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";

import { i18n, setLanguage } from "@/i18n/i18n";
import type { Language } from "@/i18n/languages";
import { getSupabase } from "@/lib/supabase";
import { getThemePreference, setThemePreference } from "@/lib/theme";
import type { ThemePreference } from "@/lib/theme";

import { membershipQuery, useMember } from "./membership";
import type { Member, Membership } from "./membership";

/**
 * Language and theme belong to the member (BLUEPRINT §4): signing in on a new device brings their
 * choices along, and a change on one device is kept for the next sign-in anywhere. Signed out, the
 * device keeps its own choice.
 */
export function useApplyMemberPreferences(member: Member | null): void {
  const memberId = member?.id;
  useEffect(() => {
    if (!member) return;
    if (member.language !== i18n.language) void setLanguage(member.language);
    if (member.theme !== getThemePreference()) setThemePreference(member.theme);
    // Only when someone signs in: later changes come from this device.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-applying on every profile refetch would undo a change just made here.
  }, [memberId]);
}

/** Choosing a language or theme: applied here at once, saved to the profile when signed in. */
export function usePreferenceSetters() {
  const member = useMember();
  const queryClient = useQueryClient();

  const remember = useCallback(
    (change: Partial<Pick<Member, "language" | "theme">>) => {
      if (!member) return;
      queryClient.setQueryData<Membership>(membershipQuery.queryKey, (current) =>
        current?.kind === "member"
          ? { ...current, member: { ...current.member, ...change } }
          : current,
      );
      // Best effort: if saving fails, this device still has the choice.
      void getSupabase()
        .from("profiles")
        .update(change)
        .eq("id", member.id)
        .then(
          () => undefined,
          () => undefined,
        );
    },
    [member, queryClient],
  );

  const chooseLanguage = useCallback(
    (language: Language) => {
      void setLanguage(language);
      remember({ language });
    },
    [remember],
  );

  const chooseTheme = useCallback(
    (theme: ThemePreference) => {
      setThemePreference(theme);
      remember({ theme });
    },
    [remember],
  );

  return { chooseLanguage, chooseTheme };
}
