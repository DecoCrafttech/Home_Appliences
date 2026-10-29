import { test, expect } from "@playwright/test";
const id = "11111111-1111-4111-8111-111111111111",
  techId = "22222222-2222-4222-8222-222222222222";
test("assignment drawer blocks triple submission, preserves selection on failure and retries with the same key", async ({
  page,
}) => {
  const keys: string[] = [];
  let calls = 0;
  await page.route("**/api/v1/admin/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/me"))
      return route.fulfill({
        json: {
          data: { id, username: "qa", role: "ADMIN", full_name: "Workflow QA" },
        },
      });
    if (path.endsWith("/eligible-technicians"))
      return route.fulfill({
        json: {
          data: [
            {
              id: techId,
              full_name: "Eligible Technician",
              skills: "AC",
              service_area: "Chennai",
              availability: "AVAILABLE",
              scheduled_workload: 2,
              average_rating: null,
            },
          ],
          meta: {
            excluded: [
              {
                id: "other",
                full_name: "Unavailable Technician",
                reason: "On leave on the requested date",
              },
            ],
          },
        },
      });
    if (path.endsWith("/offer")) {
      calls++;
      keys.push(route.request().headers()["idempotency-key"]!);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return calls === 1
        ? route.fulfill({
            status: 503,
            json: {
              error: { message: "Unable to connect. Please try again." },
            },
          })
        : route.fulfill({
            status: 201,
            json: { data: { id: "assignment", state: "ACCEPTED" } },
          });
    }
    if (path.endsWith("/requests/" + id))
      return route.fulfill({
        json: {
          data: {
            id,
            request_number: "SR-SAFE-1",
            customer_name: "QA Customer",
            appliance: "AC",
            request_type: "SERVICE",
            preferred_date: "2099-10-25",
            preferred_time_window: "09:00-12:00",
            address_snapshot: { city: "Chennai", area: "Adyar" },
            status: "ASSIGNMENT_PENDING",
            version: 1,
            timeline: [],
          },
        },
      });
    return route.fulfill({ json: { data: [] } });
  });
  await page.goto("http://127.0.0.1:5174/requests/" + id);
  await page
    .getByRole("button", { name: "Assign Technician", exact: true })
    .click();
  const drawer = page.getByRole("dialog");
  await drawer.getByRole("radio").check();
  const submit = drawer.getByRole("button", {
    name: "Confirm Assignment",
    exact: true,
  });
  await submit.evaluate((button) => {
    for (let i = 0; i < 3; i++) (button as HTMLButtonElement).click();
  });
  await expect(
    drawer.getByRole("button", { name: "Assigning...", exact: true }),
  ).toBeDisabled();
  await expect(drawer.locator(".action-spinner")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("alert")).toHaveText(
    "Unable to connect. Please try again.",
  );
  expect(calls).toBe(1);
  await expect(drawer.getByRole("radio")).toBeChecked();
  await drawer.getByLabel("Search technicians").press("Enter");
  await drawer.getByLabel("Search technicians").press("Enter");
  await drawer.getByLabel("Search technicians").press("Enter");
  await expect(drawer).toHaveCount(0);
  expect(calls).toBe(2);
  expect(keys[0]).toBe(keys[1]);
  await expect(
    page.getByText("Technician assigned successfully.", { exact: true }),
  ).toHaveCount(1);
});

test("refresh during an unknown committed assignment never automatically submits again", async ({
  page,
}) => {
  let committed = 0;
  await page.route("**/api/v1/admin/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/me"))
      return route.fulfill({
        json: {
          data: { id, username: "qa", role: "ADMIN", full_name: "Refresh QA" },
        },
      });
    if (path.endsWith("/eligible-technicians"))
      return route.fulfill({
        json: {
          data: [
            {
              id: techId,
              full_name: "Eligible Technician",
              skills: "AC",
              service_area: "Chennai",
              scheduled_workload: 0,
              average_rating: null,
            },
          ],
          meta: { excluded: [] },
        },
      });
    if (path.endsWith("/offer")) {
      committed++;
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.abort("connectionreset").catch(() => {});
      return;
    }
    if (path.endsWith("/requests/" + id))
      return route.fulfill({
        json: {
          data: {
            id,
            request_number: "SR-REFRESH",
            customer_name: "QA",
            appliance: "AC",
            request_type: "SERVICE",
            status: committed ? "TECHNICIAN_ASSIGNED" : "ASSIGNMENT_PENDING",
            version: committed ? 2 : 1,
            ...(committed
              ? {
                  assignment_state: "ACCEPTED",
                  assigned_technician_name: "Eligible Technician",
                }
              : {}),
            timeline: [],
          },
        },
      });
    return route.fulfill({ json: { data: [] } });
  });
  await page.goto("http://127.0.0.1:5174/requests/" + id);
  await page
    .getByRole("button", { name: "Assign Technician", exact: true })
    .click();
  await page.getByRole("dialog").getByRole("radio").check();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm Assignment", exact: true })
    .click();
  await expect.poll(() => committed).toBe(1);
  await page.reload();
  await expect(
    page.getByText("Assignment: ACCEPTED", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(committed).toBe(1);
});

for (const role of ["customer", "admin", "technician"] as const)
  test(
    role + " notifications load on demand without idle polling",
    async ({ page }) => {
      let reads = 0,
        markedRead = false,
        failFetch = false;
      const origin =
        role === "customer"
          ? "http://localhost:5173"
          : role === "admin"
            ? "http://127.0.0.1:5174"
            : "http://127.0.0.1:5175";
      const prefix = role === "customer" ? "/api/v1" : `/api/v1/${role}`;
      await page.clock.install();
      await page.route("**/api/v1/**", (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path.endsWith("/auth/customer/config"))
          return route.fulfill({ json: { data: { clientId: null } } });
        if (path.endsWith("/profile") || path.endsWith("/auth/me"))
          return route.fulfill({
            json: {
              data: {
                id,
                full_name: "Notification QA",
                username: "qa",
                role: "ADMIN",
                phone: "+919000000001",
                verification_status: "VERIFIED",
                availability: "AVAILABLE",
                skills: "AC",
                service_area: "Chennai",
                working_hours: { start: "09:00", end: "18:00" },
                leave_dates: [],
                csrfToken: "a".repeat(43),
              },
            },
          });
        if (path === prefix + "/notifications/" + techId + "/read") {
          markedRead = true;
          return route.fulfill({ json: { data: { id: techId } } });
        }
        if (path === "/api/v1/admin/dashboard/summary")
          return route.fulfill({ json: { data: {} } });
        if (path === "/api/v1/admin/dashboard/allocation")
          return route.fulfill({
            json: {
              data: {
                assignable: 0,
                unassigned: 0,
                offered: 0,
                accepted: 0,
                unavailable: 0,
                workload: [],
              },
            },
          });
        if (path === "/api/v1/admin/dashboard/activity")
          return route.fulfill({
            json: {
              data: {
                trends: [],
                distribution: [],
                recent: [],
                attention: [],
                alerts: { unassigned: 0, overdue: 0, negative: 0 },
              },
            },
          });
        if (path === prefix + "/notifications") {
          if (failFetch)
            return route.fulfill({
              status: 503,
              json: { error: { message: "Temporary failure" } },
            });
          reads++;
          return route.fulfill({
            json: {
              data: [
                {
                  id: techId,
                  title: "Fresh notification",
                  message: "Current backend message",
                  request_id: id,
                  related_path: "/requests/" + id,
                  read_at: markedRead ? "2026-10-22T08:00:00Z" : null,
                  created_at: "2026-10-22T07:00:00Z",
                },
              ],
            },
          });
        }
        return route.fulfill({ json: { data: [] } });
      });
      await page.goto(
        origin +
          (role === "technician"
            ? "/technician"
            : role === "admin"
              ? "/notifications"
              : "/"),
      );
      const bell = page.getByRole("button", { name: /^Notifications/ });
      await expect(bell).toBeVisible();
      if (role === "admin") await expect.poll(() => reads).toBeGreaterThan(0);
      else expect(reads).toBe(0);
      if (role === "admin") {
        // The legacy Notifications URL opens the inbox immediately. Close it
        // before exercising the header bell, which is behind the modal.
        await page
          .getByRole("dialog")
          .getByRole("button", { name: "Close", exact: true })
          .click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
      }
      const before = reads;
      await page.clock.fastForward(60000);
      expect(reads).toBe(before);
      await page.evaluate(() => {
        window.dispatchEvent(new Event("focus"));
        window.dispatchEvent(new Event("focus"));
      });
      await page.waitForTimeout(100);
      expect(reads).toBe(before);
      await bell.click();
      await expect.poll(() => reads).toBe(before + 1);
      await expect(
        page.getByRole("heading", { name: /Fresh notification/ }),
      ).toBeVisible();
      await page
        .getByRole("dialog")
        .getByRole("button", {
          name: "Refresh",
          exact: true,
        })
        .click();
      await expect.poll(() => reads).toBe(before + 2);
      const link = page.getByRole("dialog").getByRole("link", {
        name: "View details",
        exact: true,
      });
      await expect(link).toHaveAttribute(
        "href",
        (role === "technician" ? "/technician/jobs/" : "/requests/") + id,
      );
      await page
        .getByRole("button", {
          name: "Mark as read",
          exact: true,
        })
        .click();
      await expect(
        page.getByRole("button", { name: /Mark (as )?read/, exact: true }),
      ).toHaveCount(0);
      await expect(bell.locator("span")).toHaveCount(0);
      failFetch = true;
      await page
        .getByRole("dialog")
        .getByRole("button", {
          name: "Refresh",
          exact: true,
        })
        .click();
      await expect(
        page.getByText("Unable to load notifications.", { exact: true }),
      ).toBeVisible();
    },
  );

for (const width of [360, 390, 768, 1024, 1440])
  test(
    "assignment drawer fits " + width + "px and returns focus after cancel",
    async ({ page }) => {
      await page.setViewportSize({ width, height: width < 500 ? 844 : 900 });
      await page.route("**/api/v1/admin/**", (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path.endsWith("/auth/me"))
          return route.fulfill({
            json: {
              data: { id, username: "qa", full_name: "QA", role: "ADMIN" },
            },
          });
        if (path.endsWith("/requests/" + id))
          return route.fulfill({
            json: {
              data: {
                id,
                request_number: "SR-MOBILE",
                customer_name: "QA",
                appliance: "AC",
                request_type: "INSTALLATION",
                version: 1,
                status: "ASSIGNMENT_PENDING",
                timeline: [],
              },
            },
          });
        if (path.endsWith("/eligible-technicians"))
          return route.fulfill({
            json: {
              data: [
                {
                  id: techId,
                  full_name: "Eligible Technician",
                  skills: "AC",
                  service_area: "Chennai",
                  scheduled_workload: 0,
                  average_rating: null,
                },
              ],
              meta: { excluded: [] },
            },
          });
        return route.fulfill({ json: { data: [] } });
      });
      await page.goto("http://127.0.0.1:5174/requests/" + id);
      const trigger = page.getByRole("button", {
        name: "Assign Technician",
        exact: true,
      });
      await trigger.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("radio")).toBeVisible();
      expect(
        await dialog.evaluate(
          (node) => node.scrollWidth <= node.clientWidth + 1,
        ),
      ).toBe(true);
      await page.screenshot({
        path: "test-results/screenshots/assignment-drawer-" + width + ".png",
        fullPage: true,
      });
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();
    },
  );
