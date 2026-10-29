import { test, expect } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";
const roles = ["customer", "admin", "technician"] as const;
const results: Record<string, unknown> = {};
for (const role of roles)
  test(`${role} request measurement`, async ({ page }) => {
    await page.clock.install();
    const calls: Record<string, number> = {};
    const aborted: Record<string, number> = {};
    page.on("requestfailed", (request) => {
      if (
        request.url().includes("/api/v1/") &&
        request.failure()?.errorText.includes("ERR_ABORTED")
      ) {
        const endpoint = new URL(request.url()).pathname;
        aborted[endpoint] = (aborted[endpoint] || 0) + 1;
      }
    });
    await page.route("**/api/v1/**", (route) => {
      const path = new URL(route.request().url()).pathname;
      calls[path] = (calls[path] || 0) + 1;
      if (/\/(requests|jobs)\/11111111-1111-4111-8111-111111111111$/.test(path))
        return route.fulfill({
          json: {
            data: {
              id: "11111111-1111-4111-8111-111111111111",
              request_number: "SR-AUDIT-1",
              display_number: 123456,
              request_type: "SERVICE",
              appliance: "Air Conditioner",
              service_name: "Repair",
              status: "ASSIGNMENT_PENDING",
              version: 1,
              customer_name: "QA Customer",
              customer_phone: "9876543210",
              preferred_date: "2099-10-25",
              preferred_time_window: "09:00-12:00",
              address_snapshot: {
                name: "QA Customer",
                phone: "9876543210",
                line1: "12 Test Road",
                area: "Adyar",
                city: "Chennai",
                state: "Tamil Nadu",
                pinCode: "600020",
              },
              details: {},
              timeline: [],
              reports: [],
              estimates: [],
              assignment_state: "OFFERED",
              assignment_id: "offer",
              assignment_version: 1,
            },
          },
        });
      const data =
        path.endsWith("/auth/me") || path.endsWith("/profile")
          ? {
              id: "qa",
              full_name: "QA User",
              username: "qa",
              role: "ADMIN",
              availability: "AVAILABLE",
              verification_status: "VERIFIED",
              csrfToken: "a".repeat(43),
            }
          : path.endsWith("/dashboard/summary")
            ? {}
            : path.endsWith("/dashboard/allocation")
              ? {
                  assignable: 0,
                  unassigned: 0,
                  offered: 0,
                  accepted: 0,
                  unavailable: 0,
                  workload: [],
                }
              : path.endsWith("/dashboard/activity")
                ? {
                    trends: [],
                    distribution: [],
                    recent: [],
                    attention: [],
                    alerts: { unassigned: 0, overdue: 0, negative: 0 },
                  }
                : path.endsWith("/dashboard")
                  ? {
                      today: 0,
                      pending: 0,
                      in_progress: 0,
                      completed_today: 0,
                      next_jobs: [],
                    }
                  : path.endsWith("/auth/customer/config")
                    ? { clientId: null }
                    : [];
      return route.fulfill({
        json: {
          data,
          meta: { unreadCount: 0, fetchedAt: new Date().toISOString() },
        },
      });
    });
    const url =
      role === "customer"
        ? "http://localhost:5173/"
        : role === "admin"
          ? "http://127.0.0.1:5174/"
          : "http://127.0.0.1:5175/technician";
    await page.goto(url);
    await expect(page.locator("h1")).toBeVisible();
    await new Promise((r) => setTimeout(r, 400));
    const initial = { ...calls };
    for (let i = 0; i < 61; i++) {
      await page.clock.runFor(1000);
      await new Promise((r) => setTimeout(r, 12));
    }
    const idle = Object.fromEntries(
      Object.entries(calls)
        .map(([k, v]) => [k, v - (initial[k] || 0)])
        .filter(([, v]) => v),
    );
    const beforeBell = { ...calls };
    await page.getByRole("button", { name: /^Notifications/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await new Promise((r) => setTimeout(r, 200));
    results[role] = {
      initial,
      idle,
      notificationOpen: Object.fromEntries(
        Object.entries(calls)
          .map(([k, v]) => [k, v - (beforeBell[k] || 0)])
          .filter(([, v]) => v),
      ),
    };
    await page.keyboard.press("Escape");
    const navigation: Record<string, unknown> = {};
    for (const [label, path] of [
      [
        "listOpen",
        role === "customer"
          ? "/services"
          : role === "admin"
            ? "/requests"
            : "/technician/jobs",
      ],
      [
        "recordOpen",
        (role === "technician" ? "/technician/jobs/" : "/requests/") +
          "11111111-1111-4111-8111-111111111111",
      ],
    ]) {
      const previous = { ...calls };
      await page.goto(new URL(path!, url).href);
      await expect(page.locator("h1")).toBeVisible();
      await new Promise((resolve) => setTimeout(resolve, 300));
      navigation[label!] = Object.fromEntries(
        Object.entries(calls)
          .map(([key, count]) => [key, count - (previous[key] || 0)])
          .filter(([, count]) => count),
      );
    }
    results[role] = { ...(results[role] as object), navigation, aborted };
    if ((process.env.REQUEST_AUDIT_LABEL || "after") === "after")
      expect(idle).toEqual({});
  });
test.afterAll(() => {
  mkdirSync("docs/request-audit", { recursive: true });
  writeFileSync(
    `docs/request-audit/${process.env.REQUEST_AUDIT_LABEL || "after"}.json`,
    JSON.stringify(results, null, 2),
  );
});
