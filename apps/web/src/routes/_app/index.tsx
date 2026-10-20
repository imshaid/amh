import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { SectionPlaceholder } from "@/app/shell/section-placeholder";
import { useFormat } from "@/i18n/hooks";
import { Button } from "@/ui/button";
import { IconDashboard, IconPlus, IconSms } from "@/ui/icons";

export const Route = createFileRoute("/_app/")({
  component: DashboardPage,
});

function DashboardPage() {
  const { t } = useTranslation();
  const { date } = useFormat();
  const [today] = useState(() => new Date());
  return (
    <SectionPlaceholder
      section="dashboard"
      icon={IconDashboard}
      eyebrow={date(today)}
      actions={
        <>
          <Button asChild>
            <Link to="/receivables">
              <IconSms aria-hidden="true" />
              {t("actions.matchPayment")}
            </Link>
          </Button>
          <Button asChild variant="primary">
            <Link to="/new">
              <IconPlus aria-hidden="true" />
              {t("nav.newOrder")}
            </Link>
          </Button>
        </>
      }
    />
  );
}
