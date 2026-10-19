import { Link, useRouter } from "@tanstack/react-router";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useDocumentTitle } from "./use-document-title";

const actionClass =
  "inline-flex items-center rounded-[10px] bg-brand px-3.5 py-2 text-sm font-semibold text-brand-ink hover:bg-brand-strong";

function StatusLayout({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  useDocumentTitle(title);
  // A section, not <main>: these pages also render inside the app shell's <main>.
  return (
    <section className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-start justify-center gap-3 px-4">
      <h1 className="font-display text-2xl leading-tight font-semibold">{title}</h1>
      <p className="text-ink-2">{body}</p>
      {children}
    </section>
  );
}

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <StatusLayout title={t("errors.notFound.title")} body={t("errors.notFound.body")}>
      <Link to="/" className={actionClass}>
        {t("errors.notFound.action")}
      </Link>
    </StatusLayout>
  );
}

export function ErrorPage({ error, reset }: ErrorComponentProps) {
  const { t } = useTranslation();
  const router = useRouter();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <StatusLayout title={t("errors.unexpected.title")} body={t("errors.unexpected.body")}>
      <button
        type="button"
        className={actionClass}
        onClick={() => {
          reset();
          void router.invalidate();
        }}
      >
        {t("errors.unexpected.action")}
      </button>
    </StatusLayout>
  );
}
