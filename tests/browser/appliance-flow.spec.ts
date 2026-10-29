import { test, expect } from "@playwright/test";
const appliance = "11111111-1111-4111-8111-111111111111",
  service = "22222222-2222-4222-8222-222222222222",
  option = "33333333-3333-4333-8333-333333333333",
  option2 = "44444444-4444-4444-8444-444444444444";
for (const width of [360, 390, 768, 1024, 1440])
  test(`appliance navigation and multi-option booking at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    let scoped = 0;
    const options = [
      {
        id: option,
        name: "Cooling inspection",
        description: "Diagnose cooling",
        active: true,
        priceType: "INSPECTION",
        amountPaise: 29900,
      },
      {
        id: option2,
        name: "Filter cleaning",
        description: "Clean filters",
        active: true,
        priceType: "FIXED",
        amountPaise: 19900,
      },
    ];
    const category = {
      id: appliance,
      name: "Air Conditioner",
      slug: "air-conditioner",
      service_count: 2,
    };
    const item = {
      id: service,
      appliance_category_id: appliance,
      appliance_name: category.name,
      name: "AC Repair",
      request_type: "SERVICE",
      description: "Diagnosis and repair for your air conditioner",
      booking_options: options,
      form_fields: [],
    };
    await page.route("**/api/v1/**", (route) => {
      const p = new URL(route.request().url()).pathname;
      if (p.endsWith("/profile"))
        return route.fulfill({
          json: {
            data: {
              id: appliance,
              full_name: "Appliance QA",
              phone_e164: null,
              email: "appliance@example.com",
              created_at: "2026-10-22",
            },
          },
        });
      if (p.endsWith("/auth/customer/config"))
        return route.fulfill({ json: { data: { clientId: null } } });
      if (p.endsWith("/catalogue/appliances"))
        return route.fulfill({
          json: {
            data: [
              category,
              {
                id: option,
                name: "Washing Machine",
                slug: "washing-machine",
                service_count: 1,
              },
            ],
          },
        });
      if (p.endsWith(`/catalogue/appliances/${appliance}/services`)) {
        scoped++;
        return route.fulfill({
          json: {
            data: [
              item,
              {
                ...item,
                id: option2,
                name: "AC Installation",
                request_type: "INSTALLATION",
              },
            ],
            meta: { appliance: category },
          },
        });
      }
      if (p.endsWith("/catalogue"))
        return route.fulfill({ json: { data: [item] } });
      if (p.endsWith("/appliances"))
        return route.fulfill({ json: { data: [category] } });
      if (p.endsWith("/services"))
        return route.fulfill({ json: { data: [item] } });
      return route.fulfill({ json: { data: [] } });
    });
    await page.goto("http://localhost:5173/services");
    await expect(
      page.getByRole("heading", { name: "Appliances", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "AC Repair", exact: true }),
    ).toHaveCount(0);
    await page.screenshot({
      path: `test-results/manual-status/appliances-${width}.png`,
      fullPage: true,
    });
    await page
      .locator(".appliance-card")
      .filter({ hasText: "Air Conditioner" })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/services/appliances/${appliance}$`),
    );
    await expect.poll(() => scoped).toBe(1);
    await expect(
      page.getByRole("heading", { name: "AC Installation", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Service", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "AC Installation", exact: true }),
    ).toHaveCount(0);
    await expect(page.locator(".discovery-card a")).toHaveCount(0);
    await page.goto(
      `http://localhost:5173/request/service?applianceCategoryId=${appliance}`,
    );
    const repair = page
      .locator(".booking-service-card")
      .filter({ hasText: "AC Repair" });
    await repair
      .getByRole("button", { name: "View service details", exact: true })
      .click();
    await expect(repair.getByText(item.description)).toBeVisible();
    await repair.getByRole("button", { name: "Book now" }).click();
    await page
      .getByRole("checkbox", { name: /Cooling inspection/ })
      .check();
    await page
      .getByRole("checkbox", { name: /Filter cleaning/ })
      .check();
    await expect(
      page.getByRole("checkbox", { name: /Cooling inspection/ }),
    ).toBeChecked();
    await expect(
      page.getByRole("checkbox", { name: /Filter cleaning/ }),
    ).toBeChecked();
    await expect(
      page.getByRole("heading", { name: "Choose your appliance", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Air Conditioner/ }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByLabel(/Short description/)).toHaveAttribute(
      "placeholder",
      "Enter your brand and short details",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/manual-status/selected-service-${width}.png`,
      fullPage: true,
    });
  });
