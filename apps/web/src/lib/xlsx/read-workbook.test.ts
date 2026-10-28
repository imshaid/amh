import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";

import packageList from "../../../../../docs/reference/packages-new.xlsx?inline";
import foodSchedule from "../../../../../docs/reference/samples/wv-food-schedule-sep-municipality.xlsx?inline";
import { bytesOf } from "@/test/fixtures";

import { cellText, readWorkbook, WorkbookError } from "./read-workbook";

const MAIN = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
const REL = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

/** A workbook as Excel writes it: shared strings, styles, and one sheet per entry. */
function workbook(sheets: Record<string, string>, extra: Record<string, string> = {}) {
  const names = Object.keys(sheets);
  const files: Record<string, Uint8Array> = {
    "xl/workbook.xml": strToU8(
      `<workbook ${MAIN} ${REL}><sheets>${names
        .map(
          (name, index) =>
            `<sheet name="${name}" sheetId="${String(index + 1)}" r:id="rId${String(index + 1)}"/>`,
        )
        .join("")}</sheets></workbook>`,
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${names
        .map(
          (_, index) =>
            `<Relationship Id="rId${String(index + 1)}" Type="worksheet" Target="${index === 0 ? "/xl/" : ""}worksheets/sheet${String(index + 1)}.xml"/>`,
        )
        .join("")}</Relationships>`,
    ),
  };
  names.forEach((name, index) => {
    files[`xl/worksheets/sheet${String(index + 1)}.xml`] = strToU8(sheets[name] ?? "");
  });
  for (const [path, content] of Object.entries(extra)) files[path] = strToU8(content);
  return zipSync(files);
}

describe("readWorkbook", () => {
  it("reads the new package list as written", () => {
    const { sheets } = readWorkbook(bytesOf(packageList));

    expect(sheets.map((sheet) => sheet.name)).toEqual(["packages", "items", "readme"]);
    const [packages] = sheets;
    expect(packages?.rows[0]?.map(cellText)).toEqual([
      "sl",
      "code",
      "category",
      "category_bn",
      "rate_bdt",
      "notes",
      "wv_original_text",
    ]);
    expect(packages?.rows).toHaveLength(31);
    const lunch = packages?.rows[15];
    expect(cellText(lunch?.[1])).toBe("Lunch Basic-07");
    expect(lunch?.[4]).toEqual({ value: 355, date: false });
    // An empty notes cell is a gap, not a value.
    expect(lunch?.[5]).toBeNull();
  });

  it("reads a WV food schedule's sheets, headers and dates", () => {
    const { sheets } = readWorkbook(bytesOf(foodSchedule));

    // Bangla য় may be stored as one code point or as য plus nukta.
    expect(sheets.map((sheet) => sheet.name.normalize("NFC"))).toEqual(
      ["Jan ২য় (2)", "Sept_Muni", "Sheet2"].map((name) => name.normalize("NFC")),
    );
    const september = sheets[1];
    // Headers keep their line breaks and typos; the importer reads the price from them.
    expect(september?.rows[3]?.map(cellText)).toContain("Snakc \n85");
    expect(september?.rows[3]?.map(cellText)).toContain("Lunch-\n430");
    // The schedule's dates are date-formatted serials; quantities are plain numbers.
    expect(september?.rows[4]?.[0]).toEqual({ value: 46212, date: true });
    expect(september?.rows[4]?.[6]).toEqual({ value: 52, date: false });
  });

  it("reads shared strings, rich text, numbers, booleans, dates and gaps", () => {
    const bytes = workbook(
      {
        Schedule: `<worksheet ${MAIN}><sheetData>
          <row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row>
          <row r="3"><c r="A3" s="1"><v>46273</v></c><c r="B3"><v>1638387433</v></c><c r="C3" t="b"><v>1</v></c>
            <c r="D3" t="str"><f>A1</f><v>Snack 50</v></c><c r="E3" t="e"><v>#N/A</v></c><c r="F3" s="2"><v>12.5</v></c></row>
        </sheetData></worksheet>`,
      },
      {
        "xl/sharedStrings.xml": `<sst ${MAIN}><si><t>Snack 50</t></si><si><r><t>Lunch-</t></r><r><t>430</t></r><rPh><t>x</t></rPh></si></sst>`,
        "xl/styles.xml": `<styleSheet ${MAIN}><numFmts><numFmt numFmtId="164" formatCode="d/m/yy;@"/><numFmt numFmtId="165" formatCode="&quot;Tk&quot; #,##0.00"/></numFmts>
          <cellXfs><xf numFmtId="0"/><xf numFmtId="164"/><xf numFmtId="165"/></cellXfs></styleSheet>`,
      },
    );

    const [sheet] = readWorkbook(bytes).sheets;
    expect(sheet?.name).toBe("Schedule");
    expect(sheet?.rows[0]).toEqual([
      { value: "Snack 50", date: false },
      null,
      { value: "Lunch-430", date: false },
    ]);
    expect(sheet?.rows[1]).toEqual([]);
    expect(sheet?.rows[2]).toEqual([
      { value: 46273, date: true },
      { value: 1638387433, date: false },
      { value: true, date: false },
      { value: "Snack 50", date: false },
      null,
      { value: 12.5, date: false },
    ]);
  });

  it("reads parts written with a namespace prefix", () => {
    const bytes = workbook({
      Sheet1: `<x:worksheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><x:sheetData>
        <x:row r="1"><x:c r="B1" t="inlineStr"><x:is><x:t>code</x:t></x:is></x:c></x:row>
      </x:sheetData></x:worksheet>`,
    });
    expect(readWorkbook(bytes).sheets[0]?.rows[0]?.map(cellText)).toEqual(["", "code"]);
  });

  it("refuses files that are not Excel workbooks", () => {
    expect(() => readWorkbook(strToU8("sl,code,rate\n1,Lunch,430"))).toThrow(WorkbookError);
    expect(() => readWorkbook(zipSync({ "word/document.xml": strToU8("<w/>") }))).toThrow(
      expect.objectContaining({ kind: "notXlsx" }),
    );
  });
});

describe("cellText", () => {
  it("gives trimmed text for any cell", () => {
    expect(cellText({ value: "  Lunch Basic-07 ", date: false })).toBe("Lunch Basic-07");
    expect(cellText({ value: 355, date: false })).toBe("355");
    expect(cellText(null)).toBe("");
  });
});
