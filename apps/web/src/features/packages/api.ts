import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

import { check, unwrap } from "@/lib/data/result";
import type { Json } from "@/lib/database.gen";
import { clientEnv } from "@/lib/env";
import { getSupabase } from "@/lib/supabase";

import type { ItemLine, PackageListInput } from "./package-list";

/*
 * Packages and their categories, rate history and client codes. Rates are selected as text so the
 * exact decimal reaches the screen (DECISIONS 2026-10-20); the database computes everything else.
 */

export interface PackageRow {
  id: string;
  name: string;
  categoryId: string;
  /** Exact decimal, e.g. "355.00". */
  rate: string;
  items: ItemLine[];
  notes: string;
  active: boolean;
  clientCodes: { id: string; code: string; organisationId: string }[];
}

export interface CategoryRow {
  id: string;
  nameEn: string;
  nameBn: string;
  sortOrder: number;
}

export interface RateChange {
  id: string;
  rate: string;
  effectiveFrom: string;
  createdAt: string;
  by: { nameBn: string; nameEn: string } | null;
}

function isItemLine(value: Json): value is { en: string; bn?: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof value.en === "string" &&
    (value.bn === undefined || typeof value.bn === "string")
  );
}

/** The database checks the shape; this only narrows the JSON type. */
export function itemsOf(items: Json): ItemLine[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter(isItemLine)
    .map((item) => (item.bn ? { en: item.en, bn: item.bn } : { en: item.en }));
}

export const packageKeys = {
  all: ["packages"] as const,
  list: ["packages", "list"] as const,
  categories: ["packages", "categories"] as const,
  rates: (packageId: string) => ["packages", "rates", packageId] as const,
};

export const packagesQuery = queryOptions({
  queryKey: packageKeys.list,
  enabled: clientEnv.ok,
  queryFn: async (): Promise<PackageRow[]> => {
    const rows = unwrap(
      await getSupabase()
        .from("packages")
        .select(
          "id, name, category_id, rate::text, items, notes, active, package_client_codes(id, code, organisation_id)",
        )
        .order("rate")
        .order("name"),
    );
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      categoryId: row.category_id,
      rate: row.rate,
      items: itemsOf(row.items),
      notes: row.notes,
      active: row.active,
      clientCodes: row.package_client_codes.map((code) => ({
        id: code.id,
        code: code.code,
        organisationId: code.organisation_id,
      })),
    }));
  },
});

export const categoriesQuery = queryOptions({
  queryKey: packageKeys.categories,
  enabled: clientEnv.ok,
  queryFn: async (): Promise<CategoryRow[]> => {
    const rows = unwrap(
      await getSupabase()
        .from("package_categories")
        .select("id, name_en, name_bn, sort_order")
        .order("sort_order")
        .order("name_en"),
    );
    return rows.map((row) => ({
      id: row.id,
      nameEn: row.name_en,
      nameBn: row.name_bn,
      sortOrder: row.sort_order,
    }));
  },
});

export function rateHistoryQuery(packageId: string) {
  return queryOptions({
    queryKey: packageKeys.rates(packageId),
    enabled: clientEnv.ok,
    queryFn: async (): Promise<RateChange[]> => {
      const rows = unwrap(
        await getSupabase()
          .from("package_rates")
          .select(
            "id, rate::text, effective_from, created_at, profiles(display_name_bn, display_name_en)",
          )
          .eq("package_id", packageId)
          .order("created_at", { ascending: false }),
      );
      return rows.map((row) => ({
        id: row.id,
        rate: row.rate,
        effectiveFrom: row.effective_from,
        createdAt: row.created_at,
        by: row.profiles
          ? { nameBn: row.profiles.display_name_bn, nameEn: row.profiles.display_name_en }
          : null,
      }));
    },
  });
}

export interface PackageInput {
  name: string;
  categoryId: string;
  rate: string;
  items: ItemLine[];
  notes: string;
}

/** Creates or updates a package; returns its id. */
export async function savePackage(id: string | null, input: PackageInput): Promise<string> {
  const values = {
    name: input.name,
    category_id: input.categoryId,
    // PostgREST casts the exact decimal string to numeric; the generated type says number.
    rate: input.rate as unknown as number,
    items: input.items.map((line) => (line.bn ? { en: line.en, bn: line.bn } : { en: line.en })),
    notes: input.notes,
  };
  const packages = getSupabase().from("packages");
  if (id) {
    check(await packages.update(values).eq("id", id));
    return id;
  }
  return unwrap(await packages.insert(values).select("id").single()).id;
}

export async function setPackageActive(id: string, active: boolean): Promise<void> {
  check(await getSupabase().from("packages").update({ active }).eq("id", id));
}

export async function deletePackage(id: string): Promise<void> {
  check(await getSupabase().from("packages").delete().eq("id", id));
}

export async function createCategory(input: {
  nameEn: string;
  nameBn: string;
  sortOrder: number;
}): Promise<string> {
  return unwrap(
    await getSupabase()
      .from("package_categories")
      .insert({ name_en: input.nameEn, name_bn: input.nameBn, sort_order: input.sortOrder })
      .select("id")
      .single(),
  ).id;
}

export async function addClientCode(input: {
  packageId: string;
  organisationId: string;
  code: string;
}): Promise<void> {
  check(
    await getSupabase().from("package_client_codes").insert({
      package_id: input.packageId,
      organisation_id: input.organisationId,
      code: input.code,
    }),
  );
}

export async function removeClientCode(id: string): Promise<void> {
  check(await getSupabase().from("package_client_codes").delete().eq("id", id));
}

// ---------------------------------------------------------------------------------------------
// Package list import
// ---------------------------------------------------------------------------------------------

const outcome = z.enum(["new", "changed", "unchanged"]);

const importReport = z.object({
  applied: z.boolean(),
  batch_id: z.string().nullable(),
  categories: z.array(z.object({ name_en: z.string(), outcome, changes: z.array(z.string()) })),
  packages: z.array(
    z.object({
      name: z.string(),
      category: z.string(),
      outcome,
      changes: z.array(z.string()),
      old_rate: z.string().nullable(),
      rate: z.string(),
    }),
  ),
  not_in_list: z.array(z.object({ id: z.string(), name: z.string(), rate: z.string() })),
});

export type ImportReport = z.infer<typeof importReport>;

/** What importing the list would change (apply false), or the changes made (apply true). */
export async function importPackageList(
  list: PackageListInput,
  apply: boolean,
): Promise<ImportReport> {
  const result = unwrap(
    await getSupabase().rpc("import_package_list", {
      p_list: list as unknown as Json,
      p_apply: apply,
    }),
  );
  return importReport.parse(result);
}
