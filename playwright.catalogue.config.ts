import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "dynamic-catalogue.spec.ts",
  workers: 1,
  timeout: 300000,
  expect: { timeout: 30000 },
  outputDir: "test-results/dynamic-catalogue",
  use: {
    baseURL: "http://localhost:5193",
    channel: "chrome",
    headless: true,
    actionTimeout: 30000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    serviceWorkers: "block",
  },
  webServer: [
    {
      command: "npm run dev -w @home/api",
      url: "http://localhost:3391/api/v1/health",
      env: { PORT: "3391", NODE_ENV: "test" },
      reuseExistingServer: false,
      timeout: 60000,
    },
    {
      command: "npm run dev -w @home/customer -- --port 5193 --host localhost",
      url: "http://localhost:5193",
      env: { VITE_API_ORIGIN: "http://localhost:3391" },
      reuseExistingServer: false,
      timeout: 60000,
    },
    {
      command: "npm run dev -w @home/admin -- --port 5194 --host localhost",
      url: "http://localhost:5194",
      env: { VITE_API_ORIGIN: "http://localhost:3391" },
      reuseExistingServer: false,
      timeout: 60000,
    },
  ],
});
