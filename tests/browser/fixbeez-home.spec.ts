import { test, expect, type Page } from "./fixtures";

const names = [
  "Air Conditioner",
  "Refrigerator",
  "Washing Machine",
  "Television",
  "Water Heater",
  "Microwave Oven",
  "Mixer Grinder",
  "Other Appliances",
];
const backendNames = [
  "Air Conditioner",
  "Refrigerator",
  "Washing Machine",
  "Television",
  "Geyser",
  "Microwave",
  "Mixer Grinder",
  "Other Appliances",
];
const categories = backendNames.map((name, i) => ({
  id: `11111111-1111-4111-8111-${String(i + 1).padStart(12, "0")}`,
  name,
  slug: name.toLowerCase().replaceAll(" ", "-"),
  service_count: 1,
}));
const serviceId = "22222222-2222-4222-8222-222222222222";
async function setup(page: Page, missingMixer = false) {
  const requests: string[] = [];
  await page.route("https://accounts.google.com/**", (route) => route.abort());
  await page.route("**/api/v1/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    requests.push(path);
    if (path.endsWith("/auth/customer/config"))
      return route.fulfill({ json: { data: { clientId: null } } });
    if (path.endsWith("/profile"))
      return route.fulfill({
        json: {
          data: {
            id: serviceId,
            full_name: "Priya Customer",
            email: "priya@example.com",
            phone_e164: "+919876543210",
          },
        },
      });
    if (path.endsWith("/catalogue/appliances"))
      return route.fulfill({
        json: {
          data: categories.filter(
            (category) => !missingMixer || category.name !== "Mixer Grinder",
          ),
        },
      });
    const category = categories.find((category) =>
      path.endsWith(`/catalogue/appliances/${category.id}/services`),
    );
    if (category)
      return route.fulfill({
        json: {
          data: [
            {
              id: serviceId,
              name: `${category.name} Care`,
              appliance_category_id: category.id,
              appliance_name: category.name,
              request_type: "SERVICE",
              booking_options: [],
            },
          ],
          meta: { appliance: category },
        },
      });
    return route.fulfill({ json: { data: [] } });
  });
  return requests;
}

for (const width of [360, 390, 430, 1440]) {
  test(`redesigned customer home and appliance destinations at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const requests = await setup(page);
    await page.goto("/");
    await expect(page.locator(".home-welcome h1")).toContainText("Priya");
    await expect(page.locator(".home-hero, .fb-home-promo")).toHaveCount(0);
    await expect(page.locator(".home-promo")).toHaveCount(1);
    await expect(
      page.getByRole("navigation", { name: "Quick actions" }).locator("strong"),
    ).toHaveText(["Service Request", "Installation Request", "Help & Support"]);
    await expect(page.locator(".home-discovery .appliance-card h2")).toHaveText(
      names.slice(0, 4),
    );
    await expect(page.locator(".bottom-nav a")).toHaveText([
      "Home",
      "Services",
      "+ Book",
      "My Requests",
      "Profile",
    ]);
    await expect
      .poll(() =>
        page
          .locator(".home-discovery .appliance-photo")
          .evaluateAll((images) =>
            images.every(
              (image) =>
                (image as HTMLImageElement).complete &&
                (image as HTMLImageElement).naturalWidth > 0,
            ),
          ),
      )
      .toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    expect(
      await page
        .locator(".home-header")
        .evaluate(
          (header) => getComputedStyle(header, "::before").backgroundRepeat,
        ),
    ).toBe("no-repeat");
    await page.screenshot({
      path: `test-results/fixbeez-home/home-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("link", { name: "View All", exact: true }).click();
    for (let i = 0; i < names.length; i++) {
      await page
        .getByRole("link", { name: `View ${names[i]} services`, exact: true })
        .click();
      await expect(page).toHaveURL(
        new RegExp(`/services/appliances/${categories[i]!.id}$`),
      );
      await expect(
        page.getByRole("heading", { name: backendNames[i], exact: true }),
      ).toBeVisible();
      const booking = page.getByRole("link", {
        name: `Book ${backendNames[i]} Care`,
        exact: true,
      });
      await expect(booking).toHaveAttribute(
        "href",
        `/request/service?applianceCategoryId=${categories[i]!.id}&serviceId=${serviceId}`,
      );
      await page.goBack();
      await expect(page.locator(".appliance-card")).toHaveCount(11);
    }
    expect(requests.filter((path) => path.endsWith("/services"))).toHaveLength(
      8,
    );
  });
}

test("an unconfigured appliance shows an honest empty page without a fake API ID", async ({
  page,
}) => {
  const requests = await setup(page, true);
  await page.goto("/services");
  await page
    .getByRole("link", { name: "View Mixer Grinder services", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Mixer Grinder", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "No services listed yet" }),
  ).toBeVisible();
  expect(requests.some((path) => path.includes("unlisted-"))).toBe(false);
});
