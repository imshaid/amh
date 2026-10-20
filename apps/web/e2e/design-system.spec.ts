import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { ConsoleMessage, Page } from "@playwright/test";

/** WCAG 2.1 A and AA: what BLUEPRINT §7 asks for. */
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const summary = results.violations.map(
    (violation) =>
      `${violation.id}: ${violation.help}\n  ${violation.nodes
        .slice(0, 5)
        .map((node) => node.target.join(" "))
        .join("\n  ")}`,
  );
  expect(summary).toEqual([]);
}

/** Contrast is only meaningful once the screen has faded in and the web fonts are in. */
async function waitUntilSettled(page: Page) {
  await expect(page.locator("#main > div").first()).toHaveCSS("opacity", "1");
  await page.evaluate(() => document.fonts.ready);
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe("design system", () => {
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

  test("the gallery shows every section without overflowing", async ({ page }) => {
    await page.goto("/dev/gallery");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("ডিজাইন গ্যালারি");
    for (const section of ["রং", "লেখা", "আইকন", "বোতাম", "ফর্ম", "টেবিল", "নড়াচড়া"]) {
      await expect(page.getByRole("heading", { level: 2, name: section })).toBeVisible();
    }
    await expectNoHorizontalOverflow(page);
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test.describe(`${colorScheme} theme`, () => {
      test.use({ colorScheme });

      test("the dashboard meets WCAG AA", async ({ page }) => {
        await page.goto("/");
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await waitUntilSettled(page);
        await expectNoAxeViolations(page);
      });

      test("the gallery meets WCAG AA", async ({ page }) => {
        await page.goto("/dev/gallery");
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await waitUntilSettled(page);
        // Counting figures and filling meters take a moment longer.
        await page.waitForTimeout(1000);
        await expectNoAxeViolations(page);
      });
    });
  }

  test("the command bar opens, filters and navigates by keyboard", async ({ page, isMobile }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("ড্যাশবোর্ড");
    if (isMobile) {
      await page.getByRole("button", { name: "খুঁজুন", exact: true }).click();
    } else {
      await page.keyboard.press("Control+k");
    }
    const dialog = page.getByRole("dialog", { name: "খুঁজুন ও যান" });
    await expect(dialog).toBeVisible();
    await page.keyboard.type("locations");
    await expect(dialog.getByRole("option")).toHaveText(["লোকেশন"]);
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL("/locations");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("লোকেশন");
    await expect(dialog).toBeHidden();
  });

  test("the skip link takes keyboard users straight to the content", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "মূল অংশে যান" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main")).toBeFocused();
  });
});

test.describe("phone", () => {
  test.skip(({ isMobile }) => !isMobile, "The bottom bar and its sheet exist on phones only.");

  test("More opens a sheet with the directories", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "আরও" }).click();
    const sheet = page.getByRole("dialog", { name: "আরও" });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("link", { name: "ক্লায়েন্ট" }).click();

    await expect(page).toHaveURL("/clients");
    await expect(sheet).toBeHidden();
    await expect(page.getByRole("button", { name: "আরও" })).toHaveAttribute("aria-current", "page");
  });

  test("the centre button starts a new order", async ({ page }) => {
    await page.goto("/orders");
    await page.getByRole("link", { name: "নতুন", exact: true }).click();
    await expect(page).toHaveURL("/new");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("নতুন অর্ডার");
  });
});
