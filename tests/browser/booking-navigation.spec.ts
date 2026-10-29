import { test, expect, type Page } from "@playwright/test";
const category = "11111111-1111-4111-8111-111111111111",
  service = "22222222-2222-4222-8222-222222222222";
async function start(page: Page, selectService = true) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/v1/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/customer/config"))
      return route.fulfill({ json: { data: { clientId: null } } });
    if (path.endsWith("/profile"))
      return route.fulfill({
        json: {
          data: {
            id: category,
            full_name: "Draft QA Customer",
            phone_e164: "+919876543210",
            email: "draft@example.com",
            created_at: "2026-10-01T00:00:00Z",
          },
        },
      });
    if (path.endsWith("/appliances"))
      return route.fulfill({
        json: { data: [{ id: category, name: "Air Conditioner" }] },
      });
    if (path.endsWith("/catalogue"))
      return route.fulfill({
        json: {
          data: [
            {
              id: service,
              name: "Draft Care",
              appliance_name: "Air Conditioner",
              appliance_category_id: category,
              request_type: "SERVICE",
              description: "QA service",
              booking_options: [],
              form_fields: [],
            },
          ],
        },
      });
    if (path.includes("/catalogue/appliances/") && path.endsWith("/services"))
      return route.fulfill({
        json: {
          data: [
            {
              id: service,
              name: "Draft Care",
              appliance_name: "Air Conditioner",
              appliance_category_id: category,
              request_type: "SERVICE",
              description: "QA service",
              booking_options: [],
              form_fields: [],
            },
          ],
          meta: { appliance: { id: category, name: "Air Conditioner" } },
        },
      });
    if (path.endsWith("/services"))
      return route.fulfill({
        json: {
          data: [
            {
              id: service,
              name: "Draft Care",
              booking_options: [],
              form_fields: [],
            },
          ],
        },
      });
    if (path.endsWith("/addresses"))
      return route.fulfill({
        json: {
          data: [
            {
              id: service,
              label: "Home",
              recipient_name: "Draft QA Customer",
              phone: "9876543210",
              line1: "Private street 123",
              area: "Adyar",
              city: "Chennai",
              state: "Tamil Nadu",
              pin_code: "600020",
              is_default: true,
            },
          ],
        },
      });
    return route.fulfill({ json: { data: [] } });
  });
  await page.goto("http://localhost:5173/");
  await page.getByRole("link", { name: "Repair an appliance" }).click();
  if (!selectService) return;
  await page.getByRole("button", { name: /Air Conditioner/ }).click();
  await page
    .locator(".booking-service-card")
    .filter({ hasText: "Draft Care" })
    .getByRole("button", { name: "Book now" })
    .click();
  await expect(page.getByLabel(/Short description/)).toBeVisible();
}
test("unchanged defaults do not block harmless booking navigation", async ({
  page,
}) => {
  await start(page, false);
  await page.getByRole("link", { name: "Profile", exact: true }).last().click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("browser Back preserves editing, drafts omit contact details, and discard requires confirmation", async ({
  page,
}) => {
  await start(page);
  await page
    .getByLabel(/Short description/)
    .fill("Keep this requirement in my draft");
  await page.goBack();
  let dialog = page.getByRole("dialog", { name: "Leave this request?" });
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", { name: "Continue Editing", exact: true })
    .click();
  await expect(page.getByLabel(/Short description/)).toHaveValue(
    "Keep this requirement in my draft",
  );
  await page
    .getByRole("link", { name: "Services", exact: true })
    .last()
    .click();
  dialog = page.getByRole("dialog", { name: "Leave this request?" });
  await dialog.getByRole("button", { name: "Save Draft", exact: true }).click();
  await expect(page).toHaveURL(/\/services$/);
  const stored = await page.evaluate(() =>
    Object.entries(localStorage)
      .filter(([key]) => key.startsWith("home-draft-v1:"))
      .map(([, value]) => value),
  );
  expect(stored).toHaveLength(1);
  expect(stored[0]).toContain("Keep this requirement");
  expect(stored[0]).not.toContain("Private street 123");
  expect(stored[0]).not.toContain("9876543210");
  await page.getByRole("link", { name: "Home", exact: true }).last().click();
  await page.getByRole("link", { name: /Continue your draft/ }).click();
  await expect(page.getByLabel(/Short description/)).toHaveValue(
    "Keep this requirement in my draft",
  );
  await page
    .getByRole("button", { name: "Discard draft", exact: true })
    .click();
  dialog = page.getByRole("dialog", { name: "Discard this draft?" });
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", { name: "Discard Changes", exact: true })
    .click();
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((key) =>
        key.startsWith("home-draft-v1:"),
      ),
    ),
  ).toHaveLength(0);
});
