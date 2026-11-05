import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import request from "supertest";
import { app } from "./app.js";
import { db } from "./db.js";

const hash = (v: string) => createHash("sha256").update(v).digest("hex");
const adminToken = randomUUID(),
  customerToken = randomUUID(),
  readerToken = randomUUID();
const admin = () => request(app);
const cookie = `staff_session=${adminToken}`;
const customer = () => request(app);
const customerCookie = `customer_session=${customerToken}`;
const staff: string[] = [],
  groups: string[] = [],
  items: string[] = [],
  entries: string[] = [],
  requests: string[] = [],
  media: { id: string; object_key: string }[] = [];
let customerId = "",
  groupId = "",
  otherGroupId = "",
  itemId = "",
  entryId = "",
  optionId = "";
const unique = randomUUID().slice(0, 8);
describe.runIf(Boolean(process.env.DATABASE_URL))(
  "dynamic catalogue integration with real storage and booking",
  () => {
    beforeAll(async () => {
      for (const [role, token] of [
        ["ADMIN", adminToken],
        ["SUPPORT_AGENT", readerToken],
      ]) {
        const id = randomUUID();
        await db()`INSERT INTO staff_profiles(id,email,username,full_name,password_hash,role,must_change_password) VALUES(${id},${id + "@example.invalid"},${"catalogue_" + id},'Catalogue QA','unused',${role},false)`;
        staff.push(id);
        await db()`INSERT INTO staff_sessions(staff_id,token_hash,expires_at) VALUES(${id},${hash(token!)},now()+interval '1 hour')`;
      }
      customerId = randomUUID();
      await db()`INSERT INTO customers(id,full_name,phone_e164) VALUES(${customerId},'Catalogue Customer','+919876543210')`;
      await db()`INSERT INTO customer_sessions(customer_id,token_hash,expires_at) VALUES(${customerId},${hash(customerToken)},now()+interval '1 hour')`;
    });
    afterAll(async () => {
      for (const id of requests) {
        await db()`DELETE FROM request_status_events WHERE request_id=${id}`;
        await db()`DELETE FROM service_requests WHERE id=${id}`;
      }
      for (const id of entries)
        await db()`DELETE FROM service_catalogue WHERE id=${id}`;
      for (const id of items)
        await db()`DELETE FROM appliance_categories WHERE id=${id}`;
      for (const id of groups)
        await db()`DELETE FROM catalogue_categories WHERE id=${id}`;
      const owned = staff[0]
        ? await db()`SELECT id FROM catalogue_media WHERE created_by=${staff[0]}`
        : [];
      for (const m of owned)
        await admin()
          .delete(`/api/v1/admin/catalogue/media/${m.id}`)
          .set("Cookie", cookie);
      await db()`DELETE FROM customer_addresses WHERE customer_id=${customerId}`;
      await db()`DELETE FROM customer_sessions WHERE customer_id=${customerId}`;
      await db()`DELETE FROM customers WHERE id=${customerId}`;
      for (const id of staff) {
        await db()`DELETE FROM audit_logs WHERE actor_staff_id=${id}`;
        await db()`DELETE FROM staff_sessions WHERE staff_id=${id}`;
        await db()`DELETE FROM staff_profiles WHERE id=${id}`;
      }
    });
    it("requires admin privileges and validates upload contents and limits", async () => {
      expect(
        (
          await admin()
            .post("/api/v1/admin/catalogue/categories")
            .send({ name: "Denied" })
        ).status,
      ).toBe(401);
      expect(
        (
          await admin()
            .post("/api/v1/admin/catalogue/categories")
            .set("Cookie", `staff_session=${readerToken}`)
            .send({ name: "Denied" })
        ).status,
      ).toBe(403);
      expect(
        (
          await admin()
            .post("/api/v1/admin/catalogue/media")
            .set("Cookie", cookie)
            .send({
              contentType: "image/png",
              data: Buffer.from("not a PNG").toString("base64"),
            })
        ).status,
      ).toBe(422);
      expect(
        (
          await admin()
            .post("/api/v1/admin/catalogue/media")
            .set("Cookie", cookie)
            .send({
              contentType: "text/html",
              data: Buffer.from("<script/>").toString("base64"),
            })
        ).status,
      ).toBe(422);
      expect(
        (
          await admin()
            .post("/api/v1/admin/catalogue/media")
            .set("Cookie", cookie)
            .send({
              contentType: "image/png",
              data: Buffer.alloc(2097153).toString("base64"),
            })
        ).status,
      ).toBe(422);
    });
    it("uploads PNG, WebP, JPEG to object storage and deduplicates retries", async () => {
      for (const [ext, contentType] of [
        ["png", "image/png"],
        ["webp", "image/webp"],
        ["jpg", "image/jpeg"],
      ]) {
        const data = (
          await readFile(
            new URL(
              `../../tests/fixtures/catalogue/sample.${ext}`,
              import.meta.url,
            ),
          )
        ).toString("base64");
        const uploaded = await admin()
          .post("/api/v1/admin/catalogue/media")
          .set("Cookie", cookie)
          .send({ contentType, data });
        expect(uploaded.status, JSON.stringify(uploaded.body)).toBe(201);
        media.push(uploaded.body.data);
        const preview = await admin()
          .get(uploaded.body.data.previewUrl)
          .set("Cookie", cookie);
        expect(preview.status).toBe(200);
        expect(preview.headers["content-type"]).toContain(contentType);
        const again = await admin()
          .post("/api/v1/admin/catalogue/media")
          .set("Cookie", cookie)
          .send({ contentType, data });
        expect([200, 201]).toContain(again.status);
        expect(again.body.data.id).toBe(uploaded.body.data.id);
      }
    });
    it("creates arbitrary categories and items, persists ordering and moves items", async () => {
      for (const name of ["Garden " + unique, "Future " + unique]) {
        const response = await admin()
          .post("/api/v1/admin/catalogue/categories")
          .set("Cookie", cookie)
          .send({
            name,
            publicationStatus: "PUBLISHED",
            iconObjectKey: media[0]!.object_key,
          });
        expect(response.status, JSON.stringify(response.body)).toBe(201);
        groups.push(response.body.data.id);
      }
      [groupId, otherGroupId] = groups as [string, string];
      for (const name of [
        "Water Feature " + unique,
        "Outdoor Unit " + unique,
      ]) {
        const r = await admin()
          .post("/api/v1/admin/catalogue/items")
          .set("Cookie", cookie)
          .send({
            name,
            categoryId: groupId,
            publicationStatus: "PUBLISHED",
            iconObjectKey: media[1]!.object_key,
          });
        expect(r.status, JSON.stringify(r.body)).toBe(201);
        items.push(r.body.data.id);
      }
      itemId = items[0]!;
      expect(
        (
          await admin()
            .put("/api/v1/admin/catalogue/order")
            .set("Cookie", cookie)
            .send({
              entity: "items",
              parentId: groupId,
              ids: [...items].reverse(),
            })
        ).status,
      ).toBe(200);
      const listing = await customer().get(
        `/api/v1/catalogue/categories/${groupId}/items`,
      );
      expect(listing.body.data.map((r: { id: string }) => r.id)).toEqual(
        [...items].reverse(),
      );
      expect(listing.body.data[0].icon_url).toBe(
        `/api/v1/catalogue/media/${media[1]!.id}`,
      );
      expect(
        (
          await admin()
            .patch(`/api/v1/admin/catalogue/items/${items[1]}`)
            .set("Cookie", cookie)
            .send({ categoryId: otherGroupId })
        ).status,
      ).toBe(200);
      expect(
        (
          await customer().get(
            `/api/v1/catalogue/categories/${otherGroupId}/items`,
          )
        ).body.data[0].id,
      ).toBe(items[1]);
      const idempotencyKey = randomUUID();
      const body = { name: "Idempotent " + unique, categoryId: otherGroupId };
      const first = await admin()
        .post("/api/v1/admin/catalogue/items")
        .set("Cookie", cookie)
        .set("Idempotency-Key", idempotencyKey)
        .send(body);
      items.push(first.body.data.id);
      const second = await admin()
        .post("/api/v1/admin/catalogue/items")
        .set("Cookie", cookie)
        .set("Idempotency-Key", idempotencyKey)
        .send(body);
      expect(second.body.data.id).toBe(first.body.data.id);
    });
    it("creates services and installations and updates, removes and protects image references", async () => {
      optionId = randomUUID();
      for (const requestType of ["SERVICE", "INSTALLATION"]) {
        const r = await admin()
          .post("/api/v1/admin/catalogue/services")
          .set("Cookie", cookie)
          .send({
            name: requestType + " " + unique,
            applianceCategoryId: itemId,
            requestType,
            publicationStatus: "PUBLISHED",
            formFields: [],
            options: [
              {
                id: optionId,
                name: "Visit",
                active: true,
                priceType: "QUOTE",
                amountPaise: null,
                maximumPaise: null,
              },
            ],
            iconObjectKey: media[2]!.object_key,
          });
        expect(r.status, JSON.stringify(r.body)).toBe(201);
        entries.push(r.body.data.id);
      }
      entryId = entries[0]!;
      let r = await customer().get(
        `/api/v1/catalogue/appliances/${itemId}/services`,
      );
      expect(r.body.data).toHaveLength(2);
      expect(
        r.body.data.every((s: { icon_url: string }) =>
          s.icon_url.endsWith(media[2]!.id),
        ),
      ).toBe(true);
      expect((await customer().get(r.body.data[0].icon_url)).status).toBe(200);
      expect(
        (
          await admin()
            .delete(`/api/v1/admin/catalogue/media/${media[2]!.id}`)
            .set("Cookie", cookie)
        ).status,
      ).toBe(409);
      expect(
        (
          await admin()
            .patch(`/api/v1/admin/catalogue/services/${entryId}/icon`)
            .set("Cookie", cookie)
            .send({ iconObjectKey: media[0]!.object_key })
        ).status,
      ).toBe(200);
      r = await customer().get(
        `/api/v1/catalogue/appliances/${itemId}/services`,
      );
      expect(
        r.body.data.find((s: { id: string }) => s.id === entryId).icon_url,
      ).toContain(media[0]!.id);
      expect(
        (
          await admin()
            .patch(`/api/v1/admin/catalogue/services/${entryId}/icon`)
            .set("Cookie", cookie)
            .send({ iconObjectKey: null })
        ).status,
      ).toBe(200);
      expect(
        (
          await customer().get(
            `/api/v1/catalogue/appliances/${itemId}/services`,
          )
        ).body.data.find((s: { id: string }) => s.id === entryId).icon_url,
      ).toBeNull();
    });
    it("books through the existing workflow and snapshots category, item and entry names", async () => {
      const body = {
        applianceCategoryId: itemId,
        serviceId: entryId,
        details: { description: "Please inspect", optionId },
        address: {
          name: "Catalogue Customer",
          phone: "9876543210",
          line1: "12 Test Street",
          area: "Adyar",
          city: "Chennai",
          state: "Tamil Nadu",
          pinCode: "600001",
        },
        preferredDate: "2099-01-10",
        preferredTimeWindow: "Morning",
        idempotencyKey: randomUUID(),
      };
      const booked = await customer()
        .post("/api/v1/requests/service")
        .set("Cookie", customerCookie)
        .send(body);
      expect(booked.status, JSON.stringify(booked.body)).toBe(201);
      requests.push(booked.body.data.id);
      expect(booked.body.data.catalogue_category_name).toBe("Garden " + unique);
      expect(booked.body.data.appliance).toBe("Water Feature " + unique);
      const operations = await admin()
        .get(`/api/v1/admin/requests/${requests[0]}`)
        .set("Cookie", cookie);
      expect(operations.status).toBe(200);
      expect(operations.body.data.service_name).toBe("SERVICE " + unique);
      expect(operations.body.data.catalogue_category_id).toBe(groupId);
      await admin()
        .patch(`/api/v1/admin/catalogue/items/${itemId}`)
        .set("Cookie", cookie)
        .send({ name: "Renamed " + unique });
      await admin()
        .patch(`/api/v1/admin/catalogue/categories/${groupId}`)
        .set("Cookie", cookie)
        .send({ name: "Renamed category " + unique });
      const historical = await customer()
        .get(`/api/v1/requests/${requests[0]}`)
        .set("Cookie", customerCookie);
      expect(historical.body.data.appliance).toBe("Water Feature " + unique);
      expect(historical.body.data.catalogue_category_name).toBe(
        "Garden " + unique,
      );
    });
    it("hides disabled entries, items and categories from reads and new bookings and preserves history after archive", async () => {
      await admin()
        .patch(`/api/v1/admin/catalogue/entries/${entryId}`)
        .set("Cookie", cookie)
        .send({ active: false });
      expect(
        (
          await customer().get(
            `/api/v1/catalogue/appliances/${itemId}/services`,
          )
        ).body.data.map((s: { id: string }) => s.id),
      ).not.toContain(entryId);
      await admin()
        .patch(`/api/v1/admin/catalogue/entries/${entryId}`)
        .set("Cookie", cookie)
        .send({ active: true });
      await admin()
        .patch(`/api/v1/admin/catalogue/categories/${groupId}`)
        .set("Cookie", cookie)
        .send({ active: false });
      expect(
        (await customer().get(`/api/v1/catalogue/categories/${groupId}/items`))
          .status,
      ).toBe(404);
      expect(
        (await customer().get("/api/v1/catalogue")).body.data.some(
          (s: { id: string }) => s.id === entryId,
        ),
      ).toBe(false);
      await admin()
        .patch(`/api/v1/admin/catalogue/categories/${groupId}`)
        .set("Cookie", cookie)
        .send({ active: true });
      await admin()
        .delete(`/api/v1/admin/catalogue/items/${itemId}`)
        .set("Cookie", cookie);
      expect(
        (
          await customer().get(
            `/api/v1/catalogue/appliances/${itemId}/services`,
          )
        ).status,
      ).toBe(404);
      const old = await customer()
        .get(`/api/v1/requests/${requests[0]}`)
        .set("Cookie", customerCookie);
      expect(old.status).toBe(200);
      expect(old.body.data.service_name).toBe("SERVICE " + unique);
      expect(
        (
          await admin()
            .delete(`/api/v1/admin/catalogue/categories/${groupId}`)
            .set("Cookie", cookie)
        ).status,
      ).toBe(204);
    });
    it("protects fresh and referenced images and cleans aged orphans", async () => {
      const data = (
        await readFile(
          new URL(
            "../../tests/fixtures/catalogue/sample-cleanup.png",
            import.meta.url,
          ),
        )
      ).toString("base64");
      const uploaded = await admin()
        .post("/api/v1/admin/catalogue/media")
        .set("Cookie", cookie)
        .send({ contentType: "image/png", data });
      expect(uploaded.status).toBe(201);
      const image = uploaded.body.data;
      const fresh = await admin()
        .post("/api/v1/admin/catalogue/media/cleanup")
        .set("Cookie", cookie)
        .send({ ids: [image.id] });
      expect(fresh.status, JSON.stringify(fresh.body)).toBe(200);
      expect(fresh.body.data.removed).toEqual([]);
      await db()`UPDATE catalogue_media SET last_selected_at=now()-interval '25 hours' WHERE id=${image.id} OR id=${media[0]!.id}`;
      const cleanup = await admin()
        .post("/api/v1/admin/catalogue/media/cleanup")
        .set("Cookie", cookie)
        .send({ ids: [image.id, media[0]!.id] });
      expect(cleanup.status, JSON.stringify(cleanup.body)).toBe(200);
      expect(cleanup.body.data.removed).toEqual([image.id]);
      expect(
        (await db()`SELECT id FROM catalogue_media WHERE id=${media[0]!.id}`)
          .length,
      ).toBe(1);
      expect(
        (await admin().get(image.previewUrl).set("Cookie", cookie)).status,
      ).toBe(404);
    });
    it("allows intentional repeated visibility changes without replaying a stale payload", async () => {
      for (const active of [false, true, false, true]) {
        const r = await admin()
          .patch("/api/v1/admin/catalogue/entries/" + entryId)
          .set("Cookie", cookie)
          .send({ active });
        expect(r.status).toBe(200);
        expect(
          (
            await db()`SELECT active FROM service_catalogue WHERE id=${entryId}`
          )[0]!.active,
        ).toBe(active);
      }
    });
  },
);
