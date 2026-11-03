import { test, expect, type Page } from "./fixtures";

const labels = [
  "Air Conditioner",
  "Refrigerator",
  "Washing Machine",
  "Television",
  "Water Heater",
  "Microwave Oven",
  "Mixer Grinder",
  "Water Purifier / RO",
  "Kitchen Chimney",
  "Dishwasher",
  "Other Appliances",
];
const categories = labels.map((name, i) => ({
  id: `c0000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
  name,
  slug: name.toLowerCase().replaceAll(" ", "-"),
  service_count: 3,
}));
const profile = {
  id: "a0000000-0000-4000-8000-000000000001",
  full_name: "Priya Customer",
  email: "priya@example.com",
  phone_e164: "+919876543210",
};
function services(category: (typeof categories)[number]) {
  return ["General Service", "Cooling Repair", "Installation"].map(
    (name, i) => ({
      id: `d0000000-0000-4000-8000-${String(categories.indexOf(category) * 3 + i + 1).padStart(12, "0")}`,
      name: `${category.name} ${name}`,
      appliance_category_id: category.id,
      appliance_name: category.name,
      description:
        i === 1
          ? "Describe the cooling issue for diagnosis."
          : `Request ${name.toLowerCase()} for your appliance.`,
      request_type: i === 2 ? "INSTALLATION" : "SERVICE",
      booking_options: [],
      form_fields: [],
    }),
  );
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function setup(
  page: Page,
  options: {
    profileGate?: ReturnType<typeof deferred>;
    catalogueGate?: ReturnType<typeof deferred>;
    catalogueFail?: boolean;
    authFail?: boolean;
  } = {},
) {
  const requests: string[] = [];
  await page.route("https://accounts.google.com/**", (route) => route.abort());
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    requests.push(path);
    if (path.endsWith("/auth/customer/config"))
      return route.fulfill({ json: { data: { clientId: null } } });
    if (path.endsWith("/profile")) {
      await options.profileGate?.promise;
      return options.authFail
        ? route.fulfill({
            status: 503,
            json: { error: { message: "Account service unavailable" } },
          })
        : route.fulfill({ json: { data: profile } });
    }
    if (path.endsWith("/catalogue/appliances")) {
      await options.catalogueGate?.promise;
      return options.catalogueFail
        ? route.fulfill({
            status: 503,
            json: { error: { message: "Catalogue temporarily unavailable" } },
          })
        : route.fulfill({ json: { data: categories } });
    }
    const category = categories.find((category) =>
      path.endsWith(`/catalogue/appliances/${category.id}/services`),
    );
    if (category)
      return route.fulfill({
        json: { data: services(category), meta: { appliance: category } },
      });
    if (path.endsWith("/catalogue"))
      return route.fulfill({ json: { data: categories.flatMap(services) } });
    if (path.endsWith("/appliances"))
      return route.fulfill({ json: { data: categories } });
    if (path.endsWith("/services") || path.endsWith("/installations")) {
      const categoryId = new URL(route.request().url()).searchParams.get(
        "applianceCategoryId",
      );
      const category = categories.find(
        (category) => category.id === categoryId,
      );
      return route.fulfill({
        json: {
          data: category
            ? services(category).filter(
                (service) =>
                  service.request_type ===
                  (path.endsWith("/installations")
                    ? "INSTALLATION"
                    : "SERVICE"),
              )
            : [],
        },
      });
    }
    if (path.endsWith("/appointment-windows"))
      return route.fulfill({
        json: {
          data: [
            { id: "08:00-12:00", label: "08:00-12:00" },
            { id: "13:00-17:00", label: "13:00-17:00" },
            { id: "18:00-21:00", label: "18:00-21:00" },
          ],
        },
      });
    return route.fulfill({
      json: {
        data: [],
        meta: { unreadCount: 0, fetchedAt: new Date().toISOString() },
      },
    });
  });
  return requests;
}

for (const width of [320, 360, 375, 390, 430, 768, 1440]) {
  test(`V6 image-first Home, catalogue and service layout at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page);
    await page.goto("/");
    await expect(page.locator(".home-welcome h1")).toContainText("Priya");
    await page.evaluate(() => document.fonts.ready.then(() => true));
    expect(
      await page.evaluate(() =>
        Array.from(document.fonts).some(
          (font) => font.family === "Inter" && font.status === "loaded",
        ),
      ),
    ).toBe(true);
    await expect(
      page.getByRole("searchbox", { name: "Search appliances and services" }),
    ).toBeVisible();
    await expect(page.locator(".home-discovery .appliance-card h2")).toHaveText(
      labels.slice(0, 4),
    );
    await expect
      .poll(() =>
        page
          .locator(".home-discovery img")
          .evaluateAll((images) =>
            images.every(
              (image) =>
                (image as HTMLImageElement).complete &&
                (image as HTMLImageElement).naturalWidth === 640,
            ),
          ),
      )
      .toBe(true);
    await expect(page.locator(".bottom-nav a")).toHaveText([
      "Home",
      "Services",
      "+ Book",
      "My Requests",
      "Profile",
    ]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        Array.from(document.images)
          .filter((image) => image.complete && image.naturalWidth > 0)
          .map((image) => image.decode().catch(() => undefined)),
      );
      window.scrollTo(0, 0);
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    });
    await page.screenshot({
      path: `test-results/fixbeez-v6/home-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("link", { name: "View All", exact: true }).click();
    await expect(page.locator(".appliance-card h2")).toHaveText(labels);
    if (width < 900)
      expect(
        await page
          .locator(".appliance-grid")
          .evaluate(
            (grid) =>
              getComputedStyle(grid).gridTemplateColumns.split(" ").length,
          ),
      ).toBe(2);
    await page.locator(".appliance-card").last().scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        page
          .locator(".appliance-card img")
          .evaluateAll((images) =>
            images.every(
              (image) =>
                (image as HTMLImageElement).complete &&
                (image as HTMLImageElement).naturalWidth === 640,
            ),
          ),
      )
      .toBe(true);
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        Array.from(document.images)
          .filter((image) => image.complete && image.naturalWidth > 0)
          .map((image) => image.decode().catch(() => undefined)),
      );
      window.scrollTo(0, 0);
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    });
    await page.screenshot({
      path: `test-results/fixbeez-v6/catalogue-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole("link", { name: "View Air Conditioner services", exact: true })
      .click();
    await expect(page.locator(".service-option")).toHaveCount(3);
    expect(
      await page
        .locator(".service-option")
        .first()
        .evaluate((card) => getComputedStyle(card).backgroundImage),
    ).toBe("none");
    const paths = await page
      .locator(".service-option-icon svg path")
      .evaluateAll((paths) => paths.map((path) => path.getAttribute("d")));
    expect(new Set(paths).size).toBeGreaterThanOrEqual(2);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        Array.from(document.images)
          .filter((image) => image.complete && image.naturalWidth > 0)
          .map((image) => image.decode().catch(() => undefined)),
      );
      window.scrollTo(0, 0);
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    });
    await page.screenshot({
      path: `test-results/fixbeez-v6/services-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole("link", {
        name: "Book Air Conditioner General Service",
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(
      new RegExp(
        `/request/service\\?applianceCategoryId=${categories[0]!.id}&serviceId=`,
      ),
    );
    await expect(page.getByLabel(/Short description/)).toBeVisible();
  });
}

test("Home search filters real services and does not fetch the full catalogue while idle", async ({
  page,
}) => {
  const requests = await setup(page);
  await page.goto("/");
  await expect(page.locator(".home-discovery .appliance-card")).toHaveCount(4);
  expect(requests.filter((path) => path.endsWith("/catalogue"))).toHaveLength(
    0,
  );
  await page
    .getByRole("searchbox", { name: "Search appliances and services" })
    .fill("Air Conditioner Cooling");
  await expect(page.locator(".v6-search-results .service-option")).toHaveCount(
    1,
  );
  await expect(
    page.getByRole("link", {
      name: "Book Air Conditioner Cooling Repair",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .locator(".v6-home-search")
    .getByRole("button", { name: "Clear search", exact: true })
    .click();
  await expect(page.locator(".v6-search-results")).toHaveCount(0);
  await expect(page.locator(".home-discovery .appliance-card")).toHaveCount(4);
  expect(requests.filter((path) => path.endsWith("/catalogue"))).toHaveLength(
    1,
  );
});

test("appliance skeletons use solid grey with no shimmer and match the loaded grid", async ({
  page,
}) => {
  const gate = deferred();
  await page.setViewportSize({ width: 390, height: 900 });
  await setup(page, { catalogueGate: gate });
  await page.goto("/");
  await expect(page.locator(".v6-appliance-skeleton")).toHaveCount(4);
  const height = await page
    .locator(".v6-appliance-grid-skeleton")
    .evaluate((element) => element.getBoundingClientRect().height);
  const styles = await page.locator(".app-skeleton").evaluateAll((elements) =>
    elements.map((element) => {
      const style = getComputedStyle(element);
      return {
        background: style.backgroundColor,
        image: style.backgroundImage,
        animation: style.animationName,
      };
    }),
  );
  expect(
    styles.every(
      (style) =>
        style.background === "rgb(241, 242, 244)" &&
        style.image === "none" &&
        style.animation === "skeleton-pulse",
    ),
  ).toBe(true);
  await expect(
    page.getByRole("heading", { name: "No appliances available yet" }),
  ).toHaveCount(0);
  await page.screenshot({
    path: "test-results/fixbeez-v6/skeletons.png",
    fullPage: true,
  });
  gate.resolve();
  await expect(page.locator(".home-discovery .appliance-card")).toHaveCount(4);
  const loadedHeight = await page
    .locator(".home-discovery .appliance-grid")
    .evaluate((element) => element.getBoundingClientRect().height);
  expect(Math.abs(height - loadedHeight)).toBeLessThan(16);
});

test("empty requests, completed requests, feedback and notifications use relevant states", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/bookings");
  await expect(page.locator('[data-empty-kind="requests"]')).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Book a Service", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Completed", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No completed services yet" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "View Requests", exact: true })
    .click();
  await page.goto("/reviews");
  await expect(page.locator('[data-empty-kind="feedback"]')).toBeVisible();
  await page.getByRole("button", { name: /^Notifications/ }).click();
  await expect(page.locator('[data-empty-kind="notifications"]')).toBeVisible();
});

test("catalogue network failure is distinct from an empty catalogue and can retry", async ({
  page,
}) => {
  const options = { catalogueFail: true };
  await setup(page, options);
  await page.goto("/services");
  await expect(page.locator('[data-empty-kind="network"]')).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "No appliances available yet" }),
  ).toHaveCount(0);
  options.catalogueFail = false;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.locator(".appliance-card")).toHaveCount(11);
});

test("reduced-motion splash waits for authentication without flashing Sign In or repeating on navigation", async ({
  page,
}) => {
  await page.addInitScript(() => {
    sessionStorage.removeItem("fixbeez.customer.launched.v1");
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const gate = deferred();
  const requests = await setup(page, { profileGate: gate });
  await page.goto("/");
  await expect(page.locator(".fb-launch--splash")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Sign in", exact: true }),
  ).toHaveCount(0);
  expect(
    await page
      .locator(".fb-launch")
      .evaluate((element) => getComputedStyle(element).backgroundColor),
  ).toBe("rgb(255, 255, 255)");
  await page.screenshot({
    path: "test-results/fixbeez-v6/splash.png",
    fullPage: true,
  });
  gate.resolve();
  await expect(page.locator(".home-welcome h1")).toContainText("Priya");
  await page.getByRole("link", { name: "View All", exact: true }).click();
  await expect(page.locator(".fb-launch")).toHaveCount(0);
  expect(requests.filter((path) => path.endsWith("/profile"))).toHaveLength(1);
});

test("normal cold-launch animation completes once before revealing the restored account", async ({
  page,
}) => {
  await page.addInitScript(() => {
    sessionStorage.removeItem("fixbeez.customer.launched.v1");
  });
  const gate = deferred();
  await setup(page, { profileGate: gate });
  await page.goto("/");
  await expect(page.locator(".fb-launch--splash")).toBeVisible();
  expect(
    await page
      .locator(".fb-launch__logo")
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe("v6-logo-in");
  await page.waitForTimeout(1250);
  expect(
    await page
      .locator(".fb-launch__tagline")
      .evaluate((element) => getComputedStyle(element).opacity),
  ).toBe("1");
  await expect(
    page.getByRole("link", { name: "Sign in", exact: true }),
  ).toHaveCount(0);
  gate.resolve();
  await expect(page.locator(".home-welcome h1")).toContainText("Priya");
  await page.getByRole("link", { name: "View All", exact: true }).click();
  await expect(page.locator(".fb-launch")).toHaveCount(0);
});

test("auth network failure offers recovery instead of pretending the user is signed out", async ({
  page,
}) => {
  await setup(page, { authFail: true });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Retry connection" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Sign in", exact: true }),
  ).toHaveCount(0);
});

test("a saved draft cannot override a different appliance selected from its services list", async ({
  page,
}) => {
  await setup(page);
  await page.goto(
    `/request/service?applianceCategoryId=${categories[0]!.id}&serviceId=${services(categories[0]!)[0]!.id}`,
  );
  await page
    .getByLabel(/Short description/)
    .fill("Keep this air conditioner draft");
  await page
    .getByRole("link", { name: "Services", exact: true })
    .last()
    .click();
  await page
    .getByRole("dialog", { name: "Leave this request?" })
    .getByRole("button", { name: "Save Draft", exact: true })
    .click();
  await page
    .getByRole("link", { name: "View Refrigerator services", exact: true })
    .click();
  await page
    .getByRole("link", {
      name: "Book Refrigerator General Service",
      exact: true,
    })
    .click();
  await expect(page.getByLabel(/Short description/)).toHaveValue("");
  await expect(page).toHaveURL(
    new RegExp(
      `applianceCategoryId=${categories[1]!.id}&serviceId=${services(categories[1]!)[0]!.id}`,
    ),
  );
  await page
    .getByLabel(/Short description/)
    .fill("The refrigerator needs attention");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Location & contact", exact: true }),
  ).toBeVisible();
});
