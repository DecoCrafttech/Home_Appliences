import { test, expect, type Page } from "@playwright/test";
const id = "11111111-1111-4111-8111-111111111111";
const technicianId = "22222222-2222-4222-8222-222222222222";
async function setup(
  page: Page,
  {
    status = "UNDER_REVIEW",
    report = false,
    fail = false,
    role = "ADMIN",
  } = {},
) {
  const writes: Record<string, unknown>[] = [];
  const requestGroups: Array<string | null> = [];
  const request = {
    id,
    request_number: "QA-STATUS",
    display_number: 123,
    customer_id: id,
    customer_name: "Status Customer",
    appliance: "Air Conditioner",
    service_name: "General Service",
    request_type: "SERVICE",
    preferred_date: "2099-10-25",
    preferred_time_window: "09:00-12:00",
    status,
    version: 4,
    timeline: [],
    details: {},
    assignment_state: report ? "ACCEPTED" : undefined,
    assigned_technician_name: report ? "Report Technician" : undefined,
    pending_report_id: report ? id : undefined,
    work_reports: report
      ? [
          {
            id,
            technician_name: "Report Technician",
            state: "SUBMITTED_FOR_REVIEW",
            work_summary: "Inspected and repaired",
            checklist: [],
            outcome: "RESOLVED",
            version: 1,
            created_at: "2026-10-22T10:00:00Z",
          },
        ]
      : [],
  };
  await page.route("**/api/v1/admin/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/me"))
      return route.fulfill({
        json: {
          data: { id, role, username: "status", full_name: "Status Admin" },
        },
      });
    if (path.endsWith(`/requests/${id}/status`)) {
      const body = route.request().postDataJSON();
      writes.push(body);
      await new Promise((resolve) => setTimeout(resolve, 150));
      if (fail && writes.length === 1)
        return route.fulfill({
          status: 503,
          json: { error: { message: "Temporary error. Try again." } },
        });
      request.status = body.status === "PENDING" ? "REQUESTED" : body.status;
      request.version++;
      return route.fulfill({ json: { data: request } });
    }
    if (path.endsWith(`/requests/${id}`))
      return route.fulfill({ json: { data: request } });
    if (path.endsWith("/requests")) {
      requestGroups.push(
        new URL(route.request().url()).searchParams.get("group"),
      );
      return route.fulfill({ json: { data: [request], meta: { total: 1 } } });
    }
    if (path.endsWith("/catalogue"))
      return route.fulfill({
        json: { data: { categories: [], services: [] } },
      });
    if (path.endsWith("/technicians"))
      return route.fulfill({
        json: {
          data: [
            {
              id: technicianId,
              full_name: "Available Technician",
              verification_status: "VERIFIED",
              account_status: "ACTIVE",
            },
            {
              id: "33333333-3333-4333-8333-333333333333",
              full_name: "Another Technician",
              verification_status: "VERIFIED",
              account_status: "ACTIVE",
            },
          ],
        },
      });
    return route.fulfill({ json: { data: [] } });
  });
  await page.goto(
    `http://127.0.0.1:5174/requests/${id}?action=status#update-status`,
  );
  return { writes, requestGroups };
}

async function open(page: Page) {
  await page
    .getByRole("button", { name: "Change Status", exact: true })
    .click();
  return page.getByRole("dialog");
}
test("missing contact is honest and does not produce an invalid call link", async ({
  page,
}) => {
  await setup(page);
  await expect(
    page
      .locator(".customer-contact")
      .getByText("Phone number not provided", { exact: true }),
  ).toBeVisible();
  await expect(page.locator('.customer-contact a[href^="tel:"]')).toHaveCount(
    0,
  );
});
test("admin has a separate in-progress requests workspace", async ({
  page,
}) => {
  const { requestGroups } = await setup(page, { status: "IN_PROGRESS" });
  await page.goto("http://127.0.0.1:5174/in-progress-requests");
  await expect(
    page.getByRole("heading", { name: "In Progress Requests", exact: true }),
  ).toBeVisible();
  await expect.poll(() => requestGroups.at(-1)).toBe("IN_PROGRESS");
  await expect(page.getByLabel("Status")).toHaveCount(0);
});
test("admin changes status without entering notes and repeated save/retry is protected", async ({
  page,
}) => {
  const { writes } = await setup(page, { status: "REQUESTED", fail: true }),
    dialog = await open(page);
  for (const status of [
    "PENDING",
    "TECHNICIAN_ASSIGNED",
    "IN_PROGRESS",
    "COMPLETED",
    "ON_HOLD",
    "CANCELLED",
  ])
    await expect(
      dialog.getByLabel("New Status").locator(`option[value="${status}"]`),
    ).toHaveJSProperty("disabled", false);
  await dialog.getByLabel("New Status").selectOption("COMPLETED");
  await expect(dialog.getByLabel("Reason / Internal Note")).toHaveCount(0);
  await expect(
    dialog.getByLabel("Completion note", { exact: false }),
  ).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Save Status", exact: true })
    .click({ clickCount: 3 });
  await expect(dialog.getByRole("alert")).toHaveText(
    "Temporary error. Try again.",
  );
  expect(writes).toHaveLength(1);
  await expect(dialog.getByLabel("New Status")).toHaveValue("COMPLETED");
  await expect(dialog.getByLabel("Reason / Internal Note")).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Save Status", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(writes).toHaveLength(2);
  expect(writes[1]).toMatchObject({
    status: "COMPLETED",
    expectedVersion: 4,
  });
});
test("technician status requires a person from the active list without skill matching", async ({
  page,
}) => {
  const { writes } = await setup(page, { status: "REQUESTED" }),
    dialog = await open(page);
  await dialog.getByLabel("New Status").selectOption("TECHNICIAN_ASSIGNED");
  await expect(dialog.getByLabel("Technician", { exact: true })).toBeVisible();
  await expect(
    dialog.getByLabel("Technician", { exact: true }).locator("option"),
  ).toHaveCount(3);
  await expect(
    dialog.getByRole("button", { name: "Save Status", exact: true }),
  ).toBeDisabled();
  await dialog
    .getByLabel("Technician", { exact: true })
    .selectOption(technicianId);
  await dialog
    .getByRole("button", { name: "Save Status", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(writes[0]).toMatchObject({
    status: "TECHNICIAN_ASSIGNED",
    technicianId,
  });
});
for (const status of ["COMPLETED", "CANCELLED"])
  test(`${status} can reopen only with explicit confirmation`, async ({
    page,
  }) => {
    const { writes } = await setup(page, { status }),
      dialog = await open(page);
    await dialog.getByLabel("New Status").selectOption("PENDING");
    await expect(
      dialog.getByRole("button", { name: "Save Status", exact: true }),
    ).toBeDisabled();
    await dialog.getByRole("checkbox").check();
    await dialog
      .getByRole("button", { name: "Save Status", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    expect(writes[0]).toMatchObject({ status: "PENDING", confirmReopen: true });
  });
test("support role has no override action", async ({ page }) => {
  await setup(page, { role: "SUPPORT_AGENT" });
  await expect(
    page.getByRole("heading", { name: "000123", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Change Status", exact: true }),
  ).toHaveCount(0);
});
for (const width of [360, 390, 768, 1024, 1440])
  test(`status modal fits ${width}px and can be opened from row actions`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page);
    await page
      .getByRole("link", { name: "Back to requests", exact: true })
      .click();
    const row = page
      .locator(
        width <= 1100 ? ".mobile-request-card" : ".desktop-request-table",
      )
      .first();
    await row.getByLabel("More actions", { exact: true }).click();
    await row
      .getByRole("button", { name: "Change Status", exact: true })
      .last()
      .click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", {
        name: "Change Request Status",
        exact: true,
      }),
    ).toBeVisible();
    const box = (await dialog.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
    await page.screenshot({
      path: `test-results/manual-status/status-modal-${width}.png`,
      fullPage: true,
    });
  });
