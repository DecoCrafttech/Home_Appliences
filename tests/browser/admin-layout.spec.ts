import { test, expect, type Page } from "@playwright/test";
const id = "11111111-1111-4111-8111-111111111111";
async function setup(page: Page) {
  const customer = {
    id,
    customer_reference: "CUS-00000123",
    full_name: "QA Customer",
    email: "qa@example.com",
    phone_e164: "+919876543210",
    created_at: "2026-10-21",
    last_login_at: null,
    sign_in_methods: "GOOGLE",
    account_status: "ACTIVE",
  };
  const request = {
    id,
    customer_id: id,
    request_number: "SR-QA-123",
    request_type: "SERVICE",
    customer_name: customer.full_name,
    customer_phone: customer.phone_e164,
    appliance: "Air Conditioner",
    service_name: "General Service",
    status: "IN_PROGRESS",
    version: 4,
    preferred_date: "2026-10-25",
    preferred_time_window: "09:00-12:00",
    details: { description: "Please inspect cooling" },
    timeline: [
      {
        id: "event",
        status: "IN_PROGRESS",
        note: "Work underway",
        created_at: "2026-10-21T10:00:00Z",
      },
    ],
  };
  const feedback = {
    id,
    request_id: id,
    customer_id: id,
    full_name: customer.full_name,
    customer_reference: customer.customer_reference,
    request_number: request.request_number,
    appliance: request.appliance,
    request_type: "SERVICE",
    rating: 2,
    comment: "The technician arrived later than expected.",
    tags: ["Delayed service"],
    handling_status: "NEW",
    created_at: "2026-10-21T10:00:00Z",
    completed_at: "2026-10-21T09:00:00Z",
    notes: [],
    history: [],
  };
  await page.route("**/api/v1/admin/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/me"))
      return route.fulfill({
        json: {
          data: {
            id,
            username: "qa_admin",
            full_name: "QA Administrator",
            role: "ADMIN",
          },
        },
      });
    if (path.endsWith("/operations"))
      return route.fulfill({
        json: {
          data: {
            totals: [
              { request_type: "SERVICE", status: "IN_PROGRESS", count: 1 },
            ],
            activity: [],
          },
        },
      });
    if (path.endsWith("/dashboard/allocation"))
      return route.fulfill({
        json: {
          data: {
            assignable: 1,
            unassigned: 1,
            offered: 0,
            accepted: 0,
            unavailable: 0,
            workload: [],
          },
        },
      });
    if (path.endsWith("/dashboard/activity"))
      return route.fulfill({
        json: {
          data: {
            trends: [{ date: "2026-10-21", service: 1, installation: 0 }],
            distribution: [{ request_type: "SERVICE", count: 1 }],
            recent: [request],
            attention: [],
            alerts: { unassigned: 1, overdue: 0, negative: 1 },
          },
        },
      });
    if (path.endsWith("/technicians"))
      return route.fulfill({
        json: {
          data: [
            {
              id,
              full_name: "QA Technician",
              phone: "9876543210",
              skills: "AC repair",
              service_area: "Chennai",
              availability: "AVAILABLE",
              verification_status: "VERIFIED",
              assigned_requests: 1,
            },
          ],
        },
      });
    if (path.endsWith("/catalogue"))
      return route.fulfill({
        json: {
          data: { categories: [{ id, name: "Air Conditioner" }], services: [] },
        },
      });
    if (path.endsWith("/support/tickets"))
      return route.fulfill({
        json: {
          data: [
            {
              id,
              ticket_number: "SUP-QA-123",
              customer_id: id,
              full_name: customer.full_name,
              customer_reference: customer.customer_reference,
              request_id: id,
              request_number: request.request_number,
              subject: "Visit follow-up",
              message: "Please share the latest visit update.",
              category: "GENERAL",
              priority: "NORMAL",
              status: "OPEN",
              created_at: "2026-10-21T10:00:00Z",
            },
          ],
        },
      });
    if (path.endsWith("/dashboard/summary"))
      return route.fulfill({
        json: {
          data: {
            total_customers: 1,
            service_requests: 1,
            pending_requests: 1,
            completed_requests: 0,
            open_tickets: 0,
            average_rating: 2,
          },
        },
      });
    if (path.endsWith("/feedback/summary"))
      return route.fulfill({
        json: {
          data: {
            total_reviews: 1,
            average_rating: 2,
            five_star_reviews: 0,
            low_ratings: 1,
            needs_attention: 1,
            resolved: 0,
          },
        },
      });
    if (path.endsWith(`/feedback/${id}`))
      return route.fulfill({ json: { data: feedback } });
    if (path.endsWith("/feedback"))
      return route.fulfill({ json: { data: [feedback], meta: { total: 1 } } });
    if (path.endsWith(`/requests/${id}`))
      return route.fulfill({ json: { data: request } });
    if (path.endsWith("/requests")) {
      const params = new URL(route.request().url()).searchParams;
      const completed = params.get("status") === "COMPLETED";
      return route.fulfill({
        json: {
          data: [
            {
              ...request,
              customer_reference: customer.customer_reference,
              assigned_technician_name: "QA Technician",
              request_type: params.get("type") || request.request_type,
              ...(completed
                ? {
                    status: "COMPLETED",
                    completed_at: "2026-10-21T10:00:00Z",
                    work_summary: "Cooling inspected and tested",
                    rating: 4,
                    review_id: id,
                  }
                : {}),
            },
          ],
          meta: { total: 1 },
        },
      });
    }
    if (path.endsWith(`/customers/${id}`))
      return route.fulfill({
        json: {
          data: {
            ...customer,
            addresses: [],
            requests: [request],
            tickets: [],
          },
        },
      });
    if (path.endsWith("/customers"))
      return route.fulfill({
        json: { data: [customer], meta: { page: 1, limit: 50, total: 1 } },
      });
    return route.fulfill({ json: { data: [] } });
  });
}
test("mobile admin navigation opens, navigates and closes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await setup(page);
  await page.goto("http://127.0.0.1:5174/");
  const menu = page.getByRole("button", { name: "Menu", exact: true });
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await menu.click();
  await page.getByRole("link", { name: "Feedback", exact: true }).click();
  await expect(page).toHaveURL("http://127.0.0.1:5174/feedback");
  await expect(
    page.getByRole("button", { name: "Menu", exact: true }),
  ).toHaveAttribute("aria-expanded", "false");
});
for (const width of [360, 390, 768, 1024, 1440])
  test(`admin pages remain usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({
      width,
      height:
        width === 360 ? 800 : width === 390 ? 844 : width === 768 ? 1024 : 900,
    });
    await setup(page);
    for (const [path, title, label] of [
      ["/", "Overview", "dashboard"],
      ["/requests", "Requests", "requests"],
      ["/service-requests", "Requests", "service-requests"],
      ["/installation-requests", "Requests", "installation-requests"],
      ["/completed-requests", "Completed Requests", "completed-requests"],
      ["/appointments", "Appointments", "appointments"],
      ["/reports", "Reports", "reports"],
      ["/settings", "Settings", "settings"],
      [`/requests/${id}`, "SR-QA-123", "request-detail"],
      ["/customers", "Customer accounts", "customers"],
      ["/technicians", "Technicians", "technicians"],
      ["/support", "Help & Support", "support"],
      ["/catalogue", "Services & Installations", "catalogue"],
      ["/feedback", "Feedback & Reviews", "feedback"],
      [`/feedback/${id}`, "SR-QA-123 · Feedback", "feedback-detail"],
    ]) {
      await page.goto(`http://127.0.0.1:5174${path}`);
      await expect(
        page.getByRole("heading", { level: 1, name: title!, exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/screenshots/admin-${label}-${width}.png`,
        fullPage: true,
      });
    }
  });

test("completion modal cancels safely, keeps failed input and confirms a real response", async ({
  page,
}) => {
  await setup(page);
  let calls = 0;
  await page.route(`**/api/v1/admin/requests/${id}/complete`, (route) => {
    calls++;
    return calls === 1
      ? route.fulfill({
          status: 409,
          json: {
            error: {
              message:
                "This request was updated. Refresh before completing it.",
            },
          },
        })
      : route.fulfill({
          json: { data: { id, status: "COMPLETED", version: 5 } },
        });
  });
  await page.goto("http://127.0.0.1:5174/service-requests");
  await page
    .locator(".desktop-request-table")
    .getByRole("button", { name: "Complete", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Complete this request?", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(calls).toBe(0);
  await page.getByRole("button", { name: "Complete", exact: true }).click();
  await page
    .getByLabel("Work completed summary", { exact: true })
    .fill("Cooling tested and work complete");
  await page
    .getByRole("button", { name: "Confirm Completion", exact: true })
    .click();
  await page.screenshot({
    path: "test-results/screenshots/admin-completion-modal.png",
    fullPage: true,
  });
  await expect(page.getByRole("alert")).toHaveText(
    "This request was updated. Refresh before completing it.",
  );
  await expect(
    page.getByLabel("Work completed summary", { exact: true }),
  ).toHaveValue("Cooling tested and work complete");
  await page
    .getByRole("button", { name: "Confirm Completion", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText("Request marked as completed successfully.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(calls).toBe(2);
});
test("session network errors offer retry without showing a login form", async ({
  page,
}) => {
  await page.route("**/api/v1/admin/auth/me", (route) =>
    route.fulfill({
      status: 503,
      json: { error: { message: "Temporarily unavailable" } },
    }),
  );
  await page.goto("http://127.0.0.1:5174/");
  await expect(
    page.getByRole("button", { name: "Try again", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Admin sign in", exact: true }),
  ).toHaveCount(0);
});

test("navigation uses unique icon links, collapses and opens the working profile settings", async ({
  page,
}) => {
  await setup(page);
  await page.goto("http://127.0.0.1:5174/");
  const links = page.locator("#admin-navigation a");
  await expect(links).toHaveCount(10);
  const hrefs = await links.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("href")),
  );
  expect(new Set(hrefs).size).toBe(10);
  expect(hrefs).toContain("/requests");
  for (const link of await links.all())
    await expect(link.locator("svg")).toHaveCount(1);
  await expect(
    page.locator('#admin-navigation a[aria-current="page"]'),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "Collapse sidebar", exact: true })
    .click();
  await expect(page.locator(".admin-layout")).toHaveClass(/nav-collapsed/);
  await page
    .getByRole("button", { name: "Expand sidebar", exact: true })
    .click();
  await page.getByLabel("Admin profile menu", { exact: true }).click();
  await page.getByRole("link", { name: "My Profile", exact: true }).click();
  await expect(page).toHaveURL("http://127.0.0.1:5174/settings#profile");
  await expect(
    page.getByRole("heading", { name: "My Profile", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Security Settings", exact: true }),
  ).toBeVisible();
});
test("one request toolbar applies filters and refreshes the server query", async ({
  page,
}) => {
  await setup(page);
  const queries: URLSearchParams[] = [];
  page.on("request", (r) => {
    const url = new URL(r.url());
    if (url.pathname === "/api/v1/admin/requests")
      queries.push(url.searchParams);
  });
  await page.goto("http://127.0.0.1:5174/service-requests");
  await expect(page.getByLabel("Search requests", { exact: true })).toHaveCount(
    1,
  );
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.getByLabel("Status", { exact: true }).selectOption("PENDING");
  await page
    .getByLabel("Appliance category", { exact: true })
    .selectOption("Air Conditioner");
  await page.getByLabel("From", { exact: true }).fill("2026-10-01");
  await page
    .getByRole("button", { name: "Apply filters", exact: true })
    .click();
  await expect
    .poll(() =>
      queries.some(
        (q) =>
          q.get("group") === "PENDING" &&
          q.get("appliance") === "Air Conditioner" &&
          q.get("from") === "2026-10-01",
      ),
    )
    .toBe(true);
  const count = queries.length;
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect.poll(() => queries.length).toBeGreaterThan(count);
});

test("overview keeps urgent work visible and reporting optional", async ({
  page,
}) => {
  await setup(page);
  await page.goto("http://127.0.0.1:5174/");
  await expect(
    page.getByRole("heading", { name: "Needs Attention", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Assign technicians", exact: true })
    .click();
  await expect(page).toHaveURL(/requests\?assignment=unassigned$/);
  await page.goto("http://127.0.0.1:5174/");
  await expect(
    page.getByRole("heading", { name: /Request trends/ }),
  ).not.toBeVisible();
  await page.getByText("Trends & team workload", { exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /Request trends/ }),
  ).toBeVisible();
});
