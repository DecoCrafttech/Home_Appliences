import { Router } from "express";
import { db } from "./db.js";
export const readinessRoutes = Router();
readinessRoutes.get("/ready", async (_req, res) => {
    try {
        await db().query("SELECT 1 AS ok", [], {
            fetchOptions: { signal: AbortSignal.timeout(5000) },
        });
        res.json({ data: { status: "ready", database: "connected" } });
    }
    catch {
        res.status(503).json({
            error: {
                code: "DATABASE_UNAVAILABLE",
                message: "The database is unavailable. Please try again shortly.",
            },
        });
    }
});
