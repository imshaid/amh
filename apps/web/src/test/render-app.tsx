import "@/i18n/i18n";

import { QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { render } from "@testing-library/react";

import { createQueryClient } from "@/app/query-client";
import { createAppRouter } from "@/app/router";

/** Renders the whole app at `path`, with in-memory history and a fresh query cache. */
export function renderApp(path = "/") {
  const queryClient = createQueryClient();
  const router = createAppRouter({
    queryClient,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...view, router };
}
