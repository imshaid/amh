import { createFileRoute } from "@tanstack/react-router";

import { SectionPlaceholder } from "@/app/shell/section-placeholder";
import { IconIntake } from "@/ui/icons";

export const Route = createFileRoute("/_app/new")({
  component: NewOrderPage,
});

function NewOrderPage() {
  return <SectionPlaceholder section="newOrder" icon={IconIntake} />;
}
