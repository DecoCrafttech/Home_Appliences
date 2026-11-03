import { test as base, expect } from "@playwright/test";

// Workflow suites start after the separately tested first-launch experience.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      localStorage.setItem("fixbeez.customer.onboarding.v1", "complete");
      for (const role of ["customer", "admin", "technician"]) {
        sessionStorage.setItem(`fixbeez.${role}.launched.v1`, "complete");
      }
    });
    await use(page);
  },
});
export { expect };
export type { Page } from "@playwright/test";
