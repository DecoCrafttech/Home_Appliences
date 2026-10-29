import { test, expect } from "@playwright/test";

const identity = "11111111-1111-4111-8111-111111111111";
const acceptedId = "22222222-2222-4222-8222-222222222222";

for (const width of [360, 390, 768, 1440]) {
  test(`assigned technician cards keep contact and actions usable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    let writes = 0;
    await page.route("**/api/v1/technician/**", (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/auth/me"))
        return route.fulfill({
          json: {
            data: {
              id: identity,
              full_name: "Arun Kumar",
              username: "qa",
              csrfToken: "a".repeat(43),
              availability: "AVAILABLE",
              verification_status: "VERIFIED",
            },
          },
        });
      if (path.endsWith("/jobs"))
        return route.fulfill({
          json: {
            data: [
              {
                id: acceptedId,
                assignment_id: acceptedId,
                request_number: "SR-101",
                request_type: "SERVICE",
                appliance: "Air Conditioner",
                service_name: "Cooling inspection and preventive maintenance",
                status: "APPOINTMENT_CONFIRMED",
                assignment_state: "ACCEPTED",
                customer_name: "Priya Kumar",
                customer_phone: "+919876543210",
                preferred_date: "2026-10-25",
                confirmed_date: "2026-10-26",
                confirmed_time_window: "09:00-12:00",
                address_snapshot: {
                  line1: "12 Lake Road",
                  area: "Adyar",
                  city: "Chennai",
                  state: "Tamil Nadu",
                  pinCode: "600020",
                },
              },
            ],
            meta: { total: 1 },
          },
        });
      if (route.request().method() !== "GET") writes++;
      return route.fulfill({ json: { data: [] } });
    });
    await page.goto("http://127.0.0.1:5175/technician/jobs");
    const accepted = page
      .locator(".tech-job-card")
      .filter({ hasText: "SR-101" });
    await expect(
      accepted.getByText("Confirmed visit", { exact: true }),
    ).toBeVisible();
    await expect(accepted.locator("time")).toHaveAttribute(
      "datetime",
      "2026-10-26",
    );
    await expect(
      accepted.getByRole("link", { name: /Call Customer/ }),
    ).toHaveAttribute("href", "tel:+919876543210");
    await expect(
      accepted.getByRole("button", { name: /Accept|Decline job/ }),
    ).toHaveCount(0);
    for (const button of await page.locator(".tech-card-actions > *").all()) {
      const box = await button.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeLessThan(80);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/marketplace-polish/technician-jobs-${width}.png`,
      fullPage: true,
    });
    await expect(
      accepted.getByRole("link", { name: "Get Directions", exact: true }),
    ).toHaveAttribute("href", /maps\/dir/);
    await expect(
      accepted.getByRole("button", { name: /Copy address|Share Location/ }),
    ).toHaveCount(0);
    expect(writes).toBe(0);
    await accepted.getByRole("link", { name: "View job", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/technician/jobs/${acceptedId}$`));
  });
}

for (const width of [360, 1440]) {
  test(`admin metric shortcuts and debounced search work at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const searches: string[] = [];
    await page.route("**/api/v1/admin/**", (route) => {
      const url = new URL(route.request().url()),
        path = url.pathname;
      if (path.endsWith("/auth/me"))
        return route.fulfill({
          json: {
            data: {
              id: identity,
              username: "qa",
              full_name: "QA Admin",
              role: "ADMIN",
            },
          },
        });
      if (path.endsWith("/dashboard/summary"))
        return route.fulfill({
          json: {
            data: {
              needs_attention: 4,
              new_service_requests: 2,
              new_installation_requests: 1,
              pending_requests: 5,
              completed_requests: 3,
              available_technicians: 2,
            },
          },
        });
      if (path.endsWith("/dashboard/allocation"))
        return route.fulfill({
          json: { data: { unassigned: 2, workload: [] } },
        });
      if (path.endsWith("/dashboard/activity"))
        return route.fulfill({
          json: {
            data: {
              attention: [],
              trends: [],
              distribution: [],
              recent: [],
              alerts: {},
            },
          },
        });
      if (path.endsWith("/catalogue"))
        return route.fulfill({
          json: { data: { categories: [], services: [] } },
        });
      if (path.endsWith("/requests")) {
        searches.push(url.searchParams.get("q") || "");
        return route.fulfill({ json: { data: [], meta: { total: 0 } } });
      }
      return route.fulfill({ json: { data: [] } });
    });
    await page.goto("http://127.0.0.1:5174/");
    const shortcut = page.getByRole("link", {
      name: "View new requests",
      exact: true,
    });
    await expect(shortcut).toBeVisible();
    await shortcut.click();
    await expect(page).toHaveURL(/\/requests\?status=REQUESTED$/);
    await expect(
      page.getByRole("heading", { name: "No requests match your filters" }),
    ).toBeVisible();
    const baseline = searches.length;
    await page
      .getByRole("searchbox", { name: "Search requests", exact: true })
      .pressSequentially("Priya", { delay: 35 });
    await expect.poll(() => searches.at(-1)).toBe("Priya");
    expect(searches.slice(baseline)).toEqual(["Priya"]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  });
}
