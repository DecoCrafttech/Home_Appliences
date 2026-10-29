import { notificationReadAllSchema } from "@home/shared";
import { Router } from "express";
import { z } from "zod";
import { db } from "./db.js";
import { ApiError, requireAuth } from "./customerRoutes.js";
import { requireStaff, allow } from "./adminRoutes.js";
import { cancellationStatuses, reviewSchema } from "@home/shared";
import { env } from "./config/env.js";
const route = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
export const aftercareRoutes = Router();
export const feedbackRoutes = Router();
for (const router of [aftercareRoutes, feedbackRoutes])
    router.param("id", (_req, _res, next, id) => next(z.string().uuid().safeParse(id).success
        ? undefined
        : new ApiError(422, "VALIDATION_ERROR", "Invalid record ID")));
aftercareRoutes.use(["/notifications", "/requests", "/profile/reviews"], requireAuth);
feedbackRoutes.use(requireStaff);
const handleFeedback = allow("SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER", "SUPPORT_AGENT");
aftercareRoutes.get("/appointment-windows", route(async (_req, res) => {
    let windows;
    try {
        windows = z
            .array(z.object({
            id: z.string().min(2).max(50),
            label: z.string().min(2).max(100),
        }))
            .min(1)
            .max(20)
            .parse(JSON.parse(env.APPOINTMENT_WINDOWS));
    }
    catch {
        throw new ApiError(503, "WINDOWS_UNAVAILABLE", "Preferred visit windows are unavailable. Please contact support");
    }
    res.json({
        data: windows,
        meta: { kind: "PREFERRED", confirmedAvailability: false },
    });
}));
aftercareRoutes.post("/locations/reverse-geocode", requireAuth, route(async (req, res) => {
    const input = z
        .object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
    })
        .safeParse(req.body);
    if (!input.success)
        throw new ApiError(422, "VALIDATION_ERROR", "Invalid location");
    if (!env.GOOGLE_GEOCODING_API_KEY)
        throw new ApiError(503, "GEOCODING_UNAVAILABLE", "Address lookup is not configured. Please enter your address manually");
    let payload;
    try {
        const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
        url.searchParams.set("latlng", `${input.data.latitude},${input.data.longitude}`);
        url.searchParams.set("key", env.GOOGLE_GEOCODING_API_KEY);
        const upstream = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!upstream.ok)
            throw new Error("upstream");
        payload = (await upstream.json());
    }
    catch {
        throw new ApiError(503, "GEOCODING_UNAVAILABLE", "Unable to resolve this location. Enter your address manually");
    }
    if (payload.status !== "OK" || !payload.results[0])
        throw new ApiError(422, "LOCATION_NOT_FOUND", "No address was found. Please enter it manually");
    const components = payload.results[0].address_components;
    const get = (type) => components.find((c) => c.types.includes(type))?.long_name || "";
    const country = components.find((c) => c.types.includes("country"))?.short_name;
    if (country !== "IN")
        throw new ApiError(422, "UNSUPPORTED_AREA", "Please enter a service address in India");
    res.json({
        data: {
            area: get("sublocality_level_1") ||
                get("sublocality") ||
                get("neighborhood"),
            city: get("locality") || get("administrative_area_level_2"),
            state: get("administrative_area_level_1"),
            pinCode: get("postal_code"),
        },
    });
}));
aftercareRoutes.get("/notifications", route(async (req, res) => {
    const rows = await db() `SELECT (SELECT count(*)::int FROM customer_notifications all_notices WHERE all_notices.customer_id=${req.customerId} AND all_notices.read_at IS NULL) AS unread_count,id,request_id,related_path,kind,title,message,read_at,created_at FROM customer_notifications WHERE customer_id=${req.customerId} ORDER BY created_at DESC LIMIT 100`;
    res.json({
        data: rows,
        meta: {
            unreadCount: Number(rows[0]?.unread_count || 0),
            fetchedAt: new Date().toISOString(),
        },
    });
}));
aftercareRoutes.patch("/notifications/read-all", route(async (req, res) => {
    const input = notificationReadAllSchema.parse(req.body);
    const data = await db() `UPDATE customer_notifications SET read_at=COALESCE(read_at,now()) WHERE customer_id=${req.customerId} AND ((${input.before || null}::timestamptz IS NOT NULL AND created_at<=${input.before || null}::timestamptz) OR id=ANY(${input.ids || []}::uuid[])) RETURNING id,read_at`;
    res.json({ data });
}));
aftercareRoutes.patch("/notifications/:id/read", route(async (req, res) => {
    const rows = await db() `UPDATE customer_notifications SET read_at=COALESCE(read_at,now()) WHERE id=${req.params.id} AND customer_id=${req.customerId} RETURNING *`;
    if (!rows[0])
        throw new ApiError(404, "NOT_FOUND", "Notification not found");
    res.json({ data: rows[0] });
}));
aftercareRoutes.post("/requests/:id/cancel", route(async (req, res) => {
    const input = z
        .object({
        reason: z.string().trim().min(3).max(300),
        version: z.number().int().positive(),
    })
        .safeParse(req.body);
    if (!input.success)
        throw new ApiError(422, "VALIDATION_ERROR", "Enter a cancellation reason");
    const owned = await db() `SELECT status,version FROM service_requests WHERE id=${req.params.id} AND customer_id=${req.customerId}`;
    if (!owned[0])
        throw new ApiError(404, "NOT_FOUND", "Request not found");
    if (!cancellationStatuses.includes(owned[0].status))
        throw new ApiError(409, "CANCELLATION_UNAVAILABLE", "Contact support to change this request; work may already be scheduled");
    const rows = await db() `WITH changed AS (UPDATE service_requests SET status_source='WORKFLOW',status='CANCELLED',version=version+1,updated_at=now() WHERE id=${req.params.id} AND customer_id=${req.customerId} AND version=${input.data.version} AND status IN ('REQUESTED','UNDER_REVIEW','EXECUTIVE_CONTACTED','ASSIGNMENT_PENDING') RETURNING *),cancelled_assignment AS (UPDATE technician_assignments SET state='CANCELLED',reason='Customer cancelled',version=version+1 WHERE request_id IN (SELECT id FROM changed) AND state IN ('OFFERED','ACCEPTED') RETURNING *),notice AS (INSERT INTO technician_notifications(technician_id,request_id,event_key,title,message) SELECT technician_id,request_id,'cancelled:'||id,'Job cancelled','The customer cancelled this request.' FROM cancelled_assignment ON CONFLICT(event_key) DO NOTHING RETURNING id),event AS (INSERT INTO request_status_events(request_id,status,note,actor_role) SELECT id,'CANCELLED',${input.data.reason},'CUSTOMER' FROM changed RETURNING id) SELECT * FROM changed`;
    if (!rows[0])
        throw new ApiError(409, "STALE_REQUEST", "This request changed. Refresh and try again");
    res.json({ data: rows[0] });
}));
aftercareRoutes.get("/requests/:id/review", route(async (req, res) => {
    const owned = await db() `SELECT id FROM service_requests WHERE id=${req.params.id} AND customer_id=${req.customerId}`;
    if (!owned[0])
        throw new ApiError(404, "NOT_FOUND", "Request not found");
    const rows = await db() `SELECT id,rating,comment,tags,created_at FROM request_reviews WHERE request_id=${req.params.id} AND customer_id=${req.customerId}`;
    res.json({ data: rows[0] || null });
}));
aftercareRoutes.post("/requests/:id/review", route(async (req, res) => {
    const input = reviewSchema.safeParse(req.body);
    if (!input.success)
        throw new ApiError(422, "VALIDATION_ERROR", "Choose one to five stars and check your feedback");
    const owned = await db() `SELECT id,status FROM service_requests WHERE id=${req.params.id} AND customer_id=${req.customerId} FOR UPDATE`;
    if (!owned[0])
        throw new ApiError(404, "NOT_FOUND", "Request not found");
    if (owned[0].status !== "COMPLETED")
        throw new ApiError(409, "REVIEW_NOT_ELIGIBLE", "Reviews are available after service completion");
    const rows = await db() `INSERT INTO request_reviews(request_id,customer_id,technician_id,rating,comment,tags) SELECT id,customer_id,assigned_technician_id,${input.data.rating},${input.data.comment},${JSON.stringify([...new Set(input.data.tags)])}::jsonb FROM service_requests WHERE id=${req.params.id} AND customer_id=${req.customerId} AND status='COMPLETED' ON CONFLICT(request_id) DO NOTHING RETURNING id,rating,comment,tags,created_at`;
    if (!rows[0])
        throw new ApiError(409, "REVIEW_EXISTS", "A review has already been submitted for this request");
    res.status(201).json({ data: rows[0] });
}));
aftercareRoutes.patch("/requests/:id/review-reminder", route(async (req, res) => {
    const rows = await db() `UPDATE service_requests SET review_reminder_dismissed_at=COALESCE(review_reminder_dismissed_at,now()) WHERE id=${req.params.id} AND customer_id=${req.customerId} AND status='COMPLETED' RETURNING id,review_reminder_dismissed_at`;
    if (!rows[0])
        throw new ApiError(404, "NOT_FOUND", "Completed request not found");
    res.json({ data: rows[0] });
}));
aftercareRoutes.get("/profile/reviews", route(async (req, res) => {
    const rows = await db() `SELECT v.id,v.request_id,v.rating,v.comment,v.tags,v.created_at,r.request_number,r.appliance FROM request_reviews v JOIN service_requests r ON r.id=v.request_id WHERE v.customer_id=${req.customerId} ORDER BY v.created_at DESC`;
    res.json({ data: rows });
}));
feedbackRoutes.get("/feedback/summary", route(async (_req, res) => {
    const rows = await db() `SELECT count(*)::int AS total_reviews,COALESCE(round(avg(rating)::numeric,1),0)::float AS average_rating,count(*) FILTER(WHERE rating=5)::int AS five_star_reviews,count(*) FILTER(WHERE rating<=2)::int AS low_ratings,count(*) FILTER(WHERE handling_status!='RESOLVED' AND rating<=2)::int AS needs_attention,count(*) FILTER(WHERE handling_status='RESOLVED')::int AS resolved FROM request_reviews`;
    res.json({ data: rows[0] });
}));
feedbackRoutes.get("/feedback", route(async (req, res) => {
    const input = z
        .object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        q: z.string().max(120).default(""),
        rating: z.enum(["", "1", "2", "3", "4", "5"]).default(""),
        status: z.enum(["", "NEW", "IN_REVIEW", "RESOLVED"]).default(""),
        type: z.enum(["", "SERVICE", "INSTALLATION"]).default(""),
        attention: z.enum(["true", "false"]).default("false"),
    })
        .safeParse(req.query);
    if (!input.success)
        throw new ApiError(422, "VALIDATION_ERROR", "Check feedback filters");
    const f = input.data;
    const rows = await db() `SELECT v.*,r.request_number,r.appliance,r.request_type,c.full_name,c.customer_reference,count(*) OVER()::int AS total_count FROM request_reviews v JOIN service_requests r ON r.id=v.request_id JOIN customers c ON c.id=v.customer_id WHERE (${f.q}='' OR r.request_number ILIKE '%' || ${f.q} || '%' OR c.customer_reference ILIKE '%' || ${f.q} || '%' OR c.full_name ILIKE '%' || ${f.q} || '%' OR c.id::text=${f.q}) AND (${f.rating}='' OR v.rating::text=${f.rating}) AND (${f.status}='' OR v.handling_status=${f.status}) AND (${f.type}='' OR r.request_type=${f.type}) AND (${f.attention}='false' OR (v.rating<=2 AND v.handling_status!='RESOLVED')) ORDER BY v.created_at DESC LIMIT ${f.limit} OFFSET ${(f.page - 1) * f.limit}`;
    res.json({
        data: rows,
        meta: { page: f.page, limit: f.limit, total: rows[0]?.total_count || 0 },
    });
}));
feedbackRoutes.get("/feedback/:id", route(async (req, res) => {
    const rows = await db() `SELECT v.*,r.request_number,r.appliance,r.service_name,r.request_type,r.completed_at,c.full_name,c.profile_photo_url,c.customer_reference FROM request_reviews v JOIN service_requests r ON r.id=v.request_id JOIN customers c ON c.id=v.customer_id WHERE v.id=${req.params.id}`;
    if (!rows[0])
        throw new ApiError(404, "NOT_FOUND", "Feedback not found");
    const notes = await db() `SELECT n.*,s.full_name FROM review_internal_notes n LEFT JOIN staff_profiles s ON s.id=n.staff_id WHERE review_id=${req.params.id} ORDER BY n.created_at`;
    const history = await db() `SELECT e.*,s.full_name FROM review_handling_events e LEFT JOIN staff_profiles s ON s.id=e.staff_id WHERE review_id=${req.params.id} ORDER BY e.created_at`;
    res.json({ data: { ...rows[0], notes, history } });
}));
feedbackRoutes.patch("/feedback/:id/handling", handleFeedback, route(async (req, res) => {
    const input = z
        .object({
        status: z.enum(["NEW", "IN_REVIEW", "RESOLVED"]),
        note: z.string().trim().min(3).max(1000),
    })
        .strict()
        .safeParse(req.body);
    if (!input.success)
        throw new ApiError(422, "VALIDATION_ERROR", "Choose a handling status and add a reason");
    const rows = await db() `WITH changed AS (UPDATE request_reviews SET handling_status=${input.data.status},updated_at=now() WHERE id=${req.params.id} RETURNING *),event AS (INSERT INTO review_handling_events(review_id,staff_id,status,note) SELECT id,${req.staff.id},handling_status,${input.data.note} FROM changed RETURNING id) SELECT * FROM changed`;
    if (!rows[0])
        throw new ApiError(404, "NOT_FOUND", "Feedback not found");
    res.json({ data: rows[0] });
}));
feedbackRoutes.post("/feedback/:id/notes", handleFeedback, route(async (req, res) => {
    const input = z
        .object({ note: z.string().trim().min(3).max(2000) })
        .strict()
        .safeParse(req.body);
    if (!input.success)
        throw new ApiError(422, "VALIDATION_ERROR", "Enter an internal note");
    const rows = await db() `INSERT INTO review_internal_notes(review_id,staff_id,note) SELECT id,${req.staff.id},${input.data.note} FROM request_reviews WHERE id=${req.params.id} RETURNING *`;
    if (!rows[0])
        throw new ApiError(404, "NOT_FOUND", "Feedback not found");
    res.status(201).json({ data: rows[0] });
}));
feedbackRoutes.post("/feedback/:id/support", handleFeedback, route(async (req, res) => {
    const rows = await db() `INSERT INTO support_tickets(ticket_number,customer_id,request_id,review_id,subject,message) SELECT 'SUP-REV-' || id::text,customer_id,request_id,id,'Customer feedback follow-up',COALESCE(NULLIF(comment,''),'Follow up on customer rating: ' || rating::text) FROM request_reviews WHERE id=${req.params.id} ON CONFLICT(review_id) DO UPDATE SET review_id=excluded.review_id RETURNING *`;
    if (!rows[0])
        throw new ApiError(404, "NOT_FOUND", "Feedback not found");
    res.json({ data: rows[0] });
}));
feedbackRoutes.get("/support/tickets", route(async (req, res) => {
    const input = z
        .object({
        q: z.string().trim().max(120).default(""),
        status: z.enum(["", "OPEN", "IN_PROGRESS", "RESOLVED"]).default(""),
        page: z.coerce.number().int().min(1).max(100000).default(1),
        limit: z.coerce.number().int().min(1).max(200).default(200),
    })
        .safeParse(req.query);
    if (!input.success)
        throw new ApiError(422, "VALIDATION_ERROR", "Check ticket search and pagination");
    const f = input.data;
    const rows = await db() `SELECT t.*,c.full_name,c.customer_reference,r.request_number,count(*) OVER()::int AS total_count FROM support_tickets t JOIN customers c ON c.id=t.customer_id LEFT JOIN service_requests r ON r.id=t.request_id WHERE (${f.status}='' OR t.status=${f.status}) AND (${f.q}='' OR t.ticket_number ILIKE '%'||${f.q}||'%' OR c.customer_reference ILIKE '%'||${f.q}||'%' OR c.full_name ILIKE '%'||${f.q}||'%' OR t.subject ILIKE '%'||${f.q}||'%' OR r.request_number ILIKE '%'||${f.q}||'%') ORDER BY t.created_at DESC LIMIT ${f.limit} OFFSET ${(f.page - 1) * f.limit}`;
    res.json({
        data: rows,
        meta: { page: f.page, limit: f.limit, total: rows[0]?.total_count || 0 },
    });
}));
feedbackRoutes.patch("/support/tickets/:id", handleFeedback, route(async (req, res) => {
    const input = z
        .object({ status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED"]) })
        .strict()
        .safeParse(req.body);
    if (!input.success)
        throw new ApiError(422, "VALIDATION_ERROR", "Choose a support status");
    const rows = await db() `UPDATE support_tickets SET status=${input.data.status},updated_at=now() WHERE id=${req.params.id} RETURNING *`;
    if (!rows[0])
        throw new ApiError(404, "NOT_FOUND", "Ticket not found");
    res.json({ data: rows[0] });
}));
const messageBody = z
    .object({
    message: z.string().trim().min(1).max(4000),
    visibility: z.enum(["PUBLIC", "INTERNAL"]).default("PUBLIC"),
})
    .strict();
feedbackRoutes.get("/support/tickets/:id/messages", route(async (req, res) => {
    const tickets = await db() `SELECT t.*,c.full_name,c.customer_reference FROM support_tickets t JOIN customers c ON c.id=t.customer_id WHERE t.id=${req.params.id}`;
    if (!tickets[0])
        throw new ApiError(404, "NOT_FOUND", "Ticket not found");
    const messages = await db() `SELECT m.*,COALESCE(s.full_name,c.full_name,'Former user') AS author_name FROM support_messages m LEFT JOIN staff_profiles s ON s.id=m.staff_id LEFT JOIN customers c ON c.id=m.customer_id WHERE ticket_id=${req.params.id} ORDER BY m.created_at,m.id`;
    res.json({ data: { ticket: tickets[0], messages } });
}));
feedbackRoutes.post("/support/tickets/:id/messages", handleFeedback, route(async (req, res) => {
    const input = messageBody.safeParse(req.body);
    if (!input.success)
        throw new ApiError(422, "VALIDATION_ERROR", "Enter a reply or internal note");
    const rows = await db() `WITH message AS(INSERT INTO support_messages(ticket_id,staff_id,author_type,visibility,message) SELECT id,${req.staff.id},'STAFF',${input.data.visibility},${input.data.message} FROM support_tickets WHERE id=${req.params.id} RETURNING *),updated AS(UPDATE support_tickets SET updated_at=now() WHERE id IN(SELECT ticket_id FROM message) RETURNING *),notification AS(INSERT INTO customer_notifications(customer_id,request_id,kind,title,message) SELECT t.customer_id,t.request_id,'SUPPORT_'||m.id::text,'Support reply','Our support team replied to your ticket.' FROM message m JOIN support_tickets t ON t.id=m.ticket_id WHERE m.visibility='PUBLIC' RETURNING id) SELECT * FROM message`;
    if (!rows[0])
        throw new ApiError(404, "NOT_FOUND", "Ticket not found");
    res.status(201).json({ data: rows[0] });
}));
aftercareRoutes.get("/support/tickets/:id/messages", requireAuth, route(async (req, res) => {
    const tickets = await db() `SELECT * FROM support_tickets WHERE id=${req.params.id} AND customer_id=${req.customerId}`;
    if (!tickets[0])
        throw new ApiError(404, "NOT_FOUND", "Ticket not found");
    const messages = await db() `SELECT id,author_type,message,created_at FROM support_messages WHERE ticket_id=${req.params.id} AND visibility='PUBLIC' ORDER BY created_at,id`;
    res.json({ data: { ticket: tickets[0], messages } });
}));
aftercareRoutes.post("/support/tickets/:id/messages", requireAuth, route(async (req, res) => {
    const input = z
        .object({ message: z.string().trim().min(1).max(4000) })
        .strict()
        .safeParse(req.body);
    if (!input.success)
        throw new ApiError(422, "VALIDATION_ERROR", "Enter a message");
    const rows = await db() `WITH message AS(INSERT INTO support_messages(ticket_id,customer_id,author_type,visibility,message) SELECT id,${req.customerId},'CUSTOMER','PUBLIC',${input.data.message} FROM support_tickets WHERE id=${req.params.id} AND customer_id=${req.customerId} RETURNING id,author_type,message,created_at),updated AS(UPDATE support_tickets SET updated_at=now() WHERE id=${req.params.id} AND EXISTS(SELECT 1 FROM message) RETURNING id) SELECT * FROM message`;
    if (!rows[0])
        throw new ApiError(404, "NOT_FOUND", "Ticket not found");
    res.status(201).json({ data: rows[0] });
}));
