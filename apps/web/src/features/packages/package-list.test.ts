import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";

import newList from "../../../../../docs/reference/packages-new.xlsx?inline";
import { readWorkbook } from "@/lib/xlsx/read-workbook";
import { bytesOf } from "@/test/fixtures";

import { parsePackageList } from "./package-list";
import { rateKey, sharedRates } from "./price";

/** A one-sheet-or-more workbook from rows of inline strings and numbers. */
function workbook(sheets: Record<string, (string | number | null)[][]>) {
  const main = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
  const names = Object.keys(sheets);
  const cell = (value: string | number | null, ref: string) =>
    value === null
      ? ""
      : typeof value === "number"
        ? `<c r="${ref}"><v>${String(value)}</v></c>`
        : `<c r="${ref}" t="inlineStr"><is><t>${value}</t></is></c>`;
  const files: Record<string, Uint8Array> = {
    "xl/workbook.xml": strToU8(
      `<workbook ${main} xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names
        .map(
          (name, i) =>
            `<sheet name="${name}" sheetId="${String(i + 1)}" r:id="rId${String(i + 1)}"/>`,
        )
        .join("")}</sheets></workbook>`,
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${names
        .map(
          (_, i) =>
            `<Relationship Id="rId${String(i + 1)}" Target="worksheets/s${String(i + 1)}.xml"/>`,
        )
        .join("")}</Relationships>`,
    ),
  };
  names.forEach((name, i) => {
    const rows = (sheets[name] ?? [])
      .map(
        (row, r) =>
          `<row r="${String(r + 1)}">${row.map((value, c) => cell(value, `${String.fromCharCode(65 + c)}${String(r + 1)}`)).join("")}</row>`,
      )
      .join("");
    files[`xl/worksheets/s${String(i + 1)}.xml`] = strToU8(
      `<worksheet ${main}><sheetData>${rows}</sheetData></worksheet>`,
    );
  });
  return readWorkbook(zipSync(files));
}

describe("parsePackageList with the new list", () => {
  const parsed = parsePackageList(readWorkbook(bytesOf(newList)));

  it("reads all 30 packages and their 10 categories without problems", () => {
    expect(parsed.issues).toEqual([]);
    expect(parsed.list.packages).toHaveLength(30);
    expect(parsed.list.categories.map((category) => category.name_en)).toEqual([
      "Snacks",
      "Lunch Basic",
      "Lunch Standard",
      "Lunch Premium",
      "Hot Meal",
      "Iftar",
      "Drinks",
      "Dessert",
      "Disposable",
      "Packing",
    ]);
    expect(parsed.list.categories[1]).toEqual({ name_en: "Lunch Basic", name_bn: "লাঞ্চ — বেসিক" });
  });

  it("keeps each package's code, rate, notes and items in print order", () => {
    const lunch = parsed.list.packages.find((item) => item.name === "Lunch Basic-07");
    expect(lunch?.rate).toBe("355");
    expect(lunch?.category).toBe("Lunch Basic");
    expect(lunch?.notes).toBe("");
    expect(lunch?.items?.map((line) => line.en)).toEqual([
      "Plain Rice (Miniket / Najirshail / Katarivog, boiled or atop) — 300 g ±",
      "Mutton Rezala / Korma / Bhuna — 2 pcs, 150 g ± (75 g each)",
      "Mixed Vegetable Fry (3+ seasonal vegetables) — 100 g ±",
      "Musur Dal (regular or thick) — 150 ml ±",
    ]);
    expect(lunch?.items?.[0]?.bn).toBe(
      "সাদা ভাত (মিনিকেট / নাজিরশাইল / কাটারিভোগ, সেদ্ধ বা আতপ) — ৩০০ গ্রাম ±",
    );
    expect(parsed.itemCount).toBe(75);
    expect(parsed.withoutItems).toEqual([]);
  });

  it("adds up to the WV sheet total, and finds the five shared prices", () => {
    const rates = parsed.list.packages.map((item) => item.rate);
    expect(rates.reduce((sum, rate) => sum + Number(rate), 0)).toBe(5444);
    expect(
      [...sharedRates(rates.map((rate) => ({ rate, active: true })))].sort(
        (a, b) => Number(a) - Number(b),
      ),
    ).toEqual(["20", "30", "35", "36", "60"].map(rateKey));
  });
});

describe("parsePackageList with problems", () => {
  const header = ["code", "category", "rate_bdt"];

  it("names the row of every package it cannot read", () => {
    const parsed = parsePackageList(
      workbook({
        packages: [
          header,
          ["Lunch Basic-07", "Lunch", 355],
          ["Lunch  basic-07", "Lunch", 355],
          ["Snack A", "Snacks", "fifty"],
          ["Snack B", null, 50],
          ["Snack C", "Snacks", null],
          [null, null, null],
        ],
      }),
    );
    expect(parsed.issues).toEqual([
      { kind: "duplicate", row: 3, name: "Lunch  basic-07" },
      { kind: "badRate", row: 4, name: "Snack A", value: "fifty" },
      { kind: "missingCategory", row: 5, name: "Snack B" },
      { kind: "missingRate", row: 6, name: "Snack C" },
    ]);
  });

  it("says which column is missing", () => {
    expect(
      parsePackageList(
        workbook({
          packages: [
            ["code", "rate"],
            ["A", 10],
          ],
        }),
      ).issues,
    ).toEqual([{ kind: "missingColumn", column: "category" }]);
    expect(parsePackageList(workbook({ Sheet1: [["sl", "name"]] })).issues).toEqual([
      { kind: "missingColumn", column: "category" },
      { kind: "missingColumn", column: "rate" },
    ]);
    expect(parsePackageList(workbook({ Sheet1: [["anything"]] })).issues).toEqual([
      { kind: "noPackageSheet" },
    ]);
  });

  it("finds headers below a title, and items for packages it does not know", () => {
    const parsed = parsePackageList(
      workbook({
        list: [
          ["New AMH package list"],
          [],
          ["Code", "Category", "Rate (BDT)"],
          ["Glass", "Disposable", 4],
        ],
        lines: [
          ["code", "position", "text_en", "text_bn"],
          ["Glass", 2, "Second line", null],
          ["Glass", 1, "Disposable Paper Glass — 200 ml ±", "কাগজের গ্লাস"],
          ["Cup", 1, "Cup", null],
          ["Glass", 3, null, "শুধু বাংলা"],
        ],
      }),
    );
    expect(parsed.list.packages).toEqual([
      {
        name: "Glass",
        category: "Disposable",
        rate: "4",
        items: [
          { en: "Disposable Paper Glass — 200 ml ±", bn: "কাগজের গ্লাস" },
          { en: "Second line" },
        ],
      },
    ]);
    expect(parsed.issues).toEqual([
      { kind: "unknownPackage", row: 4, name: "Cup" },
      { kind: "missingItemText", row: 5, name: "Glass" },
    ]);
  });

  it("leaves items out when the file has none, and reports packages without lines", () => {
    const noItems = parsePackageList(workbook({ packages: [header, ["Glass", "Disposable", 4]] }));
    expect(noItems.list.packages[0]).not.toHaveProperty("items");

    const someItems = parsePackageList(
      workbook({
        packages: [header, ["Glass", "Disposable", 4], ["Cup", "Disposable", 5]],
        items: [
          ["code", "text_en"],
          ["Glass", "Paper glass"],
        ],
      }),
    );
    expect(someItems.withoutItems).toEqual(["Cup"]);
    expect(someItems.list.packages[1]?.items).toEqual([]);
  });
});
