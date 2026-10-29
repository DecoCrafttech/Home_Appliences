import { test, expect } from "@playwright/test";
const appliance = "11111111-1111-4111-8111-111111111111";
const names = [
  "AC repair",
  "Deep cleaning & preventive maintenance for split air conditioners",
  "New AC installation",
];
for (const width of [360, 768, 1440])
  test(`catalogue cards align and remain usable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const services = names.map((name, i) => ({
      id: `22222222-2222-4222-8222-22222222222${i}`,
      name,
      description:
        i === 1
          ? "A thorough clean for indoor and outdoor units, with a complete performance check."
          : "Expert care for your appliance.",
      appliance_category_id: appliance,
      appliance_name: "Air Conditioner",
      request_type: "SERVICE",
      publication_status: i === 2 ? "DRAFT" : "PUBLISHED",
      form_fields: [],
      booking_options: [],
      base_price: i === 0 ? 499 : null,
      icon_url: i === 0 ? "/api/v1/catalogue/media/preview" : null,
      icon_preview_url: i === 0 ? "/api/v1/catalogue/media/preview" : null,
    }));
    await page.route("**/api/v1/**", (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/media/preview"))
        return route.fulfill({
          contentType: "image/svg+xml",
          body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect x="3" y="9" width="42" height="27" rx="6" fill="#dbeafe" stroke="#2563eb" stroke-width="2"/><path d="M11 21h26M11 27h26" stroke="#2563eb" stroke-width="2"/></svg>',
        });
      if (path.endsWith("/auth/me"))
        return route.fulfill({
          json: {
            data: {
              id: appliance,
              username: "qa",
              full_name: "QA Admin",
              role: "ADMIN",
            },
          },
        });
      if (path === "/api/v1/admin/catalogue")
        return route.fulfill({
          json: {
            data: {
              categories: [{ id: appliance, name: "Air Conditioner" }],
              services,
            },
          },
        });
      if (path.endsWith(`/appliances/${appliance}/services`))
        return route.fulfill({
          json: {
            data: services,
            meta: { appliance: { name: "Air Conditioner" } },
          },
        });
      if (path.endsWith("/catalogue/appliances"))
        return route.fulfill({
          json: {
            data: [
              { id: appliance, name: "Air Conditioner", service_count: 3 },
              {
                id: "fridge",
                name: "Refrigerator & freezer",
                service_count: 2,
              },
              { id: "washing", name: "Washing Machine", service_count: 4 },
            ],
          },
        });
      if (path.endsWith("/profile"))
        return route.fulfill({
          status: 401,
          json: { error: { message: "Sign in" } },
        });
      return route.fulfill({ json: { data: [], meta: { unreadCount: 0 } } });
    });
    const fits = async () =>
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
    await page.goto("http://127.0.0.1:5174/catalogue");
    await expect(page.locator(".catalogue-management-card")).toHaveCount(3);
    await fits();
    for (const card of await page.locator(".catalogue-management-card").all()) {
      await expect(
        card.getByRole("button", { name: "Change icon", exact: true }),
      ).toBeVisible();
    }
    if (width === 1440) {
      const bounds = await page
        .locator(".catalogue-management-card .workflow-actions")
        .evaluateAll((nodes) =>
          nodes.map((n) => n.getBoundingClientRect().bottom),
        );
      expect(Math.max(...bounds) - Math.min(...bounds)).toBeLessThan(2);
    }
    await page.screenshot({
      path: `test-results/card-design/admin-${width}.png`,
      fullPage: true,
    });
    await page.goto(`http://localhost:5173/services/appliances/${appliance}`);
    await expect(page.locator(".discovery-card")).toHaveCount(3);
    await fits();
    if (width === 1440) {
      const bounds = await page
        .locator(".discovery-footer")
        .evaluateAll((nodes) =>
          nodes.map((n) => n.getBoundingClientRect().bottom),
        );
      expect(Math.max(...bounds) - Math.min(...bounds)).toBeLessThan(2);
    }
    await page.screenshot({
      path: `test-results/card-design/customer-${width}.png`,
      fullPage: true,
    });
    const search = page.getByRole("searchbox", {
      name: "Search services",
      exact: true,
    });
    await search.fill("no matching service");
    await expect(
      page.getByRole("heading", { name: "No matching services" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Clear filters", exact: true })
      .click();
    await expect(page.locator(".discovery-card")).toHaveCount(3);
    await search.fill("repair");
    await expect(page.locator(".discovery-card")).toHaveCount(1);
    await page
      .getByRole("button", { name: "Clear search", exact: true })
      .click();
    await expect(page.locator(".discovery-card")).toHaveCount(3);
    await page.goto("http://localhost:5173/services");
    await expect(page.locator(".appliance-card")).toHaveCount(3);
    await fits();
    await page.screenshot({
      path: `test-results/card-design/appliances-${width}.png`,
      fullPage: true,
    });
  });
