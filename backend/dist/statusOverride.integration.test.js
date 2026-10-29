import { beforeAll, afterAll, describe, it, expect } from "vitest";
import request from "supertest";
import { randomUUID, createHash } from "node:crypto";
import { app } from "./app.js";
import { db } from "./db.js";
const suffix = randomUUID(), st = randomUUID(), ct = randomUUID(), supportToken = randomUUID(), techToken = randomUUID(), otherTechToken = randomUUID();
const hash = (s) => createHash("sha256").update(s).digest("hex");
let staff = "", support = "", customer = "", category = "", otherCategory = "", service = "", booking = "", technician = "", otherTech = "";
const opt = {
    id: randomUUID(),
    name: "Inspection",
    description: "Inspect appliance",
    active: true,
    priceType: "INSPECTION",
    amountPaise: 20000,
    maximumPaise: null,
    included: "Diagnosis",
    exclusions: "Parts",
    durationMinutes: 30,
};
const opt2 = { ...opt, id: randomUUID(), name: "Cleaning", amountPaise: 30000 };
const admin = (method, path, token = st) => {
    const agent = request(app);
    return agent[method]("/api/v1/admin" + path).set("Cookie", `staff_session=${token}`);
};
const own = (path) => request(app)
    .get("/api/v1" + path)
    .set("Cookie", `customer_session=${ct}`);
async function override(status, extra = {}) {
    const current = (await own(`/requests/${booking}`)).body.data;
    return admin("patch", `/requests/${booking}/status`).send({
        status,
        reason: "Verified administrative change",
        expectedVersion: current.version,
        ...(status === "TECHNICIAN_ASSIGNED" ? { technicianId: technician } : {}),
        ...extra,
    });
}
describe.runIf(Boolean(process.env.DATABASE_URL))("administrative overrides, appliance isolation and authorized phone contact", () => {
    beforeAll(async () => {
        const identity = (await db().query("SELECT current_setting('neon.project_id',true) AS project,current_setting('neon.branch_id',true) AS branch", []))[0];
        expect(identity).toEqual({
            project: "snowy-hill-87120042",
            branch: "br-gentle-wind-b4tsvt43",
        });
        for (const [role, token] of [
            ["ADMIN", st],
            ["SUPPORT_AGENT", supportToken],
        ]) {
            const id = String((await db() `INSERT INTO staff_profiles(email,username,full_name,password_hash,role,must_change_password) VALUES(${token + "@example.com"},${"ov" + token.slice(0, 8)},'Override QA','unused',${role},false) RETURNING id`)[0].id);
            if (role === "ADMIN")
                staff = id;
            else
                support = id;
            await db() `INSERT INTO staff_sessions(staff_id,token_hash,expires_at) VALUES(${id},${hash(token)},now()+interval '1 hour')`;
        }
        customer = String((await db() `INSERT INTO customers(full_name) VALUES('Override Customer') RETURNING id`)[0].id);
        await db() `INSERT INTO customer_sessions(customer_id,token_hash,expires_at) VALUES(${customer},${hash(ct)},now()+interval '1 hour')`;
        category = String((await db() `INSERT INTO appliance_categories(slug,name) VALUES(${"override-" + suffix},'Override Appliance') RETURNING id`)[0].id);
        otherCategory = String((await db() `INSERT INTO appliance_categories(slug,name) VALUES(${"other-" + suffix},'Other Override Appliance') RETURNING id`)[0].id);
        service = String((await db() `INSERT INTO service_catalogue(appliance_category_id,request_type,slug,name,booking_options,publication_status) VALUES(${category},'SERVICE',${suffix},'Override Inspection',${JSON.stringify([opt, opt2])}::jsonb,'PUBLISHED') RETURNING id`)[0].id);
        for (const token of [techToken, otherTechToken]) {
            const id = String((await db() `INSERT INTO technicians(full_name,phone,skills,service_area,verification_status) VALUES('Override Technician','9876543211','Override Appliance','Adyar','VERIFIED') RETURNING id`)[0].id);
            if (token === techToken)
                technician = id;
            else
                otherTech = id;
            await db() `INSERT INTO technician_accounts(technician_id,email,status,must_change_password) VALUES(${id},${token + "@example.com"},'ACTIVE',false)`;
            await db() `INSERT INTO technician_sessions(technician_id,token_hash,csrf_token,expires_at) VALUES(${id},${hash(token)},${"a".repeat(43)},now()+interval '1 hour')`;
        }
    });
    afterAll(async () => {
        if (customer)
            await db() `DELETE FROM service_requests WHERE customer_id=${customer}`;
        if (service)
            await db() `DELETE FROM service_catalogue WHERE id=${service}`;
        if (category || otherCategory)
            await db() `DELETE FROM appliance_categories WHERE id IN (${category || null}::uuid,${otherCategory || null}::uuid)`;
        if (technician || otherTech)
            await db() `DELETE FROM technicians WHERE id IN (${technician || null}::uuid,${otherTech || null}::uuid)`;
        if (customer)
            await db() `DELETE FROM customers WHERE id=${customer}`;
        for (const [id, role] of [
            [staff, "ADMIN"],
            [support, "SUPPORT_AGENT"],
        ])
            if (id) {
                await db() `DELETE FROM mutation_results WHERE actor_scope=${"staff:" + id + ":" + role}`;
                await db() `DELETE FROM staff_profiles WHERE id=${id}`;
            }
    });
    it("books multiple published options once, normalizes contact and snapshots all prices", async () => {
        const body = {
            applianceCategoryId: category,
            serviceId: service,
            details: {
                optionIds: JSON.stringify([opt.id, opt2.id]),
                description: "Samsung; inspection and cleaning",
            },
            address: {
                name: "Booking Contact",
                phone: "9876543210",
                line1: "12 Test street",
                area: "Adyar",
                city: "Chennai",
                state: "Tamil Nadu",
                pinCode: "600020",
            },
            preferredDate: "2099-11-10",
            preferredTimeWindow: "09:00-10:00",
            idempotencyKey: randomUUID(),
        };
        const replies = await Promise.all([1, 2, 3].map(() => request(app)
            .post("/api/v1/requests/service")
            .set("Cookie", `customer_session=${ct}`)
            .set("Idempotency-Key", body.idempotencyKey)
            .send(body)));
        expect(replies.every((r) => r.status === 201 || r.status === 200), JSON.stringify(replies.map((r) => r.body))).toBe(true);
        booking = replies[0].body.data.id;
        expect(new Set(replies.map((r) => r.body.data.id)).size).toBe(1);
        expect(replies[0].body.data.address_snapshot.phone).toBe("+919876543210");
        expect(replies[0].body.data.details._priceSnapshots.map((p) => p.amountPaise)).toEqual([20000, 30000]);
        const scoped = await request(app).get(`/api/v1/catalogue/appliances/${category}/services`);
        expect(scoped.status).toBe(200);
        expect(scoped.body.data.every((s) => s.appliance_category_id === category)).toBe(true);
        expect((await request(app).get(`/api/v1/catalogue/appliances/${otherCategory}/services`)).body.data).toHaveLength(0);
        await db() `UPDATE service_catalogue SET booking_options=${JSON.stringify([{ ...opt, amountPaise: 99900 }, opt2])}::jsonb WHERE id=${service}`;
        expect((await own(`/requests/${booking}`)).body.data.details._priceSnapshots[0]
            .amountPaise).toBe(20000);
        await admin("patch", `/catalogue/appliances/${category}`)
            .send({ iconObjectKey: null, publicationStatus: "DRAFT" })
            .expect(200);
        expect((await request(app).get("/api/v1/catalogue/appliances")).body.data.some((a) => a.id === category)).toBe(false);
        await request(app)
            .get(`/api/v1/catalogue/appliances/${category}/services`)
            .expect(404);
        await request(app)
            .post("/api/v1/requests/service")
            .set("Cookie", `customer_session=${ct}`)
            .send({ ...body, idempotencyKey: randomUUID() })
            .expect(422);
        await admin("patch", `/catalogue/appliances/${category}`)
            .send({ iconObjectKey: null, publicationStatus: "PUBLISHED" })
            .expect(200);
    });
    it("overrides Pending directly to In Progress atomically with actor, reason, deduplicated events and no invented assignment", async () => {
        const version = (await own(`/requests/${booking}`)).body.data.version, key = randomUUID(), payload = {
            status: "IN_PROGRESS",
            reason: "Verified actual service progress",
            expectedVersion: version,
        };
        await admin("patch", `/requests/${booking}/status`, supportToken)
            .send(payload)
            .expect(403);
        const replies = await Promise.all([1, 2, 3].map(() => admin("patch", `/requests/${booking}/status`)
            .set("Idempotency-Key", key)
            .send(payload)));
        expect(replies.every((r) => r.status === 200), JSON.stringify(replies.map((r) => r.body))).toBe(true);
        const current = (await own(`/requests/${booking}`)).body.data;
        expect(current.status).toBe("IN_PROGRESS");
        expect(current.assigned_technician_id).toBeNull();
        expect(current.status_source).toBe("ADMIN_OVERRIDE");
        const overrides = await db() `SELECT * FROM request_status_overrides WHERE request_id=${booking}`;
        expect(overrides).toHaveLength(1);
        expect(overrides[0]).toMatchObject({
            previous_status: "REQUESTED",
            new_status: "IN_PROGRESS",
            staff_id: staff,
            reason: payload.reason,
        });
        expect(await db() `SELECT id FROM request_status_events WHERE request_id=${booking} AND status='IN_PROGRESS'`).toHaveLength(1);
        expect(await db() `SELECT id FROM customer_notifications WHERE request_id=${booking} AND kind LIKE 'ADMIN_STATUS:%'`).toHaveLength(1);
        await admin("patch", `/requests/${booking}/status`)
            .send({ ...payload, status: "ON_HOLD" })
            .expect(409);
        expect((await own(`/requests/${booking}/timeline`)).body.data.some((e) => e.note.includes(payload.reason))).toBe(false);
    });
    it("records manual completion, preserves feedback and original completion on reopening and recompletion", async () => {
        const completion = await override("COMPLETED", { reason: undefined });
        expect(completion.status, JSON.stringify(completion.body)).toBe(200);
        expect((await request(app)
            .post(`/api/v1/requests/${booking}/review`)
            .set("Cookie", `customer_session=${ct}`)
            .send({ rating: 5, comment: "Verified work", tags: [] })).status).toBe(201);
        const report = (await db() `SELECT * FROM completion_reports WHERE request_id=${booking}`)[0];
        expect(report.work_summary).toBe("Administrative completion recorded by operations.");
        expect((await override("PENDING")).status).toBe(422);
        expect((await override("PENDING", { confirmReopen: true })).status).toBe(200);
        expect((await own(`/requests/${booking}`)).body.data.completed_at).toBeNull();
        expect((await own(`/requests/${booking}/review`)).body.data.rating).toBe(5);
        await request(app)
            .post(`/api/v1/requests/${booking}/review`)
            .set("Cookie", `customer_session=${ct}`)
            .send({ rating: 4, comment: "Again", tags: [] })
            .expect(409);
        await db() `UPDATE technicians SET skills='Unrelated appliance',availability='UNAVAILABLE' WHERE id=${technician}`;
        expect((await override("TECHNICIAN_ASSIGNED")).status).toBe(200);
        expect((await own(`/requests/${booking}`)).body.data.assigned_technician_id).toBe(technician);
        expect((await override("COMPLETED", { reason: undefined })).status).toBe(200);
        expect(await db() `SELECT id FROM completion_reports WHERE request_id=${booking}`).toEqual([{ id: report.id }]);
        expect(await db() `SELECT id FROM technician_work_reports WHERE request_id=${booking}`).toHaveLength(0);
    });
    it("shows booking phone only to the accepted owner and cancellation revokes access without resurrecting acceptance on reopening", async () => {
        expect((await override("IN_PROGRESS", { confirmReopen: true })).status).toBe(200);
        const tech = (token, path) => request(app)
            .get("/api/v1/technician" + path)
            .set("Cookie", `technician_session=${token}`);
        const detail = await tech(techToken, `/jobs/${booking}`);
        expect(detail.status, JSON.stringify(detail.body)).toBe(200);
        expect(detail.body.data.customer.phone_e164).toBe("+919876543210");
        expect(detail.body.data.address_snapshot).toMatchObject({
            line1: "12 Test street",
            area: "Adyar",
        });
        const list = await tech(techToken, "/jobs?tab=active");
        expect(list.body.data.find((j) => j.id === booking)
            .customer_phone).toBe("+919876543210");
        expect(list.body.data.find((j) => j.id === booking)
            .address_snapshot).toMatchObject({ line1: "12 Test street", area: "Adyar" });
        await tech(otherTechToken, `/jobs/${booking}`).expect(404);
        const offered = (await db() `INSERT INTO service_requests(request_number,customer_id,request_type,appliance,service_name,address_snapshot,preferred_date,preferred_time_window,idempotency_key) VALUES(${"OFFER-" + suffix},${customer},'SERVICE','Override Appliance','Private offer',${JSON.stringify({ phone: "+919876543210", line1: "Private test address", area: "Adyar" })}::jsonb,'2099-11-11','09:00-10:00',${randomUUID()}) RETURNING id`)[0];
        await db() `INSERT INTO technician_assignments(request_id,technician_id,state,offered_by) VALUES(${offered.id},${otherTech},'OFFERED',${staff})`;
        const offer = await tech(otherTechToken, `/jobs/${offered.id}`);
        expect(offer.status).toBe(200);
        expect(offer.body.data.customer).toBeUndefined();
        expect(JSON.stringify(offer.body)).not.toContain("9876543210");
        expect(offer.body.data.address_snapshot).toBeUndefined();
        const offers = await tech(otherTechToken, "/jobs?tab=pending");
        expect(offers.body.data.some((j) => j.id === offered.id)).toBe(false);
        await admin("patch", `/requests/${offered.id}/status`)
            .send({
            status: "TECHNICIAN_ASSIGNED",
            reason: "Administrator set manual status before selecting another technician",
            expectedVersion: 1,
            technicianId: otherTech,
        })
            .expect(200);
        const manualAssignment = await tech(otherTechToken, `/jobs/${offered.id}`);
        expect(manualAssignment.status).toBe(200);
        expect(manualAssignment.body.data.assignment_state).toBe("ACCEPTED");
        expect(manualAssignment.body.data.customer).toBeDefined();
        expect(manualAssignment.body.data.address_snapshot.line1).toBe("Private test address");
        expect((await own(`/requests/${offered.id}`)).body.data.assigned_technician_id).toBe(otherTech);
        expect((await db() `SELECT state FROM technician_assignments WHERE request_id=${offered.id}`)
            .map((row) => row.state)
            .sort()).toEqual(["ACCEPTED", "CANCELLED"]);
        // Historical/customer cancellations retained technician and visit pointers.
        await db() `UPDATE service_requests SET status='CANCELLED',assigned_technician_id=${otherTech},confirmed_date='2099-11-11',confirmed_time_window='09:00-10:00',version=version+1 WHERE id=${offered.id}`;
        const legacy = (await own(`/requests/${offered.id}`)).body.data;
        await admin("patch", `/requests/${offered.id}/status`)
            .send({
            status: "PENDING",
            reason: "Reopen a historical cancelled request",
            expectedVersion: legacy.version,
            confirmReopen: true,
        })
            .expect(200);
        const reopened = (await own(`/requests/${offered.id}`)).body.data;
        expect(reopened.assigned_technician_id).toBeNull();
        expect(reopened.confirmed_date).toBeNull();
        expect((await override("CANCELLED")).status).toBe(200);
        await tech(techToken, `/jobs/${booking}`).expect(404);
        expect((await override("PENDING")).status).toBe(422);
        expect((await override("PENDING", { confirmReopen: true })).status).toBe(200);
        await tech(techToken, `/jobs/${booking}`).expect(404);
        expect((await own(`/requests/${booking}`)).body.data.assigned_technician_id).toBeNull();
        expect(await db() `SELECT id FROM technician_assignments WHERE request_id=${booking} AND state IN ('OFFERED','ACCEPTED')`).toHaveLength(0);
    });
    it("competing versions commit only one override and one history event", async () => {
        const previous = (await own(`/requests/${booking}`)).body.data;
        const replies = await Promise.all(["IN_PROGRESS", "ON_HOLD"].map((status) => admin("patch", `/requests/${booking}/status`)
            .set("Idempotency-Key", randomUUID())
            .send({
            status,
            reason: "Competing authorized update",
            expectedVersion: previous.version,
        })));
        expect(replies.map((r) => r.status).sort(), JSON.stringify(replies.map((r) => ({ status: r.status, body: r.body })))).toEqual([200, 409]);
        const current = (await own(`/requests/${booking}`)).body.data;
        expect(current.version).toBe(previous.version + 1);
        expect(await db() `SELECT id FROM request_status_overrides WHERE request_id=${booking} AND request_version=${current.version}`).toHaveLength(1);
        expect(await db() `SELECT id FROM customer_notifications WHERE request_id=${booking} AND kind=${"ADMIN_STATUS:" + current.version}`).toHaveLength(1);
    });
});
