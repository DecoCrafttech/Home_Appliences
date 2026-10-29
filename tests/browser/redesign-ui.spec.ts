import { test, expect, type Page } from "@playwright/test";
const identity = "11111111-1111-4111-8111-111111111111",
  notice = "22222222-2222-4222-8222-222222222222";
const roles = ["customer", "admin", "technician"] as const;
async function notifications(page: Page, role: (typeof roles)[number]) {
  let reads = 0,
    read = false;
  await page.route("**/api/v1/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/customer/config"))
      return route.fulfill({ json: { data: { clientId: null } } });
    if (path.endsWith("/profile") || path.endsWith("/auth/me"))
      return route.fulfill({
        json: {
          data: {
            id: identity,
            full_name: "UI QA",
            username: "qa",
            role: "ADMIN",
            csrfToken: "a".repeat(43),
            verification_status: "VERIFIED",
            availability: "AVAILABLE",
            working_hours: { start: "09:00", end: "18:00" },
            leave_dates: [],
          },
        },
      });
    if (
      path.endsWith("/notifications/read-all") ||
      path.endsWith(`/notifications/${notice}/read`)
    ) {
      read = true;
      return route.fulfill({ json: { data: { id: notice } } });
    }
    if (path.endsWith("/notifications")) {
      reads++;
      return route.fulfill({
        json: {
          data: [
            {
              id: notice,
              title: "Visit confirmed",
              message: "Your confirmed appointment is ready to view.",
              created_at: "2026-10-22T10:00:00Z",
              read_at: read ? "2026-10-22T11:00:00Z" : null,
              request_id: identity,
              related_path: `/requests/${identity}`,
            },
          ],
          meta: {
            unreadCount: read ? 0 : 1,
            fetchedAt: new Date().toISOString(),
          },
        },
      });
    }
    if (path.endsWith("/requests") || path.endsWith("/jobs"))
      return route.fulfill({ json: { data: [], meta: { total: 0 } } });
    if (path.endsWith("/catalogue") && role === "admin")
      return route.fulfill({
        json: { data: { categories: [], services: [] } },
      });
    return route.fulfill({ json: { data: [] } });
  });
  return { reads: () => reads };
}
for (const role of roles)
  for (const [width, height] of [
    [360, 800],
    [390, 844],
    [768, 1024],
    [1024, 768],
    [1440, 900],
  ])
    test(`${role} notification dialog is usable at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: width!, height: height! });
      await page.clock.install();
      const network = await notifications(page, role);
      const origin =
        role === "customer"
          ? "http://localhost:5173"
          : role === "admin"
            ? "http://127.0.0.1:5174"
            : "http://127.0.0.1:5175";
      await page.goto(
        origin +
          (role === "technician"
            ? "/technician/jobs"
            : role === "admin"
              ? "/requests"
              : "/services"),
      );
      const bell = page.getByRole("button", { name: /^Notifications/ });
      await expect(bell).toBeVisible();
      await expect(bell.locator(".notification-badge")).toHaveCount(0);
      expect(network.reads()).toBe(0);
      const initial = network.reads();
      await bell.click();
      const dialog = page.getByRole("dialog", { name: "Notifications" });
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByRole("heading", { name: "Visit confirmed" }),
      ).toBeVisible();
      await expect.poll(network.reads).toBe(initial + 1);
      await expect(bell.locator(".notification-badge")).toHaveText("1");
      const box = await dialog.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(-1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width! + 1);
      await page.screenshot({
        path: `test-results/redesign/${role}-notifications-${width}.png`,
        fullPage: true,
      });
      await dialog
        .getByRole("button", { name: "Mark all as read", exact: true })
        .click();
      await expect(bell.locator(".notification-badge")).toHaveCount(0);
      await expect(
        dialog.getByRole("button", { name: "Mark all as read", exact: true }),
      ).toBeDisabled();
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(bell).toBeFocused();
      const idle = network.reads();
      await page.clock.fastForward(60000);
      expect(network.reads()).toBe(idle);
      await bell.click();
      await expect(dialog).toBeVisible();
      await expect.poll(network.reads).toBe(idle + 1);
      await expect(
        dialog.getByRole("link", { name: /View details/ }),
      ).toHaveAttribute(
        "href",
        (role === "technician" ? "/technician/jobs/" : "/requests/") + identity,
      );
    });

test("admin navigation exposes the unified destinations and mobile drawer closes safely", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await notifications(page, "admin");
  await page.goto("http://127.0.0.1:5174/requests");
  const toggle = page.getByRole("button", { name: "Menu", exact: true });
  await toggle.click();
  const nav = page.locator("#admin-navigation");
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  await expect(
    nav.getByRole("link", { name: "Requests", exact: true }),
  ).toBeVisible();
  await expect(
    nav.getByRole("link", { name: "Notifications", exact: true }),
  ).toHaveCount(0);
  await expect(
    nav.getByRole("link", { name: "Service Requests", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
});
