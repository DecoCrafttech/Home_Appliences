import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "./app.js";
import { db } from "./db.js";
import { hashPassword } from "./security/password.js";
const suffix = String(Date.now());
const username = `admin_${suffix}`;
const email = `admin-${suffix}@example.com`;
const password = "Strong-Test-Password-42";
const admin = request.agent(app);
let staffId = "", customerId = "", requestId = "";
describe.runIf(Boolean(process.env.DATABASE_URL))("admin Neon workflows", () => {
    beforeAll(async () => {
        const passwordHash = await hashPassword(password);
        const staff = await db() `INSERT INTO staff_profiles(email,username,full_name,password_hash,role,must_change_password) VALUES(${email},${username},'Integration Admin',${passwordHash},'OPERATIONS_MANAGER',false) RETURNING id`;
        staffId = String(staff[0].id);
        const customer = await db() `INSERT INTO customers(phone_e164,full_name) VALUES(${`+918${suffix.slice(-9)}`} ,'Admin Test Customer') RETURNING id`;
        customerId = String(customer[0].id);
        const created = await db() `INSERT INTO service_requests(request_number,customer_id,request_type,appliance,service_name,address_snapshot,preferred_date,preferred_time_window,idempotency_key) VALUES(${`ADM-${suffix}`},${customerId},'SERVICE','Washing Machine','Not Spinning','{}'::jsonb,'2026-10-26','10:00-12:00',${crypto.randomUUID()}) RETURNING id`;
        requestId = String(created[0].id);
        await db() `INSERT INTO request_status_events(request_id,status,note) VALUES(${requestId},'REQUESTED','Request received')`;
    });
    afterAll(async () => {
        if (requestId) {
            await db() `DELETE FROM audit_logs WHERE entity_id=${requestId}`;
            await db() `DELETE FROM request_status_events WHERE request_id=${requestId}`;
            await db() `DELETE FROM service_requests WHERE id=${requestId}`;
        }
        if (customerId)
            await db() `DELETE FROM customers WHERE id=${customerId}`;
        if (staffId) {
            await db() `DELETE FROM staff_sessions WHERE staff_id=${staffId}`;
            await db() `DELETE FROM staff_login_challenges WHERE staff_id=${staffId}`;
            await db() `DELETE FROM staff_profiles WHERE id=${staffId}`;
        }
    });
    it("requires staff authentication", async () => {
        const denied = await request(app).get("/api/v1/admin/dashboard/summary");
        expect(denied.status).toBe(401);
        const customers = await request(app).get("/api/v1/admin/customers");
        expect(customers.status).toBe(401);
    });
    it("authenticates staff with username, password, and MFA and restores session", async () => {
        const login = await admin
            .post("/api/v1/admin/auth/login")
            .send({ username, password });
        expect(login.status).toBe(200);
        const mfa = await admin
            .post("/api/v1/admin/auth/mfa")
            .send({ challengeId: login.body.data.challengeId, code: "123456" });
        expect(mfa.status).toBe(200);
        expect(mfa.body.data.staff.role).toBe("OPERATIONS_MANAGER");
        const me = await admin.get("/api/v1/admin/auth/me");
        expect(me.status).toBe(200);
        expect(me.body.data.username).toBe(username);
    });
    it("returns real dashboard counts and paginated request records", async () => {
        const summary = await admin.get("/api/v1/admin/dashboard/summary");
        expect(summary.status).toBe(200);
        expect(summary.body.data.total_customers).toBeGreaterThanOrEqual(1);
        const list = await admin
            .get("/api/v1/admin/requests")
            .query({ limit: 20 });
        expect(list.status).toBe(200);
        expect(list.body.data.some((row) => row.id === requestId)).toBe(true);
        const customers = await admin
            .get("/api/v1/admin/customers")
            .query({ limit: 20 });
        expect(customers.status).toBe(200);
        expect(customers.body.meta).toMatchObject({ page: 1, limit: 20 });
        expect(customers.body.data.some((row) => row.id === customerId && row.full_name === "Admin Test Customer")).toBe(true);
    });
    it("persists an audited status update visible in the shared timeline", async () => {
        const detail = await admin.get(`/api/v1/admin/requests/${requestId}`);
        const changed = await admin
            .post(`/api/v1/admin/requests/${requestId}/status`)
            .send({
            status: "UNDER_REVIEW",
            note: "Reviewed by operations",
            version: detail.body.data.version,
        });
        expect(changed.status).toBe(200);
        expect(changed.body.data.status).toBe("UNDER_REVIEW");
        const events = await db() `SELECT status,actor_staff_id FROM request_status_events WHERE request_id=${requestId} ORDER BY created_at`;
        expect(events.map((e) => e.status)).toEqual([
            "REQUESTED",
            "UNDER_REVIEW",
        ]);
        expect(events[1]?.actor_staff_id).toBe(staffId);
        const audit = await db() `SELECT action FROM audit_logs WHERE entity_id=${requestId}`;
        expect(audit[0]?.action).toBe("REQUEST_STATUS_UPDATED");
    });
    it("shows the customer profile and related records to authenticated staff", async () => {
        const denied = await request(app).get(`/api/v1/admin/customers/${customerId}`);
        expect(denied.status).toBe(401);
        const detail = await admin.get(`/api/v1/admin/customers/${customerId}`);
        expect(detail.status).toBe(200);
        expect(detail.body.data.id).toBe(customerId);
        expect(detail.body.data.requests.some((r) => r.id === requestId)).toBe(true);
        expect(detail.body.data.addresses).toEqual([]);
        expect(detail.body.data.tickets).toEqual([]);
        expect(detail.body.data).not.toHaveProperty("password_hash");
        expect((await admin.get("/api/v1/admin/customers/invalid")).status).toBe(422);
    });
    it("revokes logout session", async () => {
        expect((await admin.post("/api/v1/admin/auth/logout")).status).toBe(204);
        expect((await admin.get("/api/v1/admin/auth/me")).status).toBe(401);
    });
});
