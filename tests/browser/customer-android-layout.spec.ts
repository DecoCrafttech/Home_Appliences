import { test, expect, type Page } from "./fixtures";

const applianceId = "11111111-1111-4111-8111-111111111111";
const serviceId = "22222222-2222-4222-8222-222222222222";
const requestId = "33333333-3333-4333-8333-333333333333";
const profile = {
  id: "44444444-4444-4444-8444-444444444444",
  full_name: "Alex Kumar",
  email: "alex@example.com",
  phone_e164: "+919876543210",
};
const appliance = {
  id: applianceId,
  name: "Air Conditioner",
  slug: "air-conditioner",
  service_count: 1,
  catalogue_category_id: "home",
  category_name: "Home appliances",
};
const service = {
  id: serviceId,
  name: "General Service",
  description: "Clean and check your appliance",
  appliance_category_id: applianceId,
  request_type: "SERVICE",
  booking_options: [],
  form_fields: [],
};
const address = {
  id: "saved-address",
  label: "Home",
  recipient_name: profile.full_name,
  phone: profile.phone_e164,
  line1: "12 Garden Street",
  area: "Old area",
  city: "Chennai",
  state: "Tamil Nadu",
  pin_code: "600001",
  is_default: true,
};
const request = {
  id: requestId,
  customer_id: profile.id,
  request_number: "SR-12345",
  request_type: "SERVICE",
  appliance: appliance.name,
  service_name: service.name,
  appliance_category_id: applianceId,
  service_catalogue_id: serviceId,
  details: {},
  address_snapshot: {
    name: profile.full_name,
    phone: "9876543210",
    line1: address.line1,
    area: "Adyar",
    city: "Chennai",
    state: "Tamil Nadu",
    pinCode: "600020",
  },
  preferred_date: "2099-11-08",
  preferred_time_window: "09:00-12:00",
  status: "REQUESTED",
  version: 1,
  created_at: "2026-11-07T09:00:00Z",
  completed_at: null,
};

async function setup(page: Page, lookupFails = false) {
  const lookups: unknown[] = [];
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = [];
    if (path.endsWith("/auth/customer/config"))
      data = { clientId: null, adminOfficePhone: "+919876543210" };
    else if (path.endsWith("/profile")) data = profile;
    else if (path.endsWith("/catalogue/appliances"))
      data = [
        appliance,
        { ...appliance, id: "item-2", name: "Washing Machine" },
        { ...appliance, id: "item-3", name: "Refrigerator" },
      ];
    else if (
      path.includes("/catalogue/appliances/") &&
      path.endsWith("/services")
    )
      return route.fulfill({ json: { data: [service], meta: { appliance } } });
    else if (path.endsWith("/appliances")) data = [appliance];
    else if (path.endsWith("/services") || path.endsWith("/installations"))
      data = [service];
    else if (path.endsWith("/addresses")) data = [address];
    else if (path.endsWith("/appointment-windows"))
      data = [{ id: "09:00-12:00", label: "Morning" }];
    else if (path.endsWith("/locations/reverse-geocode")) {
      lookups.push(route.request().postDataJSON());
      if (lookupFails)
        return route.fulfill({
          status: 503,
          json: {
            error: {
              message:
                "Address lookup is not configured. Please enter your address manually",
            },
          },
        });
      data = {
        area: "Adyar",
        city: "Chennai",
        state: "Tamil Nadu",
        pinCode: "600020",
      };
    } else if (path.endsWith(`/requests/${requestId}`)) data = request;
    else if (path.endsWith("/requests")) data = [request];
    return route.fulfill({ json: { data } });
  });
  return lookups;
}
async function addressStep(page: Page) {
  await page.goto(
    `/request/service?applianceCategoryId=${applianceId}&serviceId=${serviceId}`,
  );
  await page
    .getByRole("heading", { name: "Service Request", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Location & contact", exact: true }),
  ).toBeVisible();
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
}

for (const width of [320, 360, 412]) {
  test(`compact Android layouts at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await setup(page);
    await page.goto("/book");
    await expect(page.locator(".booking-entry-card")).toHaveCount(2);
    expect(
      await page
        .locator(".booking-entry-grid")
        .evaluate(
          (e) => getComputedStyle(e).gridTemplateColumns.split(" ").length,
        ),
    ).toBe(2);
    await noOverflow(page);
    await page.screenshot({
      path: `test-results/customer-android/book-${width}.png`,
      fullPage: true,
    });
    await page.goto("/services");
    await expect(page.locator(".appliance-card")).toHaveCount(3);
    expect(
      await page
        .locator(".services-discovery .appliance-grid")
        .evaluate(
          (e) => getComputedStyle(e).gridTemplateColumns.split(" ").length,
        ),
    ).toBe(3);
    await expect(page.getByText("CARE FOR YOUR HOME")).toBeHidden();
    await noOverflow(page);
    await page.screenshot({
      path: `test-results/customer-android/services-${width}.png`,
      fullPage: true,
    });
    await page.locator(".appliance-card").first().click();
    await expect(
      page.getByRole("heading", { name: appliance.name, exact: true }),
    ).toBeVisible();
    await expect(page.getByText("All categories", { exact: true })).toHaveCount(
      0,
    );
    const back = await page.locator(".customer-back").boundingBox();
    const section = await page.locator(".services-discovery").boundingBox();
    expect(section!.y - back!.y - back!.height).toBeLessThanOrEqual(8);
    await noOverflow(page);
    await page.goto("/bookings");
    await expect(
      page.getByRole("button", { name: "Refresh requests" }),
    ).toBeVisible();
    for (const button of await page
      .locator(".request-status-tabs button")
      .all()) {
      expect(await button.evaluate((e) => getComputedStyle(e).whiteSpace)).toBe(
        "nowrap",
      );
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await page.getByRole("button", { name: "Completed", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Completed", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await noOverflow(page);
    await page.goto(`/requests/${requestId}`);
    const contact = page.locator(".request-priority-contact");
    await expect(
      contact.getByRole("link", { name: "Call Admin", exact: true }),
    ).toHaveAttribute("href", "tel:+919876543210");
    expect((await contact.boundingBox())!.y).toBeLessThan(
      (await page.locator(".request-detail-hero").boundingBox())!.y,
    );
    await noOverflow(page);
    await page.screenshot({
      path: `test-results/customer-android/details-${width}.png`,
      fullPage: true,
    });
    await addressStep(page);
    await noOverflow(page);
    const actions = await page.locator(".wizard-actions").boundingBox();
    const nav = await page.locator(".bottom-nav").boundingBox();
    expect(actions!.y + actions!.height).toBeLessThanOrEqual(nav!.y + 1);
    await expect(
      page.getByRole("button", { name: "Step 2: Address" }),
    ).toBeVisible();
  });
}

test("GPS fills editable saved address and booking controls stay above bottom navigation", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 13.0067, longitude: 80.257 });
  const lookups = await setup(page);
  await addressStep(page);
  await page.getByRole("button", { name: /Home.*12 Garden Street/ }).click();
  await page
    .getByRole("button", { name: "Use My Current Location", exact: true })
    .click();
  await expect(page.getByLabel("Area", { exact: true })).toHaveValue("Adyar");
  await expect(page.getByLabel("PIN code", { exact: true })).toHaveValue(
    "600020",
  );
  expect(lookups).toEqual([{ latitude: 13.0067, longitude: 80.257 }]);
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  const actions = await page.locator(".wizard-actions").boundingBox();
  const nav = await page.locator(".bottom-nav").boundingBox();
  expect(actions!.y + actions!.height).toBeLessThanOrEqual(nav!.y + 1);
  await expect(
    page.getByRole("button", { name: "Step 2: Address" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Step 3: Visit" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Preferred visit", exact: true }),
  ).toBeVisible();
  await page
    .locator(".visit-month-grid button:not([disabled])")
    .first()
    .click();
  // Scroll the visit fields above the fixed booking controls, as on a phone.
  await page
    .locator(".time-selector")
    .evaluate((element) =>
      element.scrollIntoView({ block: "center", behavior: "instant" }),
    );
  await page.screenshot({
    path: "test-results/customer-android/visit-360.png",
    fullPage: true,
  });
  await page.locator(".time-selector button").first().click({ timeout: 8000 });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Review & submit", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Step 4: Preview" }),
  ).toHaveAttribute("aria-current", "step");
  await expect(
    page.getByRole("button", { name: "Submit request", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Step 1: Service" }).click();
  await expect(
    page.getByRole("heading", { name: "Service Request", exact: true }),
  ).toBeVisible();
  await noOverflow(page);
  await page.screenshot({
    path: "test-results/customer-android/booking-360.png",
    fullPage: true,
  });
});

test("denied location stays actionable and does not call geocoder", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const lookups = await setup(page);
  await page.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = (_success, failure) =>
      failure?.({
        code: 1,
        message: "Denied",
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      });
  });
  await addressStep(page);
  await page
    .getByRole("button", { name: "Use My Current Location", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Location is blocked" }),
  ).toBeVisible();
  await expect(
    page.getByLabel("House / street", { exact: true }),
  ).toBeEditable();
  expect(lookups).toHaveLength(0);
});

test("network location retries GPS; geocoder failure preserves manual address entry", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const lookups = await setup(page, true);
  await page.addInitScript(() => {
    let calls = 0;
    navigator.geolocation.getCurrentPosition = (success, failure) => {
      if (++calls === 1)
        failure?.({
          code: 3,
          message: "Timeout",
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        });
      else
        success({
          coords: {
            latitude: 13,
            longitude: 80,
            accuracy: 10,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: Date.now(),
        } as GeolocationPosition);
    };
  });
  await addressStep(page);
  await page
    .getByRole("button", { name: "Use My Current Location", exact: true })
    .click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Address lookup is not configured" }),
  ).toBeVisible();
  expect(lookups).toEqual([{ latitude: 13, longitude: 80 }]);
  await expect(page.getByLabel("House / street", { exact: true })).toHaveValue(
    address.line1,
  );
  await expect(
    page.getByRole("button", { name: "Use My Current Location", exact: true }),
  ).toBeEnabled();
});
