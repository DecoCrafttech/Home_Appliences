import { rateLimit } from "express-rate-limit";
// These authenticated workflows fetch on demand. Keep them outside the shared
// IP quota without changing their authorization or mutation deduplication.
const onDemandWorkflow = /^\/api\/v1\/(?:admin\/(?:requests|notifications)|technician\/(?:jobs|assignments|notifications)|staff\/requests|requests|service-requests|installation-requests|notifications)(?:\/|$)/i;
const adminReadRoute = /^\/api\/v1\/admin\/(?:dashboard\/(?:summary|activity|allocation)|auth\/me)\/?$/i;
export function createApiRateLimit(limit) {
    return rateLimit({
        windowMs: 60_000,
        limit,
        skip: (req) => onDemandWorkflow.test(req.path) ||
            (req.method === "GET" && adminReadRoute.test(req.path)),
        message: {
            error: {
                code: "RATE_LIMITED",
                message: "Too many requests. Please try again shortly.",
            },
        },
        standardHeaders: "draft-8",
        legacyHeaders: false,
    });
}
