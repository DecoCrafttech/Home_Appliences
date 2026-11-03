import { beforeAll, afterAll, it, expect, describe } from "vitest";
import request from "supertest";
import { randomUUID, createHash } from "node:crypto";
import { app } from "./app.js";
import { db } from "./db.js";
const token = randomUUID(),
  staffToken = randomUUID();
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
let customer = "",
  other = "",
  staff = "",
  ticket = "",
  booking = "",
  category = "",
  service = "";
const addresses: string[] = [];
const cookie = `customer_session=${token}`,
  staffCookie = `staff_session=${staffToken}`;
describe.runIf(Boolean(process.env.DATABASE_URL))(
  "requested UI data contracts",
  () => {
    beforeAll(async () => {
      const identity = (
        await db().query(
          "SELECT current_setting('neon.project_id',true) AS project_id,current_setting('neon.branch_id',true) AS branch_id",
        )
      )[0];
      expect(identity?.project_id).toBe("snowy-hill-87120042");
      expect(["br-broad-breeze-b41iqgjz", "br-gentle-wind-b4tsvt43"]).toContain(
        identity?.branch_id,
      );
      const customers =
        await db()`INSERT INTO customers(full_name) VALUES('UI Update QA'),('UI Other QA') RETURNING id`;
      customer = String(customers[0]!.id);
      other = String(customers[1]!.id);
      await db()`INSERT INTO customer_sessions(customer_id,token_hash,expires_at) VALUES(${customer},${hash(token)},now()+interval '1 hour')`;
      staff = String(
        (
          await db()`INSERT INTO staff_profiles(email,username,full_name,password_hash,role,must_change_password) VALUES(${randomUUID() + "@example.com"},${"ui_" + randomUUID().slice(0, 8)},'UI QA Admin','unused','ADMIN',false) RETURNING id`
        )[0]!.id,
      );
      await db()`INSERT INTO staff_sessions(staff_id,token_hash,expires_at) VALUES(${staff},${hash(staffToken)},now()+interval '1 hour')`;
      for (const [id, defaultValue] of [
        [customer, true],
        [customer, false],
        [other, true],
      ] as const) {
        const rows =
          await db()`INSERT INTO customer_addresses(customer_id,label,recipient_name,phone,line1,area,city,state,pin_code,is_default) VALUES(${id},'QA','UI Customer','9876543210','12 QA Road','Adyar','Chennai','Tamil Nadu','600020',${defaultValue}) RETURNING id`;
        addresses.push(String(rows[0]!.id));
      }
      ticket = String(
        (
          await db()`INSERT INTO support_tickets(ticket_number,customer_id,subject,message) VALUES(${"SUP-UI-" + randomUUID()},${customer},'QA support','QA enquiry') RETURNING id`
        )[0]!.id,
      );
      booking = String(
        (
          await db()`INSERT INTO service_requests(request_number,customer_id,request_type,appliance,service_name,address_snapshot,preferred_date,preferred_time_window,idempotency_key) VALUES(${"SR-UI-" + randomUUID()},${customer},'SERVICE','Air Conditioner','General Service','{}'::jsonb,(now() AT TIME ZONE 'Asia/Kolkata')::date,'09:00-12:00',${randomUUID()}) RETURNING id`
        )[0]!.id,
      );
    });
    afterAll(async () => {
      if (booking) await db()`DELETE FROM service_requests WHERE id=${booking}`;
      if (ticket) await db()`DELETE FROM support_tickets WHERE id=${ticket}`;
      if (service)
        await db()`DELETE FROM service_catalogue WHERE id=${service}`;
      if (category)
        await db()`DELETE FROM appliance_categories WHERE id=${category}`;
      if (staff) {
        await db()`DELETE FROM audit_logs WHERE actor_staff_id=${staff}`;
        await db()`DELETE FROM staff_sessions WHERE staff_id=${staff}`;
        await db()`DELETE FROM staff_profiles WHERE id=${staff}`;
      }
      if (customer) await db()`DELETE FROM customers WHERE id=${customer}`;
      if (other) await db()`DELETE FROM customers WHERE id=${other}`;
    });
    it("sets one owned default and rejects foreign addresses without clearing it", async () => {
      await request(app)
        .patch(`/api/v1/addresses/${addresses[1]}/default`)
        .set("Cookie", cookie)
        .send({})
        .expect(200);
      await request(app)
        .patch(`/api/v1/addresses/${addresses[2]}/default`)
        .set("Cookie", cookie)
        .send({})
        .expect(404);
      const defaults =
        await db()`SELECT id FROM customer_addresses WHERE customer_id=${customer} AND is_default`;
      expect(defaults.map((row) => String(row.id))).toEqual([addresses[1]]);
      await request(app)
        .patch(`/api/v1/addresses/${addresses[1]}/default`)
        .send({})
        .expect(401);
    });
    it("persists and filters the Ignore state for support tickets", async () => {
      const result = await request(app)
        .patch(`/api/v1/admin/support/tickets/${ticket}`)
        .set("Cookie", staffCookie)
        .send({ status: "IGNORED" });
      expect(result.status, result.text).toBe(200);
      expect(result.body.data.status).toBe("IGNORED");
      const list = await request(app)
        .get("/api/v1/admin/support/tickets?status=IGNORED")
        .set("Cookie", staffCookie)
        .expect(200);
      expect(
        list.body.data.some((row: { id: string }) => row.id === ticket),
      ).toBe(true);
    });
    it("publishes maintenance edits to the customer catalogue", async () => {
      const created = await request(app)
        .post("/api/v1/admin/catalogue/appliances")
        .set("Cookie", staffCookie)
        .send({
          name: "UI QA Maintenance " + randomUUID().slice(0, 8),
          kind: "MAINTENANCE",
        });
      expect(created.status, created.text).toBe(201);
      category = created.body.data.id;
      await request(app)
        .patch(`/api/v1/admin/catalogue/appliances/${category}`)
        .set("Cookie", staffCookie)
        .send({
          iconObjectKey: null,
          publicationStatus: "PUBLISHED",
          name: "QA Maintenance Category",
        })
        .expect(200);
      const createdService = await request(app)
        .post("/api/v1/admin/catalogue/services")
        .set("Cookie", staffCookie)
        .send({
          name: "QA Plumbing",
          applianceCategoryId: category,
          requestType: "SERVICE",
          publicationStatus: "PUBLISHED",
          description: "QA plumbing work",
          formFields: [],
          options: [
            {
              id: randomUUID(),
              name: "Plumbing",
              priceType: "QUOTE",
              amountPaise: null,
              active: true,
            },
          ],
        });
      expect(createdService.status, createdService.text).toBe(201);
      service = createdService.body.data.id;
      const catalogue = await request(app).get("/api/v1/catalogue").expect(200);
      expect(
        catalogue.body.data.find((row: { id: string }) => row.id === service),
      ).toMatchObject({
        name: "QA Plumbing",
        category_kind: "MAINTENANCE",
        request_type: "SERVICE",
      });
      const seeded = catalogue.body.data.filter(
        (row: { appliance_name: string }) =>
          row.appliance_name === "Home Maintenance",
      );
      expect(seeded.map((row: { name: string }) => row.name)).toEqual(
        expect.arrayContaining([
          "Electrical Work",
          "Plumbing Work",
          "Painting",
        ]),
      );
    });
    it("deletes catalogue options from both catalogues while preserving existing request snapshots", async () => {
      await db()`UPDATE service_requests SET service_catalogue_id=${service} WHERE id=${booking}`;
      await request(app)
        .delete(`/api/v1/admin/catalogue/services/${service}`)
        .expect(401);
      await request(app)
        .delete(`/api/v1/admin/catalogue/services/${service}`)
        .set("Cookie", staffCookie)
        .expect(204);
      const publicCatalogue = await request(app)
        .get("/api/v1/catalogue")
        .expect(200);
      expect(
        publicCatalogue.body.data.some(
          (row: { id: string }) => row.id === service,
        ),
      ).toBe(false);
      const staffCatalogue = await request(app)
        .get("/api/v1/admin/catalogue")
        .set("Cookie", staffCookie)
        .expect(200);
      expect(
        staffCatalogue.body.data.services.some(
          (row: { id: string }) => row.id === service,
        ),
      ).toBe(false);
      const existing = await request(app)
        .get(`/api/v1/requests/${booking}`)
        .set("Cookie", cookie)
        .expect(200);
      expect(existing.body.data.service_name).toBe("General Service");
      const stored =
        await db()`SELECT active FROM service_catalogue WHERE id=${service}`;
      expect(stored[0]?.active).toBe(false);
    });
    it("includes new preferred visits and cancelled requests in the admin calendar", async () => {
      const from = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Kolkata",
        }).format(new Date()),
        to = new Date(new Date(from + "T12:00:00Z").getTime() + 86400000)
          .toISOString()
          .slice(0, 10);
      const query = () =>
        request(app)
          .get(`/api/v1/admin/appointments?from=${from}&to=${to}`)
          .set("Cookie", staffCookie);
      const fresh = await query().expect(200);
      expect(
        fresh.body.data.find((row: { id: string }) => row.id === booking),
      ).toMatchObject({
        status: "REQUESTED",
        visit_confirmed: false,
        confirmed_date: from,
      });
      await db()`UPDATE service_requests SET status='CANCELLED' WHERE id=${booking}`;
      const cancelled = await query().expect(200);
      expect(
        cancelled.body.data.find((row: { id: string }) => row.id === booking)
          .status,
      ).toBe("CANCELLED");
    });
  },
);
