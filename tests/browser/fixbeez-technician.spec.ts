import { test, expect, type Page } from "./fixtures";
import process from "node:process";
const technicianOrigin =
  process.env.TECHNICIAN_PREVIEW_ORIGIN || "http://127.0.0.1:5175";

const id = "11111111-1111-4111-8111-111111111111";
async function setup(page: Page) {
  let status = "APPOINTMENT_CONFIRMED";
  let writes = 0;
  const job = () => ({
    id,
    assignment_id: id,
    assignment_state: "ACCEPTED",
    request_number: "123456",
    request_type: "SERVICE",
    appliance: "Air Conditioner",
    service_name: "General Service",
    status,
    version: writes + 1,
    preferred_date: "2026-11-10",
    preferred_time_window: "08:00-12:00",
    confirmed_date: "2026-11-10",
    confirmed_time_window: "08:00-12:00",
    customer: { full_name: "Test Customer", phone_e164: "+919876543210" },
    address_snapshot: {
      line1: "12 Test Road",
      area: "Adyar",
      city: "Chennai",
      state: "Tamil Nadu",
      pinCode: "600020",
    },
    checklist: [],
    reports: [],
    estimates: [],
  });
  await page.route("**/api/v1/technician/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/me"))
      return route.fulfill({
        json: {
          data: {
            id,
            username: "qa",
            full_name: "Test Technician",
            phone: "+919876543210",
            verification_status: "VERIFIED",
            account_status: "ACTIVE",
            availability: "AVAILABLE",
            csrfToken: "a".repeat(43),
          },
        },
      });
    if (route.request().method() === "POST") {
      const action = path.split("/").pop();
      status =
        action === "on-the-way"
          ? "TECHNICIAN_EN_ROUTE"
          : action === "arrived"
            ? "TECHNICIAN_ARRIVED"
            : action === "start"
              ? "IN_PROGRESS"
              : status;
      writes++;
      return route.fulfill({ json: { data: job() } });
    }
    if (path.endsWith(`/jobs/${id}`))
      return route.fulfill({ json: { data: job() } });
    if (path.endsWith("/jobs"))
      return route.fulfill({ json: { data: [job()], meta: { total: 1 } } });
    if (path.endsWith("/dashboard"))
      return route.fulfill({
        json: {
          data: {
            today: 3,
            pending: 4,
            in_progress: 2,
            completed_today: 5,
            next_jobs: [job()],
          },
        },
      });
    return route.fulfill({ json: { data: [] } });
  });
  return {
    job,
    hold: () => {
      status = "ON_HOLD";
    },
    writes: () => writes,
  };
}

test("workday global filters use server totals and carry into My Jobs", async ({
  page,
}) => {
  const state = await setup(page);
  const queries: URL[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith("/technician/jobs")) queries.push(url);
  });
  await page.goto(`${technicianOrigin}/technician`);
  await expect(
    page.getByRole("heading", { name: "Your workday", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator(".workday-stats .stat-card")
      .filter({ hasText: "Completed today" })
      .locator("strong"),
  ).toHaveText("5");
  expect(queries).toHaveLength(0);
  const trigger = page.getByRole("button", {
    name: "Global filters",
    exact: true,
  });
  for (const width of [320, 360, 390, 430, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await trigger.click();
    const bounds = await page
      .getByRole("dialog", { name: "Global filters", exact: true })
      .boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
    if (width === 390) {
      await page.screenshot({
        path: "test-results/fixbeez/technician-filters-mobile.png",
        fullPage: true,
      });
    }
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    if (width === 390) {
      await page.screenshot({
        path: "test-results/fixbeez/technician-workday-mobile.png",
        fullPage: true,
      });
    }
  }
  await page.route("**/api/v1/technician/jobs?**", (route) =>
    route.fulfill({
      json: {
        data: [{ ...state.job(), request_type: "INSTALLATION" }],
        meta: { total: 47 },
      },
    }),
  );
  await trigger.click();
  await page.getByLabel("Work view", { exact: true }).selectOption("weekly");
  await page
    .getByLabel("Request type", { exact: true })
    .selectOption("INSTALLATION");
  await page.getByLabel("Week starting", { exact: true }).fill("2026-11-03");
  expect(queries).toHaveLength(0);
  await page
    .getByRole("button", { name: "Apply filters", exact: true })
    .click();
  await expect
    .poll(() =>
      queries.some(
        (url) =>
          url.searchParams.get("tab") === "weekly" &&
          url.searchParams.get("type") === "INSTALLATION" &&
          url.searchParams.get("date") === "2026-11-03",
      ),
    )
    .toBe(true);
  await expect(
    page
      .locator(".workday-stats .stat-card")
      .filter({ hasText: "Showing now" })
      .locator("small"),
  ).toContainText("47");
  await page.screenshot({
    path: "test-results/fixbeez/technician-workday-desktop.png",
    fullPage: true,
  });
  await page
    .locator(".staff-workday .section-heading")
    .getByRole("link", { name: "My jobs", exact: true })
    .click();
  await expect(page).toHaveURL(
    /jobs\?view=weekly&type=INSTALLATION&date=2026-11-03/,
  );
  await trigger.click();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page).toHaveURL(`${technicianOrigin}/technician/jobs`);
});

for (const width of [320, 360, 768, 1440]) {
  test(`technician contact, progress and hold remain usable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await setup(page);
    await page.goto(`${technicianOrigin}/technician/jobs`);
    await expect(
      page.getByRole("heading", { name: "My jobs", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".tech-brand .fb-brand-logo")).toHaveAttribute(
      "src",
      /fixbeez-original-logo-transparent/,
    );
    await expect(
      page.getByRole("link", { name: "Call Customer", exact: true }),
    ).toHaveAttribute("href", "tel:+919876543210");
    await page.getByRole("link", { name: "View job", exact: true }).click();
    for (const action of ["Start visit", "Mark arrived", "Start job"]) {
      await page.getByRole("button", { name: action, exact: true }).click();
    }
    expect(state.writes()).toBe(3);
    await expect(
      page.getByRole("button", { name: "Complete job", exact: true }),
    ).toBeVisible();
    state.hold();
    await page.reload();
    await expect(page.locator(".tech-hold-notice")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Start job", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Call Customer", exact: true }),
    ).toHaveAttribute("href", "tel:+919876543210");
    expect(state.writes()).toBe(3);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/fixbeez/technician-hold-${width}.png`,
      fullPage: true,
    });
  });
}
