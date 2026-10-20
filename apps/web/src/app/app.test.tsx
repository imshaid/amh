import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { commandBar } from "@/app/shell/command-bar-store";
import { setLanguage } from "@/i18n/i18n";
import { renderApp } from "@/test/render-app";

beforeEach(async () => {
  // The command bar's open state lives outside React; a test that leaves it open must not leak.
  commandBar.close();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  await setLanguage("bn");
  localStorage.clear();
});

/**
 * The shell renders the sidebar menu and the phone's bottom bar; CSS shows one at a time, so tests
 * use the sidebar (the first one).
 */
function sidebar(name = "প্রধান মেনু") {
  const [menu] = screen.getAllByRole("navigation", { name });
  if (!menu) throw new Error("The main menu is missing");
  return within(menu);
}

describe("app shell", () => {
  it("opens on the dashboard in Bangla with the full main menu", async () => {
    renderApp("/");

    expect(
      await screen.findByRole("heading", { level: 1, name: "ড্যাশবোর্ড" }),
    ).toBeInTheDocument();
    expect(
      sidebar()
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual([
      "ড্যাশবোর্ড",
      "অর্ডার",
      "নতুন অর্ডার",
      "পাওনা ও পেমেন্ট",
      "ক্লায়েন্ট",
      "লোকেশন",
      "প্যাকেজ ও দাম",
    ]);
    expect(document.title).toBe("ড্যাশবোর্ড · আদর্শ মুন্সির হোটেল");
    // Tests run without a backend configured; the live indicator says so.
    expect(screen.getByRole("status")).toHaveTextContent(
      "সার্ভার এখনো সেট করা হয়নি, তাই কোনো ডেটা নেই।",
    );
  });

  it("marks the current section and shows order numbers in Bangla digits", async () => {
    renderApp("/orders/0047");

    expect(
      await screen.findByRole("heading", { level: 1, name: "অর্ডার ০০৪৭" }),
    ).toBeInTheDocument();
    const nav = sidebar();
    expect(nav.getByRole("link", { name: "অর্ডার" })).toHaveAttribute("aria-current", "page");
    expect(nav.getByRole("link", { name: "ড্যাশবোর্ড" })).not.toHaveAttribute("aria-current");
    expect(nav.getByRole("link", { name: "নতুন অর্ডার" })).not.toHaveAttribute("aria-current");
  });

  it("switches the whole interface to English", async () => {
    const user = userEvent.setup();
    renderApp("/packages");
    await screen.findByRole("heading", { level: 1, name: "প্যাকেজ ও দাম" });

    await user.click(screen.getByRole("button", { name: "English" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Packages" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement.lang).toBe("en");
    expect(document.title).toBe("Packages · Adarsha Munshir Hotel");
  });

  it("applies and remembers a theme choice from the theme menu", async () => {
    const user = userEvent.setup();
    renderApp("/");

    await user.click(await screen.findByRole("button", { name: "থিম বদলান, এখন: ডিভাইসের মতো" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "ডার্ক" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("amh:theme")).toBe("dark");

    await user.click(screen.getByRole("button", { name: "থিম বদলান, এখন: ডার্ক" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "ডিভাইসের মতো" }));
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(localStorage.getItem("amh:theme")).toBeNull();
  });

  it("opens the command bar with Ctrl+K and goes where you type, in either language", async () => {
    const user = userEvent.setup();
    const { router } = renderApp("/");
    await screen.findByRole("heading", { level: 1, name: "ড্যাশবোর্ড" });

    await user.keyboard("{Control>}k{/Control}");
    const dialog = await screen.findByRole("dialog", { name: "খুঁজুন ও যান" });
    // English words find Bangla items too.
    await user.type(within(dialog).getByRole("combobox"), "packages");
    expect(
      within(dialog)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["প্যাকেজ ও দাম"]);
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/packages");
    });
    expect(
      await screen.findByRole("heading", { level: 1, name: "প্যাকেজ ও দাম" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("explains when the command bar finds nothing", async () => {
    const user = userEvent.setup();
    renderApp("/");
    await screen.findByRole("heading", { level: 1, name: "ড্যাশবোর্ড" });

    await user.click(screen.getByRole("button", { name: "খুঁজুন: অর্ডার, দাম, লোকেশন" }));
    await user.type(await screen.findByRole("combobox"), "৯৯৯৯");

    expect(await screen.findByText("কিছু পাওয়া যায়নি")).toBeInTheDocument();
  });

  it("reaches the directories through the phone's More sheet", async () => {
    const user = userEvent.setup();
    const { router } = renderApp("/");
    await screen.findByRole("heading", { level: 1, name: "ড্যাশবোর্ড" });

    const [, bottomBar] = screen.getAllByRole("navigation", { name: "প্রধান মেনু" });
    if (!bottomBar) throw new Error("The bottom bar is missing");
    await user.click(within(bottomBar).getByRole("button", { name: "আরও" }));
    const sheet = await screen.findByRole("dialog", { name: "আরও" });
    await user.click(within(sheet).getByRole("link", { name: "লোকেশন" }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/locations");
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "আরও" })).not.toBeInTheDocument();
    });
  });

  it("shows a helpful page for an unknown address", async () => {
    renderApp("/no-such-page");

    expect(
      await screen.findByRole("heading", { name: "পাতাটা খুঁজে পাওয়া যায়নি" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ড্যাশবোর্ডে ফিরুন" })).toHaveAttribute("href", "/");
  });
});
