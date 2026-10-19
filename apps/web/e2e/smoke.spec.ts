import { expect, test } from "@playwright/test";
import type { ConsoleMessage } from "@playwright/test";

test.describe("foundation smoke", () => {
  let consoleErrors: string[];

  test.beforeEach(({ page }) => {
    consoleErrors = [];
    page.on("console", (message: ConsoleMessage) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(error.message));
  });

  test.afterEach(() => {
    expect(consoleErrors).toEqual([]);
  });

  test("opens in Bangla and moves between sections", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("ড্যাশবোর্ড · আদর্শ মুন্সির হোটেল");
    await expect(page.locator("html")).toHaveAttribute("lang", "bn");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("ড্যাশবোর্ড");
    await expect(page.getByRole("status")).toContainText("সার্ভার:");

    // Exactly one menu is visible at any width.
    const menu = page.getByRole("navigation", { name: "প্রধান মেনু" });
    await menu.getByRole("link", { name: "অর্ডার", exact: true }).click();
    await expect(page).toHaveURL("/orders");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("অর্ডার");
    await expect(menu.getByRole("link", { name: "অর্ডার", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("remembers English across a reload", async ({ page }) => {
    await page.goto("/packages");
    await page.getByRole("button", { name: "English" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Packages");

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Packages");
  });

  test("serves deep links and explains unknown addresses", async ({ page }) => {
    await page.goto("/orders/0047");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("অর্ডার ০০৪৭");

    await page.goto("/no-such-page");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("পাতাটা খুঁজে পাওয়া যায়নি");
    await page.getByRole("link", { name: "ড্যাশবোর্ডে ফিরুন" }).click();
    await expect(page).toHaveURL("/");
  });

  test("is installable: manifest, icons and an active service worker", async ({
    page,
    request,
  }) => {
    await page.goto("/");
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
      "href",
      "/manifest.webmanifest",
    );

    const manifest = (await (await request.get("/manifest.webmanifest")).json()) as {
      short_name: string;
      lang: string;
      display: string;
      icons: { src: string; purpose: string }[];
    };
    expect(manifest).toMatchObject({
      short_name: "আদর্শ হোটেল",
      lang: "bn",
      display: "standalone",
    });
    expect(manifest.icons.map((icon) => icon.purpose)).toEqual(["any", "any", "maskable"]);
    for (const icon of manifest.icons) {
      const response = await request.get(icon.src);
      expect(response.headers()["content-type"]).toBe("image/png");
    }

    const scope = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return registration.active ? registration.scope : null;
    });
    expect(scope).toBe(new URL("/", page.url()).href);
  });
});

test.describe("theme boot script", () => {
  // A service worker would serve the bundle from its cache, out of reach of page.route().
  test.use({ serviceWorkers: "block" });

  test("applies a saved dark theme before the app bundle runs", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("combobox", { name: "থিম" }).selectOption("dark");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    // Block the app bundle: only public/theme-boot.js can have set the theme after this reload.
    await page.route("**/assets/*.js", (route) => route.abort());
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(10, 16, 25)");
  });
});
