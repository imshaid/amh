import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";

import { EmptyState } from "@/ui/empty-state";
import type { IconComponent } from "@/ui/icons";
import { PageHeader } from "@/ui/page-header";

import { usePageTitle } from "./page-title-context";

export type Section =
  "dashboard" | "orders" | "newOrder" | "receivables" | "clients" | "locations" | "packages";

/**
 * A screen that a later segment builds: its real title and subtitle, and a note saying what will
 * appear here.
 */
export function SectionPlaceholder({
  section,
  icon,
  title,
  eyebrow,
  actions,
}: {
  section: Section;
  icon: IconComponent;
  /** Overrides the section name, e.g. an order's number. */
  title?: string;
  eyebrow?: ReactNode;
  actions?: ReactNode;
}) {
  const { t } = useTranslation();
  const heading = title ?? t(`nav.${section}`);
  usePageTitle(heading);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={heading}
        eyebrow={eyebrow}
        subtitle={t(`pages.${section}.subtitle`)}
        actions={actions}
      />
      <EmptyState
        icon={icon}
        title={t("pages.building.title")}
        body={t(`pages.${section}.upcoming`)}
      />
    </div>
  );
}
