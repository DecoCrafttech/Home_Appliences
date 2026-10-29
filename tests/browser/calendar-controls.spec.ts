import { test, expect, type Page } from "@playwright/test";
const id = "11111111-1111-4111-8111-111111111111";
async function setup(page: Page) {
  const ranges: string[] = [];
  let writes = 0;
  await page.route("**/api/v1/admin/**", (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname;
    if (path.endsWith("/auth/me"))
      return route.fulfill({
        json: {
          data: {
            id,
            username: "calendar",
            full_name: "Calendar QA",
            role: "ADMIN",
          },
        },
      });
    if (path.endsWith("/appointments")) {
      ranges.push(url.search);
      return route.fulfill({
        json: {
          data: [
            {
              id,
              display_number: 123,
              request_number: "QA-CALENDAR",
              request_type: "SERVICE",
              appliance: "Air Conditioner",
              service_name: "Inspection",
              status: "APPOINTMENT_CONFIRMED",
              version: 1,
              confirmed_date: "2099-11-01",
              confirmed_time_window: "09:00-10:00",
              customer_name: "Calendar Customer",
              technician_name: "Calendar Technician",
              address_snapshot: {
                line1: "QA street",
                area: "Adyar",
                city: "Chennai",
              },
            },
          ],
          meta: { truncated: false },
        },
      });
    }
    if (path.endsWith("/status")) {
      writes++;
      return route.fulfill({
        status: 409,
        json: {
          error: {
            message: "Technician already has an appointment at this time.",
          },
        },
      });
    }
    return route.fulfill({ json: { data: [] } });
  });
  await page.goto("http://127.0.0.1:5174/appointments?date=2099-11-01");
  await expect(page.locator(".calendar-event").first()).toBeVisible();
  return { ranges, writes: () => writes };
}
for (const width of [390, 1440])
  test(`calendar day, week, month and agenda work at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width < 500 ? 844 : 900 });
    const state = await setup(page);
    for (const name of ["Month view", "Agenda view", "Day view", "Week view"]) {
      await page.getByRole("tab", { name, exact: true }).click();
      await expect(page.locator(".calendar-event").first()).toBeVisible();
    }
    expect(state.ranges.length).toBeGreaterThanOrEqual(3);
    await page.getByLabel("Go to date", { exact: true }).fill("2099-11-08");
    await expect
      .poll(() => state.ranges.some((query) => query.includes("from=2099-11")))
      .toBe(true);
    await page.screenshot({
      path: `test-results/redesign/calendar-controls-${width}.png`,
      fullPage: true,
    });
  });
test("desktop calendar drag awaits confirmation and rejected reschedules preserve the original event", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const state = await setup(page);
  const event = page.locator(".calendar-event").first();
  await event.scrollIntoViewIfNeeded();
  const bounds = (await event.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 8);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 80, {
    steps: 20,
  });
  await page.mouse.up();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  expect(state.writes()).toBe(0);
  await dialog
    .getByRole("button", { name: "Confirm reschedule", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "Technician already has an appointment at this time.",
  );
  expect(state.writes()).toBe(1);
  await expect(dialog.getByLabel("Date", { exact: true })).toHaveValue(
    "2099-11-01",
  );
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(event).toContainText(/9/);
});
