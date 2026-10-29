import { test, expect } from "@playwright/test";

const appliance = "11111111-1111-4111-8111-111111111111";
const serviceId = "22222222-2222-4222-8222-222222222222";
const mediaId = "33333333-3333-4333-8333-333333333333";
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#2563eb" d="M0 0h24v24H0z"/></svg>';
const publicUrl = `/api/v1/catalogue/media/${mediaId}`;

test("admin uploads, saves, replaces and removes a service SVG visible to customers", async ({
  page,
  context,
}) => {
  let key: string | null = null;
  let uploads = 0;
  const patches: unknown[] = [];
  const service = () => ({
    id: serviceId,
    name: "AC repair",
    appliance_category_id: appliance,
    appliance_name: "Air Conditioner",
    request_type: "SERVICE",
    publication_status: "PUBLISHED",
    form_fields: [],
    booking_options: [],
    icon_object_key: key,
    icon_preview_url: key ? `/api/v1/admin/catalogue/media/${mediaId}` : null,
    icon_url: key ? publicUrl : null,
  });
  await context.route("**/api/v1/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname;
    if (path.endsWith(`/catalogue/media/${mediaId}`))
      return route.fulfill({ contentType: "image/svg+xml", body: svg });
    if (path === "/api/v1/admin/auth/me")
      return route.fulfill({
        json: {
          data: {
            id: appliance,
            username: "qa",
            full_name: "QA Admin",
            role: "ADMIN",
          },
        },
      });
    if (
      path === "/api/v1/admin/catalogue/media" &&
      request.method() === "POST"
    ) {
      const body = request.postDataJSON();
      expect(body.contentType).toBe("image/svg+xml");
      expect(Buffer.from(body.data, "base64").toString()).toContain("<svg");
      if (Buffer.from(body.data, "base64").toString().includes("<script>"))
        return route.fulfill({
          status: 422,
          json: {
            error: {
              message:
                "Use a static SVG without scripts, embedded content or external references.",
            },
          },
        });
      uploads++;
      return route.fulfill({
        status: 201,
        json: {
          data: {
            id: mediaId,
            object_key: `catalogue/icons/test-${uploads}`,
            previewUrl: `/api/v1/admin/catalogue/media/${mediaId}`,
          },
        },
      });
    }
    if (path === `/api/v1/admin/catalogue/services/${serviceId}/icon`) {
      const body = request.postDataJSON();
      expect(Object.keys(body)).toEqual(["iconObjectKey"]);
      patches.push(body);
      key = body.iconObjectKey;
      return route.fulfill({
        json: { data: { id: serviceId, icon_object_key: key } },
      });
    }
    if (path === "/api/v1/admin/catalogue")
      return route.fulfill({
        json: {
          data: {
            categories: [{ id: appliance, name: "Air Conditioner" }],
            services: [service()],
          },
        },
      });
    if (path === `/api/v1/catalogue/appliances/${appliance}/services`)
      return route.fulfill({
        json: {
          data: [service()],
          meta: { appliance: { id: appliance, name: "Air Conditioner" } },
        },
      });
    if (path === "/api/v1/catalogue")
      return route.fulfill({ json: { data: [service()] } });
    if (path.endsWith("/profile"))
      return route.fulfill({
        status: 401,
        json: { error: { message: "Sign in" } },
      });
    return route.fulfill({ json: { data: [], meta: { unreadCount: 0 } } });
  });
  await page.goto("http://127.0.0.1:5174/catalogue");
  await page.getByRole("button", { name: "Change icon", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "Save icon", exact: true }),
  ).toBeDisabled();
  await dialog
    .getByLabel("Upload or replace icon")
    .setInputFiles({
      name: "repair.SVG",
      mimeType: "",
      buffer: Buffer.from("<svg><script>alert(1)</script></svg>"),
    });
  await expect(dialog.getByRole("alert")).toContainText(
    "Use a static SVG without scripts",
  );
  await expect(
    dialog.getByRole("button", { name: "Save icon", exact: true }),
  ).toBeDisabled();
  await dialog.getByLabel("Upload or replace icon").setInputFiles({
    name: "repair.SVG",
    mimeType: "",
    buffer: Buffer.from(svg),
  });
  await expect(dialog.getByRole("status")).toContainText("Icon uploaded");
  await expect(dialog.getByAltText("Service icon preview")).toBeVisible();
  expect(patches).toHaveLength(0);
  await dialog.getByRole("button", { name: "Save icon", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(key).toBe("catalogue/icons/test-1");

  const customer = await context.newPage();
  await customer.goto(`http://localhost:5173/services/appliances/${appliance}`);
  await expect(customer.locator(`img[src="${publicUrl}"]`)).toBeVisible();
  expect(
    await customer
      .locator(`img[src="${publicUrl}"]`)
      .evaluate(
        (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
      ),
  ).toBe(true);
  await customer.getByRole("link", { name: /AC repair/ }).click();
  await expect(customer.locator(`img[src="${publicUrl}"]`)).toBeVisible();

  await page.getByRole("button", { name: "Change icon", exact: true }).click();
  await dialog.getByLabel("Upload or replace icon").setInputFiles({
    name: "replacement.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(svg),
  });
  await expect(dialog.getByRole("status")).toContainText("Icon uploaded");
  await dialog.getByRole("button", { name: "Save icon", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(key).toBe("catalogue/icons/test-2");
  await page.getByRole("button", { name: "Change icon", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Remove icon", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Save icon", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await customer.reload();
  await expect(
    customer.getByRole("heading", { name: "AC repair", exact: true }),
  ).toBeVisible();
  await expect(customer.locator(`img[src="${publicUrl}"]`)).toHaveCount(0);
  expect(key).toBeNull();
});
