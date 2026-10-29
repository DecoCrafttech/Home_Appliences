import { test, expect } from "@playwright/test";
const first = "11111111-1111-4111-8111-111111111111",
  second = "22222222-2222-4222-8222-222222222222",
  technician = "33333333-3333-4333-8333-333333333333",
  report = "44444444-4444-4444-8444-444444444444";
for (const width of [360, 768, 1440])
  test(`request cards expose assignment and completion at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const writes: Array<{ path: string; body: Record<string, unknown> }> = [];
    const requests = [
      {
        id: first,
        request_number: "SR-101",
        status: "REQUESTED",
        version: 1,
        appliance: "Air Conditioner",
        request_type: "SERVICE",
        service_name: "Cooling inspection",
        customer_name: "Priya Kumar",
        customer_id: first,
        customer_phone: "+919876543210",
        preferred_date: "2099-10-25",
        preferred_time_window: "09:00-12:00",
        address_snapshot: { area: "Adyar", city: "Chennai" },
        assignment_state: undefined as string | undefined,
        offered_technician_name: undefined as string | undefined,
      },
      {
        id: second,
        request_number: "SR-102",
        status: "IN_PROGRESS",
        version: 4,
        appliance: "Washing Machine",
        request_type: "SERVICE",
        service_name: "Repair",
        customer_name: "Raj Kumar",
        customer_id: second,
        preferred_date: "2099-10-25",
        assignment_state: "ACCEPTED",
        assigned_technician_name: "Arun Kumar",
        address_snapshot: { area: "Adyar", city: "Chennai" },
      },
    ];
    await page.route("**/api/v1/admin/**", (route) => {
      const request = route.request(),
        path = new URL(request.url()).pathname;
      if (request.method() === "GET") {
        if (path.endsWith("/auth/me"))
          return route.fulfill({
            json: {
              data: {
                id: first,
                role: "ADMIN",
                username: "qa",
                full_name: "QA Admin",
              },
            },
          });
        if (path.endsWith("/requests"))
          return route.fulfill({
            json: { data: requests, meta: { total: 2 } },
          });
        if (path.endsWith(`/requests/${second}`))
          return route.fulfill({
            json: {
              data: {
                ...requests[1],
                work_reports: [
                  {
                    id: report,
                    state: "SUBMITTED_FOR_REVIEW",
                    outcome: "RESOLVED",
                    work_summary:
                      "Replaced the drain pump and checked operation.",
                  },
                ],
              },
            },
          });
        if (path.endsWith("/eligible-technicians"))
          return route.fulfill({
            json: {
              data: [
                {
                  id: technician,
                  full_name: "Arun Kumar",
                  skills: "Air Conditioner",
                  service_area: "Chennai",
                  scheduled_workload: 1,
                  average_rating: null,
                },
              ],
            },
          });
        if (path.endsWith("/catalogue"))
          return route.fulfill({
            json: { data: { categories: [], services: [] } },
          });
        return route.fulfill({ json: { data: [] } });
      }
      const body = request.postDataJSON();
      writes.push({ path, body });
      if (path.endsWith(`/requests/${first}/status`)) {
        expect(body.status).toBe("UNDER_REVIEW");
        requests[0]!.version = 2;
        requests[0]!.status = "UNDER_REVIEW";
        return route.fulfill({ json: { data: requests[0] } });
      }
      if (path.endsWith(`/requests/${first}/offer`)) {
        expect(body.version).toBe(2);
        expect(body.technicianId).toBe(technician);
        requests[0]!.assignment_state = "OFFERED";
        requests[0]!.offered_technician_name = "Arun Kumar";
        requests[0]!.status = "ASSIGNMENT_PENDING";
        return route.fulfill({ json: { data: { id: technician } } });
      }
      if (path.endsWith(`/work-reports/${report}/review`)) {
        expect(body.decision).toBe("APPROVE");
        requests[1]!.status = "COMPLETED";
        return route.fulfill({ json: { data: requests[1] } });
      }
      return route.fulfill({ json: { data: [] } });
    });
    await page.goto("http://127.0.0.1:5174/requests");
    const container = page.locator(
      width <= 1100 ? ".mobile-request-list" : ".desktop-request-table",
    );
    const assign = container.getByRole("button", {
      name: "Assign Technician",
      exact: true,
    });
    await expect(assign).toBeVisible();
    await expect(assign.locator("svg")).toHaveCount(1);
    await assign.click();
    let dialog = page.getByRole("dialog");
    await dialog.getByRole("radio").check();
    expect(writes).toHaveLength(0);
    await dialog
      .getByRole("button", { name: "Confirm Assignment", exact: true })
      .evaluate((button) => {
        for (let i = 0; i < 3; i++) (button as HTMLButtonElement).click();
      });
    await expect(dialog).toHaveCount(0);
    expect(
      writes.filter((write) => write.path.endsWith("/offer")),
    ).toHaveLength(1);
    expect(
      writes.filter((write) => write.path.endsWith("/status")),
    ).toHaveLength(1);
    const complete = container.getByRole("button", {
      name: "Complete",
      exact: true,
    });
    await expect(complete).toBeVisible();
    await expect(complete.locator("svg")).toHaveCount(1);
    await page.screenshot({
      path: `test-results/request-simple/admin-requests-${width}.png`,
      fullPage: true,
    });
    await complete.click();
    dialog = page.getByRole("dialog", {
      name: "Complete this request?",
      exact: true,
    });
    await expect(dialog).toContainText("Replaced the drain pump");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(
      writes.filter((write) => write.path.endsWith("/review")),
    ).toHaveLength(0);
    await complete.click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm Completion", exact: true })
      .evaluate((button) => {
        for (let i = 0; i < 3; i++) (button as HTMLButtonElement).click();
      });
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(
      writes.filter((write) => write.path.endsWith("/review")),
    ).toHaveLength(1);
    await expect(complete).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  });
