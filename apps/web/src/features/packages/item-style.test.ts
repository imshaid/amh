import { describe, expect, it } from "vitest";

import newList from "../../../../../docs/reference/packages-new.xlsx?inline";
import { readWorkbook } from "@/lib/xlsx/read-workbook";
import { bytesOf } from "@/test/fixtures";

import { itemStyleHints } from "./item-style";
import { parsePackageList } from "./package-list";

describe("itemStyleHints", () => {
  it("finds nothing to say about the new list, which follows the style", () => {
    const { list } = parsePackageList(readWorkbook(bytesOf(newList)));
    const lines = list.packages.flatMap((item) => item.items ?? []).map((line) => line.en);
    expect(lines.length).toBeGreaterThan(70);
    expect(lines.filter((line) => itemStyleHints(line).length > 0)).toEqual([]);
  });

  it("points out the old way of writing lines", () => {
    expect(itemStyleHints("Chinigura Rice (Polao) 300 grams (±)")).toEqual([
      "separator",
      "units",
      "approx",
    ]);
    expect(itemStyleHints("Mineral Water - 5 liter +/-")).toEqual(["separator", "units", "approx"]);
    expect(itemStyleHints("Biscuit — 1 Pcs. 62 gm")).toEqual(["units"]);
  });

  it("leaves lines without a quantity alone", () => {
    expect(itemStyleHints("Packed in a foil carton with a printed message")).toEqual([]);
    expect(itemStyleHints("  ")).toEqual([]);
  });
});
