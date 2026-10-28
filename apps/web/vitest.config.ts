import { defineConfig, mergeConfig } from "vitest/config";

import viteConfig from "./vite.config.ts";

export default defineConfig((configEnv) =>
  mergeConfig(
    viteConfig(configEnv),
    defineConfig({
      // Tests never read a developer's .env.local, so they cannot reach a real backend.
      envDir: "./src/test",
      // Sample spreadsheets are imported as fixtures with `?inline` (see src/test/fixtures.ts).
      assetsInclude: ["**/*.xlsx"],
      test: {
        name: "web",
        environment: "jsdom",
        include: ["src/**/*.test.{ts,tsx}", "build/**/*.test.ts"],
        setupFiles: ["./src/test/setup.ts"],
        restoreMocks: true,
        // CSS imports are empty in tests, except the tokens, whose contrast is tested.
        css: { include: [/src\/styles\/tokens\.css/] },
      },
    }),
  ),
);
