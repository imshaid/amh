import { createFileRoute, redirect } from "@tanstack/react-router";

import { SignInPage } from "@/app/auth/sign-in-page";
import { membershipQuery, safeRedirect } from "@/lib/auth/membership";

interface SignInSearch {
  /** Where to return after signing in (a path inside the app). */
  redirect?: string;
  /** Why the member was sent here. */
  reason?: "noAccess";
}

// Outside the app frame: no menu, nothing to see before signing in.
export const Route = createFileRoute("/sign-in")({
  validateSearch: (search: Record<string, unknown>): SignInSearch => ({
    ...(typeof search.redirect === "string" ? { redirect: search.redirect } : {}),
    ...(search.reason === "noAccess" ? { reason: "noAccess" as const } : {}),
  }),
  beforeLoad: async ({ context, search }) => {
    const membership = await context.queryClient.query({ ...membershipQuery, staleTime: "static" });
    if (membership.kind === "member" || membership.kind === "unverified") {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router redirects by throwing.
      throw redirect({ href: safeRedirect(search.redirect), replace: true });
    }
  },
  component: SignInRoute,
});

function SignInRoute() {
  const { redirect: redirectTo, reason } = Route.useSearch();
  return <SignInPage redirectTo={redirectTo} reason={reason} />;
}
