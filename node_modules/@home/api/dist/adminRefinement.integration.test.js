import { beforeAll, afterAll, describe, it, expect } from "vitest";
import request from "supertest";
import { randomUUID, createHash } from "node:crypto";
import { app } from "./app.js";
import { db } from "./db.js";
import { hashPassword } from "./security/password.js";
const staffToken = randomUUID(), otherStaffToken = randomUUID(), customerToken = randomUUID(), otherToken = randomUUID();
const hash = (s) => createHash("sha256").update(s).digest("hex");
const staffCookie = `staff_session=${staffToken}`, customerCookie = `customer_session=${customerToken}`, otherCookie = `customer_session=${otherToken}`;
let staffId = "", operationsStaffId = "", customerId = "", otherId = "", technicianId = "", serviceId = "", ticketId = "";
const requests = [];
describe.runIf(Boolean(process.env.DATABASE_URL))("admin refinement and shared support", () => {
    beforeAll(async () => {
        expect(["codex-customer-dev", "br-gentle-wind-b4tsvt43"]).toContain(process.env.NEON_BRANCH);
        const customers = await db() `INSERT INTO customers(full_name) VALUES('Refinement Customer'),('Refinement Other Customer') RETURNING id`;
        customerId = String(customers[0].id);
        otherId = String(customers[1].id);
        for (const [id, token] of [
            [customerId, customerToken],
            [otherId, otherToken],
        ])
            await db() `INSERT INTO customer_sessions(customer_id,token_hash,expires_at) VALUES(${id},${hash(token)},now()+interval '1 hour')`;
        const staff = await db() `INSERT INTO staff_profiles(email,username,full_name,password_hash,role,must_change_password) VALUES(${`${randomUUID()}@example.com`},${`refine_${randomUUID().slice(0, 8)}`},'Refinement Admin',${await hashPassword("Original-Test-Password-42")},'ADMIN',true) RETURNING id`;
        staffId = String(staff[0].id);
        for (const token of [staffToken, otherStaffToken])
            await db() `INSERT INTO staff_sessions(staff_id,token_hash,expires_at) VALUES(${staffId},${hash(token)},now()+interval '1 hour')`;
    });
    afterAll(async () => {
        for (const id of requests) {
            await db() `DELETE FROM audit_logs WHERE entity_id=${id}`;
            await db() `DELETE FROM request_status_events WHERE request_id=${id}`;
            await db() `DELETE FROM service_requests WHERE id=${id}`;
        }
        if (ticketId)
            await db() `DELETE FROM support_tickets WHERE id=${ticketId}`;
        if (technicianId)
            await db() `DELETE FROM technicians WHERE id=${technicianId}`;
        if (serviceId)
            await db() `DELETE FROM service_catalogue WHERE id=${serviceId}`;
        for (const id of [customerId, otherId].filter(Boolean)) {
            await db() `DELETE FROM customer_sessions WHERE customer_id=${id}`;
            await db() `DELETE FROM customers WHERE id=${id}`;
        }
        if (staffId) {
            await db() `DELETE FROM staff_sessions WHERE staff_id=${staffId}`;
            await db() `DELETE FROM staff_profiles WHERE id=${staffId}`;
        }
        if (operationsStaffId) {
            await db() `DELETE FROM staff_sessions WHERE staff_id=${operationsStaffId}`;
            await db() `DELETE FROM staff_profiles WHERE id=${operationsStaffId}`;
        }
    });
    it("serves real dashboard trends and separate new-request counts", async () => {
        const summary = await request(app)
            .get("/api/v1/admin/dashboard/summary")
            .set("Cookie", staffCookie);
        expect(summary.status).toBe(200);
        expect(summary.body.data.new_service_requests).toBeTypeOf("number");
        expect(summary.body.data.new_installation_requests).toBeTypeOf("number");
        const activity = await request(app)
            .get("/api/v1/admin/dashboard/activity")
            .set("Cookie", staffCookie);
        expect(activity.status).toBe(200);
        expect(activity.body.data.trends).toHaveLength(7);
        expect(activity.body.data.alerts.unassigned).toBeTypeOf("number");
    });
    it("creates and assigns a technician without skills or availability fields", async () => {
        const body = {
            fullName: "Refinement Technician",
            phone: "9876543210",
            serviceArea: "Chennai",
            verificationStatus: "VERIFIED",
        };
        const created = await request(app)
            .post("/api/v1/admin/technicians")
            .set("Cookie", staffCookie)
            .send(body);
        expect(created.status).toBe(201);
        expect(created.body.data).not.toHaveProperty("skills");
        expect(created.body.data).not.toHaveProperty("availability");
        technicianId = created.body.data.id;
        const roster = await request(app)
            .get("/api/v1/admin/technicians")
            .set("Cookie", staffCookie);
        const listedTechnician = roster.body.data.find((technician) => technician.id === technicianId);
        expect(listedTechnician).not.toHaveProperty("skills");
        expect(listedTechnician).not.toHaveProperty("availability");
        const operationsToken = randomUUID(), operations = await db() `INSERT INTO staff_profiles(email,username,full_name,password_hash,role,must_change_password) VALUES(${`${randomUUID()}@example.com`},${`ops_${randomUUID().slice(0, 8)}`},'Refinement Operations',${await hashPassword("Original-Test-Password-43")},'OPERATIONS_MANAGER',false) RETURNING id`;
        operationsStaffId = String(operations[0].id);
        await db() `INSERT INTO staff_sessions(staff_id,token_hash,expires_at) VALUES(${operationsStaffId},${hash(operationsToken)},now()+interval '1 hour')`;
        const operationsCookie = `staff_session=${operationsToken}`;
        expect((await request(app)
            .post("/api/v1/admin/technicians")
            .set("Cookie", operationsCookie)
            .send(body)).status).toBe(403);
        expect((await request(app)
            .post(`/api/v1/admin/technicians/${technicianId}/password`)
            .set("Cookie", operationsCookie)
            .send({ temporaryPassword: "Temporary-Password-42!" })).status).toBe(403);
        expect((await request(app)
            .patch(`/api/v1/admin/technicians/${technicianId}/account`)
            .set("Cookie", operationsCookie)
            .send({ status: "SUSPENDED" })).status).toBe(403);
        expect((await request(app)
            .delete(`/api/v1/admin/technicians/${technicianId}`)
            .set("Cookie", operationsCookie)).status).toBe(403);
        const updated = await request(app)
            .patch(`/api/v1/admin/technicians/${technicianId}`)
            .set("Cookie", staffCookie)
            .send(body);
        expect(updated.status).toBe(200);
        const row = await db() `INSERT INTO service_requests(request_number,customer_id,request_type,appliance,service_name,address_snapshot,preferred_date,preferred_time_window,idempotency_key,status) VALUES(${`REF-${randomUUID()}`},${customerId},'SERVICE','Air Conditioner','Test service','{"city":"Chennai"}'::jsonb,'2099-10-25','09:00-12:00',${randomUUID()},'ASSIGNMENT_PENDING') RETURNING id`;
        const id = String(row[0].id);
        requests.push(id);
        const assigned = await request(app)
            .post(`/api/v1/admin/requests/${id}/status`)
            .set("Cookie", staffCookie)
            .send({
            status: "TECHNICIAN_ASSIGNED",
            note: "Assign technician",
            version: 1,
            technicianId,
        });
        expect(assigned.status).toBe(200);
        const customer = await request(app)
            .get(`/api/v1/requests/${id}`)
            .set("Cookie", customerCookie);
        expect(customer.body.data.assigned_technician_name).toBe(body.fullName);
    });
    it("rejects overlapping concurrent appointments while permitting adjacent visits", async () => {
        const first = requests[0];
        const second = await db() `INSERT INTO service_requests(request_number,customer_id,request_type,appliance,service_name,address_snapshot,preferred_date,preferred_time_window,idempotency_key,status,assigned_technician_id) SELECT ${`REF-${randomUUID()}`},customer_id,'INSTALLATION',appliance,service_name,address_snapshot,preferred_date,preferred_time_window,${randomUUID()},'TECHNICIAN_ASSIGNED',assigned_technician_id FROM service_requests WHERE id=${first} RETURNING id`;
        const secondId = String(second[0].id);
        requests.push(secondId);
        const results = await Promise.all([
            [first, 2, "09:00-12:00"],
            [secondId, 1, "10:00-11:00"],
        ].map(([id, version, window]) => request(app)
            .post(`/api/v1/admin/requests/${id}/status`)
            .set("Cookie", staffCookie)
            .send({
            status: "APPOINTMENT_CONFIRMED",
            note: "Confirm visit",
            version,
            confirmedDate: "2099-10-25",
            confirmedTimeWindow: window,
        })));
        expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
        expect(results.find((r) => r.status === 409).body.error.code).toBe("APPOINTMENT_CONFLICT");
        const loser = results[0].status === 409 ? first : secondId;
        const version = loser === first ? 2 : 1;
        const adjacent = await request(app)
            .post(`/api/v1/admin/requests/${loser}/status`)
            .set("Cookie", staffCookie)
            .send({
            status: "APPOINTMENT_CONFIRMED",
            note: "Confirm adjacent visit",
            version,
            confirmedDate: "2099-10-25",
            confirmedTimeWindow: "12:00-13:00",
        });
        expect(adjacent.status).toBe(200);
        const customer = await request(app)
            .get(`/api/v1/requests/${loser}`)
            .set("Cookie", customerCookie);
        expect(customer.body.data.confirmed_time_window).toBe("12:00-13:00");
    });
    it("shares catalogue pricing with customers without fabricating final charges", async () => {
        const categories = await db() `SELECT id FROM appliance_categories WHERE active=true LIMIT 1`;
        const categoryId = String(categories[0].id);
        const service = await request(app)
            .post("/api/v1/admin/catalogue/services")
            .set("Cookie", staffCookie)
            .send({
            name: "Refinement priced service",
            applianceCategoryId: categoryId,
            requestType: "SERVICE",
            formFields: [],
            basePrice: 450.5,
        });
        expect(service.status).toBe(201);
        serviceId = service.body.data.id;
        const list = await request(app)
            .get("/api/v1/services")
            .query({ applianceCategoryId: categoryId });
        expect(Number(list.body.data.find((s) => s.id === serviceId)
            .base_price)).toBe(450.5);
    });
    it("synchronizes support replies and prevents private-note/customer ownership leaks", async () => {
        const ticket = await request(app)
            .post("/api/v1/support/tickets")
            .set("Cookie", customerCookie)
            .send({
            subject: "Refinement support",
            message: "Please update my installation appointment.",
            requestId: requests[0],
        });
        expect(ticket.status).toBe(201);
        ticketId = ticket.body.data.id;
        const searched = await request(app)
            .get("/api/v1/admin/support/tickets")
            .set("Cookie", staffCookie)
            .query({ q: ticket.body.data.ticket_number, limit: 1, page: 1 });
        expect(searched.status).toBe(200);
        expect(searched.body.data[0].id).toBe(ticketId);
        expect(searched.body.meta.total).toBe(1);
        const url = `/api/v1/admin/support/tickets/${ticketId}/messages`, customerUrl = `/api/v1/support/tickets/${ticketId}/messages`;
        expect((await request(app)
            .post(url)
            .set("Cookie", staffCookie)
            .send({ message: "Your visit is confirmed.", visibility: "PUBLIC" })).status).toBe(201);
        expect((await request(app).post(url).set("Cookie", staffCookie).send({
            message: "Private technician discussion",
            visibility: "INTERNAL",
        })).status).toBe(201);
        const customer = await request(app)
            .get(customerUrl)
            .set("Cookie", customerCookie);
        expect(customer.status).toBe(200);
        expect(customer.body.data.messages).toHaveLength(1);
        expect(JSON.stringify(customer.body)).not.toContain("Private technician discussion");
        expect((await request(app).get(customerUrl).set("Cookie", otherCookie)).status).toBe(404);
        expect((await request(app)
            .post(customerUrl)
            .set("Cookie", customerCookie)
            .send({ message: "Leak attempt", visibility: "INTERNAL" })).status).toBe(422);
        expect((await request(app)
            .post(customerUrl)
            .set("Cookie", customerCookie)
            .send({ message: "Thank you, confirmed." })).status).toBe(201);
        const staff = await request(app).get(url).set("Cookie", staffCookie);
        expect(staff.body.data.messages).toHaveLength(3);
        const notices = await db() `SELECT id FROM customer_notifications WHERE customer_id=${customerId} AND kind LIKE 'SUPPORT_%'`;
        expect(notices).toHaveLength(1);
    });
    it("updates own profile and rotates password while revoking other sessions", async () => {
        const profile = await request(app)
            .patch("/api/v1/admin/auth/profile")
            .set("Cookie", staffCookie)
            .send({ fullName: "Updated Refinement Admin" });
        expect(profile.status).toBe(200);
        expect(profile.body.data.full_name).toBe("Updated Refinement Admin");
        const invalid = await request(app)
            .post("/api/v1/admin/auth/password")
            .set("Cookie", staffCookie)
            .send({
            currentPassword: "wrong",
            newPassword: "Replacement-Test-Password-52",
        });
        expect(invalid.status).toBe(403);
        const changed = await request(app)
            .post("/api/v1/admin/auth/password")
            .set("Cookie", staffCookie)
            .send({
            currentPassword: "Original-Test-Password-42",
            newPassword: "Replacement-Test-Password-52",
        });
        expect(changed.status).toBe(200);
        expect((await request(app)
            .get("/api/v1/admin/auth/me")
            .set("Cookie", staffCookie)).status).toBe(200);
        expect((await request(app)
            .get("/api/v1/admin/auth/me")
            .set("Cookie", `staff_session=${otherStaffToken}`)).status).toBe(401);
    });
});
