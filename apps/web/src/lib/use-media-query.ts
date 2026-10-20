import { useCallback, useSyncExternalStore } from "react";

/**
 * Whether a CSS media query matches, kept up to date. `fallback` is used where matchMedia is
 * missing (tests without a layout engine).
 */
export function useMediaQuery(query: string, fallback = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window.matchMedia !== "function") return () => undefined;
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => {
        list.removeEventListener("change", onChange);
      };
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => (typeof window.matchMedia === "function" ? window.matchMedia(query).matches : fallback),
    () => fallback,
  );
}

/** Matches Tailwind's `md` breakpoint: tables show as tables from here, as cards below it. */
export const WIDE_QUERY = "(width >= 48rem)";
