import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { test, expect } from "@playwright/test";
import { randomUUID, createHash } from "node:crypto";
import { db } from "../../backend/src/db";
for (const type of ["SERVICE", "INSTALLATION"])
  test("three-way technician browser: " + type, async ({ browser }) => {
    test.setTimeout(600000);
    expect(["codex-customer-dev", "br-gentle-wind-b4tsvt43"]).toContain(
      process.env.NEON_BRANCH,
    );
    const hash = (v: string) => createHash("sha256").update(v).digest("hex"),
      suffix = randomUUID(),
      st = randomUUID(),
      ct = randomUUID(),
      email = suffix + "@example.com",
      password = "Browser-Technician-Password-42";
    const adminContext = await browser.newContext({
        viewport: { width: 1440, height: 900 },
      }),
      techContext = await browser.newContext({
        viewport: { width: 390, height: 844 },
      }),
      customerContext = await browser.newContext({
        viewport: { width: 390, height: 844 },
      });
    let staff = "",
      customer = "",
      techId = "",
      id = "",
      serviceId = "";
    try {
      staff = String(
        (
          await db()`INSERT INTO staff_profiles(email,username,full_name,password_hash,role,must_change_password) VALUES(${"staff-" + email},${"techbrowser_" + suffix.slice(0, 8)},'Three Way Browser Admin','unused','ADMIN',false) RETURNING id`
        )[0]!.id,
      );
      customer = String(
        (
          await db()`INSERT INTO customers(full_name,phone_e164) VALUES('Three Way Browser Customer',${"+919" + Date.now().toString().slice(-9)}) RETURNING id`
        )[0]!.id,
      );
      await db()`INSERT INTO staff_sessions(staff_id,token_hash,expires_at) VALUES(${staff},${hash(st)},now()+interval '1 hour')`;
      await db()`INSERT INTO customer_sessions(customer_id,token_hash,expires_at) VALUES(${customer},${hash(ct)},now()+interval '1 hour')`;
      techId = String(
        (
          await db()`INSERT INTO technicians(full_name,phone,skills,service_area,verification_status) VALUES('Three Way Browser Technician','+919876543210','AC','Chennai','VERIFIED') RETURNING id`
        )[0]!.id,
      );
      const category = (
        await db()`SELECT id,name FROM appliance_categories WHERE slug='air-conditioner'`
      )[0]!;
      await db()`UPDATE technicians SET skills=${String(category.name)} WHERE id=${techId}`;
      serviceId = String(
        (
          await db()`INSERT INTO service_catalogue(appliance_category_id,request_type,slug,name) VALUES(${category.id},${type},${suffix},'Browser technician care') RETURNING id`
        )[0]!.id,
      );
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
      const booking = await customerContext.request.post(
        "http://localhost:5173/api/v1/requests/" +
          (type === "SERVICE" ? "service" : "installation"),
        {
          data: {
            applianceCategoryId: String(category.id),
            serviceId,
            details: { description: "Three-way browser test request" },
            address: {
              name: "Three Way Browser Customer",
              phone: "9876543210",
              line1: "Private Browser Street",
              area: "Adyar",
              city: "Chennai",
              state: "Tamil Nadu",
              pinCode: "600020",
            },
            preferredDate: "2099-10-25",
            preferredTimeWindow: "09:00-12:00",
            idempotencyKey: suffix,
          },
        },
      );
      expect(booking.status()).toBe(201);
      id = (await booking.json()).data.id;
      const admin = await adminContext.newPage(),
        technician = await techContext.newPage(),
        client = await customerContext.newPage();
      const invitation = await adminContext.request.post(
        "http://127.0.0.1:5174/api/v1/admin/technicians/" + techId + "/invite",
        { data: { email } },
      );
      expect(invitation.status()).toBe(201);
      await technician.goto(
        "http://127.0.0.1:5175" + (await invitation.json()).data.activationPath,
      );
      await technician
        .getByLabel("New password", { exact: true })
        .fill(password);
      await technician
        .getByLabel("Confirm password", { exact: true })
        .fill(password);
      await technician
        .getByRole("button", { name: "Activate account", exact: true })
        .click();
      await expect(technician).toHaveURL(/\/technician\/login$/);
      await technician
        .getByLabel("Username or email", { exact: true })
        .fill(email);
      await technician.getByLabel("Password", { exact: true }).fill(password);
      await technician
        .getByRole("button", { name: "Sign in", exact: true })
        .click();
      await expect(
        technician.getByRole("heading", { name: "Your workday" }),
      ).toBeVisible({ timeout: 60000 });
      await admin.goto("http://127.0.0.1:5174/requests/" + id);
      await admin
        .getByRole("button", { name: "Start Review", exact: true })
        .click();
      await admin
        .getByRole("dialog")
        .getByRole("button", { name: "Start Review", exact: true })
        .click();
      await expect(
        admin.getByText("Under review", { exact: true }).first(),
      ).toBeVisible();
      await admin
        .getByRole("button", { name: "Assign Technician", exact: true })
        .click();
      const drawer = admin.getByRole("dialog");
      await drawer.getByLabel("Search technicians").fill(techId);
      await drawer.locator('input[type=radio][value="' + techId + '"]').check();
      const assignmentResponse = admin.waitForResponse(
        (r) =>
          r.url().endsWith("/requests/" + id + "/offer") &&
          r.request().method() === "POST",
        { timeout: 60000 },
      );
      await drawer
        .getByRole("button", { name: "Confirm Assignment", exact: true })
        .evaluate((button) => {
          (button as HTMLButtonElement).click();
          (button as HTMLButtonElement).click();
          (button as HTMLButtonElement).click();
        });
      const assignmentResponseResult = await assignmentResponse;
      expect(assignmentResponseResult.status()).toBe(201);
      await expect(drawer).toHaveCount(0, { timeout: 60000 });
      await expect(
        admin.getByText("Technician assigned successfully.", {
          exact: true,
        }),
      ).toHaveCount(1);
      expect(
        (
          await db()`SELECT id FROM technician_assignments WHERE request_id=${id}`
        ).length,
      ).toBe(1);
      const retried = await adminContext.request.post(
        assignmentResponseResult.url(),
        {
          data: assignmentResponseResult.request().postDataJSON(),
          headers: {
            "Idempotency-Key": assignmentResponseResult.request().headers()[
              "idempotency-key"
            ]!,
          },
        },
      );
      expect(retried.status()).toBe(201);
      expect(
        (
          await db()`SELECT id FROM technician_assignments WHERE request_id=${id}`
        ).length,
      ).toBe(1);
      await technician.goto("http://127.0.0.1:5175/technician/jobs/" + id);
      await expect(
        technician.getByText("Three Way Browser Customer", { exact: true }),
      ).toBeVisible({ timeout: 60000 });
      await expect(
        technician.getByText("Private Browser Street", { exact: false }),
      ).toBeVisible({ timeout: 60000 });
      await expect(
        technician.getByRole("button", { name: /Accept|Decline job/ }),
      ).toHaveCount(0);
      expect(
        (
          await db()`SELECT e.id FROM technician_assignment_events e JOIN technician_assignments a ON a.id=e.assignment_id WHERE a.request_id=${id} AND e.state='ACCEPTED'`
        ).length,
      ).toBe(1);
      await admin.reload();
      await expect(admin.getByText("Accepted", { exact: true })).toBeVisible();
      await client.goto("http://localhost:5173/requests/" + id);
      await expect(
        client
          .getByText("Three Way Browser Technician", { exact: false })
          .first(),
      ).toBeVisible();
      const current = (
        await db()`SELECT version FROM service_requests WHERE id=${id}`
      )[0]!;
      const appointment = await adminContext.request.post(
        "http://127.0.0.1:5174/api/v1/admin/requests/" + id + "/status",
        {
          data: {
            status: "APPOINTMENT_CONFIRMED",
            version: current.version,
            note: "Customer confirmed the appointment",
            confirmedDate: "2099-10-25",
            confirmedTimeWindow: "09:00-12:00",
          },
        },
      );
      expect(appointment.status()).toBe(200);
      await technician.reload();
      for (const name of ["On the way", "I have arrived", "Start work"]) {
        const button = technician.getByRole("button", { name, exact: true });
        await expect(button).toBeEnabled({ timeout: 30000 });
        const response = technician.waitForResponse(
          (r) =>
            r.request().method() === "POST" &&
            r.url().includes("/api/v1/technician/jobs/" + id + "/"),
          { timeout: 60000 },
        );
        await button.evaluate((button) => {
          (button as HTMLButtonElement).click();
          (button as HTMLButtonElement).click();
        });
        const result = await response;
        expect(result.status(), await result.text()).toBe(200);
      }
      await technician.reload();
      await technician
        .getByLabel("Work performed", { exact: true })
        .fill("Work performed and all function tests passed.");
      await technician
        .getByLabel("Optional completion photo (up to 8 MB)")
        .setInputFiles({
          name: "completion.png",
          mimeType: "image/png",
          buffer: Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5VQAAAAASUVORK5CYII=",
            "base64",
          ),
        });
      await expect(
        technician.getByText("Photo uploaded.", { exact: true }),
      ).toBeVisible({ timeout: 60000 });
      await expect(
        technician.getByRole("img", { name: "Selected completion photo" }),
      ).toBeVisible({ timeout: 60000 });
      for (const box of await technician.getByRole("checkbox").all())
        await box.check();
      await technician
        .getByRole("button", {
          name: "Submit work report",
          exact: true,
        })
        .evaluate((button) => {
          (button as HTMLButtonElement).click();
          (button as HTMLButtonElement).click();
        });
      await expect(
        technician.getByText("Work report submitted.", { exact: true }),
      ).toBeVisible({ timeout: 60000 });
      expect(
        (
          await db()`SELECT id FROM technician_work_reports WHERE request_id=${id}`
        ).length,
      ).toBe(1);
      expect(
        (await db()`SELECT status FROM service_requests WHERE id=${id}`)[0]!
          .status,
      ).toBe("IN_PROGRESS");
      await technician.goto(
        "http://127.0.0.1:5175/technician/jobs?view=in-progress",
      );
      await technician
        .locator(".tech-job-card")
        .filter({ hasText: "Browser technician care" })
        .getByRole("button", { name: "Complete job", exact: true })
        .click();
      const completedResponse = technician.waitForResponse(
        (response) =>
          response.url().endsWith(`/jobs/${id}/complete`) &&
          response.request().method() === "POST",
      );
      await technician
        .getByRole("button", { name: "Confirm completion", exact: true })
        .click();
      const completionResult = await completedResponse;
      expect(completionResult.status(), await completionResult.text()).toBe(
        200,
      );
      await expect(
        technician.getByText(
          "Job completed. Operations and the customer have been notified.",
          { exact: true },
        ),
      ).toBeVisible({ timeout: 60000 });
      expect(
        (await db()`SELECT status FROM service_requests WHERE id=${id}`)[0]!
          .status,
      ).toBe("COMPLETED");
      await admin.goto(`http://127.0.0.1:5174/requests/${id}#work-report`);
      await expect(
        admin
          .locator(".timeline li")
          .filter({ has: admin.getByText("Completed", { exact: true }) })
          .getByText("Changed by Three Way Browser Technician", {
            exact: true,
          }),
      ).toBeVisible({ timeout: 60000 });
      await expect(
        admin.getByText("Completed by Three Way Browser Technician", {
          exact: false,
        }),
      ).toBeVisible({ timeout: 60000 });
      expect(
        (await db()`SELECT id FROM completion_reports WHERE request_id=${id}`)
          .length,
      ).toBe(1);
      await client.reload();
      await expect(
        client
          .getByText("Work performed and all function tests passed.", {
            exact: true,
          })
          .first(),
      ).toBeVisible({ timeout: 60000 });
      await client
        .getByRole("button", { name: "Rate & Review", exact: true })
        .click();
      await client
        .getByRole("button", { name: "5 stars", exact: true })
        .click();
      await client
        .getByLabel(/Written feedback/)
        .fill("Professional technician and clear updates.");
      await client
        .getByRole("button", { name: "Submit review", exact: true })
        .evaluate((button) => {
          (button as HTMLButtonElement).click();
          (button as HTMLButtonElement).click();
        });
      await expect(
        client.getByRole("heading", { name: "Your review", exact: true }),
      ).toBeVisible({ timeout: 60000 });
      expect(
        (await db()`SELECT id FROM request_reviews WHERE request_id=${id}`)
          .length,
      ).toBe(1);
      for (const viewport of [
        { width: 360, height: 800 },
        { width: 390, height: 844 },
        { width: 768, height: 1024 },
        { width: 1024, height: 768 },
        { width: 1440, height: 900 },
      ]) {
        await technician.setViewportSize(viewport);
        for (const path of [
          "",
          "/jobs",
          "/schedule",
          "/profile",
          "/notifications",
        ]) {
          await technician.goto("http://127.0.0.1:5175/technician" + path);
          await expect(technician.locator(".tech-main")).toBeVisible({
            timeout: 60000,
          });
          await expect(technician.locator(".ui-loading")).toHaveCount(0, {
            timeout: 30000,
          });
          if (!path)
            for (const count of await technician
              .locator(".stat-card strong")
              .all())
              await expect(count).toHaveText(/^\d+$/, { timeout: 30000 });
          await expect(
            technician.locator(".tech-main [role=alert]"),
          ).toHaveCount(0);
          expect(
            await technician.evaluate(
              () =>
                document.documentElement.scrollWidth <= window.innerWidth + 1,
            ),
          ).toBe(true);
          if (type === "SERVICE")
            await technician.screenshot({
              path:
                "test-results/screenshots/technician-" +
                (path.slice(1) || "home") +
                "-" +
                viewport.width +
                ".png",
              fullPage: true,
            });
        }
      }
    } finally {
      await Promise.all([
        adminContext.close(),
        techContext.close(),
        customerContext.close(),
      ]);
      if (id) {
        const attachments =
          await db()`SELECT object_key FROM technician_attachments WHERE request_id=${id}`;
        for (const item of attachments)
          await new S3Client({
            endpoint: process.env.AWS_ENDPOINT_URL_S3,
            region: process.env.AWS_REGION || "auto",
            forcePathStyle: true,
          }).send(
            new DeleteObjectCommand({
              Bucket: process.env.TECHNICIAN_STORAGE_BUCKET || "uploads",
              Key: String(item.object_key),
            }),
          );
        await db()`DELETE FROM audit_logs WHERE entity_id=${id}`;
        await db()`DELETE FROM service_requests WHERE id=${id}`;
      }
      if (techId) await db()`DELETE FROM technicians WHERE id=${techId}`;
      if (serviceId)
        await db()`DELETE FROM service_catalogue WHERE id=${serviceId}`;
      if (customer) await db()`DELETE FROM customers WHERE id=${customer}`;
      if (staff) await db()`DELETE FROM staff_profiles WHERE id=${staff}`;
    }
  });
