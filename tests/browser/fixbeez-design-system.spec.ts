import { test, expect, type Page } from "./fixtures";

const applianceId = "11111111-1111-4111-8111-111111111111";
const serviceId = "22222222-2222-4222-8222-222222222222";
async function customerData(page: Page) {
  await page.route("https://accounts.google.com/**", (route) => route.abort());
  await page.route("**/api/v1/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/customer/config"))
      return route.fulfill({ json: { data: { clientId: null } } });
    if (path.endsWith("/profile"))
      return route.fulfill({
        json: {
          data: {
            id: applianceId,
            full_name: "Design QA",
            email: "qa@example.com",
            phone_e164: "+919876543210",
          },
        },
      });
    if (path.endsWith("/catalogue/appliances"))
      return route.fulfill({
        json: {
          data: [
            { id: applianceId, name: "Air Conditioner", service_count: 2 },
          ],
        },
      });
    if (
      path.endsWith("/catalogue") ||
      path.endsWith(`/catalogue/appliances/${applianceId}/services`)
    )
      return route.fulfill({
        json: {
          data: [
            {
              id: serviceId,
              name: "AC General Service",
              description: "Appliance service",
              appliance_category_id: applianceId,
              appliance_name: "Air Conditioner",
              request_type: "SERVICE",
              booking_options: [],
            },
            {
              id: "install",
              name: "AC Installation",
              description: "Installation service",
              appliance_category_id: applianceId,
              appliance_name: "Air Conditioner",
              request_type: "INSTALLATION",
              booking_options: [],
            },
          ],
          meta: { appliance: { id: applianceId, name: "Air Conditioner" } },
        },
      });
    if (path.endsWith("/requests"))
      return route.fulfill({
        json: {
          data: ["REQUESTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"].map(
            (status, i) => ({
              id: `request-${i}`,
              request_number: `${123450 + i}`,
              appliance: "Air Conditioner",
              service_name: "General Service",
              request_type: "SERVICE",
              status,
              preferred_date: "2026-11-10",
              preferred_time_window: "08:00-12:00",
              address_snapshot: { area: "Adyar", city: "Chennai" },
              review_id: status === "COMPLETED" ? "review" : null,
            }),
          ),
        },
      });
    return route.fulfill({ json: { data: [] } });
  });
}

for (const width of [320, 360, 768, 1440]) {
  test(`customer brand, real service listing and navigation at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await customerData(page);
    await page.goto("/");
    await expect(page.locator(".home-welcome h1")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Browse Appliances" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Fixbeez home" }).getByRole("img"),
    ).toHaveAttribute("src", /fixbeez-original-logo-transparent/);
    const bottom = page.locator(".bottom-nav");
    await expect(bottom.locator("a")).toHaveText([
      "Home",
      "Services",
      "+ Book",
      "My Requests",
      "Profile",
    ]);
    if (width < 1001) await expect(bottom).toBeVisible();
    await page.screenshot({
      path: `test-results/fixbeez/home-${width}.png`,
      fullPage: true,
    });
    await page.goto("/services");
    await expect(
      page.getByRole("heading", { name: "Appliances", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Book AC General Service", exact: true }),
    ).toHaveCount(0);
    await page.screenshot({
      path: `test-results/fixbeez/appliances-${width}.png`,
      fullPage: true,
    });
    await page
      .locator(".appliance-card")
      .filter({ hasText: "Air Conditioner" })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/services/appliances/${applianceId}$`),
    );
    await expect(
      page.getByRole("link", { name: "Book AC General Service", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Service", exact: true }).click();
    await expect(
      page.getByRole("link", { name: "Book AC Installation", exact: true }),
    ).toHaveCount(0);
    await page.screenshot({
      path: `test-results/fixbeez/appliance-services-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Installation", exact: true })
      .click();
    await expect(
      page.getByRole("link", { name: "Book AC Installation", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Book AC General Service", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("link", { name: "Book AC Installation", exact: true })
      .click();
    await expect(page).toHaveURL(
      /\/request\/installation\?.*applianceCategoryId=/,
    );
    await page.goto("/book");
    await expect(
      page.getByRole("heading", { name: "Book a visit", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".booking-entry-grid a")).toHaveCount(2);
    await page.goto("/bookings");
    await expect(page.locator(".request-card")).toHaveCount(4);
    for (const status of ["Pending", "In Progress", "Completed"]) {
      await page.getByRole("button", { name: status, exact: true }).click();
      await expect(page.locator(".request-card")).toHaveCount(1);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    expect(
      await page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue("--color-background")
          .trim(),
      ),
    ).toBe("#ffffff");
    await page.screenshot({
      path: `test-results/fixbeez/requests-${width}.png`,
      fullPage: true,
    });
    await page.goto("/login");
    await expect(bottom).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Welcome to Fixbeez" }),
    ).toBeVisible();
  });
}

test("first launch is skippable and completion retains a deep link", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.removeItem("fixbeez.customer.onboarding.v1");
    sessionStorage.removeItem("fixbeez.customer.launched.v1");
  });
  await customerData(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/book");
  await expect(
    page.getByRole("heading", { name: "A little help. A happier home." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Skip intro" }).click();
  await expect(
    page.getByRole("heading", { name: "Book a visit", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/book$/);
  expect(
    await page.evaluate(() =>
      localStorage.getItem("fixbeez.customer.onboarding.v1"),
    ),
  ).toBe("complete");
});
