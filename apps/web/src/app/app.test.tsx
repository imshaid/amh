import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { setLanguage } from "@/i18n/i18n";
import { renderApp } from "@/test/render-app";

beforeEach(async () => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  await setLanguage("bn");
  localStorage.clear();
});

/** The shell renders one menu for wide screens and one for phones; CSS shows one at a time. */
function mainMenu(name = "প্রধান মেনু") {
  const [menu] = screen.getAllByRole("navigation", { name });
  if (!menu) throw new Error("The main menu is missing");
  return within(menu);
}

describe("app shell", () => {
  it("opens on the dashboard in Bangla with the full main menu", async () => {
    renderApp("/");

    expect(await screen.findByRole("heading", { name: "ড্যাশবোর্ড" })).toBeInTheDocument();
    const links = mainMenu().getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "ড্যাশবোর্ড",
      "অর্ডার",
      "নতুন অর্ডার",
      "পাওনা ও পেমেন্ট",
      "ক্লায়েন্ট",
      "লোকেশন",
      "প্যাকেজ ও দাম",
    ]);
    expect(document.title).toBe("ড্যাশবোর্ড · আদর্শ মুন্সির হোটেল");
    // Tests run without a backend configured.
    expect(screen.getByRole("status")).toHaveTextContent("সার্ভার: এখনো সেট করা হয়নি");
  });

  it("marks the current section and shows order numbers in Bangla digits", async () => {
    renderApp("/orders/0047");

    expect(await screen.findByRole("heading", { name: "অর্ডার ০০৪৭" })).toBeInTheDocument();
    const nav = mainMenu();
    expect(nav.getByRole("link", { name: "অর্ডার" })).toHaveAttribute("aria-current", "page");
    expect(nav.getByRole("link", { name: "ড্যাশবোর্ড" })).not.toHaveAttribute("aria-current");
    expect(nav.getByRole("link", { name: "নতুন অর্ডার" })).not.toHaveAttribute("aria-current");
  });

  it("switches the whole interface to English", async () => {
    const user = userEvent.setup();
    renderApp("/packages");
    await screen.findByRole("heading", { name: "প্যাকেজ ও দাম" });

    await user.click(screen.getByRole("button", { name: "English" }));

    expect(await screen.findByRole("heading", { name: "Packages" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement.lang).toBe("en");
    expect(document.title).toBe("Packages · Adarsha Munshir Hotel");
  });

  it("applies and remembers a theme choice", async () => {
    const user = userEvent.setup();
    renderApp("/");
    const theme = await screen.findByRole("combobox", { name: "থিম" });

    await user.selectOptions(theme, "dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("amh:theme")).toBe("dark");

    await user.selectOptions(theme, "system");
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(localStorage.getItem("amh:theme")).toBeNull();
  });

  it("shows a helpful page for an unknown address", async () => {
    renderApp("/no-such-page");

    expect(
      await screen.findByRole("heading", { name: "পাতাটা খুঁজে পাওয়া যায়নি" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ড্যাশবোর্ডে ফিরুন" })).toHaveAttribute("href", "/");
  });
});
