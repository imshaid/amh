import { createFileRoute } from "@tanstack/react-router";

import { SectionPlaceholder } from "@/app/shell/section-placeholder";
import { IconPackage } from "@/ui/icons";

export const Route = createFileRoute("/_app/packages")({
  component: PackagesPage,
});

function PackagesPage() {
  return <SectionPlaceholder section="packages" icon={IconPackage} />;
}
