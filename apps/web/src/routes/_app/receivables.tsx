import { createFileRoute } from "@tanstack/react-router";

import { SectionPlaceholder } from "@/app/shell/section-placeholder";
import { IconReceivables } from "@/ui/icons";

export const Route = createFileRoute("/_app/receivables")({
  component: ReceivablesPage,
});

function ReceivablesPage() {
  return <SectionPlaceholder section="receivables" icon={IconReceivables} />;
}
