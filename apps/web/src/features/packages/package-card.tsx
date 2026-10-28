import { useTranslation } from "react-i18next";

import { useFormat, useLanguage } from "@/i18n/hooks";
import { useLiveSignal } from "@/lib/data/live";
import { cn } from "@/ui/cn";
import { IconWarning } from "@/ui/icons";
import { useFlash } from "@/ui/motion/flash";
import { Tag } from "@/ui/tag";

import type { PackageRow } from "./api";

/** Item lines shown on a card before "n more". */
const VISIBLE_ITEMS = 4;

/**
 * A package as people know it: the price first and largest (BLUEPRINT §7), then the WV code, a
 * warning when another package shares the price, and the item lines in the interface language.
 * The name is the button that opens the editor; it covers the whole card.
 */
export function PackageCard({
  item,
  categoryName,
  shared,
  hit,
  onOpen,
}: {
  item: PackageRow;
  /** Shown when the card is not already under its kind's heading. */
  categoryName: string | null;
  /** Another active package has the same price. */
  shared: boolean;
  /** The typed price is exactly this package's. */
  hit: boolean;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const language = useLanguage();
  const { money, number } = useFormat();
  const flashRef = useFlash<HTMLElement>(useLiveSignal(item.id));
  const lines = item.items.map((line) => (language === "bn" && line.bn ? line.bn : line.en));
  const hidden = lines.length - VISIBLE_ITEMS;

  return (
    <article
      ref={flashRef}
      className={cn(
        "group relative flex h-full flex-col gap-2 rounded-xl border bg-surface p-4",
        "transition-[border-color,transform,box-shadow] duration-200 ease-out",
        "hover:-translate-y-0.5 hover:border-line-strong has-focus-visible:border-brand",
        hit ? "border-brand shadow-[inset_0_0_0_1px_var(--brand)]" : "border-line",
        !item.active && "bg-surface-2",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={cn("type-figure", item.active ? "text-brand-strong" : "text-muted")}>
          {money(item.rate)}
        </p>
        <div className="flex flex-wrap justify-end gap-1">
          {item.active ? null : <Tag>{t("packages.inactiveTag")}</Tag>}
          {categoryName ? <Tag>{categoryName}</Tag> : null}
        </div>
      </div>
      <h3 className="leading-snug font-semibold">
        <button
          type="button"
          onClick={onOpen}
          aria-label={t("packages.edit", { name: item.name })}
          className="text-left outline-none after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-brand"
        >
          {item.name}
        </button>
      </h3>
      {shared && item.active ? (
        <Tag tone="warn" className="self-start" title={t("packages.sharedHint")}>
          <IconWarning aria-hidden="true" />
          {t("packages.shared")}
        </Tag>
      ) : null}
      {lines.length > 0 ? (
        <ol className="flex list-decimal flex-col gap-0.5 pl-4.5 text-sm text-ink-2 marker:text-muted">
          {lines.slice(0, VISIBLE_ITEMS).map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ol>
      ) : null}
      {hidden > 0 ? (
        <p className="text-xs text-muted">
          {t("packages.moreItems", { count: hidden, n: number(hidden) })}
        </p>
      ) : null}
    </article>
  );
}
