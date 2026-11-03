import { test, expect, type Page } from "./fixtures";
const names = [
  "Air Conditioner",
  "Refrigerator",
  "Washing Machine",
  "Television",
  "Geyser",
  "Microwave",
  "Mixer Grinder",
  "Water Purifier",
  "Kitchen Chimney",
  "Dishwasher",
  "CCTV",
  "AirFiber and Internet",
  "Other Appliances",
];
const categories = names.map((name, index) => ({
  id: `a0000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  name,
  slug: name.toLowerCase().replaceAll(" ", "-"),
  kind: "APPLIANCE",
  service_count: 1,
}));
const services = categories.map((category) => ({
  id: category.id,
  name: `${category.name} Care`,
  appliance_name: category.name,
  appliance_category_id: category.id,
  request_type: "SERVICE",
  description: `Care for ${category.name}`,
  booking_options: [],
  form_fields: [],
}));
const maintenance = ["Electrical Work", "Plumbing Work", "Painting"].map(
  (name, index) => ({
    id: `b0000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    name,
    appliance_name: "Home Maintenance",
    appliance_category_id: "c0000000-0000-4000-8000-000000000001",
    category_kind: "MAINTENANCE",
    request_type: "SERVICE",
    description: "",
    booking_options: [],
    form_fields: [],
  }),
);
async function setup(page: Page) {
  await page.route("https://accounts.google.com/**", (route) => route.abort());
  await page.route("**/api/v1/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    const data = (value: unknown, extra: object = {}) =>
      route.fulfill({ json: { data: value, ...extra } });
    if (path.endsWith("/auth/customer/config"))
      return data({ clientId: null, adminOfficePhone: null });
    if (path.endsWith("/profile"))
      return data({
        id: categories[0]!.id,
        full_name: "Priya",
        phone_e164: "+919876543210",
        email: "qa@example.com",
      });
    if (path.endsWith("/catalogue/appliances") || path.endsWith("/appliances"))
      return data(categories);
    const category = categories.find((category) =>
      path.endsWith(`/catalogue/appliances/${category.id}/services`),
    );
    if (category)
      return data(
        services.filter(
          (service) => service.appliance_category_id === category.id,
        ),
        { meta: { appliance: category } },
      );
    if (path.endsWith("/catalogue")) return data([...services, ...maintenance]);
    return data([]);
  });
}
for (const width of [360, 390, 430, 1440])
  test(`customer category images, maintenance navigation and appliance images at ${width}px`, async ({
    page,
  }) => {
    await setup(page);
    await page.setViewportSize({ width, height: 950 });
    await page.goto("http://localhost:5173/");
    for (const name of [
      "Home Maintenance",
      "Electrical Work",
      "Plumbing Work",
      "Painting",
    ])
      await expect(page.getByText(name, { exact: true })).toHaveCount(0);
    await expect(page.locator(".home-action-photo")).toHaveCount(3);
    await expect(page.locator(".v6-hero-art img")).toHaveCount(1);
    await expect(page.locator(".v6-hero-art img")).toHaveAttribute(
      "src",
      "/banners/v8/appliance-family.webp",
    );
    await expect
      .poll(() =>
        page
          .locator(".home-action-photo")
          .evaluateAll((images) =>
            images.every(
              (image) =>
                (image as HTMLImageElement).complete &&
                (image as HTMLImageElement).naturalWidth > 0,
            ),
          ),
      )
      .toBe(true);
    for (const image of await page.locator(".home-action-photo").all())
      await expect(image).toHaveAttribute(
        "src",
        /\/categories\/v8\/(service|installation|maintenance)\.webp$/,
      );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/customer-images/home-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole("navigation", { name: "Quick actions" })
      .getByRole("link", { name: "Maintenance", exact: true })
      .click();
    for (const name of ["Electrical Work", "Plumbing Work", "Painting"])
      await expect(
        page.getByRole("link", { name: `Book ${name}`, exact: true }),
      ).toBeVisible();
    await page
      .getByRole("link", { name: "Services & Installation", exact: true })
      .click();
    await expect(page.locator(".appliance-card")).toHaveCount(11);
    await expect(
      page.getByRole("link", {
        name: "View Other Appliances services",
        exact: true,
      }),
    ).toHaveCount(0);
    for (const card of await page.locator(".appliance-card").all()) {
      await card.scrollIntoViewIfNeeded();
      await expect(card.locator("img")).toHaveAttribute(
        "src",
        /\/appliances\/v8\/[a-z-]+\.webp$/,
      );
      await expect
        .poll(() =>
          card
            .locator("img")
            .evaluate(
              (image) =>
                (image as HTMLImageElement).complete &&
                (image as HTMLImageElement).naturalWidth > 0,
            ),
        )
        .toBe(true);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/customer-images/appliances-${width}.png`,
      fullPage: true,
    });
  });
test("each appliance opens its own services and Other is absent from booking choices", async ({
  page,
}) => {
  await setup(page);
  for (const category of categories.filter(
    (category) =>
      category.name !== "Other Appliances" && category.name !== "Mixer Grinder",
  )) {
    await page.goto("http://localhost:5173/services");
    await page
      .getByRole("link", {
        name: `View ${category.name} services`,
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("heading", { name: category.name, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", {
        name: `Book ${category.name} Care`,
        exact: true,
      }),
    ).toHaveAttribute("href", new RegExp(`applianceCategoryId=${category.id}`));
  }
  await page.goto("http://localhost:5173/request/service");
  await expect(
    page.getByRole("button", { name: "Air Conditioner", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Other Appliances", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Mixer Grinder", exact: true }),
  ).toHaveCount(0);
});

test("customer and admin use identical transparent appliance images and hide Mixer Grinder", async ({
  page,
  request,
}) => {
  await setup(page);
  await page.route("**/api/v1/admin/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/me"))
      return route.fulfill({
        json: {
          data: {
            id: categories[0]!.id,
            full_name: "QA Admin",
            username: "qa",
            role: "ADMIN",
          },
        },
      });
    if (path.endsWith("/catalogue"))
      return route.fulfill({ json: { data: { categories, services } } });
    return route.fulfill({ json: { data: [] } });
  });
  await page.goto("http://127.0.0.1:5174/catalogue");
  await expect(
    page
      .locator(".catalogue-category-tile")
      .filter({ hasText: "Mixer Grinder" }),
  ).toHaveCount(0);
  const image = page
    .locator(".catalogue-category-tile")
    .filter({ hasText: "Air Conditioner" })
    .locator("img");
  await expect(image).toHaveAttribute(
    "src",
    "/appliances/v8/air-conditioner.webp",
  );
  for (const key of [
    "air-conditioner",
    "refrigerator",
    "washing-machine",
    "television",
    "water-heater",
    "microwave",
    "water-purifier",
    "kitchen-chimney",
    "dishwasher",
    "cctv",
    "internet",
  ]) {
    const path = `/appliances/v8/${key}.webp`;
    const customer = await request.get(`http://localhost:5173${path}`),
      admin = await request.get(`http://127.0.0.1:5174${path}`);
    expect(customer.ok()).toBe(true);
    expect(admin.ok()).toBe(true);
    expect((await customer.body()).equals(await admin.body())).toBe(true);
  }
  await page.goto("http://localhost:5173/");
  const paths = [
    "/categories/v8/service.webp",
    "/categories/v8/installation.webp",
    "/categories/v8/maintenance.webp",
    "/banners/v8/appliance-family.webp",
    "/appliances/v8/air-conditioner.webp",
  ];
  const transparency = await page.evaluate(
    async (paths) =>
      Promise.all(
        paths.map(async (path) => {
          const image = new Image();
          image.src = path;
          await image.decode();
          const canvas = document.createElement("canvas");
          canvas.width = 100;
          canvas.height = 100;
          const context = canvas.getContext("2d")!;
          context.drawImage(image, 0, 0, 100, 100);
          const pixels = context.getImageData(0, 0, 100, 100).data;
          let transparent = 0,
            solid = 0;
          for (let i = 3; i < pixels.length; i += 4) {
            if (pixels[i] < 10) transparent++;
            if (pixels[i] > 245) solid++;
          }
          return { path, corner: pixels[3], transparent, solid };
        }),
      ),
    paths,
  );
  for (const result of transparency) {
    expect(result.corner, result.path).toBe(0);
    expect(result.transparent, result.path).toBeGreaterThan(1000);
    expect(result.solid, result.path).toBeGreaterThan(100);
  }
  const colors = await page
    .locator(".home-action")
    .evaluateAll((cards) =>
      cards.map((card) => getComputedStyle(card).backgroundImage),
    );
  expect(new Set(colors).size).toBe(3);
});
