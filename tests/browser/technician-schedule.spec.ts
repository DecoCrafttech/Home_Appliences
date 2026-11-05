import { test, expect, type Page } from "./fixtures";
import process from "node:process";

const origin = process.env.TECHNICIAN_PREVIEW_ORIGIN || "http://127.0.0.1:5175";
const id = "11111111-1111-4111-8111-111111111111";
async function setup(
  page: Page,
  options: {
    empty?: boolean;
    failure?: boolean;
    truncated?: boolean;
    preferred?: boolean;
  } = {},
) {
  const ranges: URL[] = [];
  let failed = options.failure || false;
  let writes = 0;
  const job = {
    id,
    request_number: "123456",
    display_number: 123456,
    request_type: "SERVICE",
    appliance: "Air Conditioner",
    service_name: "General service",
    status: options.preferred ? "TECHNICIAN_ASSIGNED" : "APPOINTMENT_CONFIRMED",
    visit_confirmed: !options.preferred,
    version: 1,
    confirmed_date: "2099-11-01",
    confirmed_time_window: "09:00-10:00",
    customer_name: "Maya Rao",
    customer_phone: "+919876543210",
    technician_name: "Arun Kumar",
    address_snapshot: {
      line1: "12 Lake Road",
      area: "Adyar",
      city: "Chennai",
      pinCode: "600020",
    },
    assignment_state: "ACCEPTED",
    assignment_id: id,
    checklist: [],
    reports: [],
    estimates: [],
  };
  await page.route("**/api/v1/technician/**", (r) => {
    const url = new URL(r.request().url());
    if (r.request().method() !== "GET") writes++;
    if (url.pathname.endsWith("/auth/me"))
      return r.fulfill({
        json: {
          data: {
            id,
            full_name: "Arun Kumar",
            account_status: "ACTIVE",
            verification_status: "VERIFIED",
            csrfToken: "a".repeat(43),
          },
        },
      });
    if (url.pathname.endsWith("/schedule")) {
      ranges.push(url);
      if (failed)
        return r.fulfill({
          status: 503,
          json: { error: { message: "Schedule temporarily unavailable" } },
        });
      return r.fulfill({
        json: {
          data: options.empty ? [] : [job],
          meta: { truncated: !!options.truncated },
        },
      });
    }
    if (url.pathname.endsWith("/jobs/" + id))
      return r.fulfill({ json: { data: job } });
    return r.fulfill({ json: { data: [] } });
  });
  await page.goto(origin + "/technician/schedule?date=2099-11-01");
  return {
    ranges,
    writes: () => writes,
    recover: () => {
      failed = false;
    },
  };
}
for (const width of [320, 375, 390, 430, 768, 1440])
  test(`technician appointments match Admin calendar controls at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await setup(page);
    await expect(
      page.getByRole("heading", { name: "Appointments", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".calendar-event").first()).toBeVisible();
    expect(new Set(state.ranges.map((url) => url.search)).size).toBe(1);
    for (const view of ["Day view", "Week view", "Month view", "Agenda view"]) {
      await page.getByRole("tab", { name: view, exact: true }).click();
      await expect(page.locator(".calendar-event").first()).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      const headingBounds = await page
        .locator('.appointment-calendar [role="heading"]')
        .first()
        .boundingBox();
      expect(headingBounds!.x + headingBounds!.width).toBeLessThanOrEqual(
        width,
      );
    }
    await expect(page.locator(".fc-event-draggable")).toHaveCount(0);
    await page.locator(".calendar-event").first().click();
    const drawer = page.getByRole("dialog");
    await expect(
      drawer.getByRole("heading", { name: "Maya Rao" }),
    ).toBeVisible();
    await expect(
      drawer.getByRole("link", { name: "Call customer", exact: true }),
    ).toHaveAttribute("href", "tel:+919876543210");
    await expect(
      drawer.getByRole("link", { name: "Get Directions", exact: true }),
    ).toBeVisible();
    const bounds = await drawer.boundingBox();
    expect(bounds!.width).toBeLessThanOrEqual(width);
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    await drawer.getByRole("button", { name: "Close", exact: true }).click();
    const before = state.ranges.length;
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect.poll(() => state.ranges.length).toBeGreaterThan(before);
    await page.getByLabel("Go to date", { exact: true }).fill("2099-11-08");
    await expect
      .poll(() =>
        state.ranges.some((u) => u.searchParams.get("from") === "2099-11-02"),
      )
      .toBe(true);
    await page.getByLabel("Go to date", { exact: true }).fill("2099-11-01");
    await expect(page.locator(".calendar-event").first()).toBeVisible();
    if (width === 390 || width === 1440)
      await page.screenshot({
        path: `test-results/technician-schedule/${width}.png`,
        fullPage: true,
      });
    await page.locator(".calendar-event").first().click();
    await page
      .getByRole("dialog")
      .getByRole("link", { name: "View job", exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp("/technician/jobs/" + id));
    expect(state.writes()).toBe(0);
  });
test("preferred visits appear with an awaiting-confirmation label", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const state = await setup(page, { preferred: true });
  await expect(
    page.locator(".calendar-event").getByText(/Awaiting confirmation/),
  ).toBeVisible();
  await page.locator(".calendar-event").first().click();
  await expect(
    page
      .getByRole("dialog")
      .getByText("Preferred visit · awaiting confirmation", { exact: true }),
  ).toBeVisible();
  expect(state.writes()).toBe(0);
});
for (const status of [
  "TECHNICIAN_ASSIGNED",
  "APPOINTMENT_CONFIRMED",
  "IN_PROGRESS",
  "REOPENED",
])
  test(`technician completes a ${status} job directly from the appointment drawer`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await setup(page);
    let current = status === "REOPENED" ? "TECHNICIAN_ASSIGNED" : status;
    let version = 1;
    let saves = 0;
    const checks = [
      "Reported issue assessed",
      "Work and safety checks completed",
      "Customer informed of outcome",
    ];
    const job = () => ({
      id,
      request_number: "123456",
      request_type: "SERVICE",
      appliance: "Air Conditioner",
      service_name: "General service",
      status: current,
      version,
      assignment_state: "ACCEPTED",
      assignment_id: id,
      customer_name: "Maya Rao",
      customer_phone: "+919876543210",
      confirmed_date: "2099-11-01",
      confirmed_time_window: "09:00-10:00",
      checklist: checks,
      reports:
        status === "REOPENED"
          ? [
              {
                state: "APPROVED",
                outcome: "RESOLVED",
                work_summary: "Earlier completed visit",
              },
            ]
          : [],
      estimates: [],
    });
    await page.route("**/api/v1/technician/schedule?**", (r) =>
      r.fulfill({ json: { data: [job()], meta: { truncated: false } } }),
    );
    await page.route("**/api/v1/technician/jobs/" + id, (r) =>
      r.fulfill({ json: { data: job() } }),
    );
    await page.route(
      "**/api/v1/technician/jobs/" + id + "/complete",
      async (r) => {
        saves++;
        expect(r.request().postDataJSON()).toMatchObject({
          version: 1,
          workSummary: "Repaired and tested the unit",
          checklist: checks,
        });
        current = "COMPLETED";
        version++;
        await r.fulfill({ json: { data: job() } });
      },
    );
    await page.reload();
    await page.locator(".calendar-event").first().click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Complete job", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Complete job",
      exact: true,
    });
    await dialog
      .getByLabel("Work completed", { exact: true })
      .fill("Repaired and tested the unit");
    for (const item of checks)
      await dialog.getByLabel(item, { exact: true }).check();
    await dialog
      .getByRole("button", { name: "Complete job", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    expect(saves).toBe(1);
    await expect(
      page.locator(".calendar-event").getByText(/completed/),
    ).toBeVisible();
  });
test("empty technician calendar and truncated results have clear states", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await setup(page, { empty: true, truncated: true });
  await expect(page.getByText("No appointments in this period.")).toBeVisible();
  await expect(
    page.getByText(/There are more than 1,000 visits/),
  ).toBeVisible();
});
test("technician calendar can recover from a failed request", async ({
  page,
}) => {
  const state = await setup(page, { failure: true });
  await expect(
    page.getByRole("heading", {
      name: "Unable to load appointments",
      exact: true,
    }),
  ).toBeVisible();
  state.recover();
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.locator(".calendar-event").first()).toBeVisible();
});
