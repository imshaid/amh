import { createFileRoute } from "@tanstack/react-router";

import { SectionPlaceholder } from "@/app/shell/section-placeholder";
import { IconLocation } from "@/ui/icons";

export const Route = createFileRoute("/_app/locations")({
  component: LocationsPage,
});

function LocationsPage() {
  return <SectionPlaceholder section="locations" icon={IconLocation} />;
}
