import { QueryClientProvider } from "@tanstack/react-query";
import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "@/app/query-client";
import { setLanguage } from "@/i18n/i18n";
import { renderUi } from "@/test/render-ui";

import { categoriesQuery, packagesQuery } from "./api";
import type { CategoryRow, PackageRow } from "./api";
import { PackagesPage } from "./packages-page";
import type { PackagesSearch } from "./packages-page";

vi.mock("@/lib/env", async () => {
  const { CONFIGURED_ENV } = await import("@/test/fake-supabase");
  return { clientEnv: CONFIGURED_ENV };
});
// The cache is filled before rendering, so nothing is fetched; any request would fail loudly.
vi.mock("@/lib/supabase", () => ({
  getSupabase: () => {
    throw new Error("The packages page should not fetch in these tests");
  },
}));

const SNACKS: CategoryRow = { id: "snacks", nameEn: "Snacks", nameBn: "নাস্তা", sortOrder: 1 };
const LUNCH: CategoryRow = { id: "lunch", nameEn: "Lunch Basic", nameBn: "লাঞ্চ", sortOrder: 2 };

function pkg(
  id: string,
  name: string,
  rate: string,
  categoryId: string,
  active = true,
): PackageRow {
  return {
    id,
    name,
    categoryId,
    rate,
    items: [{ en: `${name} item — 1 pc`, bn: `${name} আইটেম` }],
    notes: "",
    active,
    clientCodes: [],
  };
}

const PACKAGES = [
  pkg("p17", "Snacks Single Item-17", "60.00", "snacks"),
  pkg("p19", "Snacks Single Item-19", "60.00", "snacks"),
  pkg("p27", "Snacks Single Item-27", "20.00", "snacks"),
  pkg("l07", "Lunch Basic-07", "355.00", "lunch"),
  pkg("l04", "Lunch Basic-04", "550.00", "lunch"),
  pkg("old", "Old Lunch", "430.00", "lunch", false),
];

function Harness({ initial }: { initial: PackagesSearch }) {
  const [search, setSearch] = useState(initial);
  return <PackagesPage search={search} onSearchChange={setSearch} />;
}

function renderPage(packages = PACKAGES, initial: PackagesSearch = {}) {
  const queryClient = createQueryClient();
  queryClient.setQueryData(packagesQuery.queryKey, packages);
  queryClient.setQueryData(categoriesQuery.queryKey, [SNACKS, LUNCH]);
  return renderUi(
    <QueryClientProvider client={queryClient}>
      <Harness initial={initial} />
    </QueryClientProvider>,
  );
}

function cardNames() {
  return screen.queryAllByRole("button", { name: /বদলান$/ }).map((button) => button.textContent);
}

beforeEach(async () => {
  await setLanguage("bn");
});

describe("the packages page", () => {
  it("groups active packages by kind, price first, with the shared price marked", () => {
    renderPage();

    expect(screen.getByRole("heading", { level: 2, name: "নাস্তা" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "লাঞ্চ" })).toBeInTheDocument();
    expect(cardNames()).toEqual([
      "Snacks Single Item-17",
      "Snacks Single Item-19",
      "Snacks Single Item-27",
      "Lunch Basic-07",
      "Lunch Basic-04",
    ]);
    const shared = screen.getAllByText("একই দামে আরও আছে");
    expect(shared).toHaveLength(2);
    // Bangla items in Bangla mode.
    expect(screen.getByText("Lunch Basic-07 আইটেম")).toBeInTheDocument();
  });

  it("finds packages by a price typed in Bangla digits, exact price first", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByRole("searchbox", { name: "দাম বা নাম দিয়ে খুঁজুন" }), "৩৫");

    expect(cardNames()).toEqual(["Lunch Basic-07"]);
    expect(screen.getByRole("status")).toHaveTextContent("১টা প্যাকেজ");

    await user.clear(screen.getByRole("searchbox"));
    await user.type(screen.getByRole("searchbox"), "60");
    expect(cardNames()).toEqual(["Snacks Single Item-17", "Snacks Single Item-19"]);
  });

  it("says so when no package has the typed price", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByRole("searchbox"), "999");

    expect(screen.getByText("৳৯৯৯ দামের কোনো প্যাকেজ নেই")).toBeInTheDocument();
  });

  it("finds packages by name and filters by kind", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("radio", { name: /লাঞ্চ/ }));
    expect(cardNames()).toEqual(["Lunch Basic-07", "Lunch Basic-04"]);

    await user.type(screen.getByRole("searchbox"), "basic-04");
    expect(cardNames()).toEqual(["Lunch Basic-04"]);
  });

  it("keeps switched-off packages apart", async () => {
    const user = userEvent.setup();
    renderPage();
    const filters = screen.getByRole("radiogroup", { name: "ধরন দিয়ে বাছুন" });

    await user.click(within(filters).getByRole("radio", { name: /বন্ধ করা/ }));

    expect(cardNames()).toEqual(["Old Lunch"]);
    expect(screen.getByText("বন্ধ")).toBeInTheDocument();
  });

  it("invites the first import when there are no packages", () => {
    renderPage([]);

    expect(screen.getByText("এখনো কোনো প্যাকেজ নেই")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "নতুন তালিকা আনুন" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "প্যাকেজ যোগ" })).toBeInTheDocument();
  });

  it("opens the editor with the package's details", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Lunch Basic-07 বদলান" }));

    const dialog = await screen.findByRole("dialog", { name: "প্যাকেজ বদলান" });
    expect(within(dialog).getByLabelText(/নাম \(WV কোড\)/)).toHaveValue("Lunch Basic-07");
    expect(within(dialog).getByLabelText(/দাম \(টাকা\)/)).toHaveValue("355");
  });
});
