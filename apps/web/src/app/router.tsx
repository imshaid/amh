import type { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import type { RouterHistory } from "@tanstack/react-router";

import { PageSkeleton } from "@/ui/skeleton";

import { routeTree } from "../routeTree.gen";
import { ErrorPage, NotFoundPage } from "./shell/status-page";

export interface RouterContext {
  queryClient: QueryClient;
}

export function createAppRouter({
  queryClient,
  history,
}: {
  queryClient: QueryClient;
  /** Tests pass a memory history; the app uses the browser's. */
  history?: RouterHistory;
}) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",
    defaultNotFoundComponent: NotFoundPage,
    defaultErrorComponent: ErrorPage,
    // Skeletons, not spinners (BLUEPRINT §7); only for loads long enough to notice.
    defaultPendingComponent: PageSkeleton,
    defaultPendingMs: 200,
    defaultPendingMinMs: 300,
    scrollRestoration: true,
    ...(history ? { history } : {}),
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
