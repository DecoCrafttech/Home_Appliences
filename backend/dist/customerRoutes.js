import { contactPhone } from "@home/shared";
import { catalogueOptionsSchema } from "@home/shared";
import { Router } from "express";
import { createHash, randomInt, randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "./db.js";
import { env } from "./config/env.js";
import { verifyGoogleCredential } from "./security/google.js";
import { bookingSchema, profileSchema } from "./validation.js";
import { canonicalJson, serviceFormSchema, validateServiceAnswers, } from "@home/shared";
export class ApiError extends Error {
    status;
    code;
    constructor(status, code, message) {
        super(message);
        this.status = status;
        this.code = code;
    }
}
const router = Router();
router.param("id", (_req, _res, next, id) => {
    next(z.string().uuid().safeParse(id).success
        ? undefined
        : new ApiError(422, "VALIDATION_ERROR", "Invalid record ID"));
});
const hash = (value) => createHash("sha256").update(value).digest("hex");
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const getCookie = (header, name) => header
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(`${name}=`))
    ?.slice(name.length + 1);
const phone = z
    .string()
    .regex(/^[6-9]\d{9}$/)
    .transform((v) => `+91${v}`);
const requestBody = bookingSchema;
const addressBody = z.object({
    label: z.string().trim().min(2).max(30),
    recipientName: z.string().trim().min(2).max(100),
    phone: z.string().regex(/^[6-9]\d{9}$/),
    line1: z.string().trim().min(3).max(150),
    area: z.string().trim().min(2).max(100),
    landmark: z.string().trim().max(100).optional().or(z.literal("")),
    city: z.string().trim().min(2).max(80),
    state: z.string().trim().min(2).max(80),
    pinCode: z.string().regex(/^\d{6}$/),
    isDefault: z.boolean().default(false),
});
export const requireAuth = asyncRoute(async (req, _res, next) => {
    const token = getCookie(req.headers.cookie, "customer_session");
    if (!token)
        throw new ApiError(401, "UNAUTHORIZED", "Please log in");
    const rows = await db() `SELECT customer_id FROM customer_sessions WHERE token_hash=${hash(token)} AND revoked_at IS NULL AND expires_at > now() LIMIT 1`;
    if (!rows[0])
        throw new ApiError(401, "SESSION_EXPIRED", "Your session has expired");
    const account = await db() `SELECT account_status FROM customers WHERE id=${rows[0].customer_id}`;
    if (!account[0] || account[0].account_status !== "ACTIVE")
        throw new ApiError(403, "ACCOUNT_UNAVAILABLE", "Your account is currently unavailable. Contact support");
    req.customerId = String(rows[0].customer_id);
    next();
});
router.post("/auth/otp/request", asyncRoute(async (req, res) => {
    if (env.NODE_ENV !== "test" && !env.LEGACY_OTP_ENABLED)
        throw new ApiError(410, "LEGACY_AUTH_RETIRED", "Sign in with Google to continue");
    if (env.NODE_ENV === "production" && env.OTP_PROVIDER === "development")
        throw new ApiError(503, "OTP_PROVIDER_UNAVAILABLE", "Verification service unavailable");
    const parsed = phone.safeParse(req.body?.mobile);
    if (!parsed.success)
        throw new ApiError(422, "VALIDATION_ERROR", "Enter a valid mobile number");
    const code = env.OTP_PROVIDER === "development"
        ? "123456"
        : String(randomInt(100000, 1000000));
    const rows = await db() `INSERT INTO otp_challenges(phone_e164,code_hash,expires_at) VALUES(${parsed.data},${hash(code)},now()+interval '5 minutes') RETURNING id`;
    res.status(201).json({
        data: {
            challengeId: rows[0].id,
            expiresInSeconds: 300,
            ...(env.NODE_ENV !== "production" && env.OTP_PROVIDER === "development"
                ? { developmentCode: code }
                : {}),
        },
    });
}));
router.post("/auth/customer/google", asyncRoute(async (req, res) => {
    const input = z
        .object({ credential: z.string().min(100) })
        .safeParse(req.body);
    if (!input.success)
        throw new ApiError(422, "VALIDATION_ERROR", "Google credential is required");
    let identity;
    try {
        identity = await verifyGoogleCredential(input.data.credential);
    }
    catch (error) {
        const known = error;
        throw new ApiError(known.status || 401, known.code || "INVALID_GOOGLE_CREDENTIAL", "Google sign-in could not be completed");
    }
    const linked = await db() `SELECT c.* FROM customer_auth_identities i JOIN customers c ON c.id=i.customer_id WHERE i.provider='GOOGLE' AND i.provider_subject=${identity.subject}`;
    let customer = linked[0], created = false;
    if (!customer) {
        try {
            const rows = await db() `WITH customer AS (INSERT INTO customers(phone_e164,full_name,email,profile_photo_url,last_login_at) VALUES(NULL,${identity.name},${identity.email},${identity.picture || null},now()) RETURNING *), identity AS (INSERT INTO customer_auth_identities(customer_id,provider,provider_subject,verified_email) SELECT id,'GOOGLE',${identity.subject},${identity.email} FROM customer RETURNING customer_id) SELECT c.* FROM customer c JOIN identity i ON i.customer_id=c.id`;
            customer = rows[0];
            created = true;
        }
        catch (error) {
            if (error.code !== "23505")
                throw error;
            // A concurrent sign-in may have linked this Google identity first.
            // The single statement above rolls back the losing customer insert.
            const rows = await db() `SELECT c.* FROM customer_auth_identities i JOIN customers c ON c.id=i.customer_id WHERE i.provider='GOOGLE' AND i.provider_subject=${identity.subject}`;
            if (!rows[0])
                throw error;
            customer = rows[0];
        }
    }
    if (!customer)
        throw new ApiError(503, "GOOGLE_AUTH_UNAVAILABLE", "Sign-in is temporarily unavailable. Please try again");
    if (!created) {
        if (customer.account_status !== "ACTIVE")
            throw new ApiError(403, "ACCOUNT_UNAVAILABLE", "Your account is currently unavailable. Contact support");
        await db() `UPDATE customers SET last_login_at=now(),updated_at=now(),profile_photo_url=COALESCE(${identity.picture || null},profile_photo_url) WHERE id=${customer.id}`;
        await db() `UPDATE customer_auth_identities SET last_used_at=now(),verified_email=${identity.email} WHERE provider='GOOGLE' AND provider_subject=${identity.subject}`;
    }
    const token = randomUUID() + randomUUID();
    await db() `INSERT INTO customer_sessions(customer_id,token_hash,expires_at) VALUES(${customer.id},${hash(token)},now()+interval '30 days')`;
    res
        .cookie("customer_session", token, {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 2592000000,
        path: "/",
    })
        .json({
        data: {
            customer: {
                id: customer.id,
                full_name: customer.full_name,
                email: customer.email,
                phone_e164: customer.phone_e164,
                profile_photo_url: customer.profile_photo_url,
            },
            created,
            profileComplete: Boolean(customer.full_name && customer.phone_e164),
        },
    });
}));
router.get("/auth/customer/config", (_req, res) => {
    res.json({ data: { clientId: env.GOOGLE_CLIENT_ID || null } });
});
router.get("/auth/customer/me", requireAuth, asyncRoute(async (req, res) => {
    const rows = await db() `SELECT id,customer_reference,phone_e164,phone_verified,full_name,email,profile_photo_url,account_status,created_at FROM customers WHERE id=${req.customerId}`;
    res.json({ data: rows[0] });
}));
router.post("/auth/customer/logout", requireAuth, asyncRoute(async (req, res) => {
    const token = getCookie(req.headers.cookie, "customer_session");
    await db() `UPDATE customer_sessions SET revoked_at=now() WHERE token_hash=${hash(token)}`;
    res.clearCookie("customer_session", { path: "/" }).status(204).end();
}));
router.post("/auth/otp/verify", asyncRoute(async (req, res) => {
    if (env.NODE_ENV !== "test" && !env.LEGACY_OTP_ENABLED)
        throw new ApiError(410, "LEGACY_AUTH_RETIRED", "Sign in with Google to continue");
    const input = z
        .object({
        challengeId: z.string().uuid(),
        code: z.string().regex(/^\d{6}$/),
    })
        .safeParse(req.body);
    if (!input.success)
        throw new ApiError(422, "VALIDATION_ERROR", "Invalid verification code");
    const rows = await db() `SELECT * FROM otp_challenges WHERE id=${input.data.challengeId} LIMIT 1`;
    const challenge = rows[0];
    if (!challenge || challenge.consumed_at || Number(challenge.attempts) >= 5)
        throw new ApiError(401, "INVALID_OTP", "Invalid verification code");
    if (new Date(String(challenge.expires_at)) < new Date())
        throw new ApiError(401, "OTP_EXPIRED", "Verification code expired");
    if (challenge.code_hash !== hash(input.data.code)) {
        await db() `UPDATE otp_challenges SET attempts=attempts+1 WHERE id=${input.data.challengeId}`;
        throw new ApiError(401, "INVALID_OTP", "Invalid verification code");
    }
    const customers = await db() `INSERT INTO customers(phone_e164) VALUES(${challenge.phone_e164}) ON CONFLICT(phone_e164) DO UPDATE SET updated_at=now() RETURNING id,customer_reference,profile_photo_url,phone_e164,full_name,email,created_at`;
    await db() `UPDATE otp_challenges SET consumed_at=now() WHERE id=${input.data.challengeId}`;
    const token = randomUUID() + randomUUID();
    await db() `INSERT INTO customer_sessions(customer_id,token_hash,expires_at) VALUES(${customers[0].id},${hash(token)},now()+interval '30 days')`;
    res
        .cookie("customer_session", token, {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 2592000000,
        path: "/",
    })
        .json({ data: { customer: customers[0] } });
}));
router.get("/auth/me", requireAuth, asyncRoute(async (req, res) => {
    const rows = await db() `SELECT id,customer_reference,profile_photo_url,phone_e164,full_name,email,created_at FROM customers WHERE id=${req.customerId}`;
    res.json({ data: rows[0] });
}));
router.post("/auth/logout", requireAuth, asyncRoute(async (req, res) => {
    const token = getCookie(req.headers.cookie, "customer_session");
    await db() `UPDATE customer_sessions SET revoked_at=now() WHERE token_hash=${hash(token)}`;
    res.clearCookie("customer_session", { path: "/" }).status(204).end();
}));
router.get("/profile", requireAuth, asyncRoute(async (req, res) => {
    const rows = await db() `SELECT id,customer_reference,profile_photo_url,phone_e164,full_name,email,created_at FROM customers WHERE id=${req.customerId}`;
    res.json({ data: rows[0] });
}));
router.patch("/profile", requireAuth, asyncRoute(async (req, res) => {
    const input = profileSchema.safeParse(req.body);
    if (!input.success)
        throw new ApiError(422, "VALIDATION_ERROR", "Check your profile details");
    const googleIdentity = await db() `SELECT verified_email FROM customer_auth_identities WHERE customer_id=${req.customerId} AND provider='GOOGLE' LIMIT 1`;
    const rows = await db() `UPDATE customers SET full_name=${input.data.fullName},email=${googleIdentity[0]?.verified_email || input.data.email || null},phone_e164=COALESCE(${input.data.phone ? `+91${input.data.phone.replace(/^\+91/, "")}` : null},phone_e164),updated_at=now() WHERE id=${req.customerId} RETURNING id,phone_e164,full_name,email,created_at`;
    res.json({ data: rows[0] });
}));
router.get("/appliances", asyncRoute(async (_req, res) => {
    const rows = await db() `SELECT id,slug,name FROM appliance_categories WHERE active=true ORDER BY name`;
    res.json({ data: rows });
}));
router.get("/catalogue", asyncRoute(async (_req, res) => {
    const rows = await db() `SELECT s.id,s.appliance_category_id,s.request_type,s.name,s.description,s.form_fields,s.booking_options,s.base_price,a.name AS appliance_name,a.slug AS appliance_slug,(SELECT '/api/v1/catalogue/media/'||m.id::text FROM catalogue_media m WHERE m.object_key=s.icon_object_key) AS icon_url FROM service_catalogue s JOIN appliance_categories a ON a.id=s.appliance_category_id WHERE s.active AND a.active AND a.publication_status='PUBLISHED' AND s.publication_status='PUBLISHED' ORDER BY s.display_order,a.name,s.name`;
    res.json({ data: rows });
}));
router.get("/services", asyncRoute(async (req, res) => {
    const type = req.query.type === "INSTALLATION" ? "INSTALLATION" : "SERVICE";
    const category = typeof req.query.applianceCategoryId === "string"
        ? req.query.applianceCategoryId
        : "";
    if (!z.string().uuid().safeParse(category).success)
        throw new ApiError(422, "VALIDATION_ERROR", "Select an appliance");
    const rows = await db() `SELECT id,appliance_category_id,request_type,slug,name,form_fields,base_price,description,booking_options,(SELECT '/api/v1/catalogue/media/'||m.id::text FROM catalogue_media m WHERE m.object_key=service_catalogue.icon_object_key) AS icon_url FROM service_catalogue WHERE appliance_category_id=${category} AND request_type=${type} AND active=true AND publication_status='PUBLISHED' AND EXISTS(SELECT 1 FROM appliance_categories a WHERE a.id=service_catalogue.appliance_category_id AND a.active AND a.publication_status='PUBLISHED') ORDER BY display_order,name`;
    res.json({ data: rows });
}));
router.get("/installations", asyncRoute(async (req, res) => {
    const category = typeof req.query.applianceCategoryId === "string"
        ? req.query.applianceCategoryId
        : "";
    if (!z.string().uuid().safeParse(category).success)
        throw new ApiError(422, "VALIDATION_ERROR", "Select an appliance");
    const rows = await db() `SELECT id,appliance_category_id,request_type,slug,name,form_fields,base_price,description,booking_options,(SELECT '/api/v1/catalogue/media/'||m.id::text FROM catalogue_media m WHERE m.object_key=service_catalogue.icon_object_key) AS icon_url FROM service_catalogue WHERE appliance_category_id=${category} AND request_type='INSTALLATION' AND active=true AND publication_status='PUBLISHED' AND EXISTS(SELECT 1 FROM appliance_categories a WHERE a.id=service_catalogue.appliance_category_id AND a.active AND a.publication_status='PUBLISHED') ORDER BY display_order,name`;
    res.json({ data: rows });
}));
router.get("/addresses", requireAuth, asyncRoute(async (req, res) => {
    const rows = await db() `SELECT id,label,recipient_name,phone,line1,area,landmark,city,state,pin_code,is_default,created_at,updated_at FROM customer_addresses WHERE customer_id=${req.customerId} ORDER BY is_default DESC,created_at DESC`;
    res.json({ data: rows });
}));
router.post("/addresses", requireAuth, asyncRoute(async (req, res) => {
    const input = addressBody.safeParse(req.body);
    if (!input.success)
        throw new ApiError(422, "VALIDATION_ERROR", "Check your address details");
    if (input.data.isDefault)
        await db() `UPDATE customer_addresses SET is_default=false,updated_at=now() WHERE customer_id=${req.customerId}`;
    const a = input.data;
    const rows = await db() `INSERT INTO customer_addresses(customer_id,label,recipient_name,phone,line1,area,landmark,city,state,pin_code,is_default) VALUES(${req.customerId},${a.label},${a.recipientName},${a.phone},${a.line1},${a.area},${a.landmark || null},${a.city},${a.state},${a.pinCode},${a.isDefault}) RETURNING *`;
    res.status(201).json({ data: rows[0] });
}));
router.patch("/addresses/:id", requireAuth, asyncRoute(async (req, res) => {
    const input = addressBody.safeParse(req.body);
    if (!input.success)
        throw new ApiError(422, "VALIDATION_ERROR", "Check your address details");
    if (input.data.isDefault)
        await db() `UPDATE customer_addresses SET is_default=false,updated_at=now() WHERE customer_id=${req.customerId}`;
    const a = input.data;
    const rows = await db() `UPDATE customer_addresses SET label=${a.label},recipient_name=${a.recipientName},phone=${a.phone},line1=${a.line1},area=${a.area},landmark=${a.landmark || null},city=${a.city},state=${a.state},pin_code=${a.pinCode},is_default=${a.isDefault},updated_at=now() WHERE id=${req.params.id} AND customer_id=${req.customerId} RETURNING *`;
    if (!rows[0])
        throw new ApiError(404, "NOT_FOUND", "Address not found");
    res.json({ data: rows[0] });
}));
router.delete("/addresses/:id", requireAuth, asyncRoute(async (req, res) => {
    const rows = await db() `DELETE FROM customer_addresses WHERE id=${req.params.id} AND customer_id=${req.customerId} RETURNING id`;
    if (!rows[0])
        throw new ApiError(404, "NOT_FOUND", "Address not found");
    res.status(204).end();
}));
async function createRequest(req, res, type) {
    const input = requestBody.safeParse(req.body);
    if (!input.success)
        throw new ApiError(422, "VALIDATION_ERROR", "Check your request details");
    const payloadHash = createHash("sha256")
        .update(canonicalJson({ type, ...input.data }))
        .digest("hex");
    async function replay(row) {
        const storedHash = row.booking_payload_hash ||
            createHash("sha256")
                .update(canonicalJson({
                type: row.request_type,
                applianceCategoryId: row.appliance_category_id,
                serviceId: row.service_catalogue_id,
                details: Object.fromEntries(Object.entries((row.details || {})).filter(([key]) => key !== "_fieldLabels")),
                address: row.address_snapshot,
                preferredDate: row.preferred_date,
                preferredTimeWindow: row.preferred_time_window,
                idempotencyKey: row.idempotency_key,
            }))
                .digest("hex");
        if (storedHash !== payloadHash)
            throw new ApiError(409, "IDEMPOTENCY_CONFLICT", "This booking key was already used with different details.");
        if (!row.booking_payload_hash)
            await db() `UPDATE service_requests SET booking_payload_hash=${payloadHash} WHERE id=${row.id} AND booking_payload_hash IS NULL`;
        return res.json({ data: row });
    }
    const existing = await db() `SELECT * FROM service_requests WHERE customer_id=${req.customerId} AND idempotency_key=${input.data.idempotencyKey}`;
    if (existing[0])
        return replay(existing[0]);
    const catalogue = await db() `SELECT c.id,c.form_fields,c.booking_options,c.base_price,c.name AS service_name,a.id AS appliance_id,a.name AS appliance_name FROM service_catalogue c JOIN appliance_categories a ON a.id=c.appliance_category_id WHERE c.id=${input.data.serviceId} AND a.id=${input.data.applianceCategoryId} AND c.request_type=${type} AND c.active=true AND c.publication_status='PUBLISHED' AND a.active=true AND a.publication_status='PUBLISHED'`;
    if (!catalogue[0])
        throw new ApiError(422, "INVALID_SERVICE", "The selected service is not available");
    const supportedPrefixes = env.SERVICE_PIN_PREFIXES.split(",")
        .map((value) => value.trim())
        .filter(Boolean);
    if (supportedPrefixes.length &&
        !supportedPrefixes.some((prefix) => input.data.address.pinCode.startsWith(prefix)))
        throw new ApiError(422, "UNSUPPORTED_AREA", "This address is outside our configured service area. Contact support for assistance");
    const number = `${type === "SERVICE" ? "SR" : "IR"}-${Date.now().toString(36).toUpperCase()}-${randomInt(1000, 9999)}`;
    const form = serviceFormSchema.parse(catalogue[0].form_fields);
    const answerError = validateServiceAnswers(form, input.data.details);
    if (answerError)
        throw new ApiError(422, "VALIDATION_ERROR", answerError);
    const options = catalogueOptionsSchema.parse(catalogue[0].booking_options);
    let ids = [];
    if (input.data.details.optionIds) {
        try {
            ids = z
                .array(z.string().uuid())
                .min(1)
                .max(30)
                .parse(JSON.parse(input.data.details.optionIds));
        }
        catch {
            throw new ApiError(422, "INVALID_OPTION", "Choose available service options.");
        }
    }
    else if (input.data.details.optionId)
        ids = [input.data.details.optionId];
    ids = [...new Set(ids)];
    const selectedOptions = ids.map((id) => options.find((o) => o.id === id && o.active));
    if ((options.some((o) => o.active) && !ids.length) ||
        selectedOptions.some((o) => !o))
        throw new ApiError(422, "INVALID_OPTION", "Choose available service options.");
    const selectedOption = selectedOptions[0];
    const details = {
        ...(selectedOption
            ? {
                optionId: selectedOption.id,
                optionIds: JSON.stringify(ids),
                problem: selectedOptions.map((o) => o.name).join(", "),
                _priceSnapshots: selectedOptions.map((o) => ({
                    ...o,
                    currency: "INR",
                    serviceName: catalogue[0].service_name,
                })),
            }
            : {}),
        _priceSnapshot: selectedOption
            ? {
                ...selectedOption,
                currency: "INR",
                serviceName: catalogue[0].service_name,
            }
            : {
                currency: "INR",
                amountPaise: catalogue[0].base_price == null
                    ? null
                    : Math.round(Number(catalogue[0].base_price) * 100),
                priceType: catalogue[0].base_price == null ? "QUOTE" : "FIXED",
                serviceName: catalogue[0].service_name,
            },
        ...Object.fromEntries(["description", ...form.map((f) => f.key)]
            .filter((key) => input.data.details[key] !== undefined)
            .map((key) => [key, input.data.details[key]])),
        _fieldLabels: Object.fromEntries(form.map((f) => [f.key, f.label])),
    };
    const rows = await db() `WITH created AS (INSERT INTO service_requests(request_number,customer_id,request_type,appliance,service_name,appliance_category_id,service_catalogue_id,details,address_snapshot,preferred_date,preferred_time_window,idempotency_key,booking_payload_hash) VALUES(${number},${req.customerId},${type},${catalogue[0].appliance_name},${catalogue[0].service_name},${input.data.applianceCategoryId},${input.data.serviceId},${JSON.stringify(details)},${JSON.stringify({ ...input.data.address, phone: contactPhone(input.data.address.phone) })},${input.data.preferredDate},${input.data.preferredTimeWindow},${input.data.idempotencyKey},${payloadHash}) ON CONFLICT(customer_id,idempotency_key) DO NOTHING RETURNING *),event AS (INSERT INTO request_status_events(request_id,status,note) SELECT id,'REQUESTED','Request received' FROM created RETURNING id) SELECT * FROM created`;
    if (!rows[0]) {
        const existing = await db() `SELECT * FROM service_requests WHERE customer_id=${req.customerId} AND idempotency_key=${input.data.idempotencyKey}`;
        return replay(existing[0]);
    }
    return res.status(201).json({ data: rows[0] });
}
router.post("/requests/service", requireAuth, asyncRoute((req, res) => createRequest(req, res, "SERVICE")));
router.post("/requests/installation", requireAuth, asyncRoute((req, res) => createRequest(req, res, "INSTALLATION")));
router.get("/requests", requireAuth, asyncRoute(async (req, res) => {
    const rows = await db() `SELECT r.*,v.id AS review_id FROM service_requests r LEFT JOIN request_reviews v ON v.request_id=r.id WHERE r.customer_id=${req.customerId} ORDER BY r.created_at DESC`;
    res.json({ data: rows });
}));
router.get("/requests/:id", requireAuth, asyncRoute(async (req, res) => {
    const rows = await db() `SELECT r.*,p.work_summary,p.completion_notes,t.full_name AS assigned_technician_name,t.phone AS assigned_technician_phone FROM service_requests r LEFT JOIN technicians t ON t.id=r.assigned_technician_id LEFT JOIN completion_reports p ON p.request_id=r.id WHERE r.id=${req.params.id} AND r.customer_id=${req.customerId}`;
    if (!rows[0])
        throw new ApiError(404, "NOT_FOUND", "Request not found");
    res.json({ data: rows[0] });
}));
router.get("/requests/:id/timeline", requireAuth, asyncRoute(async (req, res) => {
    const rows = await db() `SELECT e.* FROM request_status_events e JOIN service_requests r ON r.id=e.request_id WHERE e.request_id=${req.params.id} AND r.customer_id=${req.customerId} ORDER BY e.created_at`;
    res.json({ data: rows });
}));
router.post("/staff/requests/:id/status", asyncRoute(async (req, res) => {
    if (env.NODE_ENV !== "test")
        throw new ApiError(410, "STAFF_ENDPOINT_RETIRED", "Use the authenticated admin portal");
    if (!env.STAFF_API_KEY ||
        req.headers["x-staff-api-key"] !== env.STAFF_API_KEY)
        throw new ApiError(403, "FORBIDDEN", "Forbidden");
    const input = z
        .object({
        status: z.enum([
            "CONFIRMED",
            "ASSIGNED",
            "EN_ROUTE",
            "IN_PROGRESS",
            "COMPLETED",
            "CANCELLED",
        ]),
        note: z.string().max(300).optional(),
    })
        .safeParse(req.body);
    if (!input.success)
        throw new ApiError(422, "VALIDATION_ERROR", "Invalid status");
    const rows = await db() `UPDATE service_requests SET status_source='WORKFLOW',status=${input.data.status},updated_at=now() WHERE id=${req.params.id} RETURNING id`;
    if (!rows[0])
        throw new ApiError(404, "NOT_FOUND", "Request not found");
    await db() `INSERT INTO request_status_events(request_id,status,note) VALUES(${req.params.id},${input.data.status},${input.data.note || null})`;
    res.json({ data: { id: req.params.id, status: input.data.status } });
}));
router.post("/support/tickets", requireAuth, asyncRoute(async (req, res) => {
    const input = z
        .object({
        requestId: z.string().uuid().optional(),
        subject: z.string().trim().min(3).max(120),
        message: z.string().trim().min(10).max(2000),
    })
        .safeParse(req.body);
    if (!input.success)
        throw new ApiError(422, "VALIDATION_ERROR", "Check your support request");
    if (input.data.requestId) {
        const owned = await db() `SELECT id FROM service_requests WHERE id=${input.data.requestId} AND customer_id=${req.customerId}`;
        if (!owned[0])
            throw new ApiError(404, "NOT_FOUND", "Request not found");
    }
    const number = `SUP-${Date.now().toString(36).toUpperCase()}-${randomInt(1000, 9999)}`;
    const rows = await db() `INSERT INTO support_tickets(ticket_number,customer_id,request_id,subject,message) VALUES(${number},${req.customerId},${input.data.requestId || null},${input.data.subject},${input.data.message}) RETURNING *`;
    res.status(201).json({ data: rows[0] });
}));
router.get("/support/tickets", requireAuth, asyncRoute(async (req, res) => {
    const rows = await db() `SELECT * FROM support_tickets WHERE customer_id=${req.customerId} ORDER BY created_at DESC`;
    res.json({ data: rows });
}));
export { router as customerRoutes };
