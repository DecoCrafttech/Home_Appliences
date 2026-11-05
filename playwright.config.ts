import { defineConfig } from "@playwright/test";
// Browser suites must not inherit the shared launch database from local files.
process.env.NODE_ENV = "test";
if (
  process.env.RUN_DB_INTEGRATION === "true" &&
  process.env.TEST_DATABASE_URL
) {
  const target = new URL(process.env.TEST_DATABASE_URL);
  if (!/^\/fixbeez_audit_[a-f0-9]{12}$/.test(target.pathname))
    throw new Error(
      "Browser database tests require a newly created audit database",
    );
  process.env.DATABASE_URL = target.href;
} else {
  delete process.env.DATABASE_URL;
}
export default defineConfig({
  globalSetup: "./tests/browser/globalSetup.ts",
  testDir: "./tests/browser",
  workers: 1,
  timeout: 120000,
  expect: { timeout: 30000 },
  use: {
    baseURL: "http://localhost:5173",
    browserName: "chromium",
    channel: "chrome",
    headless: true,
    actionTimeout: 15000,
  },
  webServer: [
    {
      command: "npm run dev -w @home/customer",
      url: "http://localhost:5173",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "npm run dev -w @home/api",
      url: "http://localhost:3001/api/v1/health",
      reuseExistingServer: false,
      env: { NODE_ENV: "test" },
    },
    {
      command: "npm run dev -w @home/admin",
      url: "http://127.0.0.1:5174",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "npm run dev -w @home/technician",
      url: "http://127.0.0.1:5175",
      reuseExistingServer: !process.env.CI,
    },
  ],
});
