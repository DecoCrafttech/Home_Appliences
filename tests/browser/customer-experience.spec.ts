import { test, expect, type Page } from "@playwright/test";

test("booking date choices remain clear across a month boundary on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.clock.setFixedTime(new Date("2026-10-31T10:00:00+05:30"));
  await setup(page);
  await requirement(page);
  await page
    .getByLabel("House / street", { exact: true })
    .fill("12 Garden Street");
  await page.getByLabel("Area", { exact: true }).fill("Adyar");
  await page.getByLabel("City", { exact: true }).fill("Chennai");
  await page.getByLabel("State", { exact: true }).fill("Tamil Nadu");
  await page.getByLabel("PIN code", { exact: true }).fill("600020");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  const tomorrow = page.getByRole("button", {
    name: "Sunday, 1 November 2026",
    exact: true,
  });
  await expect(tomorrow).toContainText("Nov");
  await tomorrow.click();
  await expect(tomorrow).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Later date", { exact: true })).toHaveValue(
    "2026-11-01",
  );
  await page.locator(".time-selector button").first().click();
  const formBounds = await page.locator(".wizard-form").boundingBox();
  for (const action of await page.locator(".wizard-actions button").all()) {
    const bounds = await action.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(formBounds!.x);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
      formBounds!.x + formBounds!.width,
    );
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.screenshot({
    path: "test-results/marketplace-polish/booking-date-360.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Submit request", exact: true }),
  ).toBeVisible();
});

const categoryId = "11111111-1111-4111-8111-111111111111",
  serviceId = "22222222-2222-4222-8222-222222222222",
  requestId = "33333333-3333-4333-8333-333333333333";
const customer = {
  id: "44444444-4444-4444-8444-444444444444",
  customer_reference: "CUS-00001234",
  full_name: "Alex Kumar",
  email: "alex@example.com",
  phone_e164: "+919876543210",
  created_at: "2026-10-21",
};
const requestRecord = {
  id: requestId,
  customer_id: customer.id,
  request_number: "SR-EXPERIENCE-123",
  request_type: "SERVICE",
  appliance: "Air Conditioner",
  service_name: "General Service",
  appliance_category_id: categoryId,
  service_catalogue_id: serviceId,
  details: { description: "Please clean the filters" },
  address_snapshot: {
    name: customer.full_name,
    phone: "9876543210",
    line1: "12 Garden Street",
    area: "Adyar",
    city: "Chennai",
    state: "Tamil Nadu",
    pinCode: "600020",
  },
  preferred_date: "2099-10-25",
  preferred_time_window: "09:00-12:00",
  status: "REQUESTED",
  version: 1,
  created_at: "2026-10-21T10:00:00Z",
  completed_at: null,
  review_reminder_dismissed_at: null,
  review_id: null,
};
async function setup(
  page: Page,
  {
    completed = false,
    failSubmit = false,
  }: { completed?: boolean; failSubmit?: boolean } = {},
) {
  let request = {
    ...requestRecord,
    status: completed ? "COMPLETED" : "REQUESTED",
    completed_at: completed ? "2026-10-21T11:00:00Z" : null,
  };
  let review: object | null = null;
  let submissions = 0;
  await page.route("https://accounts.google.com/gsi/client*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: "window.google={accounts:{id:{initialize:function(){},renderButton:function(){},cancel:function(){}}}};",
    }),
  );
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    if (path.endsWith("/auth/customer/config"))
      return route.fulfill({
        json: { data: { clientId: "test.apps.googleusercontent.com" } },
      });
    if (path.endsWith("/profile") || path.endsWith("/auth/customer/me"))
      return route.fulfill({ json: { data: customer } });
    if (path.endsWith("/appliances"))
      return route.fulfill({
        json: {
          data: [
            {
              id: categoryId,
              name: "Air Conditioner",
              slug: "air-conditioner",
            },
          ],
        },
      });
    if (path.endsWith("/services") || path.endsWith("/installations"))
      return route.fulfill({
        json: {
          data: [{ id: serviceId, name: "General Service", form_fields: [] }],
        },
      });
    if (path.endsWith("/appointment-windows"))
      return route.fulfill({
        json: {
          data: [{ id: "09:00-12:00", label: "Morning · 9 AM to 12 PM" }],
        },
      });
    if (path.endsWith("/addresses"))
      return route.fulfill({ json: { data: [] } });
    if (path.endsWith("/locations/reverse-geocode"))
      return route.fulfill({
        json: {
          data: {
            area: "Adyar",
            city: "Chennai",
            state: "Tamil Nadu",
            pinCode: "600020",
          },
        },
      });
    if (path.endsWith("/requests/service") && method === "POST") {
      submissions++;
      if (failSubmit)
        return route.fulfill({
          status: 500,
          json: { error: { message: "Unable to save request" } },
        });
      const body = route.request().postDataJSON();
      request = {
        ...request,
        ...body,
        address_snapshot: body.address,
        preferred_date: body.preferredDate,
        preferred_time_window: body.preferredTimeWindow,
      };
      return route.fulfill({ status: 201, json: { data: request } });
    }
    if (path.endsWith("/review-reminder")) {
      request = {
        ...request,
        review_reminder_dismissed_at: "dismissed" as never,
      };
      return route.fulfill({ json: { data: request } });
    }
    if (path.endsWith("/review")) {
      if (method === "POST") {
        review = {
          id: "review-1",
          ...route.request().postDataJSON(),
          created_at: "2026-10-21",
        };
        return route.fulfill({ status: 201, json: { data: review } });
      }
      return route.fulfill({ json: { data: review } });
    }
    if (path.endsWith("/timeline"))
      return route.fulfill({
        json: {
          data: [
            {
              id: "event-1",
              status: request.status,
              note: "Request received",
              created_at: request.created_at,
            },
          ],
        },
      });
    if (path.endsWith(`/requests/${requestId}`))
      return route.fulfill({ json: { data: request } });
    if (path.endsWith("/requests"))
      return route.fulfill({ json: { data: [request] } });
    return route.fulfill({ json: { data: [] } });
  });
  return { submissions: () => submissions };
}
async function requirement(page: Page) {
  await page.goto(`/request/service?applianceCategoryId=${categoryId}`);
  await page
    .locator(".booking-service-card")
    .filter({
      has: page.getByRole("heading", { name: "General Service", exact: true }),
    })
    .getByRole("button", { name: "Book now", exact: true })
    .click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Location & contact", exact: true }),
  ).toBeVisible();
}
async function location(page: Page) {
  await page
    .getByLabel("House / street", { exact: true })
    .fill("12 Garden Street");
  await page.getByLabel("Area", { exact: true }).fill("Adyar");
  await page.getByLabel("City", { exact: true }).fill("Chennai");
  await page.getByLabel("State", { exact: true }).fill("Tamil Nadu");
  await page.getByLabel("PIN code", { exact: true }).fill("600020");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Later date", { exact: true }).fill("2099-10-25");
  await page
    .getByRole("button", { name: "Morning · 9 AM to 12 PM", exact: true })
    .click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
}
test("wizard preserves defaults, restores draft and confirms only a persisted submission", async ({
  page,
}) => {
  const state = await setup(page);
  await requirement(page);
  await expect(page.getByLabel("Contact name", { exact: true })).toHaveValue(
    customer.full_name,
  );
  await expect(page.getByLabel("Mobile number", { exact: true })).toHaveValue(
    "9876543210",
  );
  await page
    .getByLabel("House / street", { exact: true })
    .fill("Saved draft street");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page.reload();
  await expect(page.getByLabel("House / street", { exact: true })).toHaveValue(
    "",
  );
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    "Saved draft street",
  );
  await location(page);
  await page
    .getByRole("button", { name: "Submit request", exact: true })
    .click();
  await expect(page).toHaveURL(/\/bookings$/);
  await expect(
    page.getByText("Request submitted successfully!", { exact: true }),
  ).toBeVisible();
  expect(state.submissions()).toBe(1);
  await page.reload();
  await expect(
    page.getByText("Request submitted successfully!", { exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        Object.keys(localStorage).filter((key) =>
          key.startsWith("home-draft-v1:"),
        ).length,
    ),
  ).toBe(0);
});
test("failed submission keeps the review page and never shows a success banner", async ({
  page,
}) => {
  await setup(page, { failSubmit: true });
  await requirement(page);
  await location(page);
  await page
    .getByRole("button", { name: "Submit request", exact: true })
    .click();
  await expect(
    page.getByText("Unable to save request", { exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/request\/service/);
  await expect(
    page.getByText("Request submitted successfully!", { exact: true }),
  ).toHaveCount(0);
});
test("repeat request prefills appliance and address but clears the old visit", async ({
  page,
}) => {
  await setup(page);
  await page.goto(`/request/service?repeat=${requestId}`);
  await expect(
    page
      .locator(".booking-service-card")
      .filter({
        has: page.getByRole("heading", {
          name: "General Service",
          exact: true,
        }),
      })
      .getByRole("button", { name: "Selected", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByLabel("House / street", { exact: true })).toHaveValue(
    "12 Garden Street",
  );
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByLabel("Later date", { exact: true })).toHaveValue("");
});
test("location permission denial falls back to manual entry", async ({
  page,
}) => {
  await setup(page);
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition: (
          _success: unknown,
          error: (value: { code: number }) => void,
        ) => error({ code: 1 }),
      },
    }),
  );
  await requirement(page);
  await page
    .getByRole("button", { name: "Use My Current Location", exact: true })
    .click();
  await expect(
    page.getByText(
      "Location access was denied. You can enter your address manually.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByLabel("House / street", { exact: true }),
  ).toBeEditable();
});
test("current location fills approximate fields and leaves house number for confirmation", async ({
  page,
}) => {
  await setup(page);
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition: (
          success: (value: {
            coords: { latitude: number; longitude: number };
          }) => void,
        ) => success({ coords: { latitude: 13, longitude: 80 } }),
      },
    }),
  );
  await requirement(page);
  await page
    .getByRole("button", { name: "Use My Current Location", exact: true })
    .click();
  await expect(page.getByLabel("City", { exact: true })).toHaveValue("Chennai");
  await expect(page.getByLabel("House / street", { exact: true })).toHaveValue(
    "",
  );
});
test("feedback reminder dismissal survives reload and does not prevent a manual review", async ({
  page,
}) => {
  await setup(page, { completed: true });
  await page.goto("/bookings");
  await page.getByRole("button", { name: "Not now", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Not now", exact: true }),
  ).toHaveCount(0);
  await page.goto(`/requests/${requestId}`);
  await page
    .getByRole("button", { name: "Rate & Review", exact: true })
    .click();
  await page.getByRole("button", { name: "4 stars", exact: true }).click();
  await page.getByLabel(/Written feedback/).fill("Helpful and professional");
  await page
    .getByRole("button", { name: "Submit review", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your review", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Helpful and professional", { exact: true }),
  ).toBeVisible();
});
test("one-tap support carries the real request reference", async ({ page }) => {
  await setup(page);
  await page.goto(`/requests/${requestId}`);
  await page
    .getByRole("link", { name: "Contact support", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp(`requestId=${requestId}`));
  await expect(page.getByLabel("Subject", { exact: true })).toHaveValue(
    "Support for SR-EXPERIENCE-123",
  );
});
for (const width of [360, 390, 768, 1024, 1440])
  test(`responsive customer screens at ${width}px`, async ({ page }) => {
    await page.setViewportSize({
      width,
      height:
        width === 360 ? 800 : width === 390 ? 844 : width === 768 ? 1024 : 900,
    });
    await setup(page);
    for (const [path, name] of [
      ["/", "home"],
      ["/services", "appliances"],
      [`/request/service?applianceCategoryId=${categoryId}`, "wizard"],
      ["/bookings", "requests"],
      [`/requests/${requestId}`, "request-detail"],
      ["/profile", "profile"],
    ]) {
      await page.goto(path!);
      await expect(page.locator("h1").first()).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/screenshots/customer-${name}-${width}.png`,
        fullPage: true,
      });
    }
    await page.goto("/");
    await page.getByLabel("Language / மொழி").selectOption("ta");
    await expect(page.locator("h1").first()).toHaveText(
      new RegExp(
        "[" +
          String.fromCharCode(0x0b80) +
          "-" +
          String.fromCharCode(0x0bff) +
          "]",
      ),
    );
    await expect(page.locator("html")).toHaveAttribute("lang", "ta");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/screenshots/customer-tamil-${width}.png`,
      fullPage: true,
    });
  });
