import { afterAll, describe, expect, it, vi } from "vitest";
const verify = vi.hoisted(() => vi.fn());
vi.mock("./security/google.js", () => ({ verifyGoogleCredential: verify }));
import request from "supertest";
import { app } from "./app.js";
import { db } from "./db.js";
const subject = `google-${Date.now()}`,
  email = `google-${Date.now()}@example.com`,
  credential = "x".repeat(200);
const agent = request.agent(app);
const concurrentEmail = `concurrent-${Date.now()}@example.com`;
let customerId = "";
describe.runIf(Boolean(process.env.DATABASE_URL))(
  "customer Google authentication",
  () => {
    afterAll(async () => {
      const concurrentCustomers =
        await db()`SELECT id FROM customers WHERE email=${concurrentEmail}`;
      for (const customer of concurrentCustomers) {
        await db()`DELETE FROM customer_sessions WHERE customer_id=${customer.id}`;
        await db()`DELETE FROM customer_auth_identities WHERE customer_id=${customer.id}`;
        await db()`DELETE FROM customers WHERE id=${customer.id}`;
      }
      if (!customerId) return;
      await db()`DELETE FROM customer_sessions WHERE customer_id=${customerId}`;
      await db()`DELETE FROM customer_auth_identities WHERE customer_id=${customerId}`;
      await db()`DELETE FROM customers WHERE id=${customerId}`;
    });
    it("rejects a missing credential", async () => {
      expect(
        (await agent.post("/api/v1/auth/customer/google").send({})).status,
      ).toBe(422);
    });
    it("creates a Google-keyed customer and secure application session", async () => {
      verify.mockResolvedValueOnce({
        subject,
        email,
        name: "Google Customer",
        picture: "https://example.com/avatar.png",
      });
      const login = await agent
        .post("/api/v1/auth/customer/google")
        .send({ credential });
      expect(login.status).toBe(200);
      expect(login.body.data.created).toBe(true);
      customerId = login.body.data.customer.id;
      const identity =
        await db()`SELECT provider_subject,verified_email FROM customer_auth_identities WHERE customer_id=${customerId}`;
      expect(identity[0]?.provider_subject).toBe(subject);
      const me = await agent.get("/api/v1/auth/customer/me");
      expect(me.status).toBe(200);
      expect(me.body.data.email).toBe(email);
    }, 15000);
    it("returns the same customer for the same immutable Google subject", async () => {
      verify.mockResolvedValueOnce({
        subject,
        email,
        name: "Changed Display Name",
      });
      const login = await agent
        .post("/api/v1/auth/customer/google")
        .send({ credential });
      expect(login.status).toBe(200);
      expect(login.body.data.created).toBe(false);
      expect(login.body.data.customer.id).toBe(customerId);
    });
    it("rejects failed provider verification", async () => {
      verify.mockRejectedValueOnce(
        Object.assign(new Error("invalid"), {
          status: 401,
          code: "INVALID_GOOGLE_CREDENTIAL",
        }),
      );
      const response = await request(app)
        .post("/api/v1/auth/customer/google")
        .send({ credential });
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("INVALID_GOOGLE_CREDENTIAL");
    });
    it("handles concurrent first sign-ins without duplicate or orphan customers", async () => {
      const identity = {
        subject: `concurrent-${subject}`,
        email: concurrentEmail,
        name: "Concurrent Customer",
      };
      verify.mockResolvedValueOnce(identity).mockResolvedValueOnce(identity);
      const results = await Promise.all([
        request(app).post("/api/v1/auth/customer/google").send({ credential }),
        request(app).post("/api/v1/auth/customer/google").send({ credential }),
      ]);
      expect(results.map((r) => r.status)).toEqual([200, 200]);
      expect(results[0]!.body.data.customer.id).toBe(
        results[1]!.body.data.customer.id,
      );
      expect(results.filter((r) => r.body.data.created)).toHaveLength(1);
      const customers =
        await db()`SELECT id FROM customers WHERE email=${concurrentEmail}`;
      expect(customers).toHaveLength(1);
    });
    it("logs out and revokes the session", async () => {
      expect((await agent.post("/api/v1/auth/customer/logout")).status).toBe(
        204,
      );
      expect((await agent.get("/api/v1/auth/customer/me")).status).toBe(401);
    });
  },
);
