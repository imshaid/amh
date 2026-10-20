import {
  createColumnHelper,
  createSortedRowModel,
  metaHelper,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
} from "@tanstack/react-table";
import type { RowData } from "@tanstack/react-table";

export interface DataColumnMeta {
  /** Figures and money align right ("end"); short codes and counts may centre. */
  align?: "start" | "center" | "end";
  /** Tabular figures, so columns of numbers line up. */
  numeric?: boolean;
  /** The code font, for PO numbers, log codes and phone numbers. */
  mono?: boolean;
  /**
   * Where the column goes when the table becomes cards on a phone: the card's title, a line under
   * it, the right-hand figure, a labelled detail (the default), or nowhere.
   */
  card?: "title" | "subtitle" | "aside" | "detail" | "hidden";
  /** The column's plain-text name, used on phone cards when the header is not plain text. */
  label?: string;
  /** A fixed width on wide screens, e.g. "7rem". */
  width?: string;
}

/** What every DataTable can do: sort on the client, with the meta above on each column. */
export const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text, basic: sortFn_basic },
  columnMeta: metaHelper<DataColumnMeta>(),
});

export type DataTableFeatures = typeof dataTableFeatures;

/** Column definitions for a DataTable: `const columns = column.columns([column.accessor(…)])`. */
export function createDataColumns<TData extends RowData>() {
  return createColumnHelper<DataTableFeatures, TData>();
}
