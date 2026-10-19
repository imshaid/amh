import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Testing Library only cleans up automatically when test globals are enabled; they are not.
afterEach(() => {
  cleanup();
});

// jsdom does not implement scrolling; the router's scroll restoration calls it.
window.scrollTo = () => undefined;
