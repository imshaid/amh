import { useTranslation } from "react-i18next";

import { Button } from "@/ui/button";
import { Card, CardHeader } from "@/ui/card";
import { EmptyState } from "@/ui/empty-state";
import {
  IconOffline,
  IconOrders,
  IconPlus,
  IconRetry,
  IconSearch,
  IconServerOff,
} from "@/ui/icons";
import { Skeleton, SkeletonText } from "@/ui/skeleton";

import { GallerySection, Specimen } from "./section";

export function StatesSection() {
  const { t } = useTranslation();
  return (
    <GallerySection
      id="states"
      title={t("gallery.states.title")}
      description={t("gallery.states.body")}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Specimen label={t("gallery.states.loading")}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2 rounded-xl border border-line p-4">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-7 w-40" />
              <Skeleton className="h-3 w-32" />
            </div>
            <SkeletonText lines={4} className="rounded-xl border border-line p-4" />
          </div>
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} className="h-11 rounded-lg" />
            ))}
          </div>
        </Specimen>
        <Card>
          <CardHeader
            title={t("gallery.states.inPanel")}
            subtitle={t("gallery.states.inPanelHint")}
          />
          <EmptyState
            size="sm"
            kind="no-results"
            icon={IconSearch}
            title={t("gallery.states.noResultsTitle")}
            body={t("gallery.states.noResultsBody")}
          />
        </Card>
        <EmptyState
          icon={IconOrders}
          title={t("gallery.states.emptyTitle")}
          body={t("gallery.states.emptyBody")}
          actions={
            <Button variant="primary">
              <IconPlus aria-hidden="true" />
              {t("nav.newOrder")}
            </Button>
          }
        />
        <EmptyState
          kind="error"
          icon={IconServerOff}
          title={t("gallery.states.errorTitle")}
          body={t("gallery.states.errorBody")}
          actions={
            <Button>
              <IconRetry aria-hidden="true" />
              {t("errors.unexpected.action")}
            </Button>
          }
        />
        <EmptyState
          kind="unavailable"
          icon={IconOffline}
          title={t("gallery.states.offlineTitle")}
          body={t("gallery.states.offlineBody")}
          className="lg:col-span-2"
        />
      </div>
    </GallerySection>
  );
}
