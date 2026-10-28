import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { ConsoleMessage, Page } from "@playwright/test";

import { memberFor } from "./members";
import type { TestMember } from "./members";

const BANGLA_DIGITS = "০১২৩৪৫৬৭৮৯";
const toBangla = (text: string) =>
  text.replace(/[0-9]/g, (digit) => BANGLA_DIGITS.charAt(Number(digit)));

async function signIn(page: Page, member: TestMember, pin: string = member.pin) {
  // As people type it: Bangla digits and the hotel's dash.
  await page
    .getByLabel("মোবাইল নম্বর")
    .fill(toBangla(`${member.phone.slice(0, 5)}-${member.phone.slice(5)}`));
  // The sixth digit signs in by itself.
  await page.getByLabel("পিন (৬ সংখ্যা)").fill(pin);
}

test.describe("signing in against the local stack", () => {
  let consoleErrors: string[];

  test.beforeEach(({ page }) => {
    consoleErrors = [];
    page.on("console", (message: ConsoleMessage) => {
      // A wrong PIN is a 401 from member-auth, which the browser logs; the page explains it.
      if (message.type() === "error" && !message.text().includes("status of 401")) {
        consoleErrors.push(message.text());
      }
    });
    page.on("pageerror", (error) => consoleErrors.push(error.message));
  });

  test.afterEach(() => {
    expect(consoleErrors).toEqual([]);
  });

  test("a member signs in, gets back to their page, and signs out", async ({ page }, testInfo) => {
    const member = memberFor(testInfo.project.name);
    await page.goto("/orders");
    await expect(page).toHaveURL("/sign-in?redirect=%2Forders");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("লগ ইন");

    await signIn(page, member);

    await expect(page).toHaveURL("/orders");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("অর্ডার");
    await expect(page.getByRole("status")).toContainText("লাইভ");

    if (testInfo.project.name === "phone") {
      await page.getByRole("button", { name: "আরও" }).click();
      const sheet = page.getByRole("dialog", { name: "আরও" });
      await expect(sheet).toContainText(member.nameBn);
      await sheet.getByRole("button", { name: "লগ আউট" }).click();
    } else {
      await page.getByRole("button", { name: `${member.nameBn}: পিন বদলানো আর লগ আউট` }).click();
      await page.getByRole("menuitem", { name: "লগ আউট" }).click();
    }

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("লগ ইন");
    await page.goto("/packages");
    await expect(page).toHaveURL("/sign-in?redirect=%2Fpackages");
  });

  test("a wrong PIN is explained and nothing opens", async ({ page }, testInfo) => {
    await page.goto("/sign-in");
    await signIn(page, memberFor(testInfo.project.name), "000000");

    const alert = page.getByRole("alert");
    await expect(alert).toContainText("মোবাইল নম্বর বা পিন মেলেনি।");
    await expect(alert).toContainText("বার চেষ্টা করা যাবে");
    await expect(page.getByLabel("পিন (৬ সংখ্যা)")).toHaveValue("");
    await expect(page).toHaveURL("/sign-in");
  });

  test("on one's own device the session stays; on someone else's it ends with the tab", async ({
    page,
    context,
  }, testInfo) => {
    const member = memberFor(testInfo.project.name);

    // Trusted (the default): a new tab is still signed in.
    await page.goto("/sign-in");
    await signIn(page, member);
    await expect(page).toHaveURL("/");
    const second = await context.newPage();
    await second.goto("/packages");
    await expect(second.getByRole("heading", { level: 1 })).toHaveText("প্যাকেজ ও দাম");
    await second.close();

    // Untrusted: this tab keeps the session across a reload, a new tab does not get it.
    await context.clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto("/sign-in");
    await page.getByRole("checkbox", { name: "এই ডিভাইসে লগ ইন থাকুক" }).click();
    await signIn(page, member);
    await expect(page).toHaveURL("/");
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("ড্যাশবোর্ড");
    const third = await context.newPage();
    await third.goto("/");
    await expect(third).toHaveURL("/sign-in?redirect=%2F");
  });

  for (const scheme of ["light", "dark"] as const) {
    test(`the sign-in screen meets WCAG AA in the ${scheme} theme`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/sign-in");
      await expect(page.getByLabel("মোবাইল নম্বর")).toBeEnabled();
      await page.evaluate(() => document.fonts.ready);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual(
        [],
      );
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});
