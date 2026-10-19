import { useTranslation } from "react-i18next";

import { useDocumentTitle } from "./use-document-title";

/** Stands in for a screen that a later segment builds. */
export function PlaceholderPage({ title }: { title: string }) {
  const { t } = useTranslation();
  useDocumentTitle(title);
  return (
    <section className="flex flex-col gap-1.5">
      <h1 className="font-display text-[clamp(24px,3vw,30px)] leading-tight font-semibold text-balance">
        {title}
      </h1>
      <p className="text-muted">{t("pages.inProgress")}</p>
    </section>
  );
}
