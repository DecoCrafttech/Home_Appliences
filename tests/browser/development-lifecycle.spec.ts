import { requestReference } from "@home/shared";
import { test, expect } from "@playwright/test";
import { randomUUID, createHash } from "node:crypto";
import { db } from "../../backend/src/db";

for (const requestType of ["SERVICE", "INSTALLATION"] as const)
  test(`development database: ${requestType} customer books, admin completes, customer reviews, admin handles feedback`, async ({
    page,
    context,
    browser,
  }) => {
    test.setTimeout(600000);
    // Refuse to seed or clean up against any other branch.
    expect(["codex-customer-dev", "br-gentle-wind-b4tsvt43"]).toContain(
      process.env.NEON_BRANCH,
    );
    const suffix = randomUUID(),
      customerToken = randomUUID(),
      staffToken = randomUUID();
    const hash = (value: string) =>
      createHash("sha256").update(value).digest("hex");
    const serviceName = `Browser Test Care ${suffix.slice(0, 8)}`;
    let customerId = "",
      staffId = "",
      serviceId = "",
      technicianId = "";
    const staffContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    page.setDefaultTimeout(15000);
    staffContext.setDefaultTimeout(15000);
    try {
      const mobile = `987${Date.now().toString().slice(-7)}`;
      const customer =
        await db()`INSERT INTO customers(full_name,email,phone_e164) VALUES('Browser Lifecycle Customer',${`${suffix}@example.com`},${`+91${mobile}`}) RETURNING id,customer_reference`;
      customerId = String(customer[0]!.id);
      const staff =
        await db()`INSERT INTO staff_profiles(email,username,full_name,password_hash,role,must_change_password) VALUES(${`staff-${suffix}@example.com`},${`browser_${suffix.slice(0, 10)}`},'Browser Lifecycle Admin','unused','ADMIN',false) RETURNING id`;
      staffId = String(staff[0]!.id);
      await db()`INSERT INTO customer_sessions(customer_id,token_hash,expires_at) VALUES(${customerId},${hash(customerToken)},now()+interval '1 hour')`;
      await db()`INSERT INTO staff_sessions(staff_id,token_hash,expires_at) VALUES(${staffId},${hash(staffToken)},now()+interval '1 hour')`;
      const technician =
        await db()`INSERT INTO technicians(full_name,phone) VALUES('Browser Test Technician',${mobile}) RETURNING id`;
      technicianId = String(technician[0]!.id);
      const categories =
        await db()`SELECT id FROM appliance_categories WHERE slug='air-conditioner'`;
      const categoryId = String(categories[0]!.id);
      const service =
        await db()`INSERT INTO service_catalogue(appliance_category_id,request_type,slug,name) VALUES(${categoryId},${requestType},${suffix},${serviceName}) RETURNING id`;
      serviceId = String(service[0]!.id);
      await db()`INSERT INTO customer_addresses(customer_id,label,recipient_name,phone,line1,area,city,state,pin_code,is_default) VALUES(${customerId},'Test Home','Browser Lifecycle Customer',${mobile},'12 Browser Test Road','Adyar','Chennai','Tamil Nadu','600020',true)`;
      await context.addCookies([
        {
          name: "customer_session",
          value: customerToken,
          url: "http://localhost:5173",
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
      await staffContext.addCookies([
        {
          name: "staff_session",
          value: staffToken,
          url: "http://127.0.0.1:5174",
          httpOnly: true,
          sameSite: "Strict",
        },
      ]);
      await page.route("https://accounts.google.com/gsi/client*", (route) =>
        route.abort(),
      );
      await page.goto(
        `/request/${requestType.toLowerCase()}?applianceCategoryId=${categoryId}`,
      );
      await page
        .getByRole("button", { name: serviceName, exact: true })
        .click();
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await expect(
        page.getByLabel("Contact name", { exact: true }),
      ).toHaveValue("Browser Lifecycle Customer");
      await expect(
        page.getByLabel("House / street", { exact: true }),
      ).toHaveValue("12 Browser Test Road");
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await page.getByLabel("Later date", { exact: true }).fill("2099-10-25");
      await page.getByRole("button", { name: /Morning/ }).click();
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await page.screenshot({
        path: "test-results/screenshots/real-booking-review.png",
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "Submit request", exact: true })
        .click();
      await expect(page).toHaveURL(/\/bookings$/);
      await expect(
        page.getByText("Request submitted successfully!", { exact: true }),
      ).toBeVisible();
      const records =
        await db()`SELECT * FROM service_requests WHERE customer_id=${customerId}`;
      expect(records).toHaveLength(1);
      expect(records[0]!.preferred_date).toBe("2099-10-25");
      const requestId = String(records[0]!.id);
      const admin = await staffContext.newPage();
      await admin.goto("http://127.0.0.1:5174/requests");
      await admin
        .getByLabel("Search requests", { exact: true })
        .fill(String(customer[0]!.customer_reference));
      await expect(
        admin.getByRole("link", {
          name: requestReference(
            records[0] as {
              request_number: string;
              display_number?: string | number;
            },
          ),
          exact: true,
        }),
      ).toBeVisible();
      // These are temporary test records; simulate the work progression before the UI completion action.
      let version = 1;
      for (const status of [
        "UNDER_REVIEW",
        "EXECUTIVE_CONTACTED",
        "TECHNICIAN_ASSIGNED",
        "APPOINTMENT_CONFIRMED",
        "TECHNICIAN_EN_ROUTE",
        "TECHNICIAN_ARRIVED",
        "IN_PROGRESS",
      ]) {
        const updated = await staffContext.request.post(
          `http://127.0.0.1:5174/api/v1/admin/requests/${requestId}/status`,
          {
            data: {
              status,
              version,
              note: "Browser fixture work progression",
              ...(status === "TECHNICIAN_ASSIGNED" ? { technicianId } : {}),
              ...(status === "APPOINTMENT_CONFIRMED"
                ? {
                    confirmedDate: "2099-10-25",
                    confirmedTimeWindow: "09:00-12:00",
                  }
                : {}),
            },
          },
        );
        expect(updated.status()).toBe(200);
        if (status === "UNDER_REVIEW") {
          await page.goto(`/requests/${requestId}`);
          await expect(
            page.getByText("Under review", { exact: true }).first(),
          ).toBeVisible();
        }
        if (status === "TECHNICIAN_ASSIGNED") {
          await page.goto(`/requests/${requestId}`);
          await expect(
            page.getByText("Technician: Browser Test Technician", {
              exact: true,
            }),
          ).toBeVisible();
        }
        version++;
      }
      await admin.goto(`http://127.0.0.1:5174/requests/${requestId}`);
      await admin
        .getByRole("button", { name: "Change Status", exact: true })
        .click();
      await admin
        .getByLabel("New Status", { exact: true })
        .selectOption("COMPLETED");
      await expect(admin.getByLabel("Reason / Internal Note")).toHaveCount(0);
      await expect(
        admin.getByLabel("Completion note", { exact: false }),
      ).toHaveCount(0);
      await expect(admin.getByRole("dialog")).toBeVisible();
      const completionResponse = admin.waitForResponse(
        (response) =>
          response.url().endsWith(`/requests/${requestId}/status`) &&
          response.request().method() === "PATCH",
      );
      await admin
        .getByRole("button", { name: "Save Status", exact: true })
        .click();
      expect((await completionResponse).status()).toBe(200);
      await expect(admin.getByRole("dialog")).toHaveCount(0, {
        timeout: 15000,
      });
      await page.goto(`/requests/${requestId}`);
      await expect(
        page
          .getByText("Test work completed and inspected", { exact: true })
          .first(),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Rate & Review", exact: true })
        .click();
      await page.getByRole("button", { name: "4 stars", exact: true }).click();
      await page
        .getByLabel(/Written feedback/)
        .fill("The test service was handled professionally.");
      await page
        .getByRole("button", { name: "Submit review", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Your review", exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: "test-results/screenshots/real-customer-review.png",
        fullPage: true,
      });
      await page.goto("/notifications");
      await expect(
        page.getByRole("heading", {
          name: /Request completed/,
        }),
      ).toBeVisible();
      await admin.goto("http://127.0.0.1:5174/completed-requests");
      await admin
        .getByLabel("Search requests", { exact: true })
        .fill(String(customer[0]!.customer_reference));
      await expect(
        admin.getByRole("link", { name: "View review", exact: false }),
      ).toBeVisible();
      await expect(
        admin.getByRole("button", { name: "Mark as Completed", exact: true }),
      ).toHaveCount(0);
      await admin.goto("http://127.0.0.1:5174/reports");
      await expect(
        admin.getByText("Live request totals by type and status."),
      ).toBeVisible();
      await admin.goto("http://127.0.0.1:5174/notifications");
      await expect(
        admin.getByRole("heading", { name: /New customer review/ }).first(),
      ).toBeVisible();
      await admin.goto("http://127.0.0.1:5174/feedback");
      await admin
        .getByLabel("Search feedback", { exact: true })
        .fill(String(customer[0]!.customer_reference));
      await admin
        .getByRole("link", { name: "View feedback", exact: true })
        .click();
      await expect(
        admin.getByText("The test service was handled professionally.", {
          exact: true,
        }),
      ).toBeVisible();
      await admin
        .getByLabel("Add internal note", { exact: true })
        .fill("Follow-up completed with the test customer");
      await admin
        .getByRole("button", { name: "Add note", exact: true })
        .click();
      await expect(
        admin.getByText("Follow-up completed with the test customer", {
          exact: true,
        }),
      ).toBeVisible();
      await admin
        .getByLabel("Status", { exact: true })
        .selectOption("RESOLVED");
      await admin
        .getByLabel("Reason", { exact: true })
        .fill("Customer feedback reviewed");
      await admin
        .getByRole("button", { name: "Save handling status", exact: true })
        .click();
      await expect(admin.locator(".page-title .badge")).toHaveText("RESOLVED");
      await admin.screenshot({
        path: "test-results/screenshots/real-admin-feedback.png",
        fullPage: true,
      });
      await page.goto(
        `/support?requestId=${requestId}&reference=${String(records[0]!.request_number)}`,
      );
      await page
        .getByLabel("How can we help?", { exact: true })
        .fill("Please confirm my completed work details.");
      await page
        .getByRole("button", { name: "Submit support request", exact: true })
        .click();
      await expect(
        page.getByText("Support request submitted successfully.", {
          exact: true,
        }),
      ).toBeVisible();
      await admin.goto("http://127.0.0.1:5174/support");
      await admin
        .getByLabel("Search support tickets", { exact: true })
        .fill(String(customer[0]!.customer_reference));
      await admin
        .getByRole("button", { name: "View ticket", exact: true })
        .click();
      await admin
        .getByLabel("Reply to customer", { exact: true })
        .fill("Your work report is available in My Requests.");
      await admin
        .getByRole("button", { name: "Send reply", exact: true })
        .click();
      await expect(
        admin.getByText("Reply sent to customer.", { exact: true }),
      ).toBeVisible();
      await admin
        .getByLabel("Message visibility", { exact: true })
        .selectOption("INTERNAL");
      await admin
        .getByLabel("Internal note", { exact: true })
        .fill("Private QA follow-up note");
      await admin
        .getByRole("button", { name: "Save internal note", exact: true })
        .click();
      await expect(
        admin.getByText("Internal note saved.", { exact: true }),
      ).toBeVisible();
      await page.reload();
      await page
        .getByRole("button", { name: "View conversation", exact: true })
        .click();
      await expect(
        page.getByText("Your work report is available in My Requests.", {
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByText("Private QA follow-up note", { exact: true }),
      ).toHaveCount(0);
      await page
        .getByLabel("Your reply", { exact: true })
        .fill("Thank you for confirming the report.");
      await page
        .getByRole("button", { name: "Send message", exact: true })
        .click();
      await expect(
        page.getByText("Message sent to support.", { exact: true }),
      ).toBeVisible();
      await admin.reload();
      await admin
        .getByLabel("Search support tickets", { exact: true })
        .fill(String(customer[0]!.customer_reference));
      await admin
        .getByRole("button", { name: "View ticket", exact: true })
        .click();
      await expect(
        admin.getByText("Thank you for confirming the report.", {
          exact: true,
        }),
      ).toBeVisible();
      await admin.screenshot({
        path: `test-results/screenshots/real-support-${requestType}.png`,
        fullPage: true,
      });
      const feedback =
        await db()`SELECT rating,handling_status FROM request_reviews WHERE request_id=${requestId}`;
      expect(feedback[0]).toMatchObject({
        rating: 4,
        handling_status: "RESOLVED",
      });
    } catch (error) {
      const admin = staffContext.pages()[0];
      if (admin) {
        console.log("Failed admin lifecycle URL:", admin.url());
        await admin
          .screenshot({
            path: "test-results/screenshots/lifecycle-admin-failure.png",
            fullPage: true,
          })
          .catch(() => {});
      }
      throw error;
    } finally {
      await staffContext.close().catch(() => {});
      if (customerId) {
        const requests =
          await db()`SELECT id FROM service_requests WHERE customer_id=${customerId}`;
        for (const record of requests) {
          await db()`DELETE FROM audit_logs WHERE entity_id=${record.id}`;
          await db()`DELETE FROM request_status_events WHERE request_id=${record.id}`;
        }
        await db()`DELETE FROM support_tickets WHERE customer_id=${customerId}`;
        await db()`DELETE FROM service_requests WHERE customer_id=${customerId}`;
        await db()`DELETE FROM customer_addresses WHERE customer_id=${customerId}`;
        await db()`DELETE FROM customer_sessions WHERE customer_id=${customerId}`;
        await db()`DELETE FROM customers WHERE id=${customerId}`;
      }
      if (technicianId)
        await db()`DELETE FROM technicians WHERE id=${technicianId}`;
      if (serviceId)
        await db()`DELETE FROM service_catalogue WHERE id=${serviceId}`;
      if (staffId) {
        await db()`DELETE FROM staff_sessions WHERE staff_id=${staffId}`;
        await db()`DELETE FROM staff_profiles WHERE id=${staffId}`;
      }
    }
  });
