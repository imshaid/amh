import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, vi } from "vitest";

// The service worker only exists in production builds; the end-to-end tests cover it.
vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: () => ({
    needRefresh: [false, () => undefined],
    offlineReady: [false, () => undefined],
    updateServiceWorker: () => Promise.resolve(),
  }),
}));

// Animations finish at once, so tests never wait for a transition.
MotionGlobalConfig.skipAnimations = true;

// Testing Library only cleans up automatically when test globals are enabled; they are not.
afterEach(() => {
  cleanup();
});

// jsdom does not implement scrolling; the router's scroll restoration and cmdk call it.
window.scrollTo = () => undefined;
Element.prototype.scrollIntoView = () => undefined;

/**
 * jsdom has no layout, so media queries are answered for a desktop-sized window (1280px wide, no
 * reduced motion). Width queries in the `(width >= 48rem)` and `(min-width: 768px)` forms work.
 */
export const TEST_VIEWPORT_WIDTH = 1280;

function matchesWidth(query: string): boolean {
  const range =
    /width\s*>=\s*([\d.]+)(rem|px)/.exec(query) ?? /min-width:\s*([\d.]+)(rem|px)/.exec(query);
  if (!range) return false;
  const [, amount = "0", unit] = range;
  const pixels = Number(amount) * (unit === "rem" ? 16 : 1);
  return TEST_VIEWPORT_WIDTH >= pixels;
}

window.matchMedia = (query: string) =>
  ({
    matches: matchesWidth(query),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }) as MediaQueryList;

// Radix measures elements with ResizeObserver, and its Select uses pointer capture; jsdom has
// neither.
window.ResizeObserver = class {
  observe() {
    // Nothing to observe without layout.
  }
  unobserve() {
    // Nothing was observed.
  }
  disconnect() {
    // Nothing was observed.
  }
};
Element.prototype.hasPointerCapture = () => false;
Element.prototype.releasePointerCapture = () => undefined;
