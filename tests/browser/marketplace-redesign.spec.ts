import { test, expect } from "@playwright/test";
const category = "11111111-1111-4111-8111-111111111111",
  service = "22222222-2222-4222-8222-222222222222";
for (const [width, height] of [
  [360, 800],
  [390, 844],
  [768, 1024],
  [1440, 900],
])
  test(`marketplace Home search and selected booking at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: width!, height: height! });
    await page.route("**/api/v1/**", (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/profile"))
        return route.fulfill({
          json: {
            data: {
              id: category,
              full_name: "Arun Kumar",
              email: "arun@example.com",
              phone_e164: "+919876543210",
              customer_reference: "CUS-000123",
            },
          },
        });
      if (path.endsWith("/catalogue/appliances"))
        return route.fulfill({
          json: {
            data: [
              "Air Conditioner",
              "Washing Machine",
              "Refrigerator",
              "Television",
              "Water Purifier",
              "Microwave",
              "Geyser",
              "Chimney",
            ].map((name, i) => ({
              id: i === 0 ? category : `other-${i}`,
              name,
              service_count: 2,
            })),
          },
        });
      if (path.endsWith("/catalogue"))
        return route.fulfill({
          json: {
            data: [
              {
                id: service,
                appliance_category_id: category,
                appliance_name: "Air Conditioner",
                name: "Cooling inspection",
                description: "Find the cause of poor cooling.",
                request_type: "SERVICE",
                base_price: 299,
                booking_options: [],
              },
            ],
          },
        });
      if (path.endsWith("/appliances"))
        return route.fulfill({
          json: { data: [{ id: category, name: "Air Conditioner" }] },
        });
      if (path.endsWith("/services"))
        return route.fulfill({
          json: {
            data: [
              {
                id: service,
                name: "Cooling inspection",
                description: "Find the cause of poor cooling.",
                booking_options: [],
                form_fields: [],
              },
            ],
          },
        });
      if (path.endsWith("/auth/customer/config"))
        return route.fulfill({ json: { data: { clientId: null } } });
      return route.fulfill({ json: { data: [] } });
    });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "How can we help today?" }),
    ).toBeVisible();
    await expect(page.locator(".appliance-card")).toHaveCount(8);
    const firstAppliance = page.locator(".appliance-card").first();
    await expect(firstAppliance).toHaveAttribute(
      "href",
      `/services/appliances/${category}`,
    );
    await expect(firstAppliance.getByRole("link")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: /Book now/ }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Notifications", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/marketplace/home-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole("searchbox", { name: "Search appliances", exact: true })
      .fill("cooling");
    await expect(
      page.getByRole("heading", { name: "Cooling inspection", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".discovery-price")).toContainText("299");
    await expect(page.locator(".discovery-card a")).toHaveCount(0);
    await page.goto(`/services/${service}`);
    await expect(page).toHaveURL(/\/services$/);
    await page.goto(
      `/request/service?applianceCategoryId=${category}`,
    );
    const serviceChoice = page
      .locator(".booking-service-card")
      .filter({ hasText: "Cooling inspection" });
    await serviceChoice
      .getByRole("button", { name: "View service details", exact: true })
      .click();
    await expect(
      serviceChoice.getByText("Find the cause of poor cooling."),
    ).toBeVisible();
    await serviceChoice.getByRole("button", { name: "Book now" }).click();
    await expect(
      serviceChoice.getByRole("button", { name: "Selected", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `test-results/marketplace/detail-${width}.png`,
      fullPage: true,
    });
  });

test("catalogue can save directly as draft and blocks publishing under a draft appliance", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let writes = 0;
  await page.route("**/api/v1/admin/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/me"))
      return route.fulfill({
        json: {
          data: {
            id: category,
            username: "qa",
            full_name: "QA Admin",
            role: "ADMIN",
          },
        },
      });
    if (
      path.endsWith("/catalogue/services") &&
      route.request().method() === "POST"
    ) {
      writes++;
      expect(route.request().postDataJSON().publicationStatus).toBe("DRAFT");
      return route.fulfill({ status: 201, json: { data: { id: service } } });
    }
    if (path.endsWith("/catalogue"))
      return route.fulfill({
        json: {
          data: {
            categories: [
              {
                id: category,
                name: "New appliance",
                publication_status: "DRAFT",
              },
            ],
            services: [],
          },
        },
      });
    return route.fulfill({ json: { data: [] } });
  });
  await page.goto("http://127.0.0.1:5174/catalogue");
  await page.getByRole("button", { name: "Add Service", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("combobox", { name: "Appliance", exact: true })
    .selectOption(category);
  await dialog.getByLabel("Service name", { exact: true }).fill("Inspection");
  await dialog.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Publish this appliance",
  );
  expect(writes).toBe(0);
  await page.screenshot({
    path: "test-results/marketplace/catalogue-editor-390.png",
    fullPage: true,
  });
  await dialog
    .getByRole("button", { name: "Save Draft", exact: true })
    .evaluate((button) => {
      for (let i = 0; i < 3; i++) (button as HTMLButtonElement).click();
    });
  await expect(dialog).toHaveCount(0);
  expect(writes).toBe(1);
});
