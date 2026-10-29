import { defineConfig } from "@playwright/test";
export default defineConfig({
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
      reuseExistingServer: !process.env.CI,
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
