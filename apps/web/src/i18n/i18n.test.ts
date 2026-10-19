import { beforeEach, describe, expect, it, vi } from "vitest";

import { LANGUAGE_STORAGE_KEY } from "./languages";
import bn from "./locales/bn.json";
import en from "./locales/en.json";

interface Catalogue {
  [key: string]: string | Catalogue;
}

/** Flattens a catalogue into "a.b.c" → text. */
function flatten(catalogue: Catalogue, prefix = ""): Map<string, string> {
  const entries = new Map<string, string>();
  for (const [key, value] of Object.entries(catalogue)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      entries.set(path, value);
    } else {
      for (const [childKey, childValue] of flatten(value, path)) {
        entries.set(childKey, childValue);
      }
    }
  }
  return entries;
}

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{\{\s*(\w+)/g)].map((match) => match[1] ?? "").sort();
}

describe("translation catalogues", () => {
  const bangla = flatten(bn);
  const english = flatten(en);

  it("have exactly the same keys", () => {
    expect([...english.keys()].sort()).toEqual([...bangla.keys()].sort());
  });

  it("have no empty strings", () => {
    for (const [key, text] of [...bangla, ...english]) {
      expect(text.trim(), key).not.toBe("");
    }
  });

  it("use the same placeholders in both languages", () => {
    for (const [key, text] of bangla) {
      expect(placeholders(english.get(key) ?? ""), key).toEqual(placeholders(text));
    }
  });
});

describe("i18n runtime", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it("starts in Bangla when nothing is stored", async () => {
    const { i18n } = await import("./i18n");
    expect(i18n.language).toBe("bn");
    expect(document.documentElement.lang).toBe("bn");
    expect(i18n.t("nav.orders")).toBe("অর্ডার");
  });

  it("starts in the stored language", async () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "en");
    const { i18n } = await import("./i18n");
    expect(i18n.language).toBe("en");
    expect(i18n.t("nav.orders")).toBe("Orders");
  });

  it("ignores an unknown stored language", async () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "fr");
    const { i18n } = await import("./i18n");
    expect(i18n.language).toBe("bn");
  });

  it("switches language, remembers it and updates <html lang>", async () => {
    const { i18n, setLanguage } = await import("./i18n");
    await setLanguage("en");
    expect(i18n.language).toBe("en");
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("en");
    expect(document.documentElement.lang).toBe("en");
  });

  it("interpolates values", async () => {
    const { i18n } = await import("./i18n");
    expect(i18n.t("pages.orderTitle", { number: "০০৪৭" })).toBe("অর্ডার ০০৪৭");
  });
});
