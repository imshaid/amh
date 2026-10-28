import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { useMembership } from "@/lib/auth/membership";
import { startLiveSync } from "@/lib/data/live";
import { clientEnv } from "@/lib/env";
import { getSupabase } from "@/lib/supabase";

/** Keeps this device's screens in step with every other device while a member is signed in. */
export function LiveSync() {
  const queryClient = useQueryClient();
  const kind = useMembership()?.kind;
  const signedIn = kind === "member" || kind === "unverified";

  useEffect(() => {
    if (!signedIn || !clientEnv.ok) return;
    return startLiveSync(getSupabase(), queryClient);
  }, [signedIn, queryClient]);

  return null;
}
