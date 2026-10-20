import { createFileRoute } from "@tanstack/react-router";

import { SectionPlaceholder } from "@/app/shell/section-placeholder";
import { IconClients } from "@/ui/icons";

export const Route = createFileRoute("/_app/clients")({
  component: ClientsPage,
});

function ClientsPage() {
  return <SectionPlaceholder section="clients" icon={IconClients} />;
}
