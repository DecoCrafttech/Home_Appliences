import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import request from "supertest";
import { app } from "./app.js";
import { db } from "./db.js";
const customer = randomUUID(), other = randomUUID(), token = randomUUID(), otherToken = randomUUID();
const hash = (v) => createHash("sha256").update(v).digest("hex");
const send = (key, message = "Please help with my test request.", session = token) => request(app)
    .post("/api/v1/support/tickets")
    .set("Cookie", "customer_session=" + session)
    .set("Idempotency-Key", key)
    .send({ subject: "Idempotency test " + customer, message });
describe.runIf(Boolean(process.env.DATABASE_URL))("transactional mutation idempotency", () => {
    beforeAll(async () => {
        expect(["codex-customer-dev", "br-gentle-wind-b4tsvt43"]).toContain(process.env.NEON_BRANCH);
        for (const [id, t] of [
            [customer, token],
            [other, otherToken],
        ]) {
            await db() `INSERT INTO customers(id,full_name,phone_e164) VALUES(${id},'Idempotency Test',${"test-" + id})`;
            await db() `INSERT INTO customer_sessions(customer_id,token_hash,expires_at) VALUES(${id},${hash(t)},now()+interval '1 hour')`;
        }
    }, 120000);
    afterAll(async () => {
        await db() `DELETE FROM staff_notifications WHERE event_key IN (SELECT 'ticket:'||id FROM support_tickets WHERE customer_id IN (${customer},${other}))`;
        await db() `DELETE FROM support_tickets WHERE customer_id IN (${customer},${other})`;
        await db() `DELETE FROM mutation_results WHERE actor_scope IN (${"customer:" + customer},${"customer:" + other})`;
        await db() `DELETE FROM customers WHERE id IN (${customer},${other})`;
    });
    it("serializes triple submission and returns one committed result after a lost response", async () => {
        const key = randomUUID();
        const results = await Promise.all([send(key), send(key), send(key)]);
        for (const r of results)
            expect(r.status, JSON.stringify(r.body)).toBe(201);
        expect(new Set(results.map((r) => r.body.data.id)).size).toBe(1);
        const retry = await send(key);
        expect(retry.body).toEqual(results[0].body);
        expect(retry.headers["idempotency-replayed"]).toBe("true");
        expect((await db() `SELECT id FROM support_tickets WHERE customer_id=${customer}`).length).toBe(1);
    });
    it("rejects key reuse with a different payload and scopes keys to the actor", async () => {
        const key = randomUUID();
        const first = await send(key, "A distinct request for support.");
        expect(first.status).toBe(201);
        expect((await send(key, "A changed request for support.")).status).toBe(409);
        const secondActor = await send(key, "A distinct request for support.", otherToken);
        expect(secondActor.status).toBe(201);
        expect(secondActor.body.data.id).not.toBe(first.body.data.id);
    });
    it("deduplicates separate-tab keys and never commits validation failures", async () => {
        const results = await Promise.all([
            send(randomUUID(), "Two tabs submit this same message."),
            send(randomUUID(), "Two tabs submit this same message."),
        ]);
        expect(results.map((r) => r.status)).toEqual([201, 201]);
        expect(results[0].body.data.id).toBe(results[1].body.data.id);
        const key = randomUUID();
        expect((await send(key, "x")).status).toBe(422);
        expect((await send(key, "Corrected valid support message.")).status).toBe(201);
    });
    it("does not replay for revoked sessions", async () => {
        const key = randomUUID();
        expect((await send(key, "Session revocation regression test.", otherToken))
            .status).toBe(201);
        await db() `UPDATE customer_sessions SET revoked_at=now() WHERE token_hash=${hash(otherToken)}`;
        expect((await send(key, "Session revocation regression test.", otherToken))
            .status).toBe(401);
    });
});
