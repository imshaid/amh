import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { PlaceholderPage } from "@/app/shell/placeholder-page";
import { useFormat } from "@/i18n/hooks";

export const Route = createFileRoute("/_app/orders/$orderId")({
  component: OrderPage,
});

function OrderPage() {
  const { orderId } = Route.useParams();
  const { t } = useTranslation();
  const { digits } = useFormat();
  return <PlaceholderPage title={t("pages.orderTitle", { number: digits(orderId) })} />;
}
