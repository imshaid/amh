import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

import { membershipQuery } from "@/lib/auth/membership";
import { clientEnv } from "@/lib/env";
import { getSupabase } from "@/lib/supabase";

/**
 * Keeps every open screen in step with the session. Signing out, here or in another tab, or a
 * session that ended (a member switched off) goes back to the sign-in screen; signing in or a
 * refreshed session checks the membership again.
 */
export function AuthWatcher() {
  const queryClient = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    if (!clientEnv.ok) return;
    const { data } = getSupabase().auth.onAuthStateChange((event) => {
      // Supabase runs this callback inside its own lock; calling it back from here could deadlock.
      setTimeout(() => {
        if (event === "SIGNED_OUT") {
          queryClient.clear();
          queryClient.setQueryData(membershipQuery.queryKey, { kind: "signedOut" });
          const { pathname, href } = router.state.location;
          if (pathname !== "/sign-in")
            void router.navigate({ to: "/sign-in", search: { redirect: href } });
        } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          void queryClient.invalidateQueries({ queryKey: membershipQuery.queryKey });
        }
      }, 0);
    });
    return () => {
      data.subscription.unsubscribe();
    };
  }, [queryClient, router]);

  return null;
}
