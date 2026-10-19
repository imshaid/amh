import { defineConfig, mergeConfig } from "vitest/config";

import viteConfig from "./vite.config.ts";

export default mergeConfig(
  viteConfig,
  defineConfig({
    // Tests never read a developer's .env.local, so they cannot reach a real backend.
    envDir: "./src/test",
    test: {
      name: "web",
      environment: "jsdom",
      include: ["src/**/*.test.{ts,tsx}"],
      setupFiles: ["./src/test/setup.ts"],
      restoreMocks: true,
    },
  }),
);
