import { test, expect, type Page } from "@playwright/test";

const id = "11111111-1111-4111-8111-111111111111";
const identity = {
  id,
  username: "qa",
  full_name: "QA User",
  email: "qa@example.com",
  phone_e164: "+919876543210",
  phone: "+919876543210",
  role: "ADMIN",
  csrfToken: "a".repeat(43),
  verification_status: "VERIFIED",
  account_status: "ACTIVE",
  availability: "AVAILABLE",
  skills: "Air Conditioner",
  service_area: "Chennai",
  working_hours: { start: "09:00", end: "18:00" },
  leave_dates: [],
  completed_count: 0,
  average_rating: null,
  mfa_enabled: false,
};
const request = {
  id,
  customer_id: id,
  customer_name: "QA Customer",
  customer_phone: "+919876543210",
  request_number: "SR-QA-1",
  request_type: "SERVICE",
  appliance: "Air Conditioner",
  service_name: "Cooling inspection",
  status: "REQUESTED",
  assignment_state: "OFFERED",
  assignment_id: id,
  assignment_version: 1,
  version: 1,
  details: {},
  address_snapshot: {
    name: "QA Customer",
    phone: "9876543210",
    line1: "12 Garden Street",
    area: "Adyar",
    city: "Chennai",
    state: "Tamil Nadu",
    pinCode: "600020",
  },
  preferred_date: "2099-10-25",
  preferred_time_window: "09:00-12:00",
  created_at: "2026-10-25T10:00:00Z",
  timeline: [],
  work_reports: [],
  reports: [],
  estimates: [],
  support_tickets: [],
};
type Role = "customer" | "admin" | "technician";
const origins: Record<Role, string> = {
  customer: "http://localhost:5173",
  admin: "http://127.0.0.1:5174",
  technician: "http://127.0.0.1:5175",
};
function payload(path: string, role: Role) {
  if (/\/(auth\/me|profile)$/.test(path)) return { data: identity };
  if (path.endsWith("/auth/customer/config"))
    return { data: { clientId: null } };
  if (path.endsWith("/profile/photo")) return { data: { url: null } };
  if (path.endsWith("/dashboard/summary")) return { data: {} };
  if (path.endsWith("/dashboard/allocation"))
    return {
      data: {
        unassigned: 0,
        assignable: 0,
        offered: 0,
        accepted: 0,
        unavailable: 0,
        workload: [],
      },
    };
  if (path.endsWith("/dashboard/activity"))
    return {
      data: {
        attention: [],
        recent: [],
        trends: [],
        distribution: [],
        alerts: {},
      },
    };
  if (path.endsWith("/dashboard"))
    return {
      data: {
        today: 0,
        pending: 0,
        in_progress: 0,
        completed_today: 0,
        next_jobs: [],
      },
    };
  if (path.endsWith(`/jobs/${id}`) || path.endsWith(`/requests/${id}`))
    return { data: request };
  if (path.endsWith(`/customers/${id}`))
    return {
      data: {
        ...identity,
        customer_reference: "CUS-QA",
        created_at: "2026-10-25",
        requests: [],
        addresses: [],
        reviews: [],
        tickets: [],
      },
    };
  if (path.endsWith("/feedback/summary")) return { data: {} };
  if (role === "admin" && path.endsWith("/catalogue"))
    return { data: { categories: [], services: [] } };
  return {
    data: [],
    meta: {
      total: 0,
      page: 1,
      limit: 20,
      unreadCount: 0,
      fetchedAt: new Date().toISOString(),
    },
  };
}
async function states(page: Page, role: Role) {
  let gate = "",
    phase: "slow" | "error" | "ready" = "ready";
  let pending: Array<() => void> = [];
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === gate) {
      if (phase === "slow")
        await new Promise<void>((resolve) => pending.push(resolve));
      if (phase === "error")
        return route.fulfill({
          status: 403,
          json: {
            error: {
              code: "FORBIDDEN",
              message: "Unable to load this information. Please try again.",
            },
          },
        });
    }
    return route.fulfill({ json: payload(path, role) });
  });
  return {
    async slow(path: string) {
      gate = `/api/v1${role === "customer" ? "" : `/${role}`}${path}`;
      phase = "slow";
      pending = [];
    },
    error() {
      phase = "error";
      pending.splice(0).forEach((resolve) => resolve());
    },
    ready() {
      phase = "ready";
      pending.splice(0).forEach((resolve) => resolve());
    },
  };
}
const screens: Record<Role, Array<[string, string, string]>> = {
  customer: [
    ["/", "/catalogue/appliances", "appliances"],
    ["/services", "/catalogue/appliances", "appliances"],
    ["/bookings", "/requests", "cards"],
    ["/profile", "/profile", "profile"],
    ["/addresses", "/addresses", "cards"],
    ["/support", "/support/tickets", "cards"],
    [`/requests/${id}`, `/requests/${id}`, "detail"],
  ],
  admin: [
    ["/", "/dashboard/summary", "dashboard"],
    ["/requests", "/requests", "table"],
    ["/customers", "/customers", "table"],
    ["/technicians", "/technicians", "table"],
    ["/catalogue", "/catalogue", "table"],
    ["/feedback", "/feedback", "table"],
    [`/requests/${id}`, `/requests/${id}`, "detail"],
    [`/customers/${id}`, `/customers/${id}`, "profile"],
  ],
  technician: [
    ["/technician", "/dashboard", "workday"],
    ["/technician/jobs", "/jobs", "cards"],
    [`/technician/jobs/${id}`, `/jobs/${id}`, "detail"],
    ["/technician/profile", "/auth/me", "profile"],
  ],
};
for (const role of ["customer", "admin", "technician"] as const) {
  for (const width of [360, 390, 768, 1024, 1440]) {
    test(`${role} loading, error, retry, offline and notifications at ${width}px`, async ({
      page,
      context,
    }) => {
      test.setTimeout(180000);
      await page.setViewportSize({ width, height: 900 });
      const controller = await states(page, role);
      for (const [url, endpoint, variant] of screens[role]) {
        await controller.slow(endpoint);
        await page.goto(origins[role] + url);
        const skeleton = page.locator(`.app-loading--${variant}`).first();
        await expect(skeleton).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        ).toBe(true);
        if (url === screens[role][0]![0])
          await page.screenshot({
            path: `test-results/ui-essentials/${role}-loading-${width}.png`,
          });
        controller.error();
        await expect(
          page.getByRole("button", { name: /^(Try again|Retry)$/i }).first(),
        ).toBeVisible();
        controller.ready();
        await page
          .getByRole("button", { name: /^(Try again|Retry)$/i })
          .first()
          .click();
        await expect(
          page.getByRole("button", { name: /^(Try again|Retry)$/i }),
        ).toHaveCount(0);
        await expect(page.locator(".app-loading")).toHaveCount(0);
        await expect(
          page.getByRole("heading", { name: "Unable to display this page" }),
        ).toHaveCount(0);
      }
      // Offline detection is local; reconnect does not submit anything.
      await context.setOffline(true);
      await expect(
        page.getByText("You're offline. Check your connection.", {
          exact: true,
        }),
      ).toBeVisible();
      await context.setOffline(false);
      await expect(
        page.getByText("You're offline. Check your connection.", {
          exact: true,
        }),
      ).toHaveCount(0);
      await controller.slow("/notifications");
      const bell = page.getByRole("button", {
        name: "Notifications",
        exact: true,
      });
      await bell.click();
      await expect(page.locator(".app-loading--notifications")).toBeVisible();
      controller.error();
      const dialog = page.getByRole("dialog");
      await expect(
        dialog.getByText("Unable to load notifications."),
      ).toBeVisible();
      controller.ready();
      await dialog.getByRole("button", { name: "Try again" }).click();
      await expect(
        dialog.getByRole("heading", { name: "No notifications yet" }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(bell).toBeFocused();
    });
  }
}

test("theme text and controls have accessible contrast in every PWA", async ({
  page,
}) => {
  const luminance = (hex: string) => {
    const c = hex
      .match(/\w\w/g)!
      .map((v) => parseInt(v, 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return c[0]! * 0.2126 + c[1]! * 0.7152 + c[2]! * 0.0722;
  };
  const contrast = (a: string, b: string) => {
    const x = luminance(a.replace("#", "")),
      y = luminance(b.replace("#", ""));
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  for (const role of ["customer", "admin", "technician"] as const) {
    await states(page, role);
    await page.goto(
      origins[role] + (role === "technician" ? "/technician" : "/"),
    );
    const values = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return Object.fromEntries(
        [
          "primary",
          "accent",
          "background",
          "heading",
          "secondary",
          "muted",
          "focus",
        ].map((key) => [key, style.getPropertyValue(`--color-${key}`).trim()]),
      );
    });
    expect(values.primary).toBe("#512da8");
    expect(values.accent).toBe("#ffb6a3");
    expect(values.background).toBe("#f7f2ff");
    for (const key of ["heading", "secondary", "muted"])
      expect(contrast(values[key]!, values.background!)).toBeGreaterThanOrEqual(
        4.5,
      );
    expect(contrast(values.primary!, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(values.heading!, values.accent!)).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(contrast(values.focus!, values.background!)).toBeGreaterThanOrEqual(
      3,
    );
  }
});

test("password visibility preserves the value and does not submit", async ({
  page,
}) => {
  let writes = 0;
  await page.route("**/api/v1/admin/**", (route) => {
    if (route.request().method() !== "GET") writes++;
    return route.fulfill({
      status: 401,
      json: { error: { code: "UNAUTHORIZED" } },
    });
  });
  await page.goto(origins.admin);
  const password = page.getByLabel("Password", { exact: true });
  await password.fill("Example-password-123");
  await page
    .getByRole("button", { name: "Show password", exact: true })
    .click();
  await expect(password).toHaveAttribute("type", "text");
  await expect(password).toHaveValue("Example-password-123");
  await page
    .getByRole("button", { name: "Hide password", exact: true })
    .click();
  await expect(password).toHaveAttribute("type", "password");
  expect(writes).toBe(0);
});

test("address deletion confirms, keeps failures open and guards repeated clicks", async ({
  page,
}) => {
  await states(page, "customer");
  let calls = 0,
    removed = false;
  await page.route("**/api/v1/addresses**", async (route) => {
    if (route.request().method() === "DELETE") {
      calls++;
      if (calls === 1)
        return route.fulfill({
          status: 503,
          json: { error: { message: "Try deleting again." } },
        });
      removed = true;
      return route.fulfill({ json: { data: { id } } });
    }
    return route.fulfill({
      json: {
        data: removed
          ? []
          : [
              {
                id,
                label: "Home",
                recipient_name: "QA Customer",
                line1: "12 Garden Street",
                area: "Adyar",
                city: "Chennai",
                pin_code: "600020",
              },
            ],
      },
    });
  });
  await page.goto(origins.customer + "/addresses");
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Keep address" }).click();
  expect(calls).toBe(0);
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Delete address", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("Try deleting again.");
  await dialog
    .getByRole("button", { name: "Delete address", exact: true })
    .evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
      button.click();
    });
  await expect(dialog).toHaveCount(0);
  expect(calls).toBe(2);
  await expect(
    page.getByRole("heading", { name: "No saved addresses yet" }),
  ).toBeVisible();
});

test("request search is debounced and list filters survive returning from details", async ({
  page,
}) => {
  await states(page, "admin");
  const searches: string[] = [];
  await page.route("**/api/v1/admin/requests?**", (route) => {
    searches.push(new URL(route.request().url()).searchParams.get("q") || "");
    return route.fulfill({ json: { data: [request], meta: { total: 1 } } });
  });
  await page.goto(origins.admin + "/requests");
  const search = page.getByRole("searchbox", { name: "Search requests" });
  await search.pressSequentially("cooling", { delay: 20 });
  await expect(page).toHaveURL(/q=cooling/);
  await expect
    .poll(() => searches.filter((q) => q === "cooling").length)
    .toBe(1);
  expect(searches.filter((q) => q && q !== "cooling")).toHaveLength(0);
  await page
    .getByRole("combobox", { name: "Sort requests" })
    .selectOption("oldest");
  await page
    .getByRole("link", { name: /View Details/i })
    .first()
    .click();
  await page.goBack();
  await expect(search).toHaveValue("cooling");
  await expect(
    page.getByRole("combobox", { name: "Sort requests" }),
  ).toHaveValue("oldest");
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await expect(page).not.toHaveURL(/q=cooling/);
});

test("catalogue protects unsaved edits and confirms unpublishing", async ({
  page,
}) => {
  await states(page, "admin");
  const service = {
    id,
    name: "Cooling inspection",
    appliance_category_id: id,
    appliance_name: "Air Conditioner",
    request_type: "SERVICE",
    publication_status: "PUBLISHED",
    form_fields: [],
    booking_options: [],
  };
  let writes = 0;
  await page.route("**/api/v1/admin/catalogue**", (route) => {
    if (route.request().method() === "PATCH") {
      writes++;
      return route.fulfill({ json: { data: { id } } });
    }
    return route.fulfill({
      json: {
        data: {
          categories: [
            { id, name: "Air Conditioner", publication_status: "PUBLISHED" },
          ],
          services: [service],
        },
      },
    });
  });
  await page.goto(origins.admin + "/catalogue");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Service name", { exact: true })
    .fill("Updated cooling inspection");
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(
    dialog.getByRole("heading", { name: "Discard unsaved changes?" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Keep editing" }).click();
  await expect(dialog.getByLabel("Service name", { exact: true })).toHaveValue(
    "Updated cooling inspection",
  );
  await page.keyboard.press("Escape");
  await dialog.getByRole("button", { name: "Discard changes" }).click();
  expect(writes).toBe(0);
  await page.getByRole("button", { name: "Unpublish", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Keep published" }).click();
  expect(writes).toBe(0);
  await page.getByRole("button", { name: "Unpublish", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Unpublish service", exact: true })
    .evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
      button.click();
    });
  await expect(dialog).toHaveCount(0);
  expect(writes).toBe(1);
});

test("background refresh preserves the loaded layout and reduced motion stops shimmer", async ({
  page,
}) => {
  const controller = await states(page, "technician");
  await page.goto(origins.technician + "/technician");
  await expect(
    page.getByRole("heading", { name: "No upcoming work" }),
  ).toBeVisible();
  await controller.slow("/dashboard");
  await page.getByRole("button", { name: "Refresh workday" }).click();
  await expect(
    page.getByRole("heading", { name: "No upcoming work" }),
  ).toBeVisible();
  await expect(page.locator(".app-loading")).toHaveCount(0);
  controller.ready();
  await expect(
    page.getByRole("button", { name: "Refresh workday" }),
  ).toBeEnabled();
  await controller.slow("/jobs");
  await page.getByRole("link", { name: "My jobs", exact: true }).last().click();
  await expect(page.locator(".app-skeleton").first()).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .locator(".app-skeleton")
      .first()
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe("none");
  controller.ready();
});
