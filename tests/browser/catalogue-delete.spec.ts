import { test, expect, type Page } from "./fixtures";
const category = "11111111-1111-4111-8111-111111111111";
const items = [
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "General Service",
    request_type: "SERVICE",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    name: "New Installation",
    request_type: "INSTALLATION",
  },
];
async function setup(page: Page, role = "ADMIN") {
  const state = {
    writes: 0,
    keys: [] as string[],
    failure: true,
    removed: [] as string[],
  };
  await page.route("**/api/v1/admin/**", async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname;
    if (path.endsWith("/auth/me"))
      return route.fulfill({
        json: {
          data: { id: category, full_name: "QA Admin", username: "qa", role },
        },
      });
    if (request.method() === "DELETE") {
      state.writes++;
      state.keys.push(request.headers()["idempotency-key"] || "");
      await new Promise((resolve) => setTimeout(resolve, 250));
      if (state.failure)
        return route.fulfill({
          status: 503,
          json: { error: { message: "Unable to delete. Try again." } },
        });
      state.removed.push(path.split("/").at(-1)!);
      return route.fulfill({ status: 204 });
    }
    if (path.endsWith("/catalogue"))
      return route.fulfill({
        json: {
          data: {
            categories: [
              {
                id: category,
                name: "Air Conditioner",
                kind: "APPLIANCE",
                publication_status: "PUBLISHED",
              },
            ],
            services: items
              .filter((item) => !state.removed.includes(item.id))
              .map((item) => ({
                ...item,
                appliance_category_id: category,
                appliance_name: "Air Conditioner",
                publication_status: "PUBLISHED",
                form_fields: [],
                booking_options: [],
              })),
          },
        },
      });
    return route.fulfill({ json: { data: [] } });
  });
  return state;
}
for (const width of [360, 390, 430, 1440])
  test(`admin service and installation deletion recovers safely at ${width}px`, async ({
    page,
  }) => {
    const state = await setup(page);
    await page.setViewportSize({ width, height: 950 });
    await page.goto("http://127.0.0.1:5174/catalogue");
    await page
      .locator(".catalogue-category-tile")
      .getByRole("button", { name: "Edit", exact: true })
      .click();
    for (const item of items) {
      state.failure = true;
      const trigger = page.getByRole("button", {
        name: `Delete ${item.name}`,
        exact: true,
      });
      await trigger.click();
      let dialog = page.getByRole("dialog", {
        name: "Delete catalogue item?",
        exact: true,
      });
      await expect(dialog).toContainText(item.name);
      const before = state.writes;
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
      expect(state.writes).toBe(before);
      await expect(trigger).toBeFocused();
      await trigger.click();
      dialog = page.getByRole("dialog", {
        name: "Delete catalogue item?",
        exact: true,
      });
      const confirm = dialog.getByRole("button", {
        name: "Delete item",
        exact: true,
      });
      await confirm.evaluate((button) => {
        for (let index = 0; index < 3; index++)
          (button as HTMLButtonElement).click();
      });
      await expect(dialog.getByRole("alert")).toHaveText(
        "Unable to delete. Try again.",
      );
      expect(state.writes).toBe(before + 1);
      await expect(trigger).toHaveCount(1);
      state.failure = false;
      await confirm.click();
      await expect(dialog).toHaveCount(0);
      expect(state.writes).toBe(before + 2);
      expect(state.keys.at(-1)).toBe(state.keys.at(-2));
      expect(state.keys.at(-1)).not.toBe("");
      await expect(trigger).toHaveCount(0);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  });
test("read-only admin roles do not receive catalogue delete controls", async ({
  page,
}) => {
  await setup(page, "SUPPORT_AGENT");
  await page.goto("http://127.0.0.1:5174/catalogue");
  await page
    .locator(".catalogue-category-tile")
    .getByRole("button", { name: "View", exact: true })
    .click();
  await expect(page.getByRole("button", { name: /^Delete / })).toHaveCount(0);
});
