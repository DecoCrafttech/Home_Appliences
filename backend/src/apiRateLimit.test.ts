import express from "express";
import { rateLimit } from "express-rate-limit";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApiRateLimit } from "./apiRateLimit.js";

function fixture() {
  const app = express();
  app.use(createApiRateLimit(2));
  app.use(
    "/api/v1/admin/auth/login",
    rateLimit({ windowMs: 60_000, limit: 1, legacyHeaders: false }),
  );
  app.use((_req, res) => res.sendStatus(204));
  return app;
}

describe("API rate limit exclusions", () => {
  it.each([
    "/api/v1/admin/dashboard/summary",
    "/api/v1/admin/dashboard/activity",
    "/api/v1/admin/dashboard/allocation",
    "/api/v1/admin/notifications",
    "/api/v1/admin/auth/me",
  ])(
    "keeps Admin GET %s available after the shared quota is exhausted",
    async (path) => {
      const app = fixture();
      await request(app).get("/api/v1/catalogue").expect(204);
      await request(app).get("/api/v1/catalogue").expect(204);
      await request(app).get("/api/v1/catalogue").expect(429);
      for (const url of [path, path + "/", path.toUpperCase() + "?refresh=1"]) {
        const response = await request(app).get(url).expect(204);
        expect(response.headers.ratelimit).toBeUndefined();
        expect(response.headers["ratelimit-policy"]).toBeUndefined();
      }
    },
  );

  it("limits other Admin auth routes and mutations on read-only dashboard paths", async () => {
    const app = fixture();
    await request(app).get("/api/v1/admin/auth/me-extra").expect(204);
    await request(app)
      .get("/api/v1/admin/dashboard/summary-export")
      .expect(204);
    await request(app).post("/api/v1/admin/dashboard/summary").expect(429);
    await request(app).post("/api/v1/admin/auth/password").expect(429);
  });

  it.each([
    ["Customer", "/api/v1/notifications", "/api/v1/requests"],
    ["Admin", "/api/v1/admin/notifications", "/api/v1/admin/requests"],
    [
      "Technician",
      "/api/v1/technician/notifications",
      "/api/v1/technician/jobs",
    ],
  ])(
    "keeps %s notification and request reads outside the quota",
    async (_role, notices, jobs) => {
      const app = fixture();
      // Exhaust the shared quota before fetching any excluded workflow.
      await request(app).get("/api/v1/catalogue").expect(204);
      await request(app).get("/api/v1/catalogue").expect(204);
      await request(app).get("/api/v1/catalogue").expect(429);
      for (const path of [notices, jobs, `${jobs}/example`, notices]) {
        const response = await request(app).get(path).expect(204);
        expect(response.headers.ratelimit).toBeUndefined();
        expect(response.headers["ratelimit-policy"]).toBeUndefined();
      }
    },
  );

  it("exempts nested mutations, booking aliases and assignment actions", async () => {
    const app = fixture();
    for (const path of [
      "/api/v1/notifications/read-all",
      "/api/v1/admin/notifications/example/read",
      "/api/v1/technician/notifications/read-all",
      "/api/v1/requests/service",
      "/api/v1/requests/installation",
      "/api/v1/service-requests",
      "/api/v1/installation-requests",
      "/api/v1/admin/requests/example/status",
      "/api/v1/staff/requests/example/status",
      "/api/v1/technician/assignments/example/accept",
      "/api/v1/technician/jobs/example/report",
      "/API/V1/ADMIN/REQUESTS/example/status",
    ]) {
      const response = await request(app).post(path).expect(204);
      expect(response.headers.ratelimit).toBeUndefined();
    }
    // Excluded mutations did not consume the general quota.
    await request(app).get("/api/v1/catalogue").expect(204);
    await request(app).get("/api/v1/catalogue").expect(204);
  });

  it("still limits other endpoints and returns the configured API error", async () => {
    const app = fixture();
    await request(app).get("/api/v1/catalogue").expect(204);
    const second = await request(app).get("/api/v1/profile").expect(204);
    expect(second.headers["ratelimit-policy"]).toBeDefined();
    const blocked = await request(app).get("/api/v1/catalogue").expect(429);
    expect(blocked.body.error.code).toBe("RATE_LIMITED");
  });

  it("preserves the separate authentication limiter", async () => {
    const app = fixture();
    await request(app).post("/api/v1/admin/auth/login").expect(204);
    await request(app).post("/api/v1/admin/auth/login").expect(429);
  });

  it("does not exempt similarly named unrelated routes", async () => {
    const app = fixture();
    await request(app).get("/api/v1/requests-export").expect(204);
    await request(app).get("/api/v1/admin/notifications-settings").expect(204);
    await request(app).get("/api/v1/technician/jobs-admin").expect(429);
  });
});
