import { test, expect } from "@playwright/test";

test("technician workday shortcuts request the matching job list", async ({
  page,
}) => {
  const requestedTabs: string[] = [];
  await page.route("**/api/v1/technician/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/auth/me"))
      return route.fulfill({
        json: {
          data: {
            id: "qa-tech",
            full_name: "QA Technician",
            username: "qa",
            availability: "AVAILABLE",
            verification_status: "VERIFIED",
            csrfToken: "a".repeat(43),
            must_change_password: false,
          },
        },
      });
    if (url.pathname.endsWith("/dashboard"))
      return route.fulfill({
        json: {
          data: {
            pending: 2,
            today: 3,
            in_progress: 1,
            completed_today: 1,
            next_jobs: [],
          },
        },
      });
    if (url.pathname.endsWith("/jobs")) {
      requestedTabs.push(url.searchParams.get("tab") || "");
      return route.fulfill({ json: { data: [], meta: { total: 0 } } });
    }
    return route.fulfill({ json: { data: [], meta: { unreadCount: 0 } } });
  });
  for (const [label, tab] of [
    ["New offers", "pending"],
    ["Today's jobs", "today"],
    ["In progress", "in-progress"],
  ]) {
    await page.goto("http://127.0.0.1:5175/technician");
    await page.getByRole("link", { name: new RegExp(label!) }).click();
    await expect(page.getByRole("combobox", { name: "View", exact: true })).toHaveValue(tab!);
    await expect.poll(() => requestedTabs.at(-1)).toBe(tab);
  }
});

test("customer home prioritizes an estimate decision and shows confirmed visit", async ({
  page,
}) => {
  await page.route("**/api/v1/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/profile"))
      return route.fulfill({
        json: { data: { id: "qa-customer", full_name: "QA Customer" } },
      });
    if (path.endsWith("/requests"))
      return route.fulfill({
        json: {
          data: [
            {
              id: "ordinary",
              request_number: "SR-1",
              appliance: "Washing Machine",
              service_name: "Repair",
              request_type: "SERVICE",
              status: "REQUESTED",
              preferred_date: "2099-10-25",
              preferred_time_window: "09:00-12:00",
            },
            {
              id: "decision",
              request_number: "SR-2",
              appliance: "Air Conditioner",
              service_name: "Cooling repair",
              request_type: "SERVICE",
              status: "ESTIMATE_PENDING_APPROVAL",
              preferred_date: "2099-10-25",
              preferred_time_window: "09:00-12:00",
              confirmed_date: "2099-10-26",
              confirmed_time_window: "12:00-16:00",
            },
          ],
        },
      });
    if (path.endsWith("/auth/customer/config"))
      return route.fulfill({ json: { data: { clientId: null } } });
    return route.fulfill({ json: { data: [], meta: { unreadCount: 0 } } });
  });
  await page.goto("http://localhost:5173/");
  const card = page.locator(".request-card");
  await expect(
    card.getByRole("heading", { name: "Air Conditioner", exact: true }),
  ).toBeVisible();
  await expect(card).toContainText(
    "Review the estimate and approve or decline",
  );
  await expect(card).toContainText("Confirmed: 2099-10-26");
  await expect(card).toContainText("12:00-16:00");
  await expect(
    page.getByRole("link", { name: "View all (2)", exact: true }),
  ).toHaveAttribute("href", "/bookings");
});
