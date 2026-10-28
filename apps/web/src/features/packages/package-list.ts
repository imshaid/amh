import { cellText } from "@/lib/xlsx/read-workbook";
import type { Cell, Sheet, Workbook } from "@/lib/xlsx/read-workbook";

import { parseRate, rateFromNumber } from "./price";

/*
 * Reads a package list workbook (docs/reference/packages-new.xlsx) into what
 * public.import_package_list takes. Sheet "packages": one row per package (code, category,
 * category_bn, rate_bdt, notes). Sheet "items": item lines (code, position, text_en, text_bn).
 * Other columns, such as WV's original wording, are ignored. Anything that would make the import
 * guess is reported instead, with the spreadsheet row it is on.
 */

export interface ItemLine {
  en: string;
  bn?: string;
}

export interface PackageListInput {
  categories: { name_en: string; name_bn?: string }[];
  packages: {
    name: string;
    category: string;
    rate: string;
    items?: ItemLine[];
    notes?: string;
  }[];
}

/** A problem that stops the import until the file is fixed. `row` is the sheet's row number. */
export type ListIssue =
  | { kind: "noPackageSheet" }
  | { kind: "missingColumn"; column: "code" | "category" | "rate" }
  | { kind: "missingRate"; row: number; name: string }
  | { kind: "badRate"; row: number; name: string; value: string }
  | { kind: "missingCategory"; row: number; name: string }
  | { kind: "duplicate"; row: number; name: string }
  | { kind: "unknownPackage"; row: number; name: string }
  | { kind: "missingItemText"; row: number; name: string };

export interface ParsedPackageList {
  list: PackageListInput;
  issues: ListIssue[];
  /** Packages that have no item lines in a file that has an items sheet. */
  withoutItems: string[];
  itemCount: number;
}

const PACKAGE_COLUMNS = {
  name: ["code", "name", "package", "package_name"],
  category: ["category"],
  categoryBn: ["category_bn", "category_bangla"],
  rate: ["rate_bdt", "rate", "price", "rate_tk"],
  notes: ["notes", "note"],
} as const;

const ITEM_COLUMNS = {
  name: ["code", "package", "name"],
  position: ["position", "sl", "order"],
  en: ["text_en", "item", "item_en", "en"],
  bn: ["text_bn", "item_bn", "bn"],
} as const;

/** "Rate (BDT)" -> "rate_bdt", "category_bn" -> "category_bn". */
function headerKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/** The same name typed with other spacing or case is the same package (as in the database). */
function nameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.'’]/g, "")
    .replace(/[\s\p{P}\p{S}]+/gu, " ")
    .trim();
}

type ColumnMap<TKey extends string> = Partial<Record<TKey, number>>;

interface HeaderFound<TKey extends string> {
  /** Index of the header row in `sheet.rows`. */
  index: number;
  columns: ColumnMap<TKey>;
}

function findHeader<TKey extends string>(
  sheet: Sheet,
  aliases: Record<TKey, readonly string[]>,
  required: readonly NoInfer<TKey>[],
): HeaderFound<TKey> | null {
  const limit = Math.min(sheet.rows.length, 10);
  for (let index = 0; index < limit; index += 1) {
    const keys = (sheet.rows[index] ?? []).map((cell) => headerKey(cellText(cell)));
    const columns: ColumnMap<TKey> = {};
    for (const [field, names] of Object.entries(aliases) as [TKey, readonly string[]][]) {
      const column = keys.findIndex((key) => names.includes(key));
      if (column >= 0) columns[field] = column;
    }
    if (required.every((field) => columns[field] !== undefined)) return { index, columns };
  }
  return null;
}

function cellAt(row: readonly (Cell | null)[], column: number | undefined): Cell | null {
  return column === undefined ? null : (row[column] ?? null);
}

function rateOf(cell: Cell | null): string | null {
  if (!cell) return null;
  return typeof cell.value === "number" ? rateFromNumber(cell.value) : parseRate(cellText(cell));
}

function sheetNamed(workbook: Workbook, name: string): Sheet | undefined {
  return workbook.sheets.find((sheet) => sheet.name.trim().toLowerCase() === name);
}

export function parsePackageList(workbook: Workbook): ParsedPackageList {
  const issues: ListIssue[] = [];
  const empty: ParsedPackageList = {
    list: { categories: [], packages: [] },
    issues,
    withoutItems: [],
    itemCount: 0,
  };

  // The packages sheet: by name, else the first sheet with code, category and rate columns.
  const candidates = [
    sheetNamed(workbook, "packages"),
    ...workbook.sheets.filter((sheet) => sheet !== sheetNamed(workbook, "packages")),
  ].filter((sheet): sheet is Sheet => sheet !== undefined);
  let packageSheet: Sheet | undefined;
  let header: HeaderFound<keyof typeof PACKAGE_COLUMNS> | null = null;
  for (const sheet of candidates) {
    header = findHeader(sheet, PACKAGE_COLUMNS, ["name"]);
    if (header) {
      packageSheet = sheet;
      break;
    }
  }
  if (!packageSheet || !header) {
    issues.push({ kind: "noPackageSheet" });
    return empty;
  }
  const { columns } = header;
  if (columns.category === undefined) issues.push({ kind: "missingColumn", column: "category" });
  if (columns.rate === undefined) issues.push({ kind: "missingColumn", column: "rate" });
  if (issues.length > 0) return empty;

  const categories = new Map<string, { name_en: string; name_bn?: string }>();
  const packages: PackageListInput["packages"] = [];
  const packageKeys = new Map<string, number>();

  packageSheet.rows.slice(header.index + 1).forEach((row, offset) => {
    const rowNumber = header.index + offset + 2;
    const name = cellText(cellAt(row, columns.name));
    if (name === "") return;
    const key = nameKey(name);
    if (packageKeys.has(key)) {
      issues.push({ kind: "duplicate", row: rowNumber, name });
      return;
    }
    packageKeys.set(key, packages.length);

    const category = cellText(cellAt(row, columns.category));
    const rateCell = cellAt(row, columns.rate);
    const rate = rateOf(rateCell);
    if (category === "") issues.push({ kind: "missingCategory", row: rowNumber, name });
    if (!rateCell) issues.push({ kind: "missingRate", row: rowNumber, name });
    else if (rate === null)
      issues.push({ kind: "badRate", row: rowNumber, name, value: cellText(rateCell) });

    const categoryKey = nameKey(category);
    const categoryBn = cellText(cellAt(row, columns.categoryBn));
    const known = categories.get(categoryKey);
    if (category !== "" && !known) {
      categories.set(categoryKey, {
        name_en: category,
        ...(categoryBn ? { name_bn: categoryBn } : {}),
      });
    } else if (known && !known.name_bn && categoryBn) {
      known.name_bn = categoryBn;
    }

    packages.push({
      name,
      category: known?.name_en ?? category,
      rate: rate ?? "",
      ...(columns.notes === undefined ? {} : { notes: cellText(cellAt(row, columns.notes)) }),
    });
  });

  // Item lines, when the workbook has them.
  const itemSheet =
    sheetNamed(workbook, "items") ??
    workbook.sheets.find(
      (sheet) => sheet !== packageSheet && findHeader(sheet, ITEM_COLUMNS, ["name", "en"]),
    );
  const itemHeader = itemSheet ? findHeader(itemSheet, ITEM_COLUMNS, ["name", "en"]) : null;
  let itemCount = 0;
  const withoutItems: string[] = [];
  if (itemSheet && itemHeader) {
    const lines = packages.map(() => [] as { position: number; order: number; line: ItemLine }[]);
    const { columns: itemColumns } = itemHeader;
    itemSheet.rows.slice(itemHeader.index + 1).forEach((row, offset) => {
      const rowNumber = itemHeader.index + offset + 2;
      const name = cellText(cellAt(row, itemColumns.name));
      const en = cellText(cellAt(row, itemColumns.en));
      const bn = cellText(cellAt(row, itemColumns.bn));
      if (name === "" && en === "") return;
      const index = packageKeys.get(nameKey(name));
      if (index === undefined) {
        issues.push({ kind: "unknownPackage", row: rowNumber, name });
        return;
      }
      if (en === "") {
        issues.push({ kind: "missingItemText", row: rowNumber, name });
        return;
      }
      const position = cellAt(row, itemColumns.position)?.value;
      lines[index]?.push({
        position: typeof position === "number" ? position : Number.POSITIVE_INFINITY,
        order: offset,
        line: bn ? { en, bn } : { en },
      });
      itemCount += 1;
    });
    packages.forEach((item, index) => {
      const own = (lines[index] ?? []).sort((a, b) => a.position - b.position || a.order - b.order);
      item.items = own.map((entry) => entry.line);
      if (own.length === 0) withoutItems.push(item.name);
    });
  }

  return {
    list: { categories: [...categories.values()], packages },
    issues,
    withoutItems,
    itemCount,
  };
}
