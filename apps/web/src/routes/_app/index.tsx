import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { PlaceholderPage } from "@/app/shell/placeholder-page";
import { ServerStatusLine } from "@/app/shell/server-status";

export const Route = createFileRoute("/_app/")({
  component: DashboardPage,
});

function DashboardPage() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-5">
      <PlaceholderPage title={t("nav.dashboard")} />
      <ServerStatusLine />
    </div>
  );
}
