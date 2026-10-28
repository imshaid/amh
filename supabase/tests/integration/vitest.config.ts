import { defineConfig } from "vitest/config";

// Integration tests against the running local Supabase stack (`npm run db:start`): the real Auth,
// Data API, Storage and Edge Runtime. Not part of `npm test`; run with `npm run test:integration`.
export default defineConfig({
  root: import.meta.dirname,
  test: {
    name: "integration",
    environment: "node",
    include: ["**/*.test.ts"],
    // Tests share one stack and its per-phone lockouts; run them one after another.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
