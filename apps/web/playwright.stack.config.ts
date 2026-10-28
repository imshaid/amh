import { defineConfig, devices } from "@playwright/test";

const port = 4174;
const isCI = Boolean(process.env.CI);

// End-to-end tests against the local Supabase stack: real sign-in through member-auth, Auth and
// RLS. Run with `npm run e2e:stack` from the repository root, which first writes
// apps/web/.env.stack.local for the running stack; the app is built with `--mode stack`.
export default defineConfig({
  testDir: "./e2e-stack",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI
    ? [["github"], ["html", { open: "never", outputFolder: "playwright-report-stack" }]]
    : "list",
  globalSetup: "./e2e-stack/global-setup.ts",
  use: {
    baseURL: `http://localhost:${String(port)}`,
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npm run build -- --mode stack && npm run preview -- --mode stack --port ${String(port)}`,
    port,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
