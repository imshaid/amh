import { useTranslation } from "react-i18next";

import { useFormat } from "@/i18n/hooks";
import { cn } from "@/ui/cn";
import * as Icons from "@/ui/icons";

import { GallerySection, Specimen } from "./section";

const SWATCHES = [
  {
    group: "surfaces",
    tokens: [
      "bg",
      "surface",
      "surface-2",
      "surface-raised",
      "canvas",
      "line",
      "line-strong",
      "field-line",
    ],
  },
  { group: "text", tokens: ["ink", "ink-2", "muted"] },
  {
    group: "brand",
    tokens: ["brand", "brand-strong", "brand-soft", "turmeric", "turmeric-ink", "turmeric-soft"],
  },
  {
    group: "status",
    tokens: [
      "good",
      "good-ink",
      "good-soft",
      "warn",
      "warn-ink",
      "warn-soft",
      "serious",
      "serious-ink",
      "serious-soft",
      "crit",
      "crit-ink",
      "crit-soft",
    ],
  },
  {
    group: "charts",
    tokens: [
      "series-1",
      "series-2",
      "series-3",
      "series-4",
      "series-5",
      "series-6",
      "series-7",
      "series-8",
      "grid",
      "axis",
    ],
  },
  { group: "paper", tokens: ["paper", "paper-ink", "paper-soft", "paper-line", "toast"] },
] as const;

export function ColorsSection() {
  const { t } = useTranslation();
  return (
    <GallerySection
      id="colors"
      title={t("gallery.colors.title")}
      description={t("gallery.colors.body")}
    >
      <div className="grid gap-4 md:grid-cols-2">
        {SWATCHES.map(({ group, tokens }) => (
          <Specimen key={group} label={t(`gallery.colors.groups.${group}`)}>
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-2.5">
              {tokens.map((token) => (
                <li key={token} className="flex min-w-0 flex-col gap-1.5">
                  <span
                    className="h-11 rounded-lg border border-line"
                    style={{ background: `var(--${token})` }}
                  />
                  <code className="truncate font-mono text-xs text-ink-2">--{token}</code>
                </li>
              ))}
            </ul>
          </Specimen>
        ))}
      </div>
    </GallerySection>
  );
}

/** Each type role with the sample it is shown with ("money" is a formatted amount). */
const TYPE_ROLES = [
  { role: "type-hero", sample: "money" },
  { role: "type-title", sample: "sampleTitle" },
  { role: "type-heading", sample: "sampleHeading" },
  { role: "type-subheading", sample: "sampleSubheading" },
  { role: "text-base", sample: "sampleBody" },
  { role: "text-sm text-muted", sample: "sampleMeta" },
  { role: "type-overline", sample: "sampleOverline" },
] as const;

const CODES = ["AMH/26-27/0047", "AMH/26-27/B-0047", "132.01.08", "PBD-2794325", "01700-001214"];
const AMOUNTS = ["102620", "3735", "111880.50", "69270"];

export function TypeSection() {
  const { t } = useTranslation();
  const { money } = useFormat();
  return (
    <GallerySection id="type" title={t("gallery.type.title")} description={t("gallery.type.body")}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Specimen label={t("gallery.type.roles")}>
          <dl className="flex flex-col gap-4">
            {TYPE_ROLES.map(({ role, sample }) => (
              <div key={role} className="grid gap-1 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
                <dt className="font-mono text-xs text-muted sm:pt-1">{role.split(" ")[0]}</dt>
                <dd className={cn("min-w-0", role)}>
                  {sample === "money" ? money("238367.20") : t(`gallery.type.${sample}`)}
                </dd>
              </div>
            ))}
          </dl>
        </Specimen>
        <div className="flex flex-col gap-4">
          <Specimen label={t("gallery.type.width")}>
            <ul className="flex flex-col gap-1.5">
              {[75, 92, 100, 125].map((stretch) => (
                <li key={stretch} className="flex items-baseline gap-3">
                  <span className="w-10 shrink-0 font-mono text-xs text-muted">{stretch}%</span>
                  <span
                    className="font-display text-2xl leading-tight font-strong text-brand-strong"
                    style={{ fontStretch: `${String(stretch)}%` }}
                  >
                    {money("102620")}
                  </span>
                </li>
              ))}
            </ul>
          </Specimen>
          <Specimen label={t("gallery.type.codes")}>
            <ul className="flex flex-col gap-1 font-mono text-sm text-ink-2">
              {CODES.map((code) => (
                <li key={code}>{code}</li>
              ))}
            </ul>
          </Specimen>
          <Specimen label={t("gallery.type.tabular")}>
            <ul className="flex flex-col items-end gap-0.5 text-base tabular">
              {AMOUNTS.map((amount) => (
                <li key={amount}>{money(amount)}</li>
              ))}
            </ul>
          </Specimen>
          <Specimen label={t("gallery.type.documents")}>
            <p className="font-doc-bn text-2xl text-paper-ink">{t("app.name")}</p>
            <p className="font-doc-en text-lg text-paper-ink">
              {t("gallery.type.documentEnglish")}
            </p>
          </Specimen>
        </div>
      </div>
    </GallerySection>
  );
}

/** Every icon the app uses, by the name components import it under. */
const ICON_ENTRIES = Object.entries(Icons).filter(
  (entry): entry is [string, Icons.IconComponent] =>
    entry[0].startsWith("Icon") && entry[0] !== "IconProvider",
);

export function IconsSection() {
  const { t } = useTranslation();
  return (
    <GallerySection
      id="icons"
      title={t("gallery.icons.title")}
      description={t("gallery.icons.body")}
    >
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2">
        {ICON_ENTRIES.map(([name, Icon]) => (
          <li
            key={name}
            className="flex min-w-0 items-center gap-2.5 rounded-lg border border-line bg-surface px-3 py-2.5 text-ink-2"
          >
            <Icon className="size-4.5 shrink-0" aria-hidden="true" />
            <code className="truncate font-mono text-xs">{name.slice(4)}</code>
          </li>
        ))}
      </ul>
    </GallerySection>
  );
}
