import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import request from "supertest";
import { randomUUID, createHash } from "node:crypto";
import { app } from "./app.js";
import { db } from "./db.js";
import { hashPassword } from "./security/password.js";
const hash = (v: string) => createHash("sha256").update(v).digest("hex");
const admin = request.agent(app),
  tech = request.agent(app),
  other = request.agent(app),
  customer = request.agent(app),
  stranger = request.agent(app);
const pass = "Technician-Test-Password-2026";
let staff = "",
  customerId = "",
  strangerId = "",
  a = "",
  b = "",
  csrf = "",
  csrfB = "",
  email = "";
const requests: string[] = [];
async function job(type = "SERVICE") {
  const rows =
    await db()`INSERT INTO service_requests(request_number,customer_id,request_type,appliance,service_name,address_snapshot,preferred_date,preferred_time_window,idempotency_key,status) VALUES(${"TECH-" + randomUUID()},${customerId},${type},'AC','Repair or install','{"line1":"Private address 42","city":"Chennai","area":"Central","pinCode":"1800001"}'::jsonb,'2026-11-24','09:00-12:00',${randomUUID()},'ASSIGNMENT_PENDING') RETURNING *`;
  requests.push(String(rows[0]!.id));
  return rows[0]!;
}
async function current(id: string) {
  return (await db()`SELECT * FROM service_requests WHERE id=${id}`)[0]!;
}
async function offer(id: string, technicianId = a) {
  const r = await admin.post("/api/v1/admin/requests/" + id + "/offer").send({
    technicianId,
    version: (await current(id)).version,
    reason: "Offer to approved specialist",
  });
  expect([200, 201], JSON.stringify(r.body)).toContain(r.status);
  return r.body.data;
}
async function assign(id: string) {
  return offer(id);
}
async function progress(id: string) {
  let j = await current(id);
  let r = await admin.post("/api/v1/admin/requests/" + id + "/status").send({
    status: "APPOINTMENT_CONFIRMED",
    version: j.version,
    note: "Appointment confirmed with customer",
    confirmedDate: "2026-11-24",
    confirmedTimeWindow: requests.length % 2 ? "09:00-12:00" : "12:00-16:00",
  });
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  for (const action of ["on-the-way", "arrived", "start"]) {
    j = await current(id);
    r = await tech
      .post("/api/v1/technician/jobs/" + id + "/" + action)
      .set("X-CSRF-Token", csrf)
      .send({ version: j.version });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
  }
}
describe.runIf(Boolean(process.env.DATABASE_URL))(
  "technician three-way Neon workflow",
  () => {
    beforeAll(async () => {
      expect(["codex-customer-dev", "br-gentle-wind-b4tsvt43"]).toContain(
        process.env.NEON_BRANCH,
      );
      const staffToken = randomUUID(),
        cToken = randomUUID(),
        sToken = randomUUID();
      staff = String(
        (
          await db()`INSERT INTO staff_profiles(email,username,full_name,password_hash,role,must_change_password) VALUES(${randomUUID() + "@example.com"},${"tech_" + randomUUID().slice(0, 8)},'Technician Workflow Admin',${await hashPassword(pass)},'ADMIN',false) RETURNING id`
        )[0]!.id,
      );
      await db()`INSERT INTO staff_sessions(staff_id,token_hash,expires_at) VALUES(${staff},${hash(staffToken)},now()+interval '1 hour')`;
      admin.set("Cookie", "staff_session=" + staffToken);
      customerId = String(
        (
          await db()`INSERT INTO customers(full_name,phone_e164) VALUES('Technician Workflow Customer',${"+919" + Date.now().toString().slice(-9)}) RETURNING id`
        )[0]!.id,
      );
      strangerId = String(
        (
          await db()`INSERT INTO customers(full_name) VALUES('Technician Workflow Other') RETURNING id`
        )[0]!.id,
      );
      for (const [id, t] of [
        [customerId, cToken],
        [strangerId, sToken],
      ])
        await db()`INSERT INTO customer_sessions(customer_id,token_hash,expires_at) VALUES(${id!},${hash(t!)},now()+interval '1 hour')`;
      customer.set("Cookie", "customer_session=" + cToken);
      stranger.set("Cookie", "customer_session=" + sToken);
      for (const [agent, index] of [
        [tech, 0],
        [other, 1],
      ] as const) {
        const r = await admin.post("/api/v1/admin/technicians").send({
          fullName: "Technician Workflow " + index,
          phone: "+919876543210",
          serviceArea: "Chennai",
          verificationStatus: "VERIFIED",
        });
        expect(r.status).toBe(201);
        const id = String(r.body.data.id);
        if (index === 0) a = id;
        else b = id;
        const e = randomUUID() + "@example.com";
        if (index === 0) email = e;
        const invite = await admin
          .post("/api/v1/admin/technicians/" + id + "/invite")
          .send({ email: e });
        expect(invite.status, JSON.stringify(invite.body)).toBe(201);
        const value = invite.body.data.activationPath.split("=")[1];
        const activated = await request(app)
          .post("/api/v1/technician/auth/activate")
          .send({ token: value, password: pass });
        expect(activated.status).toBe(200);
        expect(
          (
            await request(app)
              .post("/api/v1/technician/auth/activate")
              .send({ token: value, password: pass })
          ).status,
        ).toBe(410);
        const login = await agent
          .post("/api/v1/technician/auth/login")
          .send({ email: e, password: pass });
        expect(login.status, JSON.stringify(login.body)).toBe(200);
        if (index === 0) csrf = login.body.data.csrfToken;
        else csrfB = login.body.data.csrfToken;
      }
    }, 180000);
    afterAll(async () => {
      for (const id of requests) {
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
      for (const id of [a, b])
        if (id) await db()`DELETE FROM technicians WHERE id=${id}`;
      for (const id of [customerId, strangerId])
        if (id) await db()`DELETE FROM customers WHERE id=${id}`;
      if (staff) await db()`DELETE FROM staff_profiles WHERE id=${staff}`;
    });
    it("isolates technician sessions from all admin/customer data and enforces CSRF and strict profile fields", async () => {
      expect((await tech.get("/api/v1/admin/customers")).status).toBe(401);
      expect((await tech.get("/api/v1/admin/dashboard/summary")).status).toBe(
        401,
      );
      expect((await tech.get("/api/v1/profile")).status).toBe(401);
      expect((await tech.patch("/api/v1/availability").send({})).status).toBe(
        404,
      );
      expect(
        (
          await tech
            .patch("/api/v1/technician/profile")
            .send({ fullName: "Changed", phone: "+919876543210" })
        ).status,
      ).toBe(403);
      expect(
        (
          await tech
            .patch("/api/v1/technician/profile")
            .set("X-CSRF-Token", csrf)
            .send({
              fullName: "Changed",
              phone: "+919876543210",
              verificationStatus: "VERIFIED",
            })
        ).status,
      ).toBe(422);
    });
    it("assigns technicians without skill or availability requirements", async () => {
      const j = await job();
      const id = String(j.id);
      await db()`UPDATE service_requests SET appliance='TV' WHERE id=${id}`;
      await db()`UPDATE technicians SET skills='Unrelated appliance',availability='UNAVAILABLE',service_area='Mumbai' WHERE id=${a}`;
      const eligible = await admin.get(
        "/api/v1/admin/requests/" + id + "/eligible-technicians",
      );
      expect(eligible.status).toBe(200);
      expect(eligible.body.data.some((t: { id: string }) => t.id === a)).toBe(
        true,
      );
      expect((await offer(id)).technician_id).toBe(a);
      const duplicate = await admin
        .post("/api/v1/admin/requests/" + id + "/offer")
        .send({
          technicianId: a,
          version: (await current(id)).version,
          reason: "Offer to approved specialist",
        });
      expect(duplicate.status).toBe(200);
      expect(duplicate.body.alreadyProcessed).toBe(true);
      expect(
        (
          await db()`SELECT id FROM technician_assignments WHERE request_id=${id}`
        ).length,
      ).toBe(1);
    });
    it("reschedules an accepted appointment once and rejects stale competing changes", async () => {
      const id = String((await job()).id);
      await assign(id);
      const confirm = await admin
        .post("/api/v1/admin/requests/" + id + "/status")
        .send({
          status: "APPOINTMENT_CONFIRMED",
          version: (await current(id)).version,
          note: "Confirm test appointment",
          confirmedDate: "2026-11-24",
          confirmedTimeWindow: "09:00-12:00",
        });
      expect(confirm.status, JSON.stringify(confirm.body)).toBe(200);
      const body = {
        status: "APPOINTMENT_CONFIRMED",
        version: (await current(id)).version,
        note: "Reschedule customer appointment",
        confirmedDate: "2026-11-25",
        confirmedTimeWindow: "09:00-12:00",
      };
      const results = await Promise.all([
        admin.post("/api/v1/admin/requests/" + id + "/status").send(body),
        admin.post("/api/v1/admin/requests/" + id + "/status").send(body),
      ]);
      expect(results.map((r) => r.status)).toEqual([200, 200]);
      expect((await current(id)).confirmed_date).toBe("2026-11-25");
      expect(
        (
          await db()`SELECT id FROM request_status_events WHERE request_id=${id} AND status='APPOINTMENT_CONFIRMED'`
        ).length,
      ).toBe(2);
      expect(
        (
          await admin
            .post("/api/v1/admin/requests/" + id + "/status")
            .send({ ...body, confirmedDate: "2026-11-26" })
        ).status,
      ).toBe(409);
    });
    for (const type of ["SERVICE", "INSTALLATION"])
      it(
        type +
          ": direct assignment, progress, estimate approval, corrections, completion and real rating",
        async () => {
          const j = await job(type),
            id = String(j.id);
          await offer(id);
          expect((await current(id)).status).toBe("TECHNICIAN_ASSIGNED");
          expect((await current(id)).assigned_technician_id).toBe(a);
          const before = await tech.get("/api/v1/technician/jobs/" + id);
          expect(before.status).toBe(200);
          expect(before.body.data.assignment_state).toBe("ACCEPTED");
          expect(before.body.data.customer.full_name).toBe(
            "Technician Workflow Customer",
          );
          expect(before.body.data.address_snapshot.line1).toBe(
            "Private address 42",
          );
          expect(
            (await other.get("/api/v1/technician/jobs/" + id)).status,
          ).toBe(404);
          const acceptedDetail = (
            await tech.get("/api/v1/technician/jobs/" + id)
          ).body.data;
          expect(acceptedDetail.customer.full_name).toBe(
            "Technician Workflow Customer",
          );
          const acceptedCard = (
            await tech.get("/api/v1/technician/jobs?tab=active")
          ).body.data.find((row: { id: string }) => row.id === id);
          expect(acceptedCard.customer_phone).toBe(
            acceptedDetail.customer.phone_e164,
          );
          expect(acceptedCard.address_snapshot).toMatchObject({
            line1: "Private address 42",
            area: "Central",
            city: "Chennai",
          });
          expect(acceptedCard.latest_report_state).toBeNull();
          expect(
            (
              await tech
                .post("/api/v1/technician/jobs/" + id + "/start")
                .set("X-CSRF-Token", csrf)
                .send({ version: (await current(id)).version })
            ).status,
          ).toBe(409);
          await progress(id);
          const estimate = await tech
            .post("/api/v1/technician/jobs/" + id + "/estimates")
            .set("X-CSRF-Token", csrf)
            .send({
              version: (await current(id)).version,
              diagnosis: "Replacement part required",
              items: [
                {
                  type: "Part",
                  description: "Replacement component",
                  quantity: 2,
                  unitPrice: 125.25,
                },
              ],
            });
          expect(estimate.status, JSON.stringify(estimate.body)).toBe(201);
          expect(Number(estimate.body.data.total_paise)).toBe(25050);
          const estimateBlockedCard = (
            await tech.get("/api/v1/technician/jobs?tab=active")
          ).body.data.find((row: { id: string }) => row.id === id);
          expect(estimateBlockedCard.completion_blocked_by_estimate).toBe(true);
          expect(
            (
              await stranger
                .post(
                  "/api/v1/estimates/" + estimate.body.data.id + "/decision",
                )
                .send({ decision: "APPROVED" })
            ).status,
          ).toBe(404);
          expect(
            (
              await admin
                .post("/api/v1/admin/requests/" + id + "/complete")
                .send({
                  workSummary: "Bypass should fail",
                  version: (await current(id)).version,
                })
            ).status,
          ).toBe(409);
          expect(
            (
              await customer
                .post(
                  "/api/v1/estimates/" + estimate.body.data.id + "/decision",
                )
                .send({ decision: "APPROVED" })
            ).status,
          ).toBe(200);
          let detail = (await tech.get("/api/v1/technician/jobs/" + id)).body
            .data;
          const reportBody = {
            workSummary: "Repair and function checks completed",
            checklist: detail.checklist,
            outcome: "RESOLVED",
            notes: "Customer informed",
            parts: "Replacement component",
            unresolvedIssues: "",
          };
          const sendReport = async () =>
            tech
              .post("/api/v1/technician/jobs/" + id + "/work-report")
              .set("X-CSRF-Token", csrf)
              .send({ ...reportBody, version: (await current(id)).version });
          const report = await sendReport();
          expect(report.status, JSON.stringify(report.body)).toBe(201);
          expect(
            (
              await admin
                .post("/api/v1/admin/requests/" + id + "/complete")
                .send({
                  version: (await current(id)).version,
                  workSummary: "Must use report review",
                })
            ).status,
          ).toBe(409);
          expect((await current(id)).status).toBe("IN_PROGRESS");
          expect((await sendReport()).status).toBe(409);
          const correction = await admin
            .post(
              "/api/v1/admin/work-reports/" + report.body.data.id + "/review",
            )
            .send({
              decision: "CHANGES_REQUESTED",
              reason: "Please confirm test results",
            });
          expect(correction.status, JSON.stringify(correction.body)).toBe(200);
          const revised = await sendReport();
          expect(revised.status, JSON.stringify(revised.body)).toBe(201);
          expect(revised.body.data.version).toBe(2);
          const readyCard = (
            await tech.get("/api/v1/technician/jobs?tab=active")
          ).body.data.find((row: { id: string }) => row.id === id);
          expect(readyCard.latest_report_state).toBe("SUBMITTED_FOR_REVIEW");
          expect(readyCard.latest_report_outcome).toBe("RESOLVED");
          expect(readyCard.completion_blocked_by_estimate).toBe(false);
          const complete = await tech
            .post("/api/v1/technician/jobs/" + id + "/complete")
            .set("X-CSRF-Token", csrf)
            .send({ version: (await current(id)).version });
          expect(complete.status, JSON.stringify(complete.body)).toBe(200);
          expect((await current(id)).status).toBe("COMPLETED");
          expect(
            (
              await tech.get("/api/v1/technician/jobs?tab=completed")
            ).body.data.some((row: { id: string }) => row.id === id),
          ).toBe(true);
          const completionEvent =
            await db()`SELECT actor_role,actor_technician_id FROM request_status_events WHERE request_id=${id} AND status='COMPLETED'`;
          expect(completionEvent[0]?.actor_role).toBe("TECHNICIAN");
          expect(completionEvent[0]?.actor_technician_id).toBe(a);
          const adminDetail = await admin.get("/api/v1/admin/requests/" + id);
          expect(adminDetail.status).toBe(200);
          expect(
            adminDetail.body.data.timeline.find(
              (event: { status: string }) => event.status === "COMPLETED",
            )?.actor_technician_name,
          ).toBe("Technician Workflow 0");
          expect(adminDetail.body.data.completed_by_name).toBe(
            "Technician Workflow 0",
          );
          expect((await current(id)).status).toBe("COMPLETED");
          expect((await sendReport()).status).toBe(409);
          const review = await customer
            .post("/api/v1/requests/" + id + "/review")
            .send({ rating: 5, comment: "Excellent technician", tags: [] });
          expect(review.status, JSON.stringify(review.body)).toBe(201);
          detail = (await tech.get("/api/v1/technician/auth/me")).body.data;
          expect(detail.average_rating).toBe(5);
        },
        180000,
      );
    it("serializes competing assignments and revokes previous technician access on reassignment", async () => {
      const id = String((await job()).id),
        j = await current(id);
      const results = await Promise.all(
        [a, b].map((technicianId) =>
          admin.post("/api/v1/admin/requests/" + id + "/offer").send({
            technicianId,
            version: j.version,
            reason: "Concurrent offer test",
          }),
        ),
      );
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      const firstAssignment = await offer(id, a);
      expect(firstAssignment.state).toBe("ACCEPTED");
      const replacement = await offer(id, b);
      expect((await tech.get("/api/v1/technician/jobs/" + id)).status).toBe(
        404,
      );
      expect(replacement.state).toBe("ACCEPTED");
      expect((await current(id)).status).toBe("TECHNICIAN_ASSIGNED");
      expect((await current(id)).assigned_technician_id).toBe(b);
      expect((await other.get("/api/v1/technician/jobs/" + id)).status).toBe(
        200,
      );
    }, 120000);
    it("stores actual private Neon photos, validates content and denies unrelated or withdrawn access", async () => {
      const id = String((await job()).id);
      await assign(id);
      await progress(id);
      const bytes = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5VQAAAAASUVORK5CYII=",
        "base64",
      );
      expect(
        (
          await other
            .post("/api/v1/technician/jobs/" + id + "/photos")
            .set("X-CSRF-Token", csrfB)
            .send({
              contentType: "image/png",
              size: bytes.length,
              purpose: "AFTER",
            })
        ).status,
      ).toBe(404);
      const created = await tech
        .post("/api/v1/technician/jobs/" + id + "/photos")
        .set("X-CSRF-Token", csrf)
        .send({
          contentType: "image/png",
          size: bytes.length,
          purpose: "AFTER",
        });
      expect(created.status, JSON.stringify(created.body)).toBe(201);
      const photo = created.body.data;
      const uploaded = await fetch(photo.uploadUrl, {
        method: "PUT",
        body: bytes,
        headers: { "Content-Type": "image/png" },
      });
      expect(uploaded.status).toBe(200);
      const confirmed = await tech
        .post("/api/v1/technician/photos/" + photo.id + "/confirm")
        .set("X-CSRF-Token", csrf)
        .send({});
      expect(confirmed.status, JSON.stringify(confirmed.body)).toBe(200);
      expect(
        (await other.get("/api/v1/technician/photos/" + photo.id + "/access"))
          .status,
      ).toBe(404);
      const access = await tech.get(
        "/api/v1/technician/photos/" + photo.id + "/access",
      );
      expect(access.status).toBe(200);
      expect((await fetch(access.body.data.url)).status).toBe(200);
      const unsigned = new URL(access.body.data.url);
      unsigned.search = "";
      expect((await fetch(unsigned)).status).toBe(403);
      const detail = (await tech.get("/api/v1/technician/jobs/" + id)).body
        .data;
      const report = await tech
        .post("/api/v1/technician/jobs/" + id + "/work-report")
        .set("X-CSRF-Token", csrf)
        .send({
          version: (await current(id)).version,
          workSummary: "Work checked with private completion photo",
          checklist: detail.checklist,
          outcome: "RESOLVED",
          attachmentIds: [photo.id],
        });
      expect(report.status, JSON.stringify(report.body)).toBe(201);
      const photos = await admin.get(
        "/api/v1/admin/work-reports/" + report.body.data.id + "/photos",
      );
      expect(photos.status).toBe(200);
      expect(photos.body.data).toHaveLength(1);
    }, 120000);
    it("suspension immediately invalidates existing technician sessions", async () => {
      const r = await admin
        .patch("/api/v1/admin/technicians/" + b + "/account")
        .send({ status: "SUSPENDED" });
      expect(r.status).toBe(200);
      const session = await other.get("/api/v1/technician/auth/me");
      expect(session.status).toBe(403);
      expect(session.body.error.code).toBe("ACCOUNT_FROZEN");
      expect(session.body.error.message).toContain("Contact an administrator");
      const account =
        await db()`SELECT email FROM technician_accounts WHERE technician_id=${b}`;
      const login = await other
        .post("/api/v1/technician/auth/login")
        .send({ email: account[0]!.email, password: pass });
      expect(login.status).toBe(403);
      expect(login.body.error.code).toBe("ACCOUNT_FROZEN");
      expect(login.body.error.message).toContain("Contact an administrator");
    });
    it("allows only admins to reset technician passwords and requires changing the temporary password", async () => {
      const temporaryPassword = "Admin-Issued-Temporary-Password-42!",
        permanentPassword = "Technician-New-Password-2026!";
      const reset = await admin
        .post("/api/v1/admin/technicians/" + a + "/password")
        .send({ temporaryPassword });
      expect(reset.status, JSON.stringify(reset.body)).toBe(200);
      expect((await tech.get("/api/v1/technician/auth/me")).status).toBe(401);
      const login = await tech
        .post("/api/v1/technician/auth/login")
        .send({ email, password: temporaryPassword });
      expect(login.status).toBe(200);
      csrf = login.body.data.csrfToken;
      expect(
        (await tech.get("/api/v1/technician/auth/me")).body.data
          .must_change_password,
      ).toBe(true);
      expect(
        (
          await tech
            .post("/api/v1/technician/auth/password")
            .set("X-CSRF-Token", csrf)
            .send({
              currentPassword: temporaryPassword,
              newPassword: permanentPassword,
            })
        ).status,
      ).toBe(200);
      expect(
        (
          await tech
            .post("/api/v1/technician/auth/reset-password")
            .set("X-CSRF-Token", csrf)
            .send({ token: "x".repeat(32), password: pass })
        ).status,
      ).toBe(404);
      expect(
        (
          await tech
            .post("/api/v1/technician/auth/mfa/enroll")
            .set("X-CSRF-Token", csrf)
            .send({ password: permanentPassword })
        ).status,
      ).toBe(404);
      const me = await tech.get("/api/v1/technician/auth/me");
      expect(me.body.data.mfa_enabled).toBeUndefined();
      expect(me.body.data.mfa_secret).toBeUndefined();
    }, 120000);
  },
);
