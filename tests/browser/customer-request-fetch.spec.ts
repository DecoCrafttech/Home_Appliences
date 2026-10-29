import { test, expect, type Page } from "@playwright/test";

const id = "11111111-1111-4111-8111-111111111111";
async function fixture(page: Page) {
  const calls = { list: 0, detail: 0, timeline: 0, estimates: 0 };
  const state = { fail: false };
  const record = {
    id,
    request_number: "SR-ON-DEMAND",
    appliance: "Air Conditioner",
    service_name: "Inspection",
    request_type: "SERVICE",
    status: "REQUESTED",
    version: 1,
    details: {},
    address_snapshot: {
      name: "Request QA",
      phone: "9876543210",
      line1: "Test street",
      area: "Adyar",
      city: "Chennai",
      state: "Tamil Nadu",
      pinCode: "600020",
    },
    preferred_date: "2099-11-01",
    preferred_time_window: "09:00-10:00",
    created_at: "2026-10-23T06:00:00Z",
  };
  await page.clock.install();
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/customer/config"))
      return route.fulfill({ json: { data: { clientId: null } } });
    if (path.endsWith("/profile"))
      return route.fulfill({
        json: {
          data: { id, full_name: "Request QA", created_at: record.created_at },
        },
      });
    const key =
      path === "/api/v1/requests"
        ? "list"
        : path === `/api/v1/requests/${id}`
          ? "detail"
          : path.endsWith(`/${id}/timeline`)
            ? "timeline"
            : path.endsWith(`/${id}/estimates`)
              ? "estimates"
              : null;
    if (key) {
      calls[key]++;
      if (state.fail)
        return route.fulfill({
          status: 503,
          json: { error: { message: "Request refresh unavailable" } },
        });
      if (calls[key] > 1)
        await new Promise((resolve) => setTimeout(resolve, 200));
      const data =
        key === "list"
          ? [record]
          : key === "detail"
            ? record
            : key === "timeline"
              ? [
                  {
                    id,
                    status: "REQUESTED",
                    note:
                      calls.timeline > 1
                        ? "Latest progress"
                        : "Request received",
                    created_at: record.created_at,
                  },
                ]
              : [];
      return route.fulfill({ json: { data } });
    }
    return route.fulfill({ json: { data: [] } });
  });
  return { calls, state };
}

async function idleAndFocus(page: Page) {
  await page.clock.fastForward(120000);
  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("offline"));
    window.dispatchEvent(new Event("online"));
  });
  await page.waitForTimeout(150);
}

for (const path of ["/", "/bookings"])
  test(`Customer ${path} requests fetch on opening, Refresh and reload only`, async ({
    page,
  }) => {
    const { calls } = await fixture(page);
    await page.goto(path);
    await expect.poll(() => calls.list).toBe(1);
    await idleAndFocus(page);
    expect(calls.list).toBe(1);
    if (path === "/bookings") {
      const refresh = page.getByRole("button", {
        name: "Refresh",
        exact: true,
      });
      await refresh.evaluate((button) => {
        (button as HTMLButtonElement).click();
        (button as HTMLButtonElement).click();
      });
      await expect(
        page.getByRole("button", { name: "Refreshing...", exact: true }),
      ).toBeDisabled();
      await expect(refresh).toBeEnabled();
      expect(calls.list).toBe(2);
    }
    const before = calls.list;
    await page.reload();
    await expect.poll(() => calls.list).toBe(before + 1);
  });

test("Customer detail, timeline and estimates stay idle and refresh together once per click", async ({
  page,
}) => {
  const { calls } = await fixture(page);
  await page.goto(`/requests/${id}`);
  await expect
    .poll(() => ({ ...calls }))
    .toEqual({ list: 0, detail: 1, timeline: 1, estimates: 1 });
  await expect(
    page.getByText("Request received", { exact: true }),
  ).toBeVisible();
  await idleAndFocus(page);
  expect(calls).toEqual({ list: 0, detail: 1, timeline: 1, estimates: 1 });
  const refresh = page.getByRole("button", { name: "Refresh", exact: true });
  await refresh.evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  await expect(
    page.getByText("Latest progress", { exact: true }),
  ).toBeVisible();
  expect(calls).toEqual({ list: 0, detail: 2, timeline: 2, estimates: 2 });
  await idleAndFocus(page);
  expect(calls).toEqual({ list: 0, detail: 2, timeline: 2, estimates: 2 });
});

test("Customer failed request refresh waits for an explicit retry", async ({
  page,
}) => {
  const { calls, state } = await fixture(page);
  await page.goto("/bookings");
  await expect(
    page.getByRole("button", { name: "Refresh", exact: true }),
  ).toBeVisible();
  state.fail = true;
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Try again", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator("[data-sonner-toast]")
      .getByText("Request refresh unavailable", { exact: true }),
  ).toBeVisible();
  await idleAndFocus(page);
  expect(calls.list).toBe(2);
  state.fail = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Refresh", exact: true }),
  ).toBeVisible();
  expect(calls.list).toBe(3);
});
