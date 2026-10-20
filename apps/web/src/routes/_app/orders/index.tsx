import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { SectionPlaceholder } from "@/app/shell/section-placeholder";
import { Button } from "@/ui/button";
import { IconOrders, IconPlus } from "@/ui/icons";

export const Route = createFileRoute("/_app/orders/")({
  component: OrdersPage,
});

function OrdersPage() {
  const { t } = useTranslation();
  return (
    <SectionPlaceholder
      section="orders"
      icon={IconOrders}
      actions={
        <Button asChild variant="primary">
          <Link to="/new">
            <IconPlus aria-hidden="true" />
            {t("nav.newOrder")}
          </Link>
        </Button>
      }
    />
  );
}
