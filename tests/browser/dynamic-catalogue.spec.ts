import { test, expect, type Page } from "@playwright/test";
import { randomUUID, createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { db, closeDatabase } from "../../backend/src/db";
import { storage, bucket } from "../../backend/src/technicianStorage";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";

test.skip(
  process.env.RUN_DB_INTEGRATION !== "true",
  "Requires the isolated database runner.",
);
const tag = "Browser " + randomUUID().slice(0, 8),
  staffId = randomUUID(),
  customerId = randomUUID(),
  staffToken = randomUUID(),
  customerToken = randomUUID();
const groups: string[] = [],
  items: string[] = [],
  entries: string[] = [],
  bookings: string[] = [];
const fixture = (ext: string) =>
  fileURLToPath(
    new URL(`../fixtures/catalogue/sample.${ext}`, import.meta.url),
  );
test.beforeAll(async () => {
  const receipt = JSON.parse(
    await readFile(
      new URL("../../audit-private/test-database.json", import.meta.url),
      "utf8",
    ),
  );
  const identity = (
    await db()`SELECT current_database() AS database,current_setting('neon.branch_id',true) AS branch_id`
  )[0];
  if (
    receipt.removedAt ||
    identity?.database !== receipt.database ||
    identity?.branch_id !== receipt.source.branch_id ||
    !/^fixbeez_audit_[a-f0-9]{12}$/.test(String(identity?.database))
  )
    throw new Error("Refusing to modify an unverified database.");
  await db()`INSERT INTO staff_profiles(id,email,username,full_name,password_hash,role,must_change_password) VALUES(${staffId},${staffId + "@example.invalid"},${"browser_" + staffId},'Catalogue Browser QA','unused','ADMIN',false)`;
  await db()`INSERT INTO staff_sessions(staff_id,token_hash,expires_at) VALUES(${staffId},${createHash("sha256").update(staffToken).digest("hex")},now()+interval '1 hour')`;
  await db()`INSERT INTO customers(id,full_name,phone_e164) VALUES(${customerId},'Browser Customer',${"+919" + String(Date.now()).slice(-9)})`;
  await db()`INSERT INTO customer_sessions(customer_id,token_hash,expires_at) VALUES(${customerId},${createHash("sha256").update(customerToken).digest("hex")},now()+interval '1 hour')`;
  await db()`INSERT INTO customer_addresses(customer_id,label,recipient_name,phone,line1,area,city,state,pin_code,is_default) VALUES(${customerId},'Home','Browser Customer','9876543210','12 Test Road','Adyar','Chennai','Tamil Nadu','600001',true)`;
});
test.afterAll(async () => {
  for (const id of bookings) {
    await db()`DELETE FROM request_status_events WHERE request_id=${id}`;
    await db()`DELETE FROM service_requests WHERE id=${id}`;
  }
  for (const id of entries)
    await db()`DELETE FROM service_catalogue WHERE id=${id}`;
  for (const id of items)
    await db()`DELETE FROM appliance_categories WHERE id=${id}`;
  for (const id of groups)
    await db()`DELETE FROM catalogue_categories WHERE id=${id}`;
  const images =
    await db()`SELECT id,object_key FROM catalogue_media WHERE created_by=${staffId}`;
  for (const image of images) {
    await storage().send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: String(image.object_key),
      }),
    );
    await db()`DELETE FROM catalogue_media WHERE id=${image.id}`;
  }
  await db()`DELETE FROM customer_addresses WHERE customer_id=${customerId}`;
  await db()`DELETE FROM customer_sessions WHERE customer_id=${customerId}`;
  await db()`DELETE FROM customers WHERE id=${customerId}`;
  await db()`DELETE FROM audit_logs WHERE actor_staff_id=${staffId}`;
  await db()`DELETE FROM staff_sessions WHERE staff_id=${staffId}`;
  await db()`DELETE FROM staff_profiles WHERE id=${staffId}`;
  await closeDatabase();
});
async function upload(page: Page, ext: string) {
  const uploaded = page.waitForResponse(
    (r) =>
      r.url().includes("/admin/catalogue/media") &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("dialog")
    .locator("input[type=file]")
    .setInputFiles(fixture(ext));
  const response = await uploaded;
  expect(response.status()).toBeGreaterThanOrEqual(200);
  expect(response.status()).toBeLessThan(300);
  await expect(page.getByRole("dialog").locator("progress")).toHaveCount(0);
}
async function saveEntity(page: Page, ids: string[]) {
  const saved = page.waitForResponse(
    (r) =>
      /\/admin\/catalogue\/(categories|items)$/.test(r.url()) &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  const response = await saved;
  expect(response.status()).toBeGreaterThanOrEqual(200);
  expect(response.status()).toBeLessThan(300);
  ids.push((await response.json()).data.id);
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
test("direct prefilled booking advances to the date calendar", async ({
  browser,
}) => {
  const group = randomUUID(),
    item = randomUUID(),
    entry = randomUUID(),
    option = randomUUID();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  try {
    await db()`INSERT INTO catalogue_categories(id,name,publication_status) VALUES(${group},${"Direct " + tag},'PUBLISHED')`;
    await db()`INSERT INTO appliance_categories(id,catalogue_category_id,name,slug,publication_status) VALUES(${item},${group},'Direct item',${item},'PUBLISHED')`;
    await db()`INSERT INTO service_catalogue(id,appliance_category_id,name,slug,request_type,publication_status,booking_options) VALUES(${entry},${item},'Direct visit',${entry},'SERVICE','PUBLISHED',${JSON.stringify([{ id: option, name: "Visit", active: true, priceType: "QUOTE", amountPaise: null, maximumPaise: null }])}::jsonb)`;
    await context.addCookies([
      {
        name: "customer_session",
        value: customerToken,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    await context.addInitScript(() => {
      try {
        sessionStorage.setItem("fixbeez.customer.launched.v1", "complete");
      } catch {
        /* Opaque documents have no storage. */
      }
    });
    await context.route("https://accounts.google.com/**", (r) =>
      r.fulfill({ body: "" }),
    );
    const page = await context.newPage();
    await page.goto(`http://localhost:5193/services/categories/${group}`);
    await page
      .getByRole("link", { name: "View Direct item services", exact: true })
      .click();
    await page
      .getByRole("link", { name: "Book Direct visit", exact: true })
      .click();
    await page.getByLabel(/Short description/).fill("Please inspect this unit");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Location & contact", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(
      page.getByRole("region", {
        name: "Preferred date calendar",
        exact: true,
      }),
    ).toBeVisible();
  } finally {
    await context.close();
    await db()`DELETE FROM service_catalogue WHERE id=${entry}`;
    await db()`DELETE FROM appliance_categories WHERE id=${item}`;
    await db()`DELETE FROM catalogue_categories WHERE id=${group}`;
  }
});
test("admin configures arbitrary catalogue, customer books, and mobile layouts remain usable", async ({
  browser,
}) => {
  const admin = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    serviceWorkers: "block",
  });
  const customer = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  await admin.addCookies([
    {
      name: "staff_session",
      value: staffToken,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);
  await customer.addCookies([
    {
      name: "customer_session",
      value: customerToken,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  for (const ctx of [admin, customer]) {
    await ctx.addInitScript(() => {
      try {
        sessionStorage.setItem("fixbeez.admin.launched.v1", "complete");
        sessionStorage.setItem("fixbeez.customer.launched.v1", "complete");
      } catch {
        /* Opaque documents have no storage. */
      }
    });
    await ctx.route("https://accounts.google.com/**", (r) =>
      r.fulfill({ body: "" }),
    );
  }
  const a = await admin.newPage(),
    c = await customer.newPage();
  const runtimeErrors: string[] = [];
  a.on("pageerror", (e) => runtimeErrors.push(e.message));
  c.on("pageerror", (e) => runtimeErrors.push(e.message));
  try {
    await a.goto("http://localhost:5194/catalogue");
    await a
      .getByRole("button", { name: "Create category", exact: true })
      .click();
    await a.getByRole("dialog").getByLabel("Name", { exact: true }).fill(tag);
    await a
      .getByRole("dialog")
      .getByLabel("Visibility", { exact: true })
      .selectOption("PUBLISHED");
    await upload(a, "png");
    await saveEntity(a, groups);
    await a.getByRole("button", { name: "Open " + tag, exact: true }).click();
    for (const name of ["First item", "Second item"]) {
      await a
        .locator(".catalogue-workspace-actions")
        .getByRole("button", { name: "Add item", exact: true })
        .click();
      await a
        .getByRole("dialog")
        .getByLabel("Name", { exact: true })
        .fill(name);
      await a
        .getByRole("dialog")
        .getByLabel("Visibility", { exact: true })
        .selectOption("PUBLISHED");
      await upload(a, "webp");
      await saveEntity(a, items);
    }
    console.info("Catalogue E2E: category and items saved.");
    const reordered = a.waitForResponse(
      (r) =>
        r.url().endsWith("/admin/catalogue/order") &&
        r.request().method() === "PUT",
    );
    await a
      .getByRole("button", { name: "Move Second item up", exact: true })
      .click();
    expect((await reordered).ok()).toBe(true);
    await expect(a.locator(".catalogue-card-title").first()).toHaveText(
      "Second item",
    );
    await a
      .getByRole("button", { name: "Open First item", exact: true })
      .click();
    for (const [type, name] of [
      ["Services", "Care visit"],
      ["Installation", "Install unit"],
    ]) {
      await a.getByRole("tab", { name: new RegExp("^" + type) }).click();
      await a
        .getByRole("button", {
          name: type === "Services" ? "Add service" : "Add installation",
          exact: true,
        })
        .click();
      await a
        .getByRole("dialog")
        .getByLabel("Service name", { exact: true })
        .fill(name!);
      await upload(a, "jpg");
      const saved = a.waitForResponse(
        (r) =>
          r.url().endsWith("/admin/catalogue/services") &&
          r.request().method() === "POST",
      );
      await a
        .getByRole("dialog")
        .getByRole("button", { name: "Publish", exact: true })
        .click();
      const response = await saved;
      expect(response.status()).toBeGreaterThanOrEqual(200);
      expect(response.status()).toBeLessThan(300);
      entries.push((await response.json()).data.id);
      await expect(a.getByRole("dialog")).toHaveCount(0);
    }
    await a.getByRole("tab", { name: /^Services/ }).click();
    await a
      .getByRole("button", { name: "Edit Care visit", exact: true })
      .click();
    await upload(a, "png");
    await a
      .getByRole("dialog")
      .getByRole("button", { name: "Publish", exact: true })
      .click();
    await expect(a.getByRole("dialog")).toHaveCount(0);
    console.info(
      "Catalogue E2E: service and installation entries saved and image replaced.",
    );
    await c.goto("http://localhost:5193/");
    await c.locator(".home-promo-cta").click();
    await expect(
      c
        .locator(".customer-listing-group")
        .filter({ has: c.getByRole("heading", { name: tag, exact: true }) })
        .locator(".appliance-card-footer h2")
        .first(),
    ).toHaveText("Second item");
    await c
      .getByRole("link", { name: "View First item services", exact: true })
      .click();
    const service = c.getByRole("link", {
      name: "Book Care visit",
      exact: true,
    });
    await expect(service.locator("img")).toBeVisible();
    await service.click();
    await c.getByLabel(/Short description/).fill("Please inspect the unit");
    await c.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(
      c.getByRole("heading", { name: "Location & contact", exact: true }),
    ).toBeVisible();
    await c.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(
      c.getByRole("region", { name: "Preferred date calendar", exact: true }),
    ).toBeVisible();
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    await c.getByRole("button", { name: today, exact: true }).click();
    await c.locator(".time-selector button").first().click();
    await c.getByRole("button", { name: "Continue", exact: true }).click();
    const booked = c.waitForResponse(
      (r) =>
        r.request().method() === "POST" && /\/requests\/service$/.test(r.url()),
    );
    await c
      .getByRole("button", { name: "Submit request", exact: true })
      .click();
    const response = await booked;
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(300);
    bookings.push((await response.json()).data.id);
    await expect(
      c.getByRole("heading", { name: "Request Submitted!", exact: true }),
    ).toBeVisible();
    console.info("Catalogue E2E: customer booking submitted.");
    const record = (
      await db()`SELECT * FROM service_requests WHERE id=${bookings[0]}`
    )[0];
    expect(record?.catalogue_category_name).toBe(tag);
    expect(record?.appliance).toBe("First item");
    expect(record?.service_name).toBe("Care visit");
    await c
      .getByRole("button", { name: "View My Requests", exact: true })
      .click();
    await expect(
      c.locator(".request-card").filter({ hasText: "Care visit" }).first(),
    ).toBeVisible();
    const operations = await admin.newPage();
    await operations.goto("http://localhost:5194/requests");
    await expect(
      operations.getByText(tag, { exact: true }).first(),
    ).toBeVisible();
    await expect(
      operations
        .getByText("Care visit", { exact: true })
        .filter({ visible: true })
        .first(),
    ).toBeVisible();
    await operations.close();
    for (const width of [320, 375, 390, 430, 768, 1440]) {
      await c.setViewportSize({ width, height: 900 });
      for (const path of [
        "/",
        "/services",
        "/services/categories/" + groups[0],
      ]) {
        await c.goto("http://localhost:5193" + path);
        await expect(c.locator("main#main")).toBeVisible();
        await expect(c.locator("a.appliance-card").first()).toBeVisible();
        expect(
          await c.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          `${path} at ${width}`,
        ).toBe(true);
        if (path === "/" && [320, 390].includes(width))
          await c.screenshot({
            path: `test-results/dynamic-catalogue/home-${width}.png`,
            fullPage: true,
          });
      }
      await a.setViewportSize({ width, height: 900 });
      if (width <= 760)
        await expect(
          a.getByRole("complementary", { name: "Admin navigation" }),
        ).not.toBeVisible();
      expect(
        await a.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        `admin at ${width}`,
      ).toBe(true);
      await c.screenshot({
        path: `test-results/dynamic-catalogue/customer-${width}.png`,
        fullPage: true,
      });
      await a.screenshot({
        path: `test-results/dynamic-catalogue/admin-${width}.png`,
        fullPage: true,
      });
    }
    expect(runtimeErrors).toEqual([]);
  } finally {
    await admin.close();
    await customer.close();
  }
});
