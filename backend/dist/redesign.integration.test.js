import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import request from "supertest";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { app } from "./app.js";
import { db } from "./db.js";
import { storage, bucket } from "./technicianStorage.js";
const suffix = randomUUID(), staffToken = randomUUID(), customerToken = randomUUID(), otherToken = randomUUID();
const hash = (value) => createHash("sha256").update(value).digest("hex");
const staffCookie = `staff_session=${staffToken}`, customerCookie = `customer_session=${customerToken}`;
let staff = "", customer = "", other = "", category = "", service = "", booking = "", technician = "", csrf = "", media = "", mediaKey = "";
const username = `redesign${suffix.replaceAll("-", "").slice(0, 14)}`, temp = "Temporary!Secure123", permanent = "Permanent!Secure456";
const option = {
    id: randomUUID(),
    name: "Cooling inspection",
    description: "Diagnosis before repair",
    active: true,
    priceType: "INSPECTION",
    amountPaise: 29900,
    maximumPaise: null,
    included: "Inspection",
    exclusions: "Parts quoted separately",
    durationMinutes: 60,
};
const tech = request.agent(app);
const admin = (method, path) => {
    const agent = request(app);
    return agent[method]("/api/v1/admin" + path).set("Cookie", staffCookie);
};
const serviceBody = (status = "PUBLISHED", amount = 29900) => ({
    name: `Redesign Care ${suffix}`,
    applianceCategoryId: category,
    requestType: "SERVICE",
    description: "Isolated integration catalogue",
    publicationStatus: status,
    options: [{ ...option, amountPaise: amount }],
    formFields: [],
    basePrice: amount / 100,
});
async function current() {
    return (await admin("get", `/requests/${booking}`)).body.data;
}
async function status(target, extra = {}) {
    const r = await admin("post", `/requests/${booking}/status`).send({
        status: target,
        version: (await current()).version,
        note: "Redesign integration workflow",
        ...extra,
    });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    return r.body.data;
}
describe.runIf(Boolean(process.env.DATABASE_URL))("real catalogue, onboarding, inbox and scheduling redesign", () => {
    beforeAll(async () => {
        const identity = (await db().query("SELECT current_setting('neon.project_id',true) AS project_id,current_setting('neon.branch_id',true) AS branch_id", []))[0];
        expect(identity?.project_id).toBe("snowy-hill-87120042");
        expect(identity?.branch_id).toBe("br-gentle-wind-b4tsvt43");
        staff = String((await db() `INSERT INTO staff_profiles(email,username,full_name,password_hash,role,must_change_password) VALUES(${suffix + "@example.com"},${"qa" + suffix.slice(0, 8)},'Redesign QA','unused','ADMIN',false) RETURNING id`)[0].id);
        await db() `INSERT INTO staff_sessions(staff_id,token_hash,expires_at) VALUES(${staff},${hash(staffToken)},now()+interval '1 hour')`;
        for (const [token, label] of [
            [customerToken, "Redesign Customer"],
            [otherToken, "Other Customer"],
        ]) {
            const id = String((await db() `INSERT INTO customers(full_name) VALUES(${label}) RETURNING id`)[0].id);
            if (token === customerToken)
                customer = id;
            else
                other = id;
            await db() `INSERT INTO customer_sessions(customer_id,token_hash,expires_at) VALUES(${id},${hash(token)},now()+interval '1 hour')`;
        }
        category = String((await db() `INSERT INTO appliance_categories(slug,name) VALUES(${"redesign-" + suffix},'Redesign Test Appliance') RETURNING id`)[0].id);
    });
    afterAll(async () => {
        if (customer)
            await db() `DELETE FROM service_requests WHERE customer_id=${customer}`;
        if (service)
            await db() `DELETE FROM service_catalogue WHERE id=${service}`;
        if (media)
            await db() `DELETE FROM catalogue_media WHERE id=${media} AND created_by=${staff}`;
        if (mediaKey.startsWith("catalogue/icons/"))
            await storage().send(new DeleteObjectCommand({ Bucket: bucket, Key: mediaKey }));
        if (technician)
            await db() `DELETE FROM technicians WHERE id=${technician}`;
        if (category)
            await db() `DELETE FROM appliance_categories WHERE id=${category}`;
        if (customer || other)
            await db() `DELETE FROM customers WHERE id IN (${customer || null}::uuid,${other || null}::uuid)`;
        if (staff) {
            await db() `DELETE FROM mutation_results WHERE actor_scope=${"staff:" + staff + ":ADMIN"}`;
            await db() `DELETE FROM staff_profiles WHERE id=${staff}`;
        }
    });
    it("validates SVG storage, publishes configured options, and preserves booked prices after edits", async () => {
        const unsafe = await admin("post", "/catalogue/media").send({
            contentType: "image/svg+xml",
            data: Buffer.from('<svg onload="alert(1)"></svg>').toString("base64"),
        });
        expect(unsafe.status).toBe(422);
        const upload = await admin("post", "/catalogue/media").send({
            contentType: "image/svg+xml",
            data: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#2563eb" d="M0 0h24v24H0z"/></svg>').toString("base64"),
        });
        expect(upload.status, JSON.stringify(upload.body)).toBe(201);
        media = upload.body.data.id;
        mediaKey = upload.body.data.object_key;
        const draft = await admin("post", "/catalogue/services").send({
            ...serviceBody("DRAFT"),
            iconObjectKey: mediaKey,
        });
        expect(draft.status, JSON.stringify(draft.body)).toBe(201);
        service = draft.body.data.id;
        expect((await request(app).get("/api/v1/catalogue")).body.data.some((s) => s.id === service)).toBe(false);
        expect((await request(app).get(`/api/v1/catalogue/media/${media}`)).status).toBe(404);
        expect((await admin("patch", `/catalogue/services/${service}`).send(serviceBody())).status).toBe(200);
        const published = (await request(app).get("/api/v1/catalogue")).body.data.find((s) => s.id === service);
        expect(published.booking_options[0].amountPaise).toBe(29900);
        expect(published.icon_url).toBe(`/api/v1/catalogue/media/${media}`);
        const icon = await request(app).get(published.icon_url);
        expect(icon.status).toBe(200);
        expect(icon.headers["content-security-policy"]).toContain("sandbox");
        const body = {
            applianceCategoryId: category,
            serviceId: service,
            details: { optionId: option.id, description: "Integration booking" },
            address: {
                name: "Redesign Customer",
                phone: "9876543210",
                line1: "12 Test Street",
                area: "Adyar",
                city: "Chennai",
                state: "Tamil Nadu",
                pinCode: "600020",
            },
            preferredDate: "2099-11-01",
            preferredTimeWindow: "09:00-10:00",
            idempotencyKey: randomUUID(),
        };
        const replies = await Promise.all([1, 2, 3].map(() => request(app)
            .post("/api/v1/requests/service")
            .set("Cookie", customerCookie)
            .set("Idempotency-Key", body.idempotencyKey)
            .send(body)));
        for (const r of replies)
            expect(r.status, JSON.stringify(r.body)).toBe(201);
        expect(new Set(replies.map((r) => r.body.data.id)).size).toBe(1);
        booking = replies[0].body.data.id;
        expect(String(replies[0].body.data.display_number).padStart(6, "0")).toMatch(/^\d{6,}$/);
        expect((await admin("patch", `/catalogue/services/${service}`).send(serviceBody("PUBLISHED", 49900))).status).toBe(200);
        expect((await current()).details._priceSnapshot.amountPaise).toBe(29900);
        expect((await request(app).get("/api/v1/catalogue")).body.data.find((s) => s.id === service).booking_options[0].amountPaise).toBe(49900);
        expect((await request(app)
            .get(`/api/v1/requests/${booking}`)
            .set("Cookie", `customer_session=${otherToken}`)).status).toBe(404);
    }, 180000);
    it("provisions a unique username, gates temporary sessions, changes the password and preserves owner access", async () => {
        const body = {
            fullName: "Redesign Test Technician",
            username,
            temporaryPassword: temp,
            phone: "9876543210",
            serviceArea: "Chennai",
            verificationStatus: "VERIFIED",
        };
        const created = await admin("post", "/technicians").send(body);
        expect(created.status, JSON.stringify(created.body)).toBe(201);
        technician = created.body.data.id;
        const duplicate = await admin("post", "/technicians")
            .set("Idempotency-Key", randomUUID())
            .send({ ...body, fullName: "Different Technician" });
        expect(duplicate.status).toBe(409);
        const accounts = await db() `SELECT password_hash FROM technician_accounts WHERE technician_id=${technician}`;
        expect(String(accounts[0].password_hash)).toMatch(/^\$argon2id\$/);
        expect(JSON.stringify(created.body)).not.toContain(temp);
        expect((await tech
            .post("/api/v1/technician/auth/login")
            .send({ username, password: temp })).status).toBe(200);
        let me = (await tech.get("/api/v1/technician/auth/me")).body.data;
        expect(me.must_change_password).toBe(true);
        csrf = me.csrfToken;
        expect((await tech.get("/api/v1/technician/jobs")).status).toBe(403);
        expect((await tech
            .post("/api/v1/technician/auth/password")
            .set("X-CSRF-Token", csrf)
            .send({ currentPassword: temp, newPassword: permanent })).status).toBe(200);
        me = (await tech.get("/api/v1/technician/auth/me")).body.data;
        expect(me.must_change_password).toBe(false);
        expect(me.username).toBe(username);
        expect((await tech.get("/api/v1/technician/jobs")).body.data).toEqual([]);
        await status("UNDER_REVIEW");
        await status("EXECUTIVE_CONTACTED");
        const offer = await admin("post", `/requests/${booking}/offer`).send({
            technicianId: technician,
            version: (await current()).version,
            reason: "Assign redesign test job",
        });
        expect(offer.status, JSON.stringify(offer.body)).toBe(201);
        expect(offer.body.data.state).toBe("ACCEPTED");
        expect((await tech.get(`/api/v1/technician/jobs/${booking}`)).status).toBe(200);
        await status("APPOINTMENT_CONFIRMED", {
            confirmedDate: "2099-11-01",
            confirmedTimeWindow: "09:00-10:00",
        });
        expect((await admin("delete", `/technicians/${technician}`)).status).toBe(409);
    }, 180000);
    it("synchronizes a deduplicated proposal and approved schedule across admin, technician and customer", async () => {
        const range = { from: "2099-11-01", to: "2099-11-08" };
        expect((await admin("get", "/appointments").query(range)).body.data.some((r) => r.id === booking)).toBe(true);
        expect((await tech.get("/api/v1/technician/schedule").query(range)).body.data.some((r) => r.id === booking)).toBe(true);
        const body = {
            version: (await current()).version,
            date: "2099-11-02",
            timeWindow: "10:00-11:00",
            reason: "Customer coordination",
        }, key = randomUUID();
        const proposals = await Promise.all([1, 2, 3].map(() => tech
            .post(`/api/v1/technician/jobs/${booking}/reschedule`)
            .set("X-CSRF-Token", csrf)
            .set("Idempotency-Key", key)
            .send(body)));
        for (const r of proposals)
            expect(r.status, JSON.stringify(r.body)).toBe(201);
        expect(new Set(proposals.map((r) => r.body.data.id)).size).toBe(1);
        expect((await current()).confirmed_date.slice(0, 10)).toBe("2099-11-01");
        const proposal = proposals[0].body.data, decision = {
            decision: "APPROVED",
            version: proposal.version,
            requestVersion: (await current()).version,
            reason: "Approved after schedule-conflict check",
        };
        const approved = await admin("post", `/appointment-reschedules/${proposal.id}/decision`).send(decision);
        expect(approved.status, JSON.stringify(approved.body)).toBe(200);
        expect((await admin("post", `/appointment-reschedules/${proposal.id}/decision`)
            .set("Idempotency-Key", randomUUID())
            .send(decision)).status).toBe(200);
        const own = (await request(app)
            .get(`/api/v1/requests/${booking}`)
            .set("Cookie", customerCookie)).body.data;
        expect(own.confirmed_date.slice(0, 10)).toBe("2099-11-02");
        expect(own.confirmed_time_window).toBe("10:00-11:00");
        expect((await tech.get("/api/v1/technician/schedule").query(range)).body.data.find((r) => r.id === booking)
            .confirmed_time_window).toBe("10:00-11:00");
        expect((await tech
            .post(`/api/v1/technician/jobs/${booking}/reschedule`)
            .set("X-CSRF-Token", csrf)
            .send({ ...body, version: own.version, date: "2000-01-01" })).status).toBe(422);
        expect((await db() `SELECT id FROM appointment_reschedule_requests WHERE request_id=${booking}`).length).toBe(1);
    }, 180000);
    it("counts older unread records, marks an owned snapshot and preserves other customers' unread state", async () => {
        await db() `INSERT INTO customer_notifications(customer_id,request_id,kind,title,message) SELECT ${customer},${booking},'bulk:'||n,'QA notification','QA only' FROM generate_series(1,105) AS n`;
        const foreign = String((await db() `INSERT INTO customer_notifications(customer_id,kind,title,message) VALUES(${other},'foreign','Other account','Private') RETURNING id`)[0].id);
        const inbox = await request(app)
            .get("/api/v1/notifications")
            .set("Cookie", customerCookie);
        expect(inbox.body.data.length).toBe(100);
        expect(inbox.body.meta.unreadCount).toBeGreaterThan(100);
        expect((await request(app)
            .patch(`/api/v1/notifications/${foreign}/read`)
            .set("Cookie", customerCookie)).status).toBe(404);
        expect((await request(app)
            .patch("/api/v1/notifications/read-all")
            .set("Cookie", customerCookie)
            .send({ before: inbox.body.meta.fetchedAt })).status).toBe(200);
        expect((await request(app)
            .get("/api/v1/notifications")
            .set("Cookie", customerCookie)).body.meta.unreadCount).toBe(0);
        expect((await request(app)
            .get("/api/v1/notifications")
            .set("Cookie", `customer_session=${otherToken}`)).body.meta.unreadCount).toBe(1);
        const notices = (await tech.get("/api/v1/technician/notifications")).body;
        expect((await tech
            .post("/api/v1/technician/notifications/read-all")
            .set("X-CSRF-Token", csrf)
            .send({ before: notices.meta.fetchedAt })).status).toBe(200);
        const staffNotices = (await admin("get", "/notifications")).body;
        expect((await admin("patch", "/notifications/read-all").send({
            before: staffNotices.meta.fetchedAt,
        })).status).toBe(200);
    }, 120000);
});
