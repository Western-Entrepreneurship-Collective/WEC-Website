import { defineConfig, devices } from "@playwright/test";
import { LOCAL, assertLocal } from "./os-tests/support/local";

// Separate from playwright.config.ts on purpose: the public suite must keep running
// without Docker. Run with `npm run test:os` after `npx supabase start` and a build.
assertLocal(LOCAL.url);

export default defineConfig({
  testDir: "./os-tests",
  globalSetup: "./os-tests/support/globalSetup.ts",
  timeout: 45000,
  expect: { timeout: 8000 },
  // These share one database and walk through workflows in order.
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:3002", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "phone", testMatch: /responsive\.spec/, use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: "npm run start -- --port 3002",
    url: "http://localhost:3002/os/login",
    reuseExistingServer: false,
    timeout: 60000,
    env: {
      SUPABASE_URL: LOCAL.url,
      SUPABASE_ANON_KEY: LOCAL.anonKey,
      SUPABASE_SERVICE_ROLE_KEY: LOCAL.serviceKey,
      WEC_OS_SITE_URL: "http://localhost:3002",
      WEC_OS_JOBS_SECRET: "local-jobs-secret",
    },
  },
});
