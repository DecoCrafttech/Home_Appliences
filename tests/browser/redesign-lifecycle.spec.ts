import { test, expect } from "@playwright/test";
import { randomUUID, createHash } from "node:crypto";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { db } from "../../backend/src/db";
import { storage, bucket } from "../../backend/src/technicianStorage";
test("real UI: publish options and icon, book, provision username, and approve technician reschedule", async ({
  browser,
}) => {
  test.setTimeout(720000);
  expect(["codex-customer-dev", "br-gentle-wind-b4tsvt43"]).toContain(
    process.env.NEON_BRANCH,
  );
  const suffix = randomUUID(),
    st = randomUUID(),
    ct = randomUUID(),
    name = `UI Care ${suffix.slice(0, 8)}`,
    username = `ui${suffix.replaceAll("-", "").slice(0, 12)}`,
    temporary = "Temporary!Secure123",
    permanent = "Permanent!Secure456";
  const hash = (v: string) => createHash("sha256").update(v).digest("hex");
  const adminContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    }),
    customerContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    techContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
  let staff = "",
    customer = "",
    service = "",
    booking = "",
    technician = "",
    applianceCategory = "";
  try {
    staff = String(
      (
        await db()`INSERT INTO staff_profiles(email,username,full_name,password_hash,role,must_change_password) VALUES(${suffix + "@example.com"},${"ui" + suffix.slice(0, 8)},'Redesign UI Admin','unused','ADMIN',false) RETURNING id`
      )[0]!.id,
    );
    customer = String(
      (
        await db()`INSERT INTO customers(full_name,phone_e164) VALUES('Redesign UI Customer',${"+919" + Date.now().toString().slice(-9)}) RETURNING id`
      )[0]!.id,
    );
    await db()`INSERT INTO staff_sessions(staff_id,token_hash,expires_at) VALUES(${staff},${hash(st)},now()+interval '1 hour')`;
    await db()`INSERT INTO customer_sessions(customer_id,token_hash,expires_at) VALUES(${customer},${hash(ct)},now()+interval '1 hour')`;
    const category = (
      await db()`INSERT INTO appliance_categories(slug,name) VALUES(${"ui-appliance-" + suffix},${"UI Appliance " + suffix.slice(0, 8)}) RETURNING id,name`
    )[0]!;
    applianceCategory = String(category.id);
    await adminContext.addCookies([
      {
        name: "staff_session",
        value: st,
        url: "http://127.0.0.1:5174",
        httpOnly: true,
        sameSite: "Strict",
      },
    ]);
    await customerContext.addCookies([
      {
        name: "customer_session",
        value: ct,
        url: "http://localhost:5173",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    const admin = await adminContext.newPage(),
      client = await customerContext.newPage(),
      tech = await techContext.newPage();
    await admin.goto("http://127.0.0.1:5174/catalogue");
    await admin
      .getByRole("button", { name: "Add Service", exact: true })
      .click();
    let drawer = admin.getByRole("dialog");
    await drawer.getByLabel("Service name", { exact: true }).fill(name);
    await drawer.getByLabel("Appliance").selectOption(String(category.id));
    await drawer
      .getByLabel("Short description", { exact: true })
      .fill("Live UI verification of catalogue options and pricing.");
    await drawer.getByRole("button", { name: "Icon", exact: true }).click();
    await drawer
      .getByLabel("Upload or replace icon", { exact: true })
      .setInputFiles({
        name: "care.svg",
        mimeType: "image/svg+xml",
        buffer: Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#2563eb"/></svg>',
        ),
      });
    await expect(
      drawer.getByRole("img", { name: "Service icon preview" }),
    ).toBeVisible({ timeout: 60000 });
    await drawer
      .getByRole("button", { name: "Options & pricing", exact: true })
      .click();
    for (const option of ["Not cooling", "General service"]) {
      await drawer
        .getByRole("button", { name: "Add option", exact: true })
        .click();
      await drawer
        .getByLabel("Option name", { exact: true })
        .last()
        .fill(option);
    }

    await drawer.getByLabel("Price type").nth(0).selectOption("INSPECTION");
    await drawer
      .getByLabel("Amount in INR", { exact: true })
      .nth(0)
      .fill("299");
    await drawer.getByLabel("Price type").nth(1).selectOption("FIXED");
    await drawer
      .getByLabel("Amount in INR", { exact: true })
      .nth(1)
      .fill("499");
    await drawer.getByRole("button", { name: "Preview", exact: true }).click();
    const publishedResponse = admin.waitForResponse(
      (r) =>
        r.url().endsWith("/catalogue/services") &&
        r.request().method() === "POST",
      { timeout: 90000 },
    );
    await drawer.getByRole("button", { name: "Publish", exact: true }).click();
    const saved = await publishedResponse;
    expect(saved.status()).toBe(201);
    service = (await saved.json()).data.id;
    await expect(drawer).toHaveCount(0, { timeout: 60000 });
    await admin
      .getByRole("button", { name: "Manage Appliances", exact: true })
      .click();
    drawer = admin.getByRole("dialog");
    await drawer
      .getByLabel("Appliance", { exact: true })
      .selectOption(String(category.id));
    await drawer.getByLabel("Appliance icon", { exact: true }).setInputFiles({
      name: "appliance.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#2563eb" d="M2 2h20v20H2z"/></svg>',
      ),
    });
    await expect(
      drawer.getByRole("img", { name: "Appliance icon preview" }),
    ).toBeVisible({ timeout: 60000 });
    await drawer
      .getByRole("button", { name: "Save Appliance", exact: true })
      .click();
    await expect(drawer).toHaveCount(0, { timeout: 60000 });
    await client.goto("http://localhost:5173/services");
    const applianceCard = client
      .locator(".appliance-card")
      .filter({ hasText: String(category.name) });
    await expect(applianceCard.locator("img")).toBeVisible({ timeout: 60000 });
    await expect
      .poll(
        () =>
          applianceCard
            .locator("img")
            .evaluate((node) => (node as HTMLImageElement).naturalWidth),
        { timeout: 60000 },
      )
      .toBeGreaterThan(0);
    await client.screenshot({
      path: "test-results/manual-status/real-appliance-grid.png",
      fullPage: true,
    });
    await client
      .locator(".appliance-card")
      .filter({ hasText: String(category.name) })
      .click();
    const card = client.locator(".discovery-card").filter({ hasText: name });
    await expect(card).toBeVisible({ timeout: 60000 });
    await expect(card.locator("img")).toBeVisible();
    await expect
      .poll(
        () =>
          card
            .locator("img")
            .evaluate(
              (node) =>
                (node as HTMLImageElement).complete &&
                (node as HTMLImageElement).naturalWidth > 0,
            ),
        { timeout: 60000 },
      )
      .toBe(true);
    await client.goto(
      `http://localhost:5173/request/service?applianceCategoryId=${category.id}`,
    );
    const selectedService = client
      .locator(".booking-service-card")
      .filter({ hasText: name });
    await expect(selectedService).toBeVisible();
    await selectedService
      .getByRole("button", { name: "View service details", exact: true })
      .click();
    await expect(selectedService.getByText("Not cooling")).toBeVisible();
    await selectedService.getByRole("button", { name: "Book now" }).click();
    await client.getByRole("checkbox", { name: /Not cooling/ }).check();
    await client.getByRole("checkbox", { name: /General service/ }).check();
    await expect(
      client.getByRole("checkbox", { name: /Not cooling/ }),
    ).toBeChecked();
    await client.getByRole("button", { name: "Continue", exact: true }).click();
    await client.screenshot({
      path: "test-results/redesign/booking-after-continue.png",
      fullPage: true,
    });
    await expect(
      client.getByRole("heading", { name: "Location & contact", exact: true }),
    ).toBeVisible();
    await client
      .getByLabel("Contact name", { exact: true })
      .fill("Redesign UI Customer");
    await client
      .getByLabel("Mobile number", { exact: true })
      .fill("9876543210");
    await client
      .getByLabel("House / street", { exact: true })
      .fill("12 UI Test Road");
    await client.getByLabel("Area", { exact: true }).fill("Adyar");
    await client.getByLabel("City", { exact: true }).fill("Chennai");
    await client.getByLabel("State", { exact: true }).fill("Tamil Nadu");
    await client.getByLabel("PIN code", { exact: true }).fill("600020");
    await client.getByRole("button", { name: "Continue", exact: true }).click();
    await client.getByLabel("Later date", { exact: true }).fill("2099-11-01");
    await client.getByRole("button", { name: /Morning/ }).click();
    await client.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(client.getByText(/299/).first()).toBeVisible();
    const bookingResponse = client.waitForResponse(
      (r) =>
        r.url().endsWith("/requests/service") &&
        r.request().method() === "POST",
      { timeout: 90000 },
    );
    await client
      .getByRole("button", { name: "Submit request", exact: true })
      .click();
    const booked = await bookingResponse;
    expect(booked.status()).toBe(201);
    booking = (await booked.json()).data.id;
    expect(
      (await db()`SELECT details FROM service_requests WHERE id=${booking}`)[0]!
        .details._priceSnapshots,
    ).toHaveLength(2);
    await expect(
      client.getByText("Request submitted successfully!", { exact: true }),
    ).toBeVisible({ timeout: 60000 });
    await admin.goto("http://127.0.0.1:5174/catalogue");
    await admin
      .locator(".catalogue-management-card")
      .filter({ hasText: name })
      .getByRole("button", { name: "Edit", exact: true })
      .click();
    drawer = admin.getByRole("dialog");
    await drawer
      .getByRole("button", { name: "Options & pricing", exact: true })
      .click();
    await drawer
      .getByLabel("Amount in INR", { exact: true })
      .first()
      .fill("399");
    await drawer.getByRole("button", { name: "Preview", exact: true }).click();
    await drawer.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(drawer).toHaveCount(0, { timeout: 60000 });
    expect(
      (await db()`SELECT details FROM service_requests WHERE id=${booking}`)[0]!
        .details._priceSnapshot.amountPaise,
    ).toBe(29900);
    await client.goto(
      `http://localhost:5173/services/appliances/${category.id}`,
    );
    await expect(client.locator(".discovery-price")).toContainText("399", {
      timeout: 60000,
    });
    await admin.goto("http://127.0.0.1:5174/technicians");
    await admin
      .getByRole("button", { name: "Add technician", exact: true })
      .click();
    drawer = admin.getByRole("dialog");
    await drawer
      .getByLabel("Full name", { exact: true })
      .fill(`UI Technician ${suffix.slice(0, 6)}`);
    await drawer.getByLabel("Login username", { exact: true }).fill(username);
    await drawer
      .getByLabel("Temporary password", { exact: true })
      .fill(temporary);
    await drawer
      .getByLabel("Confirm temporary password", { exact: true })
      .fill(temporary);
    await drawer
      .getByLabel("Mobile number", { exact: true })
      .fill("9876543210");
    await expect(drawer.getByLabel("Skills", { exact: true })).toHaveCount(0);
    await expect(
      drawer.getByLabel("Availability", { exact: true }),
    ).toHaveCount(0);
    await drawer.getByLabel("Service area", { exact: true }).fill("Chennai");
    await drawer.getByLabel("Verification").selectOption("VERIFIED");
    const techResponse = admin.waitForResponse(
      (r) =>
        r.url().endsWith("/technicians") && r.request().method() === "POST",
      { timeout: 90000 },
    );
    await drawer
      .getByRole("button", { name: "Save technician", exact: true })
      .click();
    const provisioned = await techResponse;
    expect(provisioned.status()).toBe(201);
    technician = (await provisioned.json()).data.id;
    await expect(drawer).toHaveCount(0, { timeout: 60000 });
    await tech.goto("http://127.0.0.1:5175/technician");
    await tech.getByLabel("Username or email", { exact: true }).fill(username);
    await tech.getByLabel("Password", { exact: true }).fill(temporary);
    await tech.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
      tech.getByRole("heading", { name: "Choose your own password" }),
    ).toBeVisible({ timeout: 60000 });
    await tech
      .getByLabel("Temporary password", { exact: true })
      .fill(temporary);
    await tech.getByLabel("New password", { exact: true }).fill(permanent);
    await tech
      .getByLabel("Confirm new password", { exact: true })
      .fill(permanent);
    await tech
      .getByRole("button", { name: "Change password", exact: true })
      .click();
    await expect(
      tech.getByRole("heading", { name: "Your workday" }),
    ).toBeVisible({ timeout: 60000 });
    await admin.goto("http://127.0.0.1:5174/requests");
    const newRequest = admin
      .locator(".desktop-request-table tr")
      .filter({ has: admin.locator(`a[href="/requests/${booking}"]`) });
    await newRequest
      .getByRole("button", { name: "Assign Technician", exact: true })
      .click();
    drawer = admin.getByRole("dialog");
    await drawer
      .getByLabel("Search technicians", { exact: true })
      .fill(technician);
    await drawer.getByRole("radio").check();
    await drawer
      .getByRole("button", { name: "Confirm Assignment", exact: true })
      .click();
    await expect(drawer).toHaveCount(0, { timeout: 60000 });
    await admin.goto(`http://127.0.0.1:5174/requests/${booking}`);
    await tech.goto(`http://127.0.0.1:5175/technician/jobs/${booking}`);
    await expect(
      tech.getByText("Redesign UI Customer", { exact: true }),
    ).toBeVisible({ timeout: 60000 });
    await expect(
      tech.getByRole("button", { name: /Accept|Decline job/ }),
    ).toHaveCount(0);
    await expect(
      tech.getByRole("link", { name: "Call Customer", exact: true }),
    ).toHaveAttribute("href", "tel:+919876543210");
    await admin.reload();
    await expect(
      admin.getByRole("link", { name: "Call Customer", exact: true }),
    ).toHaveAttribute("href", "tel:+919876543210");
    await admin
      .getByRole("button", { name: "Confirm Appointment", exact: true })
      .click();
    drawer = admin.getByRole("dialog");
    await drawer
      .getByLabel("Confirmed date", { exact: true })
      .fill("2099-11-01");
    await drawer
      .getByLabel("Confirmed visit window", { exact: true })
      .fill("09:00-10:00");
    await drawer
      .getByRole("button", { name: "Confirm Appointment", exact: true })
      .click();
    await expect(drawer).toHaveCount(0, { timeout: 60000 });
    await admin.goto("http://127.0.0.1:5174/appointments?date=2099-11-01");
    await expect(
      admin
        .locator(".calendar-event")
        .filter({ hasText: "Redesign UI Customer" })
        .first(),
    ).toBeVisible({ timeout: 60000 });
    await tech.goto(
      "http://127.0.0.1:5175/technician/schedule?date=2099-11-01",
    );
    await tech
      .locator(".calendar-event")
      .filter({ hasText: "Redesign UI Customer" })
      .first()
      .click();
    drawer = tech.getByRole("dialog");
    await expect(
      drawer.getByRole("link", { name: "Call Customer", exact: true }),
    ).toHaveAttribute("href", "tel:+919876543210");
    await drawer
      .getByRole("button", { name: "Request reschedule", exact: true })
      .click();
    await drawer
      .getByLabel("Proposed date", { exact: true })
      .fill("2099-11-02");
    await drawer.getByLabel("Start time", { exact: true }).fill("10:00");
    await drawer.getByLabel("End time", { exact: true }).fill("11:00");
    await drawer
      .getByRole("button", { name: "Send reschedule request", exact: true })
      .click();
    await expect(drawer.getByText(/Awaiting approval:/)).toBeVisible({
      timeout: 60000,
    });
    expect(
      String(
        (
          await db()`SELECT confirmed_date FROM service_requests WHERE id=${booking}`
        )[0]!.confirmed_date,
      ).slice(0, 10),
    ).toBe("2099-11-01");
    await admin.reload();
    const proposal = admin
      .locator(".reschedule-queue article")
      .filter({ hasText: "Redesign UI Customer" });
    await proposal
      .getByRole("button", { name: "Approve reschedule", exact: true })
      .click();
    await expect(proposal).toHaveCount(0, { timeout: 60000 });
    await client.goto(`http://localhost:5173/requests/${booking}`);
    await expect(client.getByText(/2099-11-02/).first()).toBeVisible({
      timeout: 60000,
    });
    await tech.goto(
      "http://127.0.0.1:5175/technician/schedule?date=2099-11-02",
    );
    await expect(
      tech
        .locator(".calendar-event")
        .filter({ hasText: "Redesign UI Customer" })
        .first(),
    ).toBeVisible({ timeout: 60000 });
    await tech.getByRole("tab", { name: "Day view", exact: true }).click();
    await admin.getByLabel("Go to date", { exact: true }).fill("2099-11-02");
    await expect(
      admin
        .locator(".calendar-event")
        .filter({ hasText: "Redesign UI Customer" })
        .first(),
    ).toBeVisible({ timeout: 60000 });
    for (const [page, label] of [
      [admin, "admin-calendar"],
      [tech, "technician-calendar"],
      [client, "customer-confirmed-request"],
    ] as const)
      await page.screenshot({
        path: `test-results/redesign/real-${label}.png`,
        fullPage: true,
      });
  } finally {
    await Promise.all([
      adminContext.close(),
      customerContext.close(),
      techContext.close(),
    ]);
    if (customer)
      await db()`DELETE FROM service_requests WHERE customer_id=${customer}`;
    if (service) await db()`DELETE FROM service_catalogue WHERE id=${service}`;
    if (technician) await db()`DELETE FROM technicians WHERE id=${technician}`;
    if (applianceCategory)
      await db()`DELETE FROM appliance_categories WHERE id=${applianceCategory}`;
    if (staff) {
      const media =
        await db()`DELETE FROM catalogue_media WHERE created_by=${staff} RETURNING object_key`;
      for (const file of media)
        if (String(file.object_key).startsWith("catalogue/icons/"))
          await storage().send(
            new DeleteObjectCommand({
              Bucket: bucket,
              Key: String(file.object_key),
            }),
          );
      await db()`DELETE FROM staff_profiles WHERE id=${staff}`;
    }
    if (customer) await db()`DELETE FROM customers WHERE id=${customer}`;
  }
});
