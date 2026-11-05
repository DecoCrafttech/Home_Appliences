import { test, expect, type Page } from "./fixtures";
import process from "node:process";
const customerOrigin =
  process.env.CUSTOMER_PREVIEW_ORIGIN || "http://localhost:5173";
const techOrigin =
  process.env.TECHNICIAN_PREVIEW_ORIGIN || "http://127.0.0.1:5175";
const adminOrigin = process.env.ADMIN_PREVIEW_ORIGIN || "http://127.0.0.1:5174";
const id = "11111111-1111-4111-8111-111111111111";
const photo =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" rx="20" fill="#7246bf"/></svg>',
  );
test("customer home shows the same profile photo header as services", async ({
  page,
}) => {
  await page.route("https://accounts.google.com/**", (r) =>
    r.fulfill({ body: "" }),
  );
  await page.route("**/api/v1/**", (r) => {
    const path = new URL(r.request().url()).pathname;
    if (path.endsWith("/profile"))
      return r.fulfill({
        json: { data: { id, full_name: "Maya Rao", profile_photo_url: photo } },
      });
    if (path.endsWith("/auth/customer/config"))
      return r.fulfill({ json: { data: { clientId: null } } });
    return r.fulfill({ json: { data: [] } });
  });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/", "/services"]) {
      await page.goto(customerOrigin + path);
      const profile = page.getByRole("link", {
        name: "Your profile",
        exact: true,
      });
      await expect(profile).toBeVisible();
      await expect(profile.locator("img")).toHaveAttribute("src", photo);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
    }
  }
});
test("technician workday is compact and job actions stay usable", async ({
  page,
}) => {
  const job = {
    id,
    request_number: "123456",
    request_type: "SERVICE",
    appliance: "Air Conditioner",
    service_name: "General service",
    status: "APPOINTMENT_CONFIRMED",
    assignment_state: "ACCEPTED",
    version: 2,
    customer_name: "Maya Rao",
    customer_phone: "+919876543210",
    preferred_date: "2026-11-10",
    preferred_time_window: "09:00-12:00",
    address_snapshot: {
      line1: "12 Lake Road",
      area: "Adyar",
      city: "Chennai",
      pinCode: "600020",
    },
    reports: [],
    estimates: [],
    checklist: [],
  };
  await page.route("**/api/v1/technician/**", (r) => {
    const path = new URL(r.request().url()).pathname;
    if (path.endsWith("/auth/me"))
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
    if (path.endsWith("/dashboard"))
      return r.fulfill({
        json: {
          data: {
            today: 3,
            pending: 2,
            in_progress: 1,
            completed_today: 4,
            next_jobs: [
              job,
              {
                ...job,
                id: "22222222-2222-4222-8222-222222222222",
                status: "IN_PROGRESS",
              },
              {
                ...job,
                id: "33333333-3333-4333-8333-333333333333",
                status: "ON_HOLD",
              },
            ],
          },
        },
      });
    if (path.endsWith("/jobs"))
      return r.fulfill({ json: { data: [job], meta: { total: 1 } } });
    if (path.endsWith("/jobs/" + id)) return r.fulfill({ json: { data: job } });
    return r.fulfill({ json: { data: [] } });
  });
  await page.goto(techOrigin + "/technician");
  await expect(
    page.getByRole("heading", { name: "Your workday", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".staff-technician-hero")).toHaveCount(0);
  await expect(page.locator(".workday-stats .stat-card")).toHaveCount(4);
  for (const width of [320, 375, 390, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(
      page.getByRole("link", { name: "Call Customer", exact: true }).first(),
    ).toHaveAttribute("href", "tel:+919876543210");
    await expect(
      page.getByRole("button", { name: "Complete job", exact: true }).first(),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    if (width === 390 || width === 1440)
      await page.screenshot({
        path: `test-results/pwa-refinements/technician-${width}.png`,
        fullPage: true,
      });
  }
  await page
    .getByRole("link", { name: "Continue job", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp("/jobs/" + id));
});
async function setupCompletion(
  page: Page,
  mode: "direct" | "managed" | "completed" | "blocked",
) {
  let posts = 0;
  let version = 7;
  let completed = mode === "completed";
  const row = {
    id,
    request_number: "123456",
    customer_name: "Maya Rao",
    customer_id: id,
    customer_reference: "C123",
    appliance: "Air Conditioner",
    service_name: "General service",
    request_type: "SERVICE",
    status: "IN_PROGRESS",
    version: 2,
    assigned_technician_name: "Arun Kumar",
    assigned_technician_id: id,
    preferred_date: "2026-11-10",
  };
  await page.route("**/api/v1/admin/**", async (r) => {
    const path = new URL(r.request().url()).pathname;
    if (path.endsWith("/auth/me"))
      return r.fulfill({
        json: {
          data: {
            id,
            username: "ops",
            full_name: "Operations",
            role: "ADMIN",
            must_change_password: false,
          },
        },
      });
    if (path.endsWith("/requests/" + id + "/complete")) {
      posts++;
      const body = r.request().postDataJSON();
      expect(body.version).toBe(version);
      expect(body.workSummary).toBe("Replaced the faulty switch");
      if (posts === 1) {
        version++;
        return r.fulfill({
          status: 409,
          json: {
            error: {
              code: "STALE_REQUEST",
              message: "This request was updated. Please check and try again.",
            },
          },
        });
      }
      completed = true;
      return r.fulfill({
        json: { data: { ...row, status: "COMPLETED", version: 9 } },
      });
    }
    if (path.endsWith("/requests/" + id))
      return r.fulfill({
        json: {
          data: {
            ...row,
            status: completed
              ? "COMPLETED"
              : mode === "blocked"
                ? "ESTIMATE_PENDING_APPROVAL"
                : row.status,
            version,
            technician_account_enabled: mode === "managed",
            pending_report_id: mode === "managed" ? id : null,
            work_reports: [],
            timeline: [],
          },
        },
      });
    if (path.endsWith("/requests"))
      return r.fulfill({
        json: { data: [row], meta: { total: 1, page: 1, limit: 20 } },
      });
    return r.fulfill({ json: { data: [], meta: { total: 0 } } });
  });
  await page.goto(adminOrigin + "/requests");
  await page
    .getByRole("button", { name: "Complete", exact: true })
    .filter({ visible: true })
    .first()
    .click();
  return () => posts;
}
test("simple completion form refreshes stale versions without losing the summary", async ({
  page,
}) => {
  const posts = await setupCompletion(page, "direct");
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator("textarea")).toHaveCount(1);
  await dialog
    .getByLabel("What work was completed?")
    .fill("Replaced the faulty switch");
  await dialog
    .getByRole("button", { name: "Complete request", exact: true })
    .click();
  await expect(dialog.getByLabel("What work was completed?")).toHaveValue(
    "Replaced the faulty switch",
  );
  await expect(dialog.getByRole("alert")).toBeVisible();
  await dialog
    .getByRole("button", { name: "Complete request", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(posts()).toBe(2);
});
for (const mode of ["managed", "completed", "blocked"] as const)
  test(`completion handles ${mode} jobs without a conflicting POST`, async ({
    page,
  }) => {
    const posts = await setupCompletion(page, mode);
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByText(
        mode === "managed"
          ? "Review the technician’s work report to complete this job."
          : mode === "completed"
            ? "This request is already complete."
            : /Review this request.s latest status before completing it\./,
      ),
    ).toBeVisible();
    await expect(dialog.locator("textarea")).toHaveCount(0);
    expect(posts()).toBe(0);
  });
