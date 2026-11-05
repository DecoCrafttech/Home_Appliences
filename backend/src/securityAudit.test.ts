import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
const state = vi.hoisted(() => ({ sql: vi.fn(), transaction: vi.fn() }));
vi.mock("./db.js", () => ({
  db: () =>
    Object.assign(state.sql, {
      query: state.sql,
      transaction: state.transaction,
    }),
  transactionConnection: vi.fn(() => {
    throw new Error("Unexpected transaction in boundary test");
  }),
  inTransaction: vi.fn(),
}));
import { app, logger } from "./app.js";
import { requireAuth } from "./customerRoutes.js";
import { requireStaff, allow } from "./adminRoutes.js";
import { requireTechnician } from "./technicianRoutes.js";
import { trustedPushEndpoint } from "./security/pushEndpoint.js";
import { safeError } from "./security/safeError.js";

beforeEach(() => {
  state.sql.mockReset().mockResolvedValue([]);
  vi.restoreAllMocks();
});

describe("authentication and browser write boundaries", () => {
  it("rejects unauthenticated access across admin and technician route families", async () => {
    for (const path of [
      "admin/dashboard/summary",
      "admin/customers",
      "admin/requests",
      "admin/technicians",
      "admin/settings/business",
      "admin/notifications",
      "admin/feedback",
      "technician/jobs",
      "technician/auth/me",
      "profile",
      "requests",
    ]) {
      expect((await request(app).get(`/api/v1/${path}`)).status, path).toBe(
        401,
      );
    }
    expect(state.sql).not.toHaveBeenCalled();
  });
  it("rejects browser writes from untrusted origins before database access", async () => {
    const response = await request(app)
      .post("/api/v1/admin/auth/login")
      .set("Origin", "https://untrusted.fixbeez.in")
      .send({ username: "admin", password: "not-a-real-password" });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("UNTRUSTED_ORIGIN");
    expect(state.sql).not.toHaveBeenCalled();
    const allowed = await request(app)
      .post("/api/v1/admin/auth/login")
      .set("Origin", "http://127.0.0.1:5174")
      .send({});
    expect(allowed.status).toBe(422);
  });
  it("enforces temporary admin password restrictions on the server", async () => {
    state.sql.mockResolvedValue([
      { id: "staff-1", role: "SUPER_ADMIN", must_change_password: true },
    ]);
    const blocked = await request(app)
      .get("/api/v1/admin/dashboard/summary")
      .set("Cookie", "staff_session=opaque-test-token");
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");
    expect(
      (
        await request(app)
          .get("/api/v1/admin/auth/me")
          .set("Cookie", "staff_session=opaque-test-token")
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .post("/api/v1/admin/auth/password")
          .set("Cookie", "staff_session=opaque-test-token")
          .send({})
      ).status,
    ).toBe(422);
  });
  it("checks a customer session and account only once per HTTP request", async () => {
    state.sql.mockResolvedValue([
      { customer_id: "customer-1", account_status: "ACTIVE" },
    ]);
    const server = express();
    server.get("/", requireAuth, requireAuth, (_req, res) =>
      res.sendStatus(200),
    );
    expect(
      (
        await request(server)
          .get("/")
          .set("Cookie", "customer_session=opaque-test-token")
      ).status,
    ).toBe(200);
    expect(state.sql).toHaveBeenCalledTimes(1);
    state.sql.mockResolvedValue([
      { customer_id: "customer-1", account_status: "SUSPENDED" },
    ]);
    expect(
      (
        await request(server)
          .get("/")
          .set("Cookie", "customer_session=opaque-test-token")
      ).status,
    ).toBe(403);
  });
  it("reuses staff authentication without weakening role authorization", async () => {
    state.sql.mockResolvedValue([
      { id: "staff-1", role: "SUPPORT_AGENT", must_change_password: false },
    ]);
    const server = express();
    server.get("/", requireStaff, requireStaff, allow("ADMIN"), (_req, res) =>
      res.sendStatus(200),
    );
    expect(
      (
        await request(server)
          .get("/")
          .set("Cookie", "staff_session=opaque-test-token")
      ).status,
    ).toBe(403);
    expect(state.sql).toHaveBeenCalledTimes(1);
  });
  it("checks technician CSRF before caching verified identity", async () => {
    const csrf = "a".repeat(43);
    state.sql.mockResolvedValue([
      {
        id: "session-1",
        technician_id: "tech-1",
        csrf_token: csrf,
        status: "ACTIVE",
        active: true,
        verification_status: "VERIFIED",
        expires_at: "2099-01-01",
        must_change_password: false,
      },
    ]);
    const server = express();
    server.post("/", requireTechnician, requireTechnician, (_req, res) =>
      res.sendStatus(200),
    );
    expect(
      (
        await request(server)
          .post("/")
          .set("Cookie", "technician_session=opaque-test-token")
      ).status,
    ).toBe(403);
    state.sql.mockClear();
    expect(
      (
        await request(server)
          .post("/")
          .set("Cookie", "technician_session=opaque-test-token")
          .set("X-CSRF-Token", csrf)
      ).status,
    ).toBe(200);
    expect(state.sql).toHaveBeenCalledTimes(1);
  });
  it("bounds credential inputs before password hashing", async () => {
    expect(
      (
        await request(app)
          .post("/api/v1/admin/auth/login")
          .send({ username: "admin", password: "x".repeat(129) })
      ).status,
    ).toBe(422);
    expect(state.sql).not.toHaveBeenCalled();
  });
});

describe("error privacy, body bounds and outbound requests", () => {
  it("bounds collection and nesting complexity before schema-validation work", async () => {
    expect(
      (
        await request(app)
          .post("/api/v1/admin/auth/login")
          .send({ items: Array.from({ length: 1001 }, () => ({})) })
      ).status,
    ).toBe(413);
    let nested: unknown = "value";
    for (let i = 0; i < 18; i++) nested = { nested };
    expect(
      (
        await request(app)
          .post("/api/v1/admin/auth/login")
          .send(nested as Record<string, unknown>)
      ).status,
    ).toBe(413);
    expect(state.sql).not.toHaveBeenCalled();
  });
  it("does not log private database details or expose them in errors", async () => {
    const spy = vi.spyOn(logger, "error").mockImplementation(() => {});
    state.sql.mockRejectedValue(
      Object.assign(new Error("PRIVATE-PASSWORD-AND-CUSTOMER-DATA"), {
        detail: "PRIVATE-DATABASE-DETAIL",
      }),
    );
    const response = await request(app).get("/api/v1/catalogue");
    expect(response.status).toBe(500);
    expect(
      JSON.stringify(response.body) + JSON.stringify(spy.mock.calls),
    ).not.toContain("PRIVATE-");
    expect(spy).toHaveBeenCalled();
  });
  it("handles malformed and oversized JSON without logging submitted passwords", async () => {
    const spy = vi.spyOn(logger, "error").mockImplementation(() => {});
    expect(
      (
        await request(app)
          .post("/api/v1/admin/auth/login")
          .set("Content-Type", "application/json")
          .send('{"password":"PRIVATE-PASSWORD"')
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post("/api/v1/admin/auth/login")
          .send({ password: "x".repeat(40000) })
      ).status,
    ).toBe(413);
    expect(JSON.stringify(spy.mock.calls)).not.toContain("PRIVATE-PASSWORD");
    expect(
      safeError({ name: "Error", code: "secret password", detail: "private" }),
    ).toEqual({ errorType: "Error", errorCode: undefined });
  });
  it("allows browser push providers and blocks SSRF targets and lookalike hosts", () => {
    for (const endpoint of [
      "https://fcm.googleapis.com/fcm/send/opaque",
      "https://updates.push.services.mozilla.com/wpush/v2/opaque",
      "https://web.push.apple.com/opaque",
      "https://wns.notify.windows.com/opaque",
    ])
      expect(trustedPushEndpoint(endpoint), endpoint).toBe(true);
    for (const endpoint of [
      "http://fcm.googleapis.com/opaque",
      "https://127.0.0.1/",
      "https://169.254.169.254/",
      "https://localhost/",
      "https://fcm.googleapis.com.evil.test/",
      "https://evil.test/?host=fcm.googleapis.com",
      "https://user:password@fcm.googleapis.com/",
      "https://fcm.googleapis.com:8443/",
    ])
      expect(trustedPushEndpoint(endpoint), endpoint).toBe(false);
  });
});
