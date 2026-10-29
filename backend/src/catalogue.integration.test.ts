import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import request from "supertest";
import { app } from "./app.js";
import { db } from "./db.js";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { storage, bucket } from "./technicianStorage.js";

const token = randomUUID(),
  customerToken = randomUUID(),
  readerToken = randomUUID();
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const admin = () => request(app);
const adminCookie = `staff_session=${token}`;
const customerCookie = `customer_session=${customerToken}`;
let staffId = "",
  readerId = "",
  customerId = "",
  categoryId = "",
  serviceId = "",
  requestId = "";
let uploadedIcon: { id: string; object_key: string } | undefined;
let createdCategoryId = "";
const fields = [
  {
    key: "ac_type",
    label: "AC type",
    type: "select",
    required: true,
    options: ["Split AC", "Window AC"],
  },
];

describe.runIf(Boolean(process.env.DATABASE_URL))(
  "service catalogue and configurable forms",
  () => {
    beforeAll(async () => {
      for (const [role, sessionToken] of [
        ["ADMIN", token],
        ["SUPPORT_AGENT", readerToken],
      ]) {
        const identity = randomUUID();
        const rows =
          await db()`INSERT INTO staff_profiles(email,username,full_name,password_hash,role,must_change_password) VALUES(${`${identity}@example.com`},${`test_${identity.slice(0, 12)}`},'Catalogue Tester','unused',${role},false) RETURNING id`;
        const id = String(rows[0]!.id);
        if (role === "ADMIN") staffId = id;
        else readerId = id;
        await db()`INSERT INTO staff_sessions(staff_id,token_hash,expires_at) VALUES(${id},${hash(sessionToken!)},now()+interval '1 hour')`;
      }
      const customers =
        await db()`INSERT INTO customers(full_name) VALUES('Catalogue Customer') RETURNING id`;
      customerId = String(customers[0]!.id);
      await db()`INSERT INTO customer_sessions(customer_id,token_hash,expires_at) VALUES(${customerId},${hash(customerToken)},now()+interval '1 hour')`;
      const categories =
        await db()`SELECT id FROM appliance_categories WHERE slug='air-conditioner'`;
      categoryId = String(categories[0]!.id);
    });
    afterAll(async () => {
      if (requestId) {
        await db()`DELETE FROM request_status_events WHERE request_id=${requestId}`;
        await db()`DELETE FROM service_requests WHERE id=${requestId}`;
      }
      if (serviceId)
        await db()`DELETE FROM service_catalogue WHERE id=${serviceId}`;
      if (createdCategoryId) {
        await db()`DELETE FROM audit_logs WHERE entity_id=${createdCategoryId}`;
        await db()`DELETE FROM appliance_categories WHERE id=${createdCategoryId}`;
      }
      if (uploadedIcon) {
        await storage().send(
          new DeleteObjectCommand({
            Bucket: bucket,
            Key: uploadedIcon.object_key,
          }),
        );
        await db()`DELETE FROM catalogue_media WHERE id=${uploadedIcon.id}`;
      }
      if (customerId) {
        await db()`DELETE FROM customer_sessions WHERE customer_id=${customerId}`;
        await db()`DELETE FROM customers WHERE id=${customerId}`;
      }
      for (const id of [staffId, readerId].filter(Boolean)) {
        await db()`DELETE FROM staff_sessions WHERE staff_id=${id}`;
        await db()`DELETE FROM staff_profiles WHERE id=${id}`;
      }
    });
    it("restricts catalogue changes to admin roles", async () => {
      expect(
        (await request(app).post("/api/v1/admin/catalogue/services").send({}))
          .status,
      ).toBe(401);
      expect(
        (
          await request(app)
            .post("/api/v1/admin/catalogue/services")
            .set("Cookie", `staff_session=${readerToken}`)
            .send({})
        ).status,
      ).toBe(403);
      expect(
        (
          await request(app)
            .get("/api/v1/admin/catalogue")
            .set("Cookie", adminCookie)
        ).status,
      ).toBe(200);
    });
    it("creates a draft appliance once and rejects duplicate names", async () => {
      const name = "Test appliance " + randomUUID().slice(0, 8);
      const key = randomUUID();
      const create = () =>
        admin()
          .post("/api/v1/admin/catalogue/appliances")
          .set("Cookie", adminCookie)
          .set("Idempotency-Key", key)
          .send({ name });
      const first = await create();
      expect(first.status, JSON.stringify(first.body)).toBe(201);
      createdCategoryId = first.body.data.id;
      expect(first.body.data.publication_status).toBe("DRAFT");
      expect((await create()).body.data.id).toBe(createdCategoryId);
      const duplicate = await admin()
        .post("/api/v1/admin/catalogue/appliances")
        .set("Cookie", adminCookie)
        .send({ name: name.toUpperCase() });
      expect(duplicate.status).toBe(409);
      const publicRows = await request(app).get("/api/v1/catalogue/appliances");
      expect(
        publicRows.body.data.some(
          (row: { id: string }) => row.id === createdCategoryId,
        ),
      ).toBe(false);
    });
    it("creates a service whose form is available in the customer catalogue", async () => {
      const invalid = await admin()
        .post("/api/v1/admin/catalogue/services")
        .set("Cookie", adminCookie)
        .send({
          applianceCategoryId: categoryId,
          requestType: "SERVICE",
          name: "Test AC care",
          formFields: [{ ...fields[0], options: [] }],
        });
      expect(invalid.status).toBe(422);
      const created = await admin()
        .post("/api/v1/admin/catalogue/services")
        .set("Cookie", adminCookie)
        .send({
          applianceCategoryId: categoryId,
          requestType: "SERVICE",
          name: "Test AC care",
          formFields: fields,
        });
      expect(created.status).toBe(201);
      serviceId = created.body.data.id;
      const catalogue = await request(app)
        .get("/api/v1/services")
        .query({ applianceCategoryId: categoryId });
      expect(
        catalogue.body.data.find((s: { id: string }) => s.id === serviceId)
          .form_fields,
      ).toEqual(fields);
    });
    it.runIf(
      Boolean(
        process.env.AWS_ENDPOINT_URL_S3 &&
          process.env.AWS_ACCESS_KEY_ID &&
          process.env.AWS_SECRET_ACCESS_KEY,
      ),
    )(
      "uploads an SVG, changes only the service icon and serves it to customers",
      async () => {
        const source =
          '<svg viewBox="0 0 24 24"><path fill="#2563eb" d="M0 0h24v24H0z"/></svg>';
        const uploaded = await admin()
          .post("/api/v1/admin/catalogue/media")
          .set("Cookie", adminCookie)
          .send({
            contentType: "image/svg+xml",
            data: Buffer.from(source).toString("base64"),
          });
        expect(uploaded.status, JSON.stringify(uploaded.body)).toBe(201);
        uploadedIcon = uploaded.body.data;
        const endpoint = `/api/v1/admin/catalogue/services/${serviceId}/icon`;
        expect(
          (
            await admin()
              .patch(endpoint)
              .send({ iconObjectKey: uploadedIcon!.object_key })
          ).status,
        ).toBe(401);
        expect(
          (
            await admin()
              .patch(endpoint)
              .set("Cookie", `staff_session=${readerToken}`)
              .send({ iconObjectKey: uploadedIcon!.object_key })
          ).status,
        ).toBe(403);
        expect(
          (
            await admin()
              .patch(endpoint)
              .set("Cookie", adminCookie)
              .send({ iconObjectKey: "catalogue/icons/missing" })
          ).status,
        ).toBe(422);
        const before = (
          await db()`SELECT name,form_fields,booking_options,publication_status FROM service_catalogue WHERE id=${serviceId}`
        )[0];
        const saved = await admin()
          .patch(endpoint)
          .set("Cookie", adminCookie)
          .send({ iconObjectKey: uploadedIcon!.object_key });
        expect(saved.status, JSON.stringify(saved.body)).toBe(200);
        expect(
          (
            await db()`SELECT name,form_fields,booking_options,publication_status FROM service_catalogue WHERE id=${serviceId}`
          )[0],
        ).toEqual(before);
        const catalogue = await request(app).get("/api/v1/catalogue");
        const service = catalogue.body.data.find(
          (s: { id: string }) => s.id === serviceId,
        );
        expect(service.icon_url).toBe(
          `/api/v1/catalogue/media/${uploadedIcon!.id}`,
        );
        const image = await request(app).get(service.icon_url);
        expect(image.status).toBe(200);
        expect(image.headers["content-type"]).toContain("image/svg+xml");
        const imageSource = Buffer.isBuffer(image.body)
          ? image.body.toString("utf8")
          : image.text;
        expect(imageSource).toContain('xmlns="http://www.w3.org/2000/svg"');
        expect(
          (
            await admin()
              .patch(endpoint)
              .set("Cookie", adminCookie)
              .send({ iconObjectKey: null })
          ).status,
        ).toBe(200);
        expect((await request(app).get(service.icon_url)).status).toBe(404);
      },
    );
    it("validates custom answers and preserves them in customer and admin request details", async () => {
      const body = {
        applianceCategoryId: categoryId,
        serviceId,
        details: { description: "AC needs professional cleaning" },
        address: {
          name: "Test Customer",
          phone: "9876543210",
          line1: "12 Test Street",
          area: "Test Area",
          city: "Chennai",
          state: "Tamil Nadu",
          pinCode: "600001",
        },
        preferredDate: "2099-10-25",
        preferredTimeWindow: "10:00-12:00",
        idempotencyKey: randomUUID(),
      };
      const missing = await request(app)
        .post("/api/v1/requests/service")
        .set("Cookie", customerCookie)
        .send(body);
      expect(missing.status).toBe(422);
      expect(missing.body.error.message).toBe("AC type is required");
      const invalid = await request(app)
        .post("/api/v1/requests/service")
        .set("Cookie", customerCookie)
        .send({ ...body, details: { ...body.details, ac_type: "Unknown" } });
      expect(invalid.status).toBe(422);
      const booked = await request(app)
        .post("/api/v1/requests/service")
        .set("Cookie", customerCookie)
        .send({ ...body, details: { ...body.details, ac_type: "Split AC" } });
      expect(booked.status).toBe(201);
      requestId = booked.body.data.id;
      expect(booked.body.data.details.ac_type).toBe("Split AC");
      expect(booked.body.data.details._fieldLabels.ac_type).toBe("AC type");
      const detail = await admin()
        .get(`/api/v1/admin/requests/${requestId}`)
        .set("Cookie", adminCookie);
      expect(detail.body.data.details.ac_type).toBe("Split AC");
    });
    it("edits services and removes custom forms", async () => {
      const updated = await admin()
        .patch(`/api/v1/admin/catalogue/services/${serviceId}`)
        .set("Cookie", adminCookie)
        .send({
          applianceCategoryId: categoryId,
          requestType: "INSTALLATION",
          name: "Updated AC care",
          formFields: [],
        });
      expect(updated.status).toBe(200);
      expect(updated.body.data.form_fields).toEqual([]);
      const installations = await request(app)
        .get("/api/v1/installations")
        .query({ applianceCategoryId: categoryId });
      expect(
        installations.body.data.some((s: { id: string }) => s.id === serviceId),
      ).toBe(true);
      const oldRequest = await request(app)
        .get(`/api/v1/requests/${requestId}`)
        .set("Cookie", customerCookie);
      expect(oldRequest.body.data.details._fieldLabels.ac_type).toBe("AC type");
    });
    it("removes services from new bookings while retaining historical requests", async () => {
      expect(
        (
          await admin()
            .delete(`/api/v1/admin/catalogue/services/${serviceId}`)
            .set("Cookie", adminCookie)
        ).status,
      ).toBe(204);
      const catalogue = await request(app)
        .get("/api/v1/installations")
        .query({ applianceCategoryId: categoryId });
      expect(
        catalogue.body.data.some((s: { id: string }) => s.id === serviceId),
      ).toBe(false);
      const rejected = await request(app)
        .post("/api/v1/requests/installation")
        .set("Cookie", customerCookie)
        .send({
          applianceCategoryId: categoryId,
          serviceId,
          details: { description: "Request after service deletion" },
          address: {
            name: "Test Customer",
            phone: "9876543210",
            line1: "12 Test Street",
            area: "Test Area",
            city: "Chennai",
            state: "Tamil Nadu",
            pinCode: "600001",
          },
          preferredDate: "2099-10-25",
          preferredTimeWindow: "10:00-12:00",
          idempotencyKey: randomUUID(),
        });
      expect(rejected.status).toBe(422);
      expect(rejected.body.error.code).toBe("INVALID_SERVICE");
      expect(
        (
          await request(app)
            .get(`/api/v1/requests/${requestId}`)
            .set("Cookie", customerCookie)
        ).status,
      ).toBe(200);
    });
  },
);
