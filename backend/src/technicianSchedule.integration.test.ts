import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import request from "supertest";
import { app } from "./app.js";
import { db } from "./db.js";

describe.runIf(Boolean(process.env.DATABASE_URL))(
  "technician preferred and confirmed schedule",
  () => {
    const technician = randomUUID(),
      other = randomUUID(),
      customer = randomUUID(),
      token = randomUUID(),
      otherToken = randomUUID();
    const jobs: string[] = [];
    const range = { from: "2026-11-05", to: "2026-11-06" };
    const get = (value = token) =>
      request(app)
        .get("/api/v1/technician/schedule")
        .set("Cookie", "technician_session=" + value);
    async function job(
      owner: string,
      state: string,
      status = "TECHNICIAN_ASSIGNED",
    ) {
      const id = randomUUID();
      jobs.push(id);
      await db()`INSERT INTO service_requests(id,request_number,customer_id,request_type,appliance,service_name,address_snapshot,preferred_date,preferred_time_window,idempotency_key,status,assigned_technician_id) VALUES(${id},${"SCHEDULE-" + id},${customer},'SERVICE','Air Conditioner','Repair','{}'::jsonb,'2026-11-05','13:00-17:00',${randomUUID()},${status},${owner})`;
      await db()`INSERT INTO technician_assignments(request_id,technician_id,state) VALUES(${id},${owner},${state})`;
      return id;
    }
    beforeAll(async () => {
      const identity = (await db()`SELECT current_database() AS name`)[0];
      expect(identity?.name).toBe(process.env.TEST_DATABASE_NAME);
      expect(String(identity?.name)).toMatch(/^fixbeez_audit_[a-f0-9]{12}$/);
      await db()`INSERT INTO customers(id,full_name) VALUES(${customer},'Schedule QA')`;
      for (const [id, value] of [
        [technician, token],
        [other, otherToken],
      ]) {
        await db()`INSERT INTO technicians(id,full_name,phone,service_area,verification_status) VALUES(${id!},'Schedule Technician','+919876543210','Chennai','VERIFIED')`;
        await db()`INSERT INTO technician_accounts(technician_id,email,username,password_hash,status,must_change_password) VALUES(${id!},${id! + "@example.invalid"},${"schedule" + id!.replaceAll("-", "").slice(0, 12)},'unused','ACTIVE',false)`;
        await db()`INSERT INTO technician_sessions(technician_id,token_hash,csrf_token,expires_at) VALUES(${id!},${createHash("sha256").update(value!).digest("hex")},${"a".repeat(43)},now()+interval '1 hour')`;
      }
      await job(technician, "ACCEPTED");
      await job(technician, "OFFERED");
      await job(technician, "ACCEPTED", "CANCELLED");
      await job(other, "ACCEPTED");
    });
    afterAll(async () => {
      for (const id of jobs) {
        await db()`DELETE FROM completion_reports WHERE request_id=${id}`;
        await db()`DELETE FROM request_status_events WHERE request_id=${id}`;
        await db()`DELETE FROM audit_logs WHERE entity_id=${id}`;
        await db()`DELETE FROM service_requests WHERE id=${id}`;
      }
      for (const id of [technician, other]) {
        await db()`DELETE FROM technician_sessions WHERE technician_id=${id}`;
        await db()`DELETE FROM technician_accounts WHERE technician_id=${id}`;
        await db()`DELETE FROM technicians WHERE id=${id}`;
      }
      await db()`DELETE FROM customers WHERE id=${customer}`;
    });
    it("includes an accepted preferred visit without confirming it or exposing other jobs", async () => {
      const response = await get().query(range);
      expect(response.status, JSON.stringify(response.body)).toBe(200);
      expect(response.body.data.map((r: { id: string }) => r.id)).toEqual([
        jobs[0],
      ]);
      expect(response.body.data[0]).toMatchObject({
        confirmed_date: "2026-11-05",
        confirmed_time_window: "13:00-17:00",
        visit_confirmed: false,
        status: "TECHNICIAN_ASSIGNED",
      });
      expect(
        (
          await db()`SELECT confirmed_date,confirmed_time_window,version FROM service_requests WHERE id=${jobs[0]!}`
        )[0],
      ).toMatchObject({
        confirmed_date: null,
        confirmed_time_window: null,
        version: 1,
      });
    });
    it("uses the confirmed time instead of the preference after confirmation", async () => {
      await db()`UPDATE service_requests SET confirmed_date='2026-11-06',confirmed_time_window='09:00-10:00',status='APPOINTMENT_CONFIRMED' WHERE id=${jobs[0]!}`;
      expect((await get().query(range)).body.data).toEqual([]);
      const response = await get().query({
        from: "2026-11-06",
        to: "2026-11-07",
      });
      expect(response.body.data[0]).toMatchObject({
        id: jobs[0],
        confirmed_date: "2026-11-06",
        confirmed_time_window: "09:00-10:00",
        visit_confirmed: true,
      });
    });
    it("keeps authentication and technician isolation", async () => {
      expect(
        (await request(app).get("/api/v1/technician/schedule").query(range))
          .status,
      ).toBe(401);
      const response = await get(otherToken).query(range);
      expect(response.body.data.map((r: { id: string }) => r.id)).toEqual([
        jobs[3],
      ]);
    });
    const checks = [
      "Reported issue assessed",
      "Work and safety checks completed",
      "Customer informed of outcome",
    ];
    const finish = (id: string, body: Record<string, unknown>, value = token) =>
      request(app)
        .post(`/api/v1/technician/jobs/${id}/complete`)
        .set("Cookie", "technician_session=" + value)
        .set("X-CSRF-Token", "a".repeat(43))
        .send(body);
    for (const status of [
      "TECHNICIAN_ASSIGNED",
      "APPOINTMENT_CONFIRMED",
      "IN_PROGRESS",
    ])
      it(`technician can directly complete an owned ${status} job`, async () => {
        const id = await job(technician, "ACCEPTED", status);
        const result = await finish(id, {
          version: 1,
          workSummary: "Repaired and tested the unit",
          checklist: checks,
        });
        expect(result.status, JSON.stringify(result.body)).toBe(200);
        expect(result.body.data.status).toBe("COMPLETED");
        expect(
          (
            await db()`SELECT previous_status,status FROM request_status_events WHERE request_id=${id}`
          )[0],
        ).toMatchObject({ previous_status: status, status: "COMPLETED" });
        expect(
          (
            await db()`SELECT state,reviewed_by_technician_id FROM technician_work_reports WHERE request_id=${id}`
          )[0],
        ).toMatchObject({
          state: "APPROVED",
          reviewed_by_technician_id: technician,
        });
        expect(
          (
            await db()`SELECT completed_by_technician_id FROM completion_reports WHERE request_id=${id}`
          )[0]?.completed_by_technician_id,
        ).toBe(technician);
        expect(
          (
            await finish(id, {
              version: 1,
              workSummary: "Repaired and tested the unit",
              checklist: checks,
            })
          ).status,
        ).toBe(200);
        expect(
          await db()`SELECT id FROM completion_reports WHERE request_id=${id}`,
        ).toHaveLength(1);
      });
    it("rejects stale, incomplete, held and foreign completions without creating reports", async () => {
      const id = await job(technician, "ACCEPTED");
      expect(
        (
          await finish(id, {
            version: 2,
            workSummary: "Repair completed",
            checklist: checks,
          })
        ).status,
      ).toBe(409);
      expect(
        (
          await finish(id, {
            version: 1,
            workSummary: "Repair completed",
            checklist: [],
          })
        ).status,
      ).toBe(422);
      expect(
        (
          await finish(
            id,
            { version: 1, workSummary: "Repair completed", checklist: checks },
            otherToken,
          )
        ).status,
      ).toBe(404);
      await db()`UPDATE service_requests SET status='ON_HOLD' WHERE id=${id}`;
      expect(
        (
          await finish(id, {
            version: 1,
            workSummary: "Repair completed",
            checklist: checks,
          })
        ).status,
      ).toBe(409);
      expect(
        await db()`SELECT id FROM technician_work_reports WHERE request_id=${id}`,
      ).toHaveLength(0);
    });
    it("keeps estimate approval required for direct completion", async () => {
      const id = await job(technician, "ACCEPTED");
      await db()`INSERT INTO technician_estimates(request_id,technician_id,version,state,diagnosis,items,subtotal_paise,tax_paise,total_paise) VALUES(${id},${technician},1,'AWAITING_CUSTOMER_APPROVAL','Parts required','[]'::jsonb,10000,0,10000)`;
      expect(
        (
          await finish(id, {
            version: 1,
            workSummary: "Repair completed",
            checklist: checks,
          })
        ).status,
      ).toBe(409);
      expect(
        await db()`SELECT id FROM technician_work_reports WHERE request_id=${id}`,
      ).toHaveLength(0);
    });
  },
);
