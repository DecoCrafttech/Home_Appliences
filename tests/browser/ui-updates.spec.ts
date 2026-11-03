import { test, expect, type Page } from "./fixtures";
const category = "11111111-1111-4111-8111-111111111111",
  service = "22222222-2222-4222-8222-222222222222",
  maintenance = "33333333-3333-4333-8333-333333333333",
  addressId = "44444444-4444-4444-8444-444444444444";
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const profile = {
  id: category,
  full_name: "Priya Customer",
  email: "priya@example.com",
  phone_e164: "+919876543210",
  role: "ADMIN",
  username: "qa",
  account_status: "ACTIVE",
  verification_status: "VERIFIED",
};
const address = {
  id: addressId,
  label: "Home",
  recipient_name: profile.full_name,
  phone: "9876543210",
  line1: "12 Test Road",
  area: "Adyar",
  city: "Chennai",
  state: "Tamil Nadu",
  pin_code: "600020",
  is_default: true,
};
const categories = [
  {
    id: category,
    name: "Air Conditioner",
    slug: "air-conditioner",
    kind: "APPLIANCE",
    publication_status: "PUBLISHED",
  },
  {
    id: maintenance,
    name: "Home Maintenance",
    slug: "home-maintenance",
    kind: "MAINTENANCE",
    publication_status: "PUBLISHED",
  },
];
const services = [
  {
    id: service,
    name: "General Service",
    appliance_category_id: category,
    appliance_name: "Air Conditioner",
    request_type: "SERVICE",
    description: "Clean and inspect your air conditioner.",
    publication_status: "PUBLISHED",
    form_fields: [],
    booking_options: [],
  },
  {
    id: maintenance,
    name: "Plumbing Work",
    appliance_category_id: maintenance,
    appliance_name: "Home Maintenance",
    category_kind: "MAINTENANCE",
    request_type: "SERVICE",
    description: "Plumbing repairs at home.",
    publication_status: "PUBLISHED",
    form_fields: [],
    booking_options: [],
  },
];
const request = {
  id: service,
  request_number: "SR-000123",
  request_type: "SERVICE",
  appliance: "Air Conditioner",
  service_name: "General Service",
  status: "REQUESTED",
  version: 1,
  customer_name: profile.full_name,
  customer_phone: profile.phone_e164,
  preferred_date: today(),
  preferred_time_window: "09:00-12:00",
  address_snapshot: {
    name: profile.full_name,
    phone: address.phone,
    line1: address.line1,
    area: address.area,
    city: address.city,
    state: address.state,
    pinCode: address.pin_code,
  },
  details: { description: "Please clean the appliance" },
  created_at: new Date().toISOString(),
  timeline: [],
};
async function setup(page: Page) {
  const state = { submissions: 0, defaultWrites: 0, ignoreWrites: 0 };
  await page.route("https://accounts.google.com/**", (route) => route.abort());
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname,
      method = route.request().method();
    const data = (value: unknown, extra: object = {}) =>
      route.fulfill({ json: { data: value, ...extra } });
    if (path.endsWith("/auth/customer/config"))
      return data({ clientId: null, adminOfficePhone: "+919999999999" });
    if (
      path.endsWith("/auth/customer/me") ||
      path.endsWith("/auth/me") ||
      path.endsWith("/profile")
    )
      return data(profile);
    if (path.endsWith("/addresses/" + addressId + "/default")) {
      state.defaultWrites++;
      return data({ id: addressId, is_default: true });
    }
    if (path.endsWith("/addresses")) return data([address]);
    if (path.endsWith("/appointment-windows"))
      return data([
        { id: "09:00-12:00", label: "Morning" },
        { id: "14:00-17:00", label: "Afternoon" },
      ]);
    if (path.includes("/catalogue/appliances/") && path.endsWith("/services"))
      return data(
        services.filter(
          (s) => s.appliance_category_id === path.split("/").at(-2),
        ),
        { meta: { appliance: categories[0] } },
      );
    if (path.endsWith("/catalogue/appliances") || path.endsWith("/appliances"))
      return data(categories);
    if (path.endsWith("/catalogue"))
      return data(
        path.includes("/admin/") ? { categories, services } : services,
      );
    if (path.endsWith("/services") || path.endsWith("/installations"))
      return data(
        services.filter(
          (s) =>
            s.appliance_category_id ===
            url.searchParams.get("applianceCategoryId"),
        ),
      );
    if (path.endsWith("/requests/service") && method === "POST") {
      state.submissions++;
      await new Promise((resolve) => setTimeout(resolve, 700));
      return data(request);
    }
    if (path.endsWith("/requests"))
      return data([request], { meta: { total: 1, page: 1, limit: 20 } });
    if (path.endsWith("/requests/" + service)) return data(request);
    if (path.endsWith("/dashboard/summary"))
      return data({
        total_requests: 1,
        pending_requests: 1,
        completed_requests: 0,
        in_progress_requests: 0,
        available_technicians: 1,
      });
    if (path.endsWith("/dashboard/activity"))
      return data({
        trends: [],
        attention: [request],
        recent: [request],
        alerts: {},
      });
    if (path.endsWith("/dashboard/allocation"))
      return data({
        unassigned: 1,
        assignable: 1,
        offered: 0,
        accepted: 0,
        unavailable: 0,
        workload: [],
      });
    if (path.endsWith("/technicians"))
      return data([
        {
          id: category,
          full_name: "Test Technician",
          phone: address.phone,
          verification_status: "VERIFIED",
          account_status: "ACTIVE",
          assigned_requests: 1,
        },
      ]);
    if (path.endsWith("/support/tickets/" + service) && method === "PATCH") {
      state.ignoreWrites++;
      return data({ id: service, status: "IGNORED" });
    }
    return data([], { meta: { total: 0 } });
  });
  return state;
}
for (const width of [360, 390, 430, 1440]) {
  test(`customer home, floating search and maintenance at ${width}px`, async ({
    page,
  }) => {
    await setup(page);
    await page.setViewportSize({ width, height: 950 });
    await page.goto("http://localhost:5173/");
    await expect(
      page.getByRole("link", { name: "Call Admin", exact: true }),
    ).toHaveAttribute("href", "tel:+919999999999");
    await expect(
      page.getByRole("heading", { name: "Home Maintenance", exact: true }),
    ).toHaveCount(0);
    await expect(page.locator(".home-action-photo")).toHaveCount(3);
    const promo = page.locator(".home-promo"),
      before = await promo.boundingBox();
    await page
      .getByRole("searchbox", { name: "Search appliances and services" })
      .fill("General");
    await expect(page.locator(".v6-search-results")).toBeVisible();
    expect((await promo.boundingBox())!.y).toBe(before!.y);
    expect(
      await page
        .getByRole("searchbox", { name: "Search appliances and services" })
        .evaluate((el) => getComputedStyle(el).outlineStyle),
    ).toBe("none");
    await page.keyboard.press("Escape");
    await expect(page.locator(".v6-search-results")).toHaveCount(0);
    await page.getByRole("link", { name: "Maintenance", exact: true }).click();
    await expect(
      page.getByRole("link", { name: "Book Plumbing Work", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/ui-updates/customer-maintenance-${width}.png`,
      fullPage: true,
    });
  });
  test(`booking saved address, month calendar and single submission at ${width}px`, async ({
    page,
  }) => {
    const state = await setup(page);
    await page.setViewportSize({ width, height: 950 });
    await page.goto("http://localhost:5173/request/service");
    await expect(
      page.getByRole("heading", { name: "Service Request", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Air Conditioner", exact: true })
      .click();
    await page.getByRole("button", { name: /General Service Clean/ }).click();
    await expect(
      page.getByRole("button", { name: "Book now", exact: true }),
    ).toHaveCount(0);
    await page
      .getByLabel(/Short description/)
      .fill("Please clean the air conditioner");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Edit details", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Save this contact number to my profile", { exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Edit details", exact: true })
      .click();
    await expect(
      page.getByRole("textbox", { name: "House / street", exact: true }),
    ).toHaveValue(address.line1);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(
      page.getByRole("region", {
        name: "Preferred date calendar",
        exact: true,
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Next month", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Previous month", exact: true }),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: "Previous month", exact: true })
      .click();
    await page.getByRole("button", { name: today(), exact: true }).click();
    await page.getByRole("button", { name: "Morning", exact: true }).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.screenshot({
      path: `test-results/ui-updates/booking-preview-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Submit request", exact: true })
      .click();
    await expect(page.getByRole("button", { name: /Saving/ })).toHaveCount(1);
    await expect.poll(() => state.submissions).toBe(1);
    await expect(
      page.getByRole("heading", { name: "Request Submitted!", exact: true }),
    ).toBeVisible();
    expect(state.submissions).toBe(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  });
  test(`admin cleanup, catalogue lanes and assigned jobs modal at ${width}px`, async ({
    page,
  }) => {
    await setup(page);
    await page.setViewportSize({ width, height: 950 });
    await page.goto("http://127.0.0.1:5174/");
    await expect(
      page.getByRole("heading", { name: "Needs Assignment", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("OPERATIONS AT A GLANCE", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Refresh dashboard", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Contact Customer", exact: true }),
    ).toHaveAttribute("href", profile.phone_e164.replace(/^/, "tel:"));
    await page.goto("http://127.0.0.1:5174/catalogue");
    await page
      .locator(".catalogue-category-tile")
      .filter({ hasText: "Air Conditioner" })
      .getByRole("button", { name: "Edit", exact: true })
      .click();
    await expect(page.locator(".catalogue-lane")).toHaveCount(2);
    await expect(
      page.getByText("General Service", { exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `test-results/ui-updates/admin-catalogue-${width}.png`,
      fullPage: true,
    });
    await page.goto("http://127.0.0.1:5174/appointments");
    await expect(page.locator(".incoming-appointment-row")).toContainText(
      "General Service",
    );
    await expect(page.locator(".appointment-state")).toHaveText("New");
    await page.goto("http://127.0.0.1:5174/technicians");
    await page.locator(".ui-action-menu summary").first().click();
    await page
      .getByRole("button", { name: "View Assigned", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: /Assigned jobs/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("dialog").getByText("General Service", { exact: true }),
    ).toBeVisible();
    const dialog = await page.getByRole("dialog").boundingBox();
    expect(dialog!.x).toBeGreaterThanOrEqual(0);
    expect(dialog!.x + dialog!.width).toBeLessThanOrEqual(width + 1);
    if (width === 1440)
      expect(Math.abs(dialog!.x + dialog!.width / 2 - width / 2)).toBeLessThan(
        2,
      );
    expect(
      await page
        .getByRole("dialog")
        .evaluate((el) => getComputedStyle(el, "::backdrop").backgroundColor),
    ).toBe("rgba(0, 0, 0, 0.1)");
  });
}

test("saved address default and edit controls use existing address APIs", async ({
  page,
}) => {
  const state = await setup(page);
  let edited: Record<string, unknown> | null = null;
  await page.route("**/api/v1/addresses", (route) =>
    route.fulfill({
      json: { data: [{ ...address, is_default: state.defaultWrites > 0 }] },
    }),
  );
  await page.route(`**/api/v1/addresses/${addressId}`, (route) => {
    edited = route.request().postDataJSON();
    return route.fulfill({ json: { data: address } });
  });
  await page.goto("http://localhost:5173/addresses");
  await page
    .getByRole("button", { name: "Set as default", exact: true })
    .click();
  await expect.poll(() => state.defaultWrites).toBe(1);
  await expect(
    page.getByRole("button", { name: "Set as default", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Recipient name", exact: true }),
  ).toHaveValue(profile.full_name);
  await page
    .getByRole("textbox", { name: "House / street", exact: true })
    .fill("24 Changed Street");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect.poll(() => edited?.line1).toBe("24 Changed Street");
  await page.goto("http://localhost:5173/profile");
  await expect(
    page
      .locator(".profile-menu")
      .getByRole("link", { name: "My Requests", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".soft-logout")).toBeVisible();
});

test("request details expose customer and assigned technician contact numbers", async ({
  page,
}) => {
  await setup(page);
  await page.route(`**/api/v1/requests/${service}`, (route) =>
    route.fulfill({
      json: {
        data: {
          ...request,
          assigned_technician_name: "Test Technician",
          assigned_technician_phone: "+919999999998",
        },
      },
    }),
  );
  await page.goto(`http://localhost:5173/requests/${service}`);
  await expect(
    page.getByRole("link", { name: "+919876543210", exact: true }),
  ).toHaveAttribute("href", "tel:+919876543210");
  await expect(
    page.getByRole("link", { name: /Call Technician/ }),
  ).toHaveAttribute("href", "tel:+919999999998");
});

test("admin ticket Ignore persists through its status control", async ({
  page,
}) => {
  await setup(page);
  let status = "OPEN";
  const ticket = {
    id: service,
    ticket_number: "SUP-000123",
    customer_id: category,
    full_name: profile.full_name,
    customer_reference: "CUS-000123",
    subject: "Visit follow-up",
    message: "Please confirm the visit",
    status,
  };
  await page.route("**/api/v1/admin/support/tickets**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === "PATCH")
      status = route.request().postDataJSON().status;
    return route.fulfill({
      json: {
        data: path.endsWith("/messages")
          ? { ticket: { ...ticket, status }, messages: [] }
          : path.endsWith(service)
            ? { ...ticket, status }
            : [{ ...ticket, status }],
        meta: { total: 1 },
      },
    });
  });
  await page.goto(`http://127.0.0.1:5174/support?ticket=${service}`);
  await page
    .getByLabel("Ticket status", { exact: true })
    .selectOption("IGNORED");
  await expect.poll(() => status).toBe("IGNORED");
  await expect(page.getByLabel("Ticket status", { exact: true })).toHaveValue(
    "IGNORED",
  );
});

for (const completionWidth of [360, 1440])
  test(`technician completes directly from a job card at ${completionWidth}px with one completion write`, async ({
    page,
  }) => {
    await setup(page);
    let completed = false,
      writes = 0;
    const job = {
      ...request,
      assignment_id: service,
      assignment_state: "ACCEPTED",
      customer: {
        full_name: profile.full_name,
        phone_e164: profile.phone_e164,
      },
      status: "IN_PROGRESS",
      checklist: [],
      estimates: [],
      reports: [
        {
          state: "SUBMITTED_FOR_REVIEW",
          outcome: "RESOLVED",
          work_summary: "Appliance cleaned and tested",
        },
      ],
    };
    await page.route("**/api/v1/technician/**", (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/auth/me"))
        return route.fulfill({
          json: { data: { ...profile, csrfToken: "a".repeat(43) } },
        });
      if (path.endsWith("/complete")) {
        writes++;
        completed = true;
      }
      const value = { ...job, status: completed ? "COMPLETED" : "IN_PROGRESS" };
      return route.fulfill({
        json: {
          data: path.endsWith("/jobs") ? [value] : value,
          meta: { total: 1 },
        },
      });
    });
    await page.setViewportSize({ width: completionWidth, height: 950 });
    await page.goto("http://127.0.0.1:5175/technician/jobs");
    await page
      .locator(".tech-job-card")
      .getByRole("button", { name: "Complete job", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Complete this job?",
      exact: true,
    });
    await expect(dialog).toBeVisible();
    await dialog
      .getByRole("button", { name: "Confirm completion", exact: true })
      .click();
    await expect.poll(() => writes).toBe(1);
    await expect(dialog).toHaveCount(0);
    await expect(page.locator(".tech-job-card")).toContainText("Completed");
  });
