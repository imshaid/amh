import { useCallback, useSyncExternalStore } from "react";

export const THEME_PREFERENCES = ["system", "light", "dark"] as const;

export type ThemePreference = (typeof THEME_PREFERENCES)[number];

/** Also read by public/theme-boot.js, which applies the choice before first paint. */
export const THEME_STORAGE_KEY = "amh:theme";

/**
 * The browser's own UI colour (address bar, installed app title bar) in each theme: the page
 * background token. public/theme-boot.js and index.html repeat these values; tests keep them equal.
 */
export const THEME_COLORS = { light: "#eef2f7", dark: "#0a1019" } as const;

const listeners = new Set<() => void>();

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

/**
 * index.html has one theme-color tag per colour scheme. A forced theme sets both to its colour, so
 * the browser UI matches the page even when it differs from the device setting.
 */
function applyThemeColor(preference: ThemePreference): void {
  const tags = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  for (const tag of tags) {
    const scheme = tag.media.includes("dark") ? "dark" : "light";
    tag.content = THEME_COLORS[preference === "system" ? scheme : preference];
  }
}

export function getThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

/** "system" removes the override, so the CSS follows prefers-color-scheme. */
function applyTheme(preference: ThemePreference): void {
  const root = document.documentElement;
  if (preference === "system") {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = preference;
  }
  applyThemeColor(preference);
}

export function setThemePreference(preference: ThemePreference): void {
  try {
    if (preference === "system") {
      localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      localStorage.setItem(THEME_STORAGE_KEY, preference);
    }
  } catch {
    // Without storage the choice lasts until the page reloads.
  }
  applyTheme(preference);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Keep other open tabs in step with a change made here.
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY || event.key === null) {
      applyTheme(getThemePreference());
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useThemePreference(): [ThemePreference, (preference: ThemePreference) => void] {
  const preference = useSyncExternalStore(
    subscribe,
    getThemePreference,
    (): ThemePreference => "system",
  );
  const update = useCallback((next: ThemePreference) => {
    setThemePreference(next);
  }, []);
  return [preference, update];
}
