import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// The service worker only exists in production builds; the end-to-end tests cover it.
vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: () => ({
    needRefresh: [false, () => undefined],
    offlineReady: [false, () => undefined],
    updateServiceWorker: () => Promise.resolve(),
  }),
}));

// Testing Library only cleans up automatically when test globals are enabled; they are not.
afterEach(() => {
  cleanup();
});

// jsdom does not implement scrolling; the router's scroll restoration calls it.
window.scrollTo = () => undefined;
