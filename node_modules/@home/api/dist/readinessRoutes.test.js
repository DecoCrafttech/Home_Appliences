import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { db } from "./db.js";
import { readinessRoutes } from "./readinessRoutes.js";
vi.mock("./db.js", () => ({ db: vi.fn() }));
const app = express();
app.use("/api/v1", readinessRoutes);
describe("database readiness", () => {
    beforeEach(() => vi.resetAllMocks());
    it("confirms a database query before reporting ready", async () => {
        const query = vi.fn().mockResolvedValue([{ ok: 1 }]);
        vi.mocked(db).mockReturnValue({ query });
        const response = await request(app).get("/api/v1/ready");
        expect(response.status).toBe(200);
        expect(response.body.data).toEqual({
            status: "ready",
            database: "connected",
        });
        expect(query).toHaveBeenCalledWith("SELECT 1 AS ok", [], {
            fetchOptions: { signal: expect.any(AbortSignal) },
        });
    });
    it("returns unavailable without exposing connection secrets", async () => {
        vi.mocked(db).mockReturnValue({
            query: vi
                .fn()
                .mockRejectedValue(new Error("postgres://user:secret@host")),
        });
        const response = await request(app).get("/api/v1/ready");
        expect(response.status).toBe(503);
        expect(response.body.error.code).toBe("DATABASE_UNAVAILABLE");
        expect(JSON.stringify(response.body)).not.toContain("secret");
    });
});
