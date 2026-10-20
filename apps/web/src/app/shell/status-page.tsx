import { Link, useRouter } from "@tanstack/react-router";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/button";
import { EmptyState } from "@/ui/empty-state";
import { IconBack, IconError, IconRetry, IconSearch } from "@/ui/icons";

import { BrandMark } from "./brand-mark";
import { usePageTitle } from "./page-title-context";

/** An address that matches no screen. Shown without the app frame, so it carries the brand. */
export function NotFoundPage() {
  const { t } = useTranslation();
  usePageTitle(t("errors.notFound.title"));
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center gap-6 px-4 py-10">
      <BrandMark className="size-11" />
      <h1 className="type-title">{t("errors.notFound.title")}</h1>
      <EmptyState
        icon={IconSearch}
        kind="no-results"
        title={t("errors.notFound.lead")}
        body={t("errors.notFound.body")}
        actions={
          <Button asChild variant="primary">
            <Link to="/">
              <IconBack aria-hidden="true" />
              {t("errors.notFound.action")}
            </Link>
          </Button>
        }
      />
    </main>
  );
}

/** A screen that failed to render: say so, keep the frame, and offer to try again. */
export function ErrorPage({ error, reset }: ErrorComponentProps) {
  const { t } = useTranslation();
  const router = useRouter();
  usePageTitle(t("errors.unexpected.title"));
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <section className="flex flex-col gap-6">
      <h1 className="type-title">{t("errors.unexpected.title")}</h1>
      <EmptyState
        icon={IconError}
        kind="error"
        title={t("errors.unexpected.lead")}
        body={t("errors.unexpected.body")}
        actions={
          <Button
            variant="primary"
            onClick={() => {
              reset();
              void router.invalidate();
            }}
          >
            <IconRetry aria-hidden="true" />
            {t("errors.unexpected.action")}
          </Button>
        }
      />
    </section>
  );
}
