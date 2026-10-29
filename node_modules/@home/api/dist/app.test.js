import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "./app.js";
import { env } from "./config/env.js";
describe("API foundation", () => {
    it("serves the public Google client configuration without credentials or secrets", async () => {
        const res = await request(app).get("/api/v1/auth/customer/config");
        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            data: { clientId: env.GOOGLE_CLIENT_ID || null },
        });
        expect(res.headers["cache-control"]).toBe("no-store");
    });
    it("returns versioned health without caching", async () => {
        const res = await request(app).get("/api/v1/health");
        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe("ok");
        expect(res.headers["cache-control"]).toBe("no-store");
        expect(res.headers["x-content-type-options"]).toBe("nosniff");
    });
    it("allows credentialed requests from the configured customer app origin", async () => {
        const res = await request(app)
            .options("/api/v1/auth/customer/google")
            .set("Origin", env.CUSTOMER_APP_ORIGIN)
            .set("Access-Control-Request-Method", "POST")
            .set("Access-Control-Request-Headers", "content-type");
        expect(res.status).toBe(204);
        expect(res.headers["access-control-allow-origin"]).toBe(env.CUSTOMER_APP_ORIGIN);
        expect(res.headers["access-control-allow-credentials"]).toBe("true");
    });
    it("returns a consistent missing route response", async () => {
        const res = await request(app).get("/api/v1/bookings");
        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe("NOT_FOUND");
    });
});
