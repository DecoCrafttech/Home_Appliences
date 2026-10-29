import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "./app.js";
import { db } from "./db.js";
import { env } from "./config/env.js";

const mobile = `9${String(Date.now()).slice(-9)}`;
const preferredDate = (() => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
})();
const agent = request.agent(app);
let customerId = "";
let serviceId = "";

describe.runIf(Boolean(process.env.DATABASE_URL))("customer Neon workflows", () => {
  beforeAll(async () => { await db()`SELECT 1`; });
  afterAll(async () => {
    if (!customerId) return;
    await db()`DELETE FROM request_status_events WHERE request_id IN (SELECT id FROM service_requests WHERE customer_id=${customerId})`;
    await db()`DELETE FROM service_requests WHERE customer_id=${customerId}`;
    await db()`DELETE FROM support_tickets WHERE customer_id=${customerId}`;
    await db()`DELETE FROM customer_addresses WHERE customer_id=${customerId}`;
    await db()`DELETE FROM customer_sessions WHERE customer_id=${customerId}`;
    await db()`DELETE FROM customers WHERE id=${customerId}`;
    await db()`DELETE FROM otp_challenges WHERE phone_e164=${`+91${mobile}`}`;
  });
  it("authenticates with OTP and persists a profile", async () => {
    const sent=await agent.post("/api/v1/auth/otp/request").send({mobile}); expect(sent.status).toBe(201);
    const verified=await agent.post("/api/v1/auth/otp/verify").send({challengeId:sent.body.data.challengeId,code:"123456"}); expect(verified.status).toBe(200); customerId=verified.body.data.customer.id;
    const saved=await agent.patch("/api/v1/profile").send({fullName:"Integration Customer",email:"integration@example.com"}); expect(saved.status).toBe(200); expect(saved.body.data.full_name).toBe("Integration Customer");
  });
  it("loads Neon catalogue and persists saved addresses", async () => {
    const appliances=await agent.get("/api/v1/appliances");expect(appliances.status).toBe(200);expect(appliances.body.data.length).toBeGreaterThanOrEqual(10);
    const saved=await agent.post("/api/v1/addresses").send({label:"Home",recipientName:"Integration Customer",phone:mobile,line1:"12 Test Street",area:"Test Area",city:"Chennai",state:"Tamil Nadu",pinCode:"600001",isDefault:true});expect(saved.status).toBe(201);
    const addresses=await agent.get("/api/v1/addresses");expect(addresses.status).toBe(200);expect(addresses.body.data[0].is_default).toBe(true);
  });
  it("persists service and installation requests and retrieves them", async () => {
    const appliances=await agent.get("/api/v1/appliances");const washing=appliances.body.data.find((a:{slug:string})=>a.slug==="washing-machine");const television=appliances.body.data.find((a:{slug:string})=>a.slug==="television");
    const serviceCatalogue=await agent.get("/api/v1/services").query({applianceCategoryId:washing.id});const notSpinning=serviceCatalogue.body.data.find((s:{slug:string})=>s.slug==="not-spinning");
    const installationCatalogue=await agent.get("/api/v1/installations").query({applianceCategoryId:television.id});const wallMount=installationCatalogue.body.data.find((s:{slug:string})=>s.slug==="wall-mount");
    const base={applianceCategoryId:washing.id,serviceId:notSpinning.id,details:{description:"Drum does not spin"},address:{name:"Integration Customer",phone:mobile,line1:"12 Test Street",area:"Test Area",city:"Chennai",state:"Tamil Nadu",pinCode:"600001"},preferredDate,preferredTimeWindow:"10:00-12:00"};
    const service=await agent.post("/api/v1/requests/service").send({...base,idempotencyKey:crypto.randomUUID()});expect(service.status).toBe(201);serviceId=service.body.data.id;
    const installation=await agent.post("/api/v1/requests/installation").send({...base,applianceCategoryId:television.id,serviceId:wallMount.id,idempotencyKey:crypto.randomUUID()});expect(installation.status).toBe(201);
    const list=await agent.get("/api/v1/requests");expect(list.status).toBe(200);expect(list.body.data).toHaveLength(2);
  });
  it("persists status history and support tickets", async () => {
    if (env.STAFF_API_KEY) {
      const status=await request(app).post(`/api/v1/staff/requests/${serviceId}/status`).set("x-staff-api-key",env.STAFF_API_KEY).send({status:"CONFIRMED",note:"Visit confirmed"});expect(status.status).toBe(200);
    } else {
      await db()`WITH changed AS (UPDATE service_requests SET status_source='WORKFLOW',status='CONFIRMED',updated_at=now() WHERE id=${serviceId} RETURNING id) INSERT INTO request_status_events(request_id,status,note) SELECT id,'CONFIRMED','Visit confirmed' FROM changed`;
    }
    const timeline=await agent.get(`/api/v1/requests/${serviceId}/timeline`);expect(timeline.body.data.map((e:{status:string})=>e.status)).toEqual(["REQUESTED","CONFIRMED"]);
    const ticket=await agent.post("/api/v1/support/tickets").send({subject:"Booking question",message:"Please confirm the expected visit time."});expect(ticket.status).toBe(201);
    const tickets=await agent.get("/api/v1/support/tickets");expect(tickets.body.data).toHaveLength(1);
  });
});
