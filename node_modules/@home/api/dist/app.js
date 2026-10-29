import { technicianIdentityRoutes, adminIdentityRoutes, } from "./technicianIdentity.js";
import { technicianStorageRoutes, adminStorageRoutes, } from "./technicianStorage.js";
import { technicianRoutes, technicianAdminRoutes, technicianCustomerRoutes, } from "./technicianRoutes.js";
import express from "express";
import { ZodError } from "zod";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { createApiRateLimit } from "./apiRateLimit.js";
import pino from "pino";
import { randomUUID } from "node:crypto";
import { env } from "./config/env.js";
import { ApiError, customerRoutes } from "./customerRoutes.js";
import { adminRoutes } from "./adminRoutes.js";
import { statusOverrideRoutes } from "./statusOverrideRoutes.js";
import { applianceCatalogueRoutes } from "./applianceCatalogueRoutes.js";
import { aftercareRoutes, feedbackRoutes } from "./aftercareRoutes.js";
import { idempotentMutations } from "./idempotency.js";
import { notificationRoutes } from "./notificationRoutes.js";
import { readinessRoutes } from "./readinessRoutes.js";
import { catalogueMediaAdmin, catalogueMediaPublic } from "./catalogueMedia.js";
import { adminCalendarRoutes, technicianCalendarRoutes, } from "./calendarRoutes.js";
export const logger = pino({
    level: env.NODE_ENV === "test" ? "silent" : "info",
    redact: ["req.headers.cookie", "req.headers.authorization"],
});
export const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(cors({
    origin: [...new Set([env.CUSTOMER_ORIGIN, env.CUSTOMER_APP_ORIGIN])],
    credentials: true,
}));
app.use((req, res, next) => {
    const id = randomUUID();
    res.setHeader("X-Request-Id", id);
    res.setHeader("Cache-Control", "no-store");
    res.on("finish", () => logger.info({ requestId: id, method: req.method, status: res.statusCode }, "request completed"));
    next();
});
app.use(createApiRateLimit(env.NODE_ENV === "production" ? 300 : 1000));
app.use("/api/v1/admin/catalogue/media", express.json({ limit: "512kb" }));
app.use(express.json({ limit: "32kb" }));
app.use(idempotentMutations);
app.use([
    "/api/v1/admin/auth/login",
    "/api/v1/admin/auth/mfa",
    "/api/v1/admin/auth/password",
    "/api/v1/auth/customer/google",
    "/api/v1/auth/otp",
], rateLimit({
    windowMs: 60_000,
    limit: 15,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
        error: {
            code: "AUTH_RATE_LIMITED",
            message: "Too many sign-in attempts. Please wait a minute and try again.",
        },
    },
}));
app.get("/api/v1/health", (_req, res) => res.json({ data: { status: "ok", version: "0.1.0", phase: 1 } }));
app.use("/api/v1", readinessRoutes);
app.use("/api/v1/technician", technicianCalendarRoutes);
app.use("/api/v1/technician", technicianRoutes);
app.use("/api/v1/technician", technicianIdentityRoutes);
app.use("/api/v1/technician", technicianStorageRoutes);
app.use("/api/v1/admin", adminIdentityRoutes);
app.use("/api/v1/admin", adminStorageRoutes);
app.use("/api/v1", technicianCustomerRoutes);
app.use("/api/v1/admin", technicianAdminRoutes);
app.use("/api/v1/admin", notificationRoutes);
app.use("/api/v1/admin", catalogueMediaAdmin);
app.use("/api/v1/admin", adminCalendarRoutes);
app.use("/api/v1", catalogueMediaPublic);
app.use("/api/v1", customerRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/admin", statusOverrideRoutes);
app.use("/api/v1", applianceCatalogueRoutes);
app.use("/api/v1/admin", feedbackRoutes);
app.use("/api/v1", aftercareRoutes);
app.use((_req, res) => res
    .status(404)
    .json({ error: { code: "NOT_FOUND", message: "Endpoint not found" } }));
const handleError = (error, _req, res, _next) => {
    const malformed = error instanceof SyntaxError && "body" in error;
    logger.error({ err: error }, "request failed");
    const apiError = error instanceof ApiError;
    const validationError = error instanceof ZodError;
    const conflict = error?.code === "23505";
    if (error?.code === "23P01") {
        res.status(409).json({
            error: {
                code: "APPOINTMENT_CONFLICT",
                message: "This technician already has an overlapping appointment. Choose another time or technician.",
            },
        });
        return;
    }
    res
        .status(apiError
        ? error.status
        : validationError
            ? 422
            : conflict
                ? 409
                : malformed
                    ? 400
                    : 500)
        .json({
        error: {
            code: apiError
                ? error.code
                : validationError
                    ? "VALIDATION_ERROR"
                    : conflict
                        ? "DUPLICATE_RECORD"
                        : malformed
                            ? "INVALID_JSON"
                            : "INTERNAL_ERROR",
            message: apiError
                ? error.message
                : validationError
                    ? error.issues[0]?.message || "Check the submitted details"
                    : conflict
                        ? "These details are already in use. Check the information and try again."
                        : malformed
                            ? "Invalid JSON request"
                            : "Something went wrong",
        },
    });
};
app.use(handleError);
