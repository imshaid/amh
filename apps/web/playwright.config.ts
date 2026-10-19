import { defineConfig, devices } from "@playwright/test";

const port = 4173;
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${String(port)}`,
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  // Smoke tests run against a production build, so the service worker and manifest are real.
  // `--mode e2e` keeps developer .env files out of it (see vite.config.ts).
  webServer: {
    command: "npm run build -- --mode e2e && npm run preview -- --mode e2e",
    port,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
