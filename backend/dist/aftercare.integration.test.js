import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createHash, randomUUID } from "node:crypto";
import { app } from "./app.js";
import { db } from "./db.js";
const token = randomUUID(), otherToken = randomUUID(), staffToken = randomUUID();
const hash = (value) => createHash("sha256").update(value).digest("hex");
const cookie = `customer_session=${token}`, otherCookie = `customer_session=${otherToken}`, staffCookie = `staff_session=${staffToken}`;
let customerId = "", otherId = "", staffId = "", requestId = "", pendingId = "", categoryId = "", serviceId = "", reviewId = "", notificationId = "", reference = "", technicianId = "";
describe.runIf(Boolean(process.env.DATABASE_URL))("booking aftercare lifecycle", () => {
    beforeAll(async () => {
        expect(["codex-customer-dev", "br-gentle-wind-b4tsvt43"]).toContain(process.env.NEON_BRANCH);
        const rows = await db() `INSERT INTO customers(full_name) VALUES('Aftercare Customer'),('Other Aftercare Customer') RETURNING id,customer_reference`;
        customerId = String(rows[0].id);
        otherId = String(rows[1].id);
        reference = String(rows[0].customer_reference);
        for (const [id, session] of [
            [customerId, token],
            [otherId, otherToken],
        ])
            await db() `INSERT INTO customer_sessions(customer_id,token_hash,expires_at) VALUES(${id},${hash(session)},now()+interval '1 hour')`;
        const uid = randomUUID();
        const staff = await db() `INSERT INTO staff_profiles(email,username,full_name,password_hash,role,must_change_password) VALUES(${`${uid}@example.com`},${`aftercare_${uid.slice(0, 8)}`},'Aftercare Admin','unused','ADMIN',false) RETURNING id`;
        staffId = String(staff[0].id);
        await db() `INSERT INTO staff_sessions(staff_id,token_hash,expires_at) VALUES(${staffId},${hash(staffToken)},now()+interval '1 hour')`;
        const category = await db() `SELECT id FROM appliance_categories WHERE active=true LIMIT 1`;
        categoryId = String(category[0].id);
        const service = await db() `INSERT INTO service_catalogue(appliance_category_id,request_type,slug,name) VALUES(${categoryId},'SERVICE',${randomUUID()},'Aftercare Test Service') RETURNING id`;
        serviceId = String(service[0].id);
        const address = JSON.stringify({
            name: "Aftercare Customer",
            phone: "9876543210",
            line1: "12 Test Road",
            area: "Test Area",
            city: "Chennai",
            state: "Tamil Nadu",
            pinCode: "600001",
        });
        const tech = await db() `INSERT INTO technicians(full_name,phone) VALUES('Completion Test Technician','9876543210') RETURNING id`;
        technicianId = String(tech[0].id);
        for (const status of ["IN_PROGRESS", "REQUESTED"]) {
            const r = await db() `INSERT INTO service_requests(request_number,customer_id,request_type,appliance,service_name,address_snapshot,preferred_date,preferred_time_window,idempotency_key,status) VALUES(${`AF-${randomUUID()}`},${customerId},'SERVICE','Air Conditioner','Test Service',${address}::jsonb,'2099-10-25','09:00-12:00',${randomUUID()},${status}) RETURNING id`;
            const id = String(r[0].id);
            if (status === "IN_PROGRESS") {
                requestId = id;
                await db() `UPDATE service_requests SET assigned_technician_id=${technicianId} WHERE id=${id}`;
            }
            else
                pendingId = id;
            await db() `INSERT INTO request_status_events(request_id,status,note) VALUES(${id},${status},'Test fixture')`;
        }
    });
    afterAll(async () => {
        for (const id of [customerId, otherId].filter(Boolean)) {
            const requests = await db() `SELECT id FROM service_requests WHERE customer_id=${id}`;
            for (const r of requests) {
                await db() `DELETE FROM audit_logs WHERE entity_id=${r.id}`;
                await db() `DELETE FROM request_status_events WHERE request_id=${r.id}`;
            }
            await db() `DELETE FROM support_tickets WHERE customer_id=${id}`;
            await db() `DELETE FROM service_requests WHERE customer_id=${id}`;
            await db() `DELETE FROM customer_sessions WHERE customer_id=${id}`;
            await db() `DELETE FROM customers WHERE id=${id}`;
        }
        if (technicianId)
            await db() `DELETE FROM technicians WHERE id=${technicianId}`;
        if (serviceId)
            await db() `DELETE FROM service_catalogue WHERE id=${serviceId}`;
        if (staffId) {
            await db() `DELETE FROM staff_sessions WHERE staff_id=${staffId}`;
            await db() `DELETE FROM staff_profiles WHERE id=${staffId}`;
        }
    });
    it("uses collision-safe customer references and supports staff search", async () => {
        expect(reference).toMatch(/^CUS-\d{8,}$/);
        const response = await request(app)
            .get("/api/v1/admin/customers")
            .set("Cookie", staffCookie)
            .query({ q: reference });
        expect(response.status).toBe(200);
        expect(response.body.data.some((c) => c.id === customerId)).toBe(true);
    });
    it("requires ownership and completion before accepting a review", async () => {
        expect((await request(app)
            .post(`/api/v1/requests/${requestId}/review`)
            .send({ rating: 5 })).status).toBe(401);
        expect((await request(app)
            .post(`/api/v1/requests/${requestId}/review`)
            .set("Cookie", otherCookie)
            .send({ rating: 5 })).status).toBe(404);
        expect((await request(app)
            .post(`/api/v1/requests/${pendingId}/review`)
            .set("Cookie", cookie)
            .send({ rating: 5 })).status).toBe(409);
        expect((await request(app)
            .post(`/api/v1/requests/${requestId}/review`)
            .set("Cookie", cookie)
            .send({ rating: 8 })).status).toBe(422);
    });
    it("completes work atomically and creates only one completion notification", async () => {
        const response = await request(app)
            .post(`/api/v1/admin/requests/${requestId}/complete`)
            .set("Cookie", staffCookie)
            .send({ version: 1, workSummary: "Work inspected and completed" });
        expect(response.status).toBe(200);
        expect(response.body.data.status).toBe("COMPLETED");
        expect(response.body.data.completed_at).toBeTruthy();
        expect((await request(app)
            .post(`/api/v1/admin/requests/${requestId}/complete`)
            .set("Cookie", staffCookie)
            .send({ version: 1, workSummary: "Repeated completion" })).status).toBe(200);
        const reports = await db() `SELECT * FROM completion_reports WHERE request_id=${requestId}`;
        expect(reports).toHaveLength(1);
        expect(reports[0].work_summary).toBe("Work inspected and completed");
        expect(reports[0].completed_by).toBe(staffId);
        const notifications = await request(app)
            .get("/api/v1/notifications")
            .set("Cookie", cookie);
        expect(notifications.status).toBe(200);
        const matching = notifications.body.data.filter((n) => n.request_id === requestId);
        expect(matching).toHaveLength(1);
        notificationId = matching[0].id;
        const events = await db() `SELECT actor_staff_id FROM request_status_events WHERE request_id=${requestId} AND status='COMPLETED'`;
        expect(events).toHaveLength(1);
        expect(events[0].actor_staff_id).toBe(staffId);
    });
    it("protects completion validation, state and the generic status endpoint", async () => {
        expect((await request(app)
            .post(`/api/v1/admin/requests/${pendingId}/complete`)
            .send({ workSummary: "Done" })).status).toBe(401);
        expect((await request(app)
            .post(`/api/v1/admin/requests/not-a-uuid/complete`)
            .set("Cookie", staffCookie)
            .send({ workSummary: "Done" })).status).toBe(422);
        expect((await request(app)
            .post(`/api/v1/admin/requests/${pendingId}/complete`)
            .set("Cookie", staffCookie)
            .send({ workSummary: " " })).status).toBe(422);
        expect((await request(app)
            .post(`/api/v1/admin/requests/${pendingId}/complete`)
            .set("Cookie", staffCookie)
            .send({ workSummary: "Done" })).status).toBe(409);
        expect((await request(app)
            .post(`/api/v1/admin/requests/${pendingId}/status`)
            .set("Cookie", staffCookie)
            .send({ status: "COMPLETED", note: "Bypass attempt", version: 1 })).status).toBe(422);
    });
    it("enforces completion prerequisites, roles and filter validation", async () => {
        const post = (body) => request(app)
            .post(`/api/v1/admin/requests/${pendingId}/complete`)
            .set("Cookie", staffCookie)
            .send(body);
        expect((await post({ workSummary: "Done", attachmentIds: [randomUUID()] }))
            .status).toBe(422);
        await db() `UPDATE service_requests SET status_source='WORKFLOW',status='IN_PROGRESS' WHERE id=${pendingId}`;
        try {
            expect((await post({ workSummary: "Done" })).body.error.code).toBe("TECHNICIAN_REQUIRED");
            await db() `UPDATE service_requests SET assigned_technician_id=${technicianId} WHERE id=${pendingId}`;
            expect((await post({ workSummary: "Done", version: 99 })).body.error.code).toBe("STALE_REQUEST");
            await db() `UPDATE service_requests SET status_source='WORKFLOW',status='ESTIMATE_PENDING_APPROVAL' WHERE id=${pendingId}`;
            expect((await post({ workSummary: "Done" })).status).toBe(409);
            await db() `UPDATE staff_profiles SET role='SUPPORT_AGENT' WHERE id=${staffId}`;
            expect((await post({ workSummary: "Done" })).status).toBe(403);
        }
        finally {
            await db() `UPDATE staff_profiles SET role='ADMIN' WHERE id=${staffId}`;
            await db() `UPDATE service_requests SET status_source='WORKFLOW',status='REQUESTED',assigned_technician_id=NULL WHERE id=${pendingId}`;
        }
        expect((await request(app)
            .get("/api/v1/admin/requests")
            .query({ page: 1.5 })
            .set("Cookie", staffCookie)).status).toBe(422);
        expect((await request(app)
            .get("/api/v1/admin/requests")
            .query({ from: "bad-date" })
            .set("Cookie", staffCookie)).status).toBe(422);
        expect((await request(app)
            .get("/api/v1/admin/operations")
            .set("Cookie", staffCookie)).status).toBe(200);
    });
    it("completes installations concurrently with one report and customer-visible summary", async () => {
        const fixture = await db() `INSERT INTO service_requests(request_number,customer_id,request_type,appliance,service_name,address_snapshot,preferred_date,preferred_time_window,idempotency_key,status,assigned_technician_id) SELECT ${`INSTALL-${randomUUID()}`},customer_id,'INSTALLATION',appliance,'Installation',address_snapshot,preferred_date,preferred_time_window,${randomUUID()},'IN_PROGRESS',${technicianId} FROM service_requests WHERE id=${requestId} RETURNING id`;
        const id = String(fixture[0].id);
        const responses = await Promise.all([1, 2].map(() => request(app)
            .post(`/api/v1/admin/requests/${id}/complete`)
            .set("Cookie", staffCookie)
            .send({
            workSummary: "Installation completed and tested",
            completionNotes: "Customer confirmed operation",
            attachmentIds: [],
        })));
        expect(responses.map((r) => r.status)).toEqual([200, 200]);
        const reports = await db() `SELECT * FROM completion_reports WHERE request_id=${id}`;
        const events = await db() `SELECT * FROM request_status_events WHERE request_id=${id} AND status='COMPLETED'`;
        const notifications = await db() `SELECT id FROM customer_notifications WHERE request_id=${id}`;
        expect(reports).toHaveLength(1);
        expect(events).toHaveLength(1);
        expect(notifications).toHaveLength(1);
        expect(events[0].previous_status).toBe("IN_PROGRESS");
        const customer = await request(app)
            .get(`/api/v1/requests/${id}`)
            .set("Cookie", cookie);
        expect(customer.body.data.work_summary).toBe("Installation completed and tested");
        expect((await request(app)
            .get(`/api/v1/requests/${id}`)
            .set("Cookie", otherCookie)).status).toBe(404);
        const list = await request(app)
            .get("/api/v1/admin/requests")
            .query({
            status: "COMPLETED",
            type: "INSTALLATION",
            q: reference,
            technicianId,
        })
            .set("Cookie", staffCookie);
        expect(list.status).toBe(200);
        expect(list.body.data.some((r) => r.id === id)).toBe(true);
    });
    it("keeps notifications and reminder preferences private and durable", async () => {
        expect((await request(app)
            .patch(`/api/v1/notifications/${notificationId}/read`)
            .set("Cookie", otherCookie)).status).toBe(404);
        const read = await request(app)
            .patch(`/api/v1/notifications/${notificationId}/read`)
            .set("Cookie", cookie);
        expect(read.status).toBe(200);
        expect(read.body.data.read_at).toBeTruthy();
        expect((await request(app)
            .patch(`/api/v1/requests/${requestId}/review-reminder`)
            .set("Cookie", otherCookie)).status).toBe(404);
        const dismissed = await request(app)
            .patch(`/api/v1/requests/${requestId}/review-reminder`)
            .set("Cookie", cookie);
        expect(dismissed.status).toBe(200);
        expect(dismissed.body.data.review_reminder_dismissed_at).toBeTruthy();
    });
    it("accepts exactly one review during concurrent submission", async () => {
        const results = await Promise.all([1, 2].map(() => request(app)
            .post(`/api/v1/requests/${requestId}/review`)
            .set("Cookie", cookie)
            .send({
            rating: 2,
            comment: "The visit was delayed",
            tags: ["Delayed service"],
        })));
        expect(results.map((r) => r.status).sort()).toEqual([201, 201]);
        expect(results[0].body.data.id).toBe(results[1].body.data.id);
        reviewId = results.find((r) => r.status === 201).body.data.id;
        const mine = await request(app)
            .get(`/api/v1/requests/${requestId}/review`)
            .set("Cookie", cookie);
        expect(mine.body.data.rating).toBe(2);
        expect(mine.body.data).not.toHaveProperty("handling_status");
        const list = await request(app)
            .get("/api/v1/requests")
            .set("Cookie", cookie);
        expect(list.body.data.find((r) => r.id === requestId)
            .review_id).toBe(reviewId);
    });
    it("lets staff investigate feedback without changing the customer rating", async () => {
        const list = await request(app)
            .get("/api/v1/admin/feedback")
            .set("Cookie", staffCookie)
            .query({ q: reference, rating: "2", attention: "true" });
        expect(list.status).toBe(200);
        expect(list.body.data.some((r) => r.id === reviewId)).toBe(true);
        const tampered = await request(app)
            .patch(`/api/v1/admin/feedback/${reviewId}/handling`)
            .set("Cookie", staffCookie)
            .send({ status: "RESOLVED", note: "Tamper attempt", rating: 5 });
        expect(tampered.status).toBe(422);
        expect((await request(app)
            .patch(`/api/v1/admin/feedback/${reviewId}/handling`)
            .set("Cookie", cookie)
            .send({ status: "RESOLVED", note: "Not staff" })).status).toBe(401);
        const changed = await request(app)
            .patch(`/api/v1/admin/feedback/${reviewId}/handling`)
            .set("Cookie", staffCookie)
            .send({ status: "IN_REVIEW", note: "Investigating delayed visit" });
        expect(changed.status).toBe(200);
        const note = await request(app)
            .post(`/api/v1/admin/feedback/${reviewId}/notes`)
            .set("Cookie", staffCookie)
            .send({ note: "Called the operations team" });
        expect(note.status).toBe(201);
        const detail = await request(app)
            .get(`/api/v1/admin/feedback/${reviewId}`)
            .set("Cookie", staffCookie);
        expect(detail.body.data.notes).toHaveLength(1);
        expect(detail.body.data.history).toHaveLength(1);
        expect(detail.body.data.rating).toBe(2);
        const summary = await request(app)
            .get("/api/v1/admin/feedback/summary")
            .set("Cookie", staffCookie);
        expect(summary.status).toBe(200);
        expect(summary.body.data.low_ratings).toBeGreaterThanOrEqual(1);
        const filtered = await Promise.all([
            {
                q: reference,
                status: "COMPLETED",
                type: "SERVICE",
                technicianId,
                rating: "2",
                from: "2000-01-01",
                to: "2100-01-01",
            },
            { q: reference, status: "COMPLETED", rating: "5" },
            { q: reference, status: "COMPLETED", to: "2000-01-01" },
        ].map((query) => request(app)
            .get("/api/v1/admin/requests")
            .set("Cookie", staffCookie)
            .query(query)));
        expect(filtered.every((result) => result.status === 200)).toBe(true);
        expect(filtered[0].body.data.some((r) => r.id === requestId)).toBe(true);
        expect(filtered[1].body.data).toHaveLength(0);
        expect(filtered[2].body.data).toHaveLength(0);
        const audit = await db() `SELECT actor_staff_id FROM audit_logs WHERE entity_id=${requestId} AND action='REQUEST_COMPLETED'`;
        expect(audit).toHaveLength(1);
        expect(audit[0].actor_staff_id).toBe(staffId);
        const firstTicket = await request(app)
            .post(`/api/v1/admin/feedback/${reviewId}/support`)
            .set("Cookie", staffCookie);
        const repeatedTicket = await request(app)
            .post(`/api/v1/admin/feedback/${reviewId}/support`)
            .set("Cookie", staffCookie);
        expect(firstTicket.status).toBe(200);
        expect(firstTicket.body.data.id).toBe(repeatedTicket.body.data.id);
        const tickets = await request(app)
            .get("/api/v1/admin/support/tickets")
            .set("Cookie", staffCookie);
        expect(tickets.body.data.some((ticket) => ticket.id === firstTicket.body.data.id)).toBe(true);
    });
    it("cancels only eligible owned requests with a versioned reason", async () => {
        expect((await request(app)
            .post(`/api/v1/requests/${pendingId}/cancel`)
            .set("Cookie", otherCookie)
            .send({ version: 1, reason: "Plans changed" })).status).toBe(404);
        expect((await request(app)
            .post(`/api/v1/requests/${requestId}/cancel`)
            .set("Cookie", cookie)
            .send({ version: 2, reason: "Plans changed" })).status).toBe(409);
        const results = await Promise.all([1, 2].map(() => request(app)
            .post(`/api/v1/requests/${pendingId}/cancel`)
            .set("Cookie", cookie)
            .send({ version: 1, reason: "Plans changed" })));
        expect(results.map((r) => r.status).sort()).toEqual([200, 200]);
        const events = await db() `SELECT note FROM request_status_events WHERE request_id=${pendingId} AND status='CANCELLED'`;
        expect(events).toHaveLength(1);
        expect(events[0].note).toBe("Plans changed");
    });
    it("creates one booking and initial timeline event during an idempotent retry", async () => {
        const body = {
            applianceCategoryId: categoryId,
            serviceId,
            details: { description: "" },
            address: {
                name: "Test Customer",
                phone: "9876543210",
                line1: "12 Test Road",
                area: "Test Area",
                city: "Chennai",
                state: "Tamil Nadu",
                pinCode: "600001",
            },
            preferredDate: "2099-10-25",
            preferredTimeWindow: "09:00-12:00",
            idempotencyKey: randomUUID(),
        };
        const results = await Promise.all([1, 2].map(() => request(app)
            .post("/api/v1/requests/service")
            .set("Cookie", cookie)
            .send(body)));
        expect(results.map((r) => r.status).sort()).toEqual([201, 201]);
        expect(results[0].body.data.id).toBe(results[1].body.data.id);
        const events = await db() `SELECT id FROM request_status_events WHERE request_id=${results[0].body.data.id}`;
        expect(events).toHaveLength(1);
        await db() `UPDATE mutation_results SET expires_at=now()-interval '1 second' WHERE actor_scope=${"customer:" + customerId} AND operation_key=${body.idempotencyKey}`;
        const changed = await request(app)
            .post("/api/v1/requests/service")
            .set("Cookie", cookie)
            .send({ ...body, preferredDate: "2099-10-26" });
        expect(changed.status).toBe(409);
    });
    it("links customer support to an owned request only", async () => {
        const body = {
            requestId,
            subject: "Completion question",
            message: "Please discuss the completed service with me.",
        };
        expect((await request(app)
            .post("/api/v1/support/tickets")
            .set("Cookie", otherCookie)
            .send(body)).status).toBe(404);
        const saved = await request(app)
            .post("/api/v1/support/tickets")
            .set("Cookie", cookie)
            .send(body);
        expect(saved.status).toBe(201);
        expect(saved.body.data.request_id).toBe(requestId);
    });
});
