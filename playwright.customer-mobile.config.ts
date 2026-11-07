import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "customer-android-layout.spec.ts",
  workers: 1,
  timeout: 45000,
  expect: { timeout: 10000 },
  use: {
    baseURL: "http://localhost:5197",
    channel: "chrome",
    headless: true,
    actionTimeout: 10000,
    serviceWorkers: "block",
  },
  webServer: {
    command:
      "npm exec -w @home/customer -- vite preview --host localhost --port 5197 --strictPort",
    url: "http://localhost:5197",
    reuseExistingServer: false,
  },
});
