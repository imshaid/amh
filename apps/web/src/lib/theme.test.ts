import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import {
  getThemePreference,
  setThemePreference,
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
