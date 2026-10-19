import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { PlaceholderPage } from "@/app/shell/placeholder-page";

export const Route = createFileRoute("/_app/packages")({
  component: PackagesPage,
});

function PackagesPage() {
  const { t } = useTranslation();
  return <PlaceholderPage title={t("nav.packages")} />;
}
