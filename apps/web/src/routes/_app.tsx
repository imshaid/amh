import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/app/shell/app-shell";

// Pathless layout: every signed-in screen renders inside the app shell. Screens without the shell
// (sign-in, delivery links) will sit beside it under the root route.
export const Route = createFileRoute("/_app")({
  component: AppShell,
});
