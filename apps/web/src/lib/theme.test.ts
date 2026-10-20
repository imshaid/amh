import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import bootScript from "../../public/theme-boot.js?raw";
import indexHtml from "../../index.html?raw";
import {
  getThemePreference,
  setThemePreference,
  THEME_COLORS,
  THEME_STORAGE_KEY,
  useThemePreference,
} from "./theme";

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe("theme preference", () => {
  it("follows the system unless a valid choice is stored", () => {
    expect(getThemePreference()).toBe("system");
    localStorage.setItem(THEME_STORAGE_KEY, "sepia");
    expect(getThemePreference()).toBe("system");
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    expect(getThemePreference()).toBe("dark");
  });

  it("re-renders subscribers and applies the theme to <html>", () => {
    const { result } = renderHook(() => useThemePreference());
    expect(result.current[0]).toBe("system");

    act(() => {
      setThemePreference("light");
    });
    expect(result.current[0]).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("picks up a change made in another tab", () => {
    const { result } = renderHook(() => useThemePreference());

    act(() => {
      localStorage.setItem(THEME_STORAGE_KEY, "dark");
      window.dispatchEvent(new StorageEvent("storage", { key: THEME_STORAGE_KEY }));
    });
    expect(result.current[0]).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});

describe("browser theme colour", () => {
  function addThemeColorTags() {
    for (const [scheme, color] of Object.entries(THEME_COLORS)) {
      const tag = document.createElement("meta");
      tag.name = "theme-color";
      tag.media = `(prefers-color-scheme: ${scheme})`;
      tag.content = color;
      document.head.append(tag);
    }
    return () => {
      for (const tag of document.querySelectorAll('meta[name="theme-color"]')) tag.remove();
    };
  }

  function contents() {
    return [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map(
      (tag) => tag.content,
    );
  }

  it("follows a forced theme and returns to per-scheme colours for the system setting", () => {
    const removeTags = addThemeColorTags();
    try {
      setThemePreference("dark");
      expect(contents()).toEqual([THEME_COLORS.dark, THEME_COLORS.dark]);
      setThemePreference("light");
      expect(contents()).toEqual([THEME_COLORS.light, THEME_COLORS.light]);
      setThemePreference("system");
      expect(contents()).toEqual([THEME_COLORS.light, THEME_COLORS.dark]);
    } finally {
      removeTags();
    }
  });

  it("uses the same colours in index.html and the boot script", () => {
    for (const color of Object.values(THEME_COLORS)) {
      expect(indexHtml).toContain(`content="${color}"`);
      expect(bootScript).toContain(`"${color}"`);
    }
  });
});
