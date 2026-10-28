import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { LoadErrorState, NotConfiguredState } from "@/app/data-states";
import { usePageTitle } from "@/app/shell/page-title-context";
import { localName } from "@/features/directory/names";
import { useFormat, useLanguage } from "@/i18n/hooks";
import { clientEnv } from "@/lib/env";
import { matchesAllWords } from "@/lib/search";
import { Button } from "@/ui/button";
import { Chip, ChipGroup } from "@/ui/chip";
import { EmptyState } from "@/ui/empty-state";
import { IconPackage, IconPlus, IconSearch, IconUpload } from "@/ui/icons";
import { SearchInput } from "@/ui/input";
import { Stagger, StaggerItem } from "@/ui/motion/stagger";
import { PageHeader } from "@/ui/page-header";
import { Skeleton } from "@/ui/skeleton";

import { categoriesQuery, packagesQuery } from "./api";
import type { CategoryRow, PackageRow } from "./api";
import { ImportDialog } from "./import-dialog";
import { PackageCard } from "./package-card";
import { PackageEditor } from "./package-editor";
import { priceMatch, priceSearch, rateKey, sharedRates } from "./price";

export interface PackagesSearch {
  /** A price ("430", "৪৩০") or words of a name. */
  q?: string | undefined;
  /** A category id, or "off" for switched-off packages; all active ones when absent. */
  kind?: string | undefined;
}

const GRID = "grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3";

/**
 * Packages and prices (BLUEPRINT §5.7): price-first cards grouped by kind, a price search that
 * answers "which package is ৳430?", duplicate-price warnings, the editor and the Excel import.
 */
export function PackagesPage({
  search,
  onSearchChange,
}: {
  search: PackagesSearch;
  onSearchChange: (next: PackagesSearch) => void;
}) {
  const { t } = useTranslation();
  usePageTitle(t("nav.packages"));
  const packages = useQuery(packagesQuery);
  const categories = useQuery(categoriesQuery);
  const [editor, setEditor] = useState<{ open: boolean; id: string | null }>({
    open: false,
    id: null,
  });
  const [importing, setImporting] = useState(false);

  const ready = packages.data && categories.data;
  const actions = ready ? (
    <>
      <Button
        onClick={() => {
          setImporting(true);
        }}
      >
        <IconUpload aria-hidden="true" />
        {t("packages.importAction")}
      </Button>
      <Button
        variant="primary"
        onClick={() => {
          setEditor({ open: true, id: null });
        }}
      >
        <IconPlus aria-hidden="true" />
        {t("packages.add")}
      </Button>
    </>
  ) : undefined;

  let body;
  if (!clientEnv.ok) body = <NotConfiguredState />;
  else if (packages.error ?? categories.error)
    body = (
      <LoadErrorState
        error={packages.error ?? categories.error}
        onRetry={() => {
          void packages.refetch();
          void categories.refetch();
        }}
      />
    );
  else if (!packages.data || !categories.data) body = <CardsSkeleton />;
  else if (packages.data.length === 0)
    body = (
      <EmptyState
        icon={IconPackage}
        title={t("packages.empty.title")}
        body={t("packages.empty.body")}
        actions={actions}
      />
    );
  else
    body = (
      <PackageList
        packages={packages.data}
        categories={categories.data}
        search={search}
        onSearchChange={onSearchChange}
        onOpen={(id) => {
          setEditor({ open: true, id });
        }}
      />
    );

  const editing = editor.id ? (packages.data?.find((item) => item.id === editor.id) ?? null) : null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("nav.packages")}
        subtitle={t("pages.packages.subtitle")}
        actions={packages.data?.length ? actions : undefined}
      />
      {body}
      <PackageEditor
        open={editor.open}
        onOpenChange={(open) => {
          setEditor((current) => ({ ...current, open }));
        }}
        item={editing}
        packages={packages.data ?? []}
      />
      <ImportDialog open={importing} onOpenChange={setImporting} />
    </div>
  );
}

function PackageList({
  packages,
  categories,
  search,
  onSearchChange,
  onOpen,
}: {
  packages: readonly PackageRow[];
  categories: readonly CategoryRow[];
  search: PackagesSearch;
  onSearchChange: (next: PackagesSearch) => void;
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation();
  const language = useLanguage();
  const { money, number } = useFormat();
  const query = search.q ?? "";
  const kind = search.kind ?? "all";
  const digits = priceSearch(query);

  const categoryName = useMemo(() => {
    const names = new Map(
      categories.map((category) => [
        category.id,
        localName(language, { en: category.nameEn, bn: category.nameBn }),
      ]),
    );
    return (id: string) => names.get(id) ?? "";
  }, [categories, language]);
  const shared = useMemo(() => sharedRates(packages), [packages]);
  const inactiveCount = packages.filter((item) => !item.active).length;

  const visible = packages
    .filter((item) =>
      kind === "off" ? !item.active : item.active && (kind === "all" || item.categoryId === kind),
    )
    .filter((item) => {
      if (digits !== null) return priceMatch(item.rate, digits) !== null;
      const category = categories.find((entry) => entry.id === item.categoryId);
      return matchesAllWords(query, [
        item.name,
        category?.nameEn ?? "",
        category?.nameBn ?? "",
        ...item.items.flatMap((line) => [line.en, line.bn ?? ""]),
        ...item.clientCodes.map((code) => code.code),
      ]);
    });

  // Without a search the cards are grouped by kind; a search shows one list, exact prices first.
  const searching = query.trim() !== "";
  const card = (item: PackageRow) => (
    <StaggerItem key={item.id}>
      <PackageCard
        item={item}
        categoryName={searching ? categoryName(item.categoryId) : null}
        shared={shared.has(rateKey(item.rate))}
        hit={digits !== null && priceMatch(item.rate, digits) === "exact"}
        onOpen={() => {
          onOpen(item.id);
        }}
      />
    </StaggerItem>
  );

  const groups = searching
    ? []
    : categories
        .map((category) => ({
          category,
          items: visible.filter((item) => item.categoryId === category.id),
        }))
        .filter((group) => group.items.length > 0);
  const results = searching
    ? [...visible].sort(
        (a, b) =>
          Number(digits !== null && priceMatch(b.rate, digits) === "exact") -
          Number(digits !== null && priceMatch(a.rate, digits) === "exact"),
      )
    : [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <ChipGroup
          label={t("packages.categoryFilter")}
          // Phones: one row that scrolls sideways, so the price search stays near the top.
          className="max-lg:-mx-4 max-lg:[scrollbar-width:none] max-lg:flex-nowrap max-lg:overflow-x-auto max-lg:px-4 max-lg:pb-1 sm:max-lg:-mx-6 sm:max-lg:px-6"
          value={kind}
          onValueChange={(next) => {
            onSearchChange({ ...search, kind: next === "all" ? undefined : next });
          }}
        >
          <Chip value="all" count={packages.filter((item) => item.active).length}>
            {t("packages.allCategories")}
          </Chip>
          {categories.map((category) => {
            const count = packages.filter(
              (item) => item.active && item.categoryId === category.id,
            ).length;
            return count > 0 ? (
              <Chip key={category.id} value={category.id} count={count}>
                {categoryName(category.id)}
              </Chip>
            ) : null;
          })}
          {inactiveCount > 0 ? (
            <Chip value="off" count={inactiveCount}>
              {t("packages.inactiveFilter")}
            </Chip>
          ) : null}
        </ChipGroup>
        <SearchInput
          className="max-lg:order-first lg:w-72"
          value={query}
          onValueChange={(next) => {
            onSearchChange({ ...search, q: next === "" ? undefined : next });
          }}
          aria-label={t("packages.search")}
          placeholder={t("packages.searchPlaceholder")}
          inputMode="search"
          autoComplete="off"
        />
      </div>
      <p className="sr-only" role="status">
        {t("packages.found", { count: visible.length, n: number(visible.length) })}
      </p>
      {visible.length === 0 ? (
        <EmptyState
          kind="no-results"
          icon={IconSearch}
          title={
            digits !== null
              ? t("packages.noPrice.title", { price: money(digits) })
              : t("packages.noMatch.title")
          }
          body={digits !== null ? t("packages.noPrice.body") : t("packages.noMatch.body")}
        />
      ) : searching ? (
        <Stagger key={`search:${kind}`} className={GRID}>
          {results.map(card)}
        </Stagger>
      ) : (
        <Stagger key={`groups:${kind}`} className="flex flex-col gap-6">
          {groups.map(({ category, items }) => (
            <section
              key={category.id}
              className="flex flex-col gap-2.5"
              aria-labelledby={`kind-${category.id}`}
            >
              <h2 id={`kind-${category.id}`} className="type-overline">
                {categoryName(category.id)}
              </h2>
              <div className={GRID}>{items.map(card)}</div>
            </section>
          ))}
        </Stagger>
      )}
    </div>
  );
}

function CardsSkeleton() {
  const { t } = useTranslation();
  return (
    <div role="status" aria-live="polite" className={GRID}>
      <span className="sr-only">{t("ui.loading")}</span>
      {Array.from({ length: 8 }, (_, index) => (
        <Skeleton key={index} className="h-44 rounded-xl" />
      ))}
    </div>
  );
}
