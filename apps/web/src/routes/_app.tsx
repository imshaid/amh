import { createFileRoute, redirect } from "@tanstack/react-router";

import { AppShell } from "@/app/shell/app-shell";
import { membershipQuery, signOut } from "@/lib/auth/membership";

// Pathless layout: every signed-in screen renders inside the app shell, and only members get in.
// Screens without the shell (sign-in, delivery links) sit beside it under the root route. Without
// a backend configured the app is a UI preview and opens without signing in.
export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context, location }) => {
    const membership = await context.queryClient.query({ ...membershipQuery, staleTime: "static" });
    if (membership.kind === "signedOut") {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router redirects by throwing.
      throw redirect({ to: "/sign-in", search: { redirect: location.href } });
    }
    if (membership.kind === "noAccess") {
      await signOut(context.queryClient);
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router redirects by throwing.
      throw redirect({ to: "/sign-in", search: { reason: "noAccess" } });
    }
    return { membership };
  },
  component: AppShell,
});
