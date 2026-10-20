import { useTable } from "@tanstack/react-table";
import type { ReactTable, Row, RowData, SortingState, TableOptions } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { useMediaQuery, WIDE_QUERY } from "@/lib/use-media-query";

import { cn } from "./cn";
import { dataTableFeatures } from "./data-table-columns";
import type { DataColumnMeta, DataTableFeatures } from "./data-table-columns";
import { IconSortable, IconSortAscending, IconSortDescending } from "./icons";

type Columns<TData extends RowData> = TableOptions<DataTableFeatures, TData>["columns"];

/** Rows above this count are virtualised when the table has a height limit. */
const VIRTUALIZE_FROM = 60;
const ROW_HEIGHT = 44;

const ALIGN = { start: "text-left", center: "text-center", end: "text-right" } as const;

function cellClasses(meta: DataColumnMeta | undefined): string {
  return cn(
    ALIGN[meta?.align ?? "start"],
    meta?.numeric && "tabular",
    meta?.mono && "font-mono text-sm",
  );
}

/**
 * A sortable table of records. On wide screens it is a real table with a sticky header; on phones
 * each row becomes a card (BLUEPRINT §5.1). Give it `maxHeight` for long lists: the body then
 * scrolls inside and only the visible rows are rendered.
 *
 * `columns` and `data` must be stable (module scope, state or memo), or every render recomputes.
 * To open a record from its row, put a link in the title cell (keyboard users need it anyway).
 */
export function DataTable<TData extends RowData>({
  data,
  columns,
  getRowId,
  caption,
  initialSorting,
  maxHeight,
  empty,
  className,
}: {
  data: TData[];
  columns: Columns<TData>;
  getRowId: (row: TData) => string;
  /** Names the table for screen readers; visible only to them. */
  caption: string;
  initialSorting?: SortingState;
  maxHeight?: string;
  /** Shown instead of the table when there are no rows: an EmptyState. */
  empty?: ReactNode;
  className?: string;
}) {
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data,
    getRowId,
    initialState: { sorting: initialSorting ?? [] },
    enableSortingRemoval: false,
  });
  const wide = useMediaQuery(WIDE_QUERY, true);
  const rows = table.getRowModel().rows;

  if (rows.length === 0 && empty) return <>{empty}</>;

  return wide ? (
    <TableView table={table} caption={caption} maxHeight={maxHeight} className={className} />
  ) : (
    <CardView table={table} caption={caption} maxHeight={maxHeight} className={className} />
  );
}

type AppTable<TData extends RowData> = ReactTable<DataTableFeatures, TData>;

interface ViewProps<TData extends RowData> {
  table: AppTable<TData>;
  caption: string;
  maxHeight: string | undefined;
  className: string | undefined;
}

function TableView<TData extends RowData>({
  table,
  caption,
  maxHeight,
  className,
}: ViewProps<TData>) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const rows = table.getRowModel().rows;
  const virtual = maxHeight !== undefined && rows.length > VIRTUALIZE_FROM;
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual returns fresh functions each render; this component is meant to re-render with it.
  const virtualizer = useVirtualizer({
    count: virtual ? rows.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });
  const items = virtualizer.getVirtualItems();
  const visible = virtual
    ? items.map((item) => rows[item.index]).filter((row) => row !== undefined)
    : rows;
  const paddingTop = virtual ? (items[0]?.start ?? 0) : 0;
  const paddingBottom = virtual ? virtualizer.getTotalSize() - (items.at(-1)?.end ?? 0) : 0;
  const footerGroups = table.getFooterGroups();
  const hasFooter = table
    .getAllLeafColumns()
    .some((column) => column.columnDef.footer !== undefined);
  const columnCount = table.getAllLeafColumns().length;

  return (
    <div
      ref={scrollRef}
      className={cn("overflow-auto rounded-xl border border-line bg-surface", className)}
      style={maxHeight ? { maxHeight } : undefined}
    >
      <table className="w-full border-collapse text-ui">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 z-10 bg-surface-2">
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => {
                const meta = header.column.columnDef.meta;
                const sorted = header.column.getIsSorted();
                const canSort = header.column.getCanSort();
                const SortIcon =
                  sorted === "asc"
                    ? IconSortAscending
                    : sorted === "desc"
                      ? IconSortDescending
                      : IconSortable;
                return (
                  <th
                    key={header.id}
                    scope="col"
                    aria-sort={
                      sorted === "asc"
                        ? "ascending"
                        : sorted === "desc"
                          ? "descending"
                          : canSort
                            ? "none"
                            : undefined
                    }
                    style={meta?.width ? { width: meta.width } : undefined}
                    className={cn(
                      "border-b border-line px-3 py-2.5 text-sm font-semibold whitespace-nowrap text-muted",
                      ALIGN[meta?.align ?? "start"],
                    )}
                  >
                    {header.isPlaceholder ? null : canSort ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className={cn(
                          "-mx-1 inline-flex items-center gap-1 rounded-sm px-1 hover:text-ink",
                          sorted && "text-ink",
                          meta?.align === "end" && "flex-row-reverse",
                        )}
                      >
                        <table.FlexRender header={header} />
                        <SortIcon
                          className={cn("size-3.5", !sorted && "opacity-50")}
                          aria-hidden="true"
                        />
                        <span className="sr-only">{t("ui.table.sort")}</span>
                      </button>
                    ) : (
                      <table.FlexRender header={header} />
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {paddingTop > 0 ? (
            <tr aria-hidden="true">
              <td colSpan={columnCount} style={{ height: paddingTop }} />
            </tr>
          ) : null}
          {visible.map((row) => (
            <BodyRow key={row.id} row={row} table={table} />
          ))}
          {paddingBottom > 0 ? (
            <tr aria-hidden="true">
              <td colSpan={columnCount} style={{ height: paddingBottom }} />
            </tr>
          ) : null}
        </tbody>
        {hasFooter ? (
          <tfoot className="sticky bottom-0 bg-surface-2 font-semibold">
            {footerGroups.map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <td
                    key={header.id}
                    className={cn(
                      "border-t border-line px-3 py-2.5",
                      cellClasses(header.column.columnDef.meta),
                    )}
                  >
                    {header.isPlaceholder ? null : <table.FlexRender footer={header} />}
                  </td>
                ))}
              </tr>
            ))}
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}

function BodyRow<TData extends RowData>({
  row,
  table,
}: {
  row: Row<DataTableFeatures, TData>;
  table: AppTable<TData>;
}) {
  return (
    <tr className="border-b border-line transition-colors duration-150 last:border-b-0 hover:bg-surface-2/60">
      {row.getAllCells().map((cell) => (
        <td
          key={cell.id}
          className={cn("h-11 px-3 py-2 align-middle", cellClasses(cell.column.columnDef.meta))}
        >
          <table.FlexRender cell={cell} />
        </td>
      ))}
    </tr>
  );
}

function CardView<TData extends RowData>({
  table,
  caption,
  maxHeight,
  className,
}: ViewProps<TData>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const rows = table.getRowModel().rows;
  const virtual = maxHeight !== undefined && rows.length > VIRTUALIZE_FROM;
  // eslint-disable-next-line react-hooks/incompatible-library -- as above: re-rendering with the virtualizer is intended.
  const virtualizer = useVirtualizer({
    count: virtual ? rows.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 96,
    overscan: 6,
  });

  const card = (row: Row<DataTableFeatures, TData>) => (
    <TableCard key={row.id} row={row} table={table} />
  );

  return (
    <div
      ref={scrollRef}
      role="list"
      aria-label={caption}
      className={cn("overflow-auto", className)}
      style={maxHeight ? { maxHeight } : undefined}
    >
      {virtual ? (
        <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((item) => {
            const row = rows[item.index];
            if (!row) return null;
            return (
              <div
                key={row.id}
                data-index={item.index}
                ref={virtualizer.measureElement}
                className="absolute inset-x-0 top-0 pb-2"
                style={{ transform: `translateY(${String(item.start)}px)` }}
              >
                {card(row)}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-2">{rows.map(card)}</div>
      )}
    </div>
  );
}

function TableCard<TData extends RowData>({
  row,
  table,
}: {
  row: Row<DataTableFeatures, TData>;
  table: AppTable<TData>;
}) {
  const cells = row.getAllCells();
  const place = (cell: (typeof cells)[number]) => cell.column.columnDef.meta?.card ?? "detail";
  const render = (cell: (typeof cells)[number]) => <table.FlexRender cell={cell} />;
  const title = cells.filter((cell) => place(cell) === "title");
  const subtitle = cells.filter((cell) => place(cell) === "subtitle");
  const aside = cells.filter((cell) => place(cell) === "aside");
  const details = cells.filter((cell) => place(cell) === "detail");

  return (
    <div
      role="listitem"
      className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3.5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {title.map((cell) => (
            <div
              key={cell.id}
              className={cn("font-semibold", cellClasses(cell.column.columnDef.meta), "text-left")}
            >
              {render(cell)}
            </div>
          ))}
          {subtitle.map((cell) => (
            <div
              key={cell.id}
              className={cn("text-sm text-muted", cell.column.columnDef.meta?.mono && "font-mono")}
            >
              {render(cell)}
            </div>
          ))}
        </div>
        {aside.length > 0 ? (
          <div className="flex shrink-0 flex-col items-end gap-1 text-right">
            {aside.map((cell) => (
              <div
                key={cell.id}
                className={cn(cell.column.columnDef.meta?.numeric && "font-semibold tabular")}
              >
                {render(cell)}
              </div>
            ))}
          </div>
        ) : null}
      </div>
      {details.length > 0 ? (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
          {details.map((cell) => {
            const meta = cell.column.columnDef.meta;
            const header = cell.column.columnDef.header;
            return (
              <div key={cell.id} className="contents">
                <dt className="text-muted">
                  {meta?.label ?? (typeof header === "string" ? header : cell.column.id)}
                </dt>
                <dd
                  className={cn(
                    "min-w-0 text-ink",
                    meta?.numeric && "tabular",
                    meta?.mono && "font-mono",
                  )}
                >
                  {render(cell)}
                </dd>
              </div>
            );
          })}
        </dl>
      ) : null}
    </div>
  );
}
