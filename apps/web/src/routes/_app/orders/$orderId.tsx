import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { SectionPlaceholder } from "@/app/shell/section-placeholder";
import { useFormat } from "@/i18n/hooks";
import { Button } from "@/ui/button";
import { IconBack, IconOrders } from "@/ui/icons";

export const Route = createFileRoute("/_app/orders/$orderId")({
  component: OrderPage,
});

function OrderPage() {
  const { orderId } = Route.useParams();
  const { t } = useTranslation();
  const { digits } = useFormat();
  return (
    <div className="flex flex-col gap-4">
      <Button asChild size="sm" className="self-start">
        <Link to="/orders">
          <IconBack aria-hidden="true" />
          {t("pages.allOrders")}
        </Link>
      </Button>
      <SectionPlaceholder
        section="orders"
        icon={IconOrders}
        title={t("pages.orderTitle", { number: digits(orderId) })}
      />
    </div>
  );
}
