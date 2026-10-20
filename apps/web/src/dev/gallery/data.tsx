import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useFormat } from "@/i18n/hooks";
import { DataTable } from "@/ui/data-table";
import { createDataColumns } from "@/ui/data-table-columns";
import { EmptyState } from "@/ui/empty-state";
import { IconOrders } from "@/ui/icons";
import { OrderStatusPill } from "@/ui/pill";

import {
  SAMPLE_CHALLANS,
  SAMPLE_CHALLANS_PACKS,
  SAMPLE_ORDERS,
  SAMPLE_ORDERS_TOTAL,
} from "./sample-data";
import type { SampleChallan, SampleOrder } from "./sample-data";
import { GallerySection, Specimen } from "./section";

const orderColumn = createDataColumns<SampleOrder>();
const challanColumn = createDataColumns<SampleChallan>();

/** "22/10/2026 – 23/10/2026", or one date for a one-day order. */
function dayMonthYear(iso: string): string {
  return iso.split("-").reverse().join("/");
}

function useOrderColumns() {
  const { t } = useTranslation();
  const { digits, money, number } = useFormat();
  return useMemo(() => {
    const dateRange = (order: SampleOrder) =>
      digits(
        order.from === order.to
          ? dayMonthYear(order.from)
          : `${dayMonthYear(order.from)} – ${dayMonthYear(order.to)}`,
      );
    return orderColumn.columns([
      orderColumn.accessor("number", {
        header: t("gallery.table.number"),
        cell: (info) => digits(info.getValue()),
        footer: () => t("gallery.table.totalRow"),
        meta: { mono: true, card: "subtitle", width: "5.5rem" },
      }),
      orderColumn.accessor("title", {
        header: t("gallery.table.order"),
        cell: (info) => (
          <span className="flex flex-col">
            <Link
              to="/orders/$orderId"
              params={{ orderId: info.row.original.number }}
              className="font-semibold text-ink hover:text-brand-strong hover:underline"
            >
              {info.getValue()}
            </Link>
            <span className="text-sm font-normal text-muted">{dateRange(info.row.original)}</span>
          </span>
        ),
        meta: { card: "title" },
      }),
      orderColumn.accessor("client", {
        header: t("gallery.table.client"),
        meta: { card: "subtitle" },
      }),
      orderColumn.accessor("challans", {
        header: t("gallery.table.challans"),
        cell: (info) => number(info.getValue()),
        meta: { align: "end", numeric: true, width: "6rem" },
      }),
      orderColumn.accessor("total", {
        header: t("gallery.table.total"),
        cell: (info) => <span className="font-semibold">{money(info.getValue())}</span>,
        sortFn: (a, b) => Number(a.original.total) - Number(b.original.total),
        footer: () => money(SAMPLE_ORDERS_TOTAL),
        meta: { align: "end", numeric: true, card: "aside", width: "9rem" },
      }),
      orderColumn.accessor("status", {
        header: t("gallery.table.status"),
        cell: (info) => <OrderStatusPill status={info.getValue()} />,
        enableSorting: false,
        meta: { card: "aside", width: "13rem" },
      }),
    ]);
  }, [t, digits, money, number]);
}

function useChallanColumns() {
  const { t } = useTranslation();
  const { digits, number } = useFormat();
  return useMemo(
    () =>
      challanColumn.columns([
        challanColumn.accessor("serial", {
          header: t("gallery.table.serial"),
          cell: (info) => number(info.getValue()),
          footer: () => t("gallery.table.totalRow"),
          meta: { numeric: true, card: "hidden", width: "4.5rem" },
        }),
        challanColumn.accessor("date", {
          header: t("gallery.table.date"),
          cell: (info) => digits(info.getValue().split("-").reverse().slice(0, 2).join("/")),
          meta: { numeric: true, card: "subtitle", width: "6rem" },
        }),
        challanColumn.accessor("location", {
          header: t("gallery.table.location"),
          meta: { card: "title" },
        }),
        challanColumn.accessor("contact", {
          header: t("gallery.table.contact"),
          enableSorting: false,
        }),
        challanColumn.accessor("phone", {
          header: t("gallery.table.phone"),
          enableSorting: false,
          meta: { mono: true },
        }),
        challanColumn.accessor("packs", {
          header: t("gallery.table.packs"),
          cell: (info) => number(info.getValue()),
          footer: () => number(SAMPLE_CHALLANS_PACKS),
          meta: { align: "end", numeric: true, card: "aside", width: "6.5rem" },
        }),
      ]),
    [t, digits, number],
  );
}

const getId = (row: { id: string }) => row.id;

export function DataSection() {
  const { t } = useTranslation();
  const orderColumns = useOrderColumns();
  const challanColumns = useChallanColumns();
  return (
    <GallerySection
      id="data"
      title={t("gallery.table.title")}
      description={t("gallery.table.body")}
    >
      <DataTable
        data={SAMPLE_ORDERS}
        columns={orderColumns}
        getRowId={getId}
        caption={t("gallery.table.ordersCaption")}
        initialSorting={[{ id: "number", desc: true }]}
        empty={<EmptyState icon={IconOrders} title={t("gallery.states.emptyTitle")} />}
      />
      <Specimen label={t("gallery.table.long")}>
        <p className="text-sm text-muted">{t("gallery.table.longHint")}</p>
        <DataTable
          data={SAMPLE_CHALLANS}
          columns={challanColumns}
          getRowId={getId}
          caption={t("gallery.table.challansCaption")}
          maxHeight="26rem"
        />
      </Specimen>
    </GallerySection>
  );
}
