import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "backend/src/**/*.test.ts",
      "packages/shared/src/**/*.test.ts",
      "packages/ui/src/**/*.test.ts",
    ],
    env: { NODE_ENV: "test" },
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
