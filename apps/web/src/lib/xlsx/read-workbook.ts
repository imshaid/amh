import { strFromU8, unzipSync } from "fflate";

/*
 * A small .xlsx reader for the imports (the package list now, food schedules in Segment 9). It
 * returns each sheet's cells as written, keeping numbers as numbers and marking cells formatted as
 * dates, so the importers decide what a value means (a flipped date, a phone number that lost its
 * leading zero). Formulas are read as their cached results. Runs in the browser: fflate unzips,
 * DOMParser reads the XML.
 */

export interface Cell {
  value: string | number | boolean;
  /** A number shown as a date or time; its value is Excel's day serial. */
  date: boolean;
}

export interface Sheet {
  name: string;
  /** Rows from the first, with null for empty cells; trailing empty cells are left out. */
  rows: (Cell | null)[][];
}

export interface Workbook {
  sheets: Sheet[];
}

export class WorkbookError extends Error {
  readonly kind: "notXlsx" | "tooLarge";

  constructor(kind: "notXlsx" | "tooLarge", message: string) {
    super(message);
    this.name = "WorkbookError";
    this.kind = kind;
  }
}

/** Larger unpacked parts are refused: a real schedule is a few hundred kilobytes. */
const MAX_PART_BYTES = 40 * 1024 * 1024;

const RELATIONSHIP_NAMESPACES = [
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  "http://purl.oclc.org/ooxml/officeDocument/relationships",
];

/** Built-in number formats that show dates or times (ECMA-376 §18.8.30). */
const BUILT_IN_DATE_FORMATS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

function parseXml(text: string): Document {
  const document = new DOMParser().parseFromString(text, "application/xml");
  if (document.getElementsByTagName("parsererror").length > 0) {
    throw new WorkbookError("notXlsx", "A part of the workbook is not well-formed XML");
  }
  return document;
}

/** Elements by local name, whatever namespace prefix the writer used. */
function elements(parent: Document | Element, name: string): Element[] {
  return Array.from(parent.getElementsByTagNameNS("*", name));
}

function children(parent: Element, name: string): Element[] {
  return Array.from(parent.children).filter((child) => child.localName === name);
}

/** The text of a string item: plain `<t>`, or rich-text runs; phonetic hints are skipped. */
function stringItemText(item: Element): string {
  const plain = children(item, "t")[0];
  if (plain) return plain.textContent;
  return children(item, "r")
    .map((run) => children(run, "t")[0]?.textContent ?? "")
    .join("");
}

/** "AB12" -> 27 (zero-based column). */
function columnIndex(reference: string): number {
  const letters = /^[A-Z]+/i.exec(reference)?.[0].toUpperCase() ?? "";
  let index = 0;
  for (const letter of letters) index = index * 26 + (letter.charCodeAt(0) - 64);
  return index - 1;
}

/** Whether a custom format code shows a date or time: d, m, y, h or s outside quotes and brackets. */
function isDateFormatCode(code: string): boolean {
  const bare = code
    .replace(/"[^"]*"/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\\./g, "");
  return /[dmyhs]/i.test(bare);
}

function dateStyles(stylesXml: string | undefined): boolean[] {
  if (!stylesXml) return [];
  const styles = parseXml(stylesXml);
  const customDates = new Set<number>();
  for (const format of elements(styles, "numFmt")) {
    if (isDateFormatCode(format.getAttribute("formatCode") ?? "")) {
      customDates.add(Number(format.getAttribute("numFmtId")));
    }
  }
  const cellFormats = elements(styles, "cellXfs")[0];
  if (!cellFormats) return [];
  return children(cellFormats, "xf").map((xf) => {
    const id = Number(xf.getAttribute("numFmtId") ?? "0");
    return BUILT_IN_DATE_FORMATS.has(id) || customDates.has(id);
  });
}

function relationshipId(sheet: Element): string | null {
  for (const namespace of RELATIONSHIP_NAMESPACES) {
    const id = sheet.getAttributeNS(namespace, "id");
    if (id) return id;
  }
  return null;
}

/** "worksheets/sheet1.xml" or "/xl/worksheets/sheet1.xml" -> "xl/worksheets/sheet1.xml". */
function partPath(target: string): string {
  return target.startsWith("/") ? target.slice(1) : `xl/${target}`;
}

function readCell(cell: Element, sharedStrings: string[], dates: boolean[]): Cell | null {
  const type = cell.getAttribute("t") ?? "n";
  const raw = children(cell, "v")[0]?.textContent ?? null;
  switch (type) {
    case "s": {
      const text = raw === null ? undefined : sharedStrings[Number(raw)];
      return text === undefined ? null : { value: text, date: false };
    }
    case "inlineStr": {
      const item = children(cell, "is")[0];
      return item ? { value: stringItemText(item), date: false } : null;
    }
    case "str":
      return raw === null ? null : { value: raw, date: false };
    case "b":
      return raw === null ? null : { value: raw === "1", date: false };
    case "e":
      return null;
    default: {
      if (raw === null || raw.trim() === "") return null;
      const value = Number(raw);
      if (!Number.isFinite(value)) return null;
      const style = Number(cell.getAttribute("s") ?? "0");
      return { value, date: dates[style] ?? false };
    }
  }
}

function readSheet(name: string, xml: string, sharedStrings: string[], dates: boolean[]): Sheet {
  // Rows missing from the XML are holes until the end.
  const rows: ((Cell | null)[] | undefined)[] = [];
  let nextRow = 0;
  for (const row of elements(parseXml(xml), "row")) {
    const rowNumber = Number(row.getAttribute("r") ?? nextRow + 1);
    const values: (Cell | null)[] = [];
    let nextColumn = 0;
    for (const cell of children(row, "c")) {
      const reference = cell.getAttribute("r");
      const column = reference ? columnIndex(reference) : nextColumn;
      nextColumn = column + 1;
      const value = readCell(cell, sharedStrings, dates);
      if (value === null) continue;
      while (values.length < column) values.push(null);
      values[column] = value;
    }
    rows[rowNumber - 1] = values;
    nextRow = rowNumber;
  }
  return { name, rows: Array.from(rows, (row) => row ?? []) };
}

export function readWorkbook(bytes: Uint8Array): Workbook {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      filter: (file) => {
        if (file.originalSize > MAX_PART_BYTES) {
          throw new WorkbookError(
            "tooLarge",
            `${file.name} unpacks to ${String(file.originalSize)} bytes`,
          );
        }
        return file.name.startsWith("xl/") && /\.(xml|rels)$/.test(file.name);
      },
    });
  } catch (error) {
    if (error instanceof WorkbookError) throw error;
    throw new WorkbookError("notXlsx", "The file is not a zip archive");
  }
  const text = (path: string) => {
    const file = files[path];
    return file ? strFromU8(file) : undefined;
  };

  const workbookXml = text("xl/workbook.xml");
  const relationshipsXml = text("xl/_rels/workbook.xml.rels");
  if (!workbookXml || !relationshipsXml) {
    throw new WorkbookError("notXlsx", "The archive has no Excel workbook in it");
  }

  const targets = new Map(
    elements(parseXml(relationshipsXml), "Relationship").map((relationship) => [
      relationship.getAttribute("Id") ?? "",
      partPath(relationship.getAttribute("Target") ?? ""),
    ]),
  );
  const sharedStringsXml = text("xl/sharedStrings.xml");
  const sharedStrings = sharedStringsXml
    ? elements(parseXml(sharedStringsXml), "si").map(stringItemText)
    : [];
  const dates = dateStyles(text("xl/styles.xml"));

  const sheets = elements(parseXml(workbookXml), "sheet").flatMap((sheet) => {
    const id = relationshipId(sheet);
    const xml = id ? text(targets.get(id) ?? "") : undefined;
    return xml ? [readSheet(sheet.getAttribute("name") ?? "", xml, sharedStrings, dates)] : [];
  });
  return { sheets };
}

/** A cell as text: trimmed strings, numbers without a trailing ".0", empty for no cell. */
export function cellText(cell: Cell | null | undefined): string {
  if (!cell) return "";
  if (typeof cell.value === "string") return cell.value.trim();
  return String(cell.value);
}
