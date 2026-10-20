import { defineConfig } from "vitest/config";

// Unit tests for the Edge Functions' logic, run in Node. They never reach a real backend.
export default defineConfig({
  test: {
    name: "functions",
    environment: "node",
    include: ["**/*.test.ts"],
    restoreMocks: true,
  },
});
