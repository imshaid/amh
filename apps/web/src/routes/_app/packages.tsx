import { createFileRoute } from "@tanstack/react-router";

import { PackagesPage } from "@/features/packages/packages-page";
import type { PackagesSearch } from "@/features/packages/packages-page";

export const Route = createFileRoute("/_app/packages")({
  validateSearch: (search: Record<string, unknown>): PackagesSearch => ({
    ...(typeof search.q === "string" && search.q !== "" ? { q: search.q } : {}),
    ...(typeof search.kind === "string" && search.kind !== "" ? { kind: search.kind } : {}),
  }),
  component: PackagesRoute,
});

function PackagesRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <PackagesPage
      search={search}
      onSearchChange={(next) => {
        void navigate({ search: next, replace: true });
      }}
    />
  );
}
