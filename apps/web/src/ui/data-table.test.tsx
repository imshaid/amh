import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setLanguage } from "@/i18n/i18n";
import { renderUi } from "@/test/render-ui";

import { DataTable } from "./data-table";
import { createDataColumns } from "./data-table-columns";

interface Row {
  id: string;
  name: string;
  packs: number;
}

const column = createDataColumns<Row>();
const columns = column.columns([
  column.accessor("name", { header: "লোকেশন", meta: { card: "title" } }),
  column.accessor("packs", {
    header: "প্যাকেট",
    footer: () => "৭৮",
    meta: { align: "end", numeric: true, card: "aside" },
  }),
]);
const rows: Row[] = [
  { id: "a", name: "সেনুয়া", packs: 26 },
  { id: "b", name: "আউলিয়াপুর", packs: 17 },
  { id: "c", name: "কেশুরবাড়ি", packs: 35 },
];
const getId = (row: Row) => row.id;

beforeEach(async () => {
  await setLanguage("bn");
});

describe("DataTable", () => {
  it("is a captioned table that sorts by a column, biggest numbers first", async () => {
    const user = userEvent.setup();
    renderUi(<DataTable data={rows} columns={columns} getRowId={getId} caption="চালান" />);

    const table = screen.getByRole("table", { name: "চালান" });
    const header = within(table).getByRole("columnheader", { name: /প্যাকেট/ });
    expect(header).toHaveAttribute("aria-sort", "none");

    const names = () =>
      within(table)
        .getAllByRole("row")
        .slice(1, -1)
        .map((row) => within(row).getAllByRole("cell")[0]?.textContent);

    await user.click(within(header).getByRole("button"));
    expect(header).toHaveAttribute("aria-sort", "descending");
    expect(names()).toEqual(["কেশুরবাড়ি", "সেনুয়া", "আউলিয়াপুর"]);

    await user.click(within(header).getByRole("button"));
    expect(header).toHaveAttribute("aria-sort", "ascending");
    expect(names()).toEqual(["আউলিয়াপুর", "সেনুয়া", "কেশুরবাড়ি"]);
    expect(within(table).getByText("৭৮")).toBeInTheDocument();
  });

  it("becomes a list of cards on a narrow screen", () => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query) =>
        ({
          matches: false,
          media: query,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        }) as unknown as MediaQueryList,
    );
    renderUi(<DataTable data={rows} columns={columns} getRowId={getId} caption="চালান" />);

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    const list = screen.getByRole("list", { name: "চালান" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
  });

  it("shows the empty state when there are no rows", () => {
    renderUi(
      <DataTable
        data={[]}
        columns={columns}
        getRowId={getId}
        caption="চালান"
        empty={<p>কিছু নেই</p>}
      />,
    );
    expect(screen.getByText("কিছু নেই")).toBeInTheDocument();
  });
});
