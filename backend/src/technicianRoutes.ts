import { contactPhone } from "@home/shared";
import {
  temporaryPasswordSchema,
  notificationReadAllSchema,
} from "@home/shared";
import {
  technicianEstimateSchema,
  technicianWorkReportSchema,
  assignmentOfferSchema,
} from "@home/shared";
import { verifyCode } from "./security/technicianMfa.js";
import { Router, type RequestHandler, type Request } from "express";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { db } from "./db.js";
import { ApiError, requireAuth } from "./customerRoutes.js";
import { requireStaff, allow } from "./adminRoutes.js";
import { env } from "./config/env.js";
import { hashPassword, verifyPassword } from "./security/password.js";
import { completeRequest } from "./completion.js";
const hash = (v: string) => createHash("sha256").update(v).digest("hex");
const token = () => randomBytes(32).toString("base64url");
const route =
  (fn: RequestHandler): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch((e) =>
      next(
        e instanceof z.ZodError
          ? new ApiError(
              422,
              "VALIDATION_ERROR",
              e.issues[0]?.message || "Check form",
            )
          : e,
      ),
    );
const cookie = (req: Request) =>
  req.headers.cookie
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith("technician_session="))
    ?.slice(19);
const missing = () =>
  new ApiError(404, "NOT_FOUND", "Job or assignment not found");
const conflict = () =>
  new ApiError(
    409,
    "STALE_WORKFLOW",
    "This job changed. Refresh before trying again.",
  );
const password = temporaryPasswordSchema,
  uuid = z.string().uuid();
export const technicianRoutes = Router(),
  technicianAdminRoutes = Router(),
  technicianCustomerRoutes = Router();
for (const r of [
  technicianRoutes,
  technicianAdminRoutes,
  technicianCustomerRoutes,
])
  r.param("id", (_req, _res, next, id) =>
    next(
      uuid.safeParse(id).success
        ? undefined
        : new ApiError(422, "VALIDATION_ERROR", "Invalid ID"),
    ),
  );
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      technician?: { id: string; csrf: string; sessionId: string };
    }
  }
}
export const requireTechnician: RequestHandler = route(
  async (req, _res, next) => {
    const value = cookie(req);
    if (!value)
      throw new ApiError(401, "UNAUTHORIZED", "Technician sign in required");
    const rows =
      await db()`SELECT s.id,s.technician_id,s.csrf_token,s.revoked_at,s.expires_at,a.must_change_password,a.status,t.active,t.verification_status FROM technician_sessions s JOIN technician_accounts a ON a.technician_id=s.technician_id JOIN technicians t ON t.id=a.technician_id WHERE s.token_hash=${hash(value)}`;
    if (rows[0]?.status === "SUSPENDED")
      throw new ApiError(
        403,
        "ACCOUNT_FROZEN",
        "Your technician account has been frozen. Contact an administrator for access.",
      );
    if (
      !rows[0] ||
      rows[0].revoked_at ||
      new Date(String(rows[0].expires_at || 0)) <= new Date() ||
      !rows[0].active ||
      rows[0].verification_status !== "VERIFIED"
    )
      throw new ApiError(
        401,
        "SESSION_EXPIRED",
        "Your session has expired or your account is unavailable. Contact an administrator.",
      );
    if (
      rows[0].must_change_password &&
      !/\/auth\/(me|password|logout)$/.test(req.path)
    )
      throw new ApiError(
        403,
        "PASSWORD_CHANGE_REQUIRED",
        "Change your temporary password before opening jobs.",
      );
    req.technician = {
      id: String(rows[0].technician_id),
      csrf: String(rows[0].csrf_token),
      sessionId: String(rows[0].id),
    };
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const v = String(req.headers["x-csrf-token"] || ""),
        e = req.technician.csrf;
      if (
        !/^[A-Za-z0-9_-]{43}$/.test(v) ||
        v.length !== e.length ||
        !timingSafeEqual(Buffer.from(v), Buffer.from(e))
      )
        throw new ApiError(
          403,
          "CSRF_REQUIRED",
          "Refresh your session before submitting.",
        );
    }
    next();
  },
);
technicianAdminRoutes.use(
  [
    "/technicians/:id/invite",
    "/technicians/:id/account",
    "/technicians/:id/password",
  ],
  requireStaff,
  allow("SUPER_ADMIN", "ADMIN"),
);
technicianAdminRoutes.use(
  [
    "/technician-workflow",
    "/requests/:id/eligible-technicians",
    "/requests/:id/offer",
    "/work-reports/:id/review",
    "/work-reports/:id/notes",
    "/technician-checklists",
  ],
  requireStaff,
  allow("SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER"),
);
technicianRoutes.use(
  ["/auth/login", "/auth/activate", "/auth/password"],
  rateLimit({
    windowMs: 60000,
    limit: 15,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
);
technicianRoutes.post(
  "/auth/activate",
  route(async (req, res) => {
    const i = z
        .object({ token: z.string().min(32).max(100), password })
        .strict()
        .parse(req.body),
      encoded = await hashPassword(i.password);
    const rows =
      await db()`UPDATE technician_accounts SET password_hash=${encoded},must_change_password=false,invite_hash=NULL,invite_expires_at=NULL,status='ACTIVE',failed_attempts=0,locked_until=NULL WHERE invite_hash=${hash(i.token)} AND invite_expires_at>now() AND status='INVITED' RETURNING technician_id`;
    if (!rows[0])
      throw new ApiError(
        410,
        "INVITATION_EXPIRED",
        "Invitation expired or already used. Ask operations for a new invitation.",
      );
    res.json({ data: { activated: true } });
  }),
);
technicianRoutes.post(
  "/auth/login",
  route(async (req, res) => {
    const i = z
      .object({
        email: z
          .string()
          .trim()
          .max(254)
          .transform((v) => v.toLowerCase())
          .optional(),
        username: z
          .string()
          .trim()
          .max(254)
          .transform((v) => v.toLowerCase())
          .optional(),
        password: z.string().min(1).max(128),
        code: z
          .string()
          .regex(/^\d{6}$/)
          .optional(),
      })
      .strict()
      .refine((v) => !!v.email !== !!v.username, "Enter your username.")
      .parse(req.body);
    const rows =
        await db()`SELECT a.*,t.active,t.verification_status FROM technician_accounts a JOIN technicians t ON t.id=a.technician_id WHERE a.email=${i.email || i.username || null} OR a.username=${i.username || i.email || null}`,
      a = rows[0];
    if (
      a &&
      a.status !== "SUSPENDED" &&
      a.locked_until &&
      new Date(String(a.locked_until)) > new Date()
    )
      throw new ApiError(
        401,
        "INVALID_CREDENTIALS",
        "Check your sign-in details or contact an administrator for account approval.",
      );
    if (
      !a ||
      !a.active ||
      !a.password_hash ||
      !(await verifyPassword(i.password, String(a.password_hash)))
    ) {
      if (a)
        await db()`UPDATE technician_accounts SET failed_attempts=failed_attempts+1,locked_until=CASE WHEN failed_attempts>=4 THEN now()+interval '15 minutes' ELSE locked_until END WHERE technician_id=${a.technician_id}`;
      throw new ApiError(
        401,
        "INVALID_CREDENTIALS",
        "Check your sign-in details or contact an administrator for account approval.",
      );
    }
    if (a.status === "SUSPENDED")
      throw new ApiError(
        403,
        "ACCOUNT_FROZEN",
        "Your technician account has been frozen. Contact an administrator for access.",
      );
    if (a.locked_until && new Date(String(a.locked_until)) > new Date())
      throw new ApiError(
        401,
        "INVALID_CREDENTIALS",
        "Check your sign-in details or contact an administrator for account approval.",
      );
    if (a.status !== "ACTIVE" || a.verification_status !== "VERIFIED")
      throw new ApiError(
        401,
        "INVALID_CREDENTIALS",
        "Your account is not active yet. Contact an administrator for approval.",
      );
    if (a.mfa_secret) {
      const counter = i.code
        ? verifyCode(String(a.mfa_secret), i.code, Number(a.mfa_last_counter))
        : null;
      if (counter === null)
        throw new ApiError(
          401,
          "MFA_REQUIRED",
          "Enter a current authenticator code.",
        );
      const used =
        await db()`UPDATE technician_accounts SET mfa_last_counter=${counter} WHERE technician_id=${a.technician_id} AND mfa_last_counter<${counter} RETURNING technician_id`;
      if (!used.length)
        throw new ApiError(
          401,
          "MFA_REPLAY",
          "Use the next authenticator code.",
        );
    }
    const value = token(),
      csrf = token();
    await db().transaction([
      db()`UPDATE technician_accounts SET failed_attempts=0,locked_until=NULL WHERE technician_id=${a.technician_id}`,
      db()`UPDATE technician_sessions SET revoked_at=now() WHERE technician_id=${a.technician_id} AND token_hash=${hash(cookie(req) || "")}`,
      db()`INSERT INTO technician_sessions(technician_id,token_hash,csrf_token,expires_at) VALUES(${a.technician_id},${hash(value)},${csrf},now()+interval '12 hours')`,
    ]);
    res
      .cookie("technician_session", value, {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 43200000,
      })
      .json({ data: { csrfToken: csrf } });
  }),
);
technicianRoutes.use(requireTechnician);
technicianRoutes.get(
  "/auth/me",
  route(async (req, res) => {
    const rows =
      await db()`SELECT t.id,t.full_name,t.phone,t.service_area,t.verification_status,a.email,a.username,a.must_change_password,a.status AS account_status,a.photo_url,(SELECT count(*)::int FROM service_requests r WHERE r.assigned_technician_id=t.id AND r.status='COMPLETED') AS completed_count,(SELECT round(avg(v.rating),1)::float FROM request_reviews v JOIN service_requests r ON r.id=v.request_id WHERE r.assigned_technician_id=t.id) AS average_rating FROM technicians t JOIN technician_accounts a ON a.technician_id=t.id WHERE t.id=${req.technician!.id}`;
    res.json({
      data: { ...rows[0], role: "TECHNICIAN", csrfToken: req.technician!.csrf },
    });
  }),
);
technicianRoutes.post(
  "/auth/logout",
  route(async (req, res) => {
    await db()`UPDATE technician_sessions SET revoked_at=now() WHERE id=${req.technician!.sessionId}`;
    res
      .clearCookie("technician_session", { path: "/" })
      .json({ data: { loggedOut: true } });
  }),
);
technicianRoutes.post(
  "/auth/password",
  route(async (req, res) => {
    const i = z
      .object({ currentPassword: z.string().max(128), newPassword: password })
      .strict()
      .parse(req.body);
    const rows =
      await db()`SELECT password_hash,must_change_password FROM technician_accounts WHERE technician_id=${req.technician!.id}`;
    if (!rows[0]?.must_change_password)
      throw new ApiError(
        403,
        "ADMIN_PASSWORD_RESET_REQUIRED",
        "Contact an administrator to reset your password.",
      );
    if (
      i.currentPassword === i.newPassword ||
      !(await verifyPassword(i.currentPassword, String(rows[0]?.password_hash)))
    )
      throw new ApiError(
        403,
        "PASSWORD_CHECK_FAILED",
        "Check current password and choose a different new password.",
      );
    const encoded = await hashPassword(i.newPassword);
    const result = await db().transaction([
      db()`UPDATE technician_accounts SET password_hash=${encoded},must_change_password=false WHERE technician_id=${req.technician!.id} AND must_change_password=true AND password_hash=${rows[0]!.password_hash} RETURNING technician_id`,
      db()`UPDATE technician_sessions SET revoked_at=now() WHERE technician_id=${req.technician!.id} AND id!=${req.technician!.sessionId}`,
    ]);
    if (!result[0]?.length) throw conflict();
    res.json({ data: { changed: true } });
  }),
);
technicianRoutes.patch(
  "/profile",
  route(async (req, res) => {
    const i = z
      .object({
        fullName: z.string().trim().min(2).max(100),
        phone: z.string().regex(/^\+91[6-9]\d{9}$/),
      })
      .strict()
      .parse(req.body);
    const rows =
      await db()`UPDATE technicians SET full_name=${i.fullName},phone=${i.phone} WHERE id=${req.technician!.id} RETURNING full_name,phone`;
    res.json({ data: rows[0] });
  }),
);
async function ownedJob(req: Request, accepted = true) {
  const rows =
    await db()`SELECT r.*,a.id AS assignment_id,a.state AS assignment_state,a.expires_at,a.version AS assignment_version FROM service_requests r JOIN technician_assignments a ON a.request_id=r.id WHERE r.id=${String(req.params.id)} AND a.technician_id=${req.technician!.id} AND a.state IN ('OFFERED','ACCEPTED')`;
  const j = rows[0];
  if (
    !j ||
    (j.assignment_state === "ACCEPTED" &&
      j.assigned_technician_id !== req.technician!.id) ||
    (accepted &&
      (j.assignment_state !== "ACCEPTED" ||
        j.assigned_technician_id !== req.technician!.id))
  )
    throw missing();
  return j;
}
technicianRoutes.get(
  "/dashboard",
  route(async (req, res) => {
    const rows =
      await db()`SELECT count(*) FILTER(WHERE a.state='ACCEPTED' AND r.status='TECHNICIAN_ASSIGNED')::int AS pending,count(*) FILTER(WHERE a.state='ACCEPTED' AND r.confirmed_date=(now() AT TIME ZONE 'Asia/Kolkata')::date AND r.status NOT IN ('COMPLETED','CANCELLED'))::int AS today,count(*) FILTER(WHERE a.state='ACCEPTED' AND r.status='IN_PROGRESS')::int AS in_progress,count(*) FILTER(WHERE a.state='ACCEPTED' AND r.status='COMPLETED' AND (r.completed_at AT TIME ZONE 'Asia/Kolkata')::date=(now() AT TIME ZONE 'Asia/Kolkata')::date)::int AS completed_today FROM technician_assignments a JOIN service_requests r ON r.id=a.request_id WHERE a.technician_id=${req.technician!.id}`;
    const nextJobs =
      await db()`SELECT r.id,r.display_number,r.request_number,r.request_type,r.appliance,r.service_name,r.status,r.status_source,r.preferred_date,r.preferred_time_window,r.confirmed_date,r.confirmed_time_window,r.version,a.id AS assignment_id,a.state AS assignment_state,a.version AS assignment_version,c.full_name AS customer_name,r.address_snapshot->>'area' AS area,r.address_snapshot->>'city' AS city FROM technician_assignments a JOIN service_requests r ON r.id=a.request_id JOIN customers c ON c.id=r.customer_id WHERE a.technician_id=${req.technician!.id} AND a.state='ACCEPTED' AND r.status NOT IN ('COMPLETED','CANCELLED') ORDER BY CASE WHEN r.status IN ('TECHNICIAN_EN_ROUTE','TECHNICIAN_ARRIVED','IN_PROGRESS','ESTIMATE_PENDING_APPROVAL') THEN 0 ELSE 1 END,COALESCE(r.confirmed_date,r.preferred_date),r.confirmed_time_window LIMIT 3`;
    res.json({ data: { ...rows[0], next_jobs: nextJobs } });
  }),
);
technicianRoutes.get(
  "/jobs",
  route(async (req, res) => {
    const i = z
      .object({
        tab: z
          .enum([
            "active",
            "pending",
            "today",
            "upcoming",
            "in-progress",
            "completed",
            "all",
            "weekly",
          ])
          .default("all"),
        type: z.enum(["SERVICE", "INSTALLATION"]).optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(50).default(20),
        date: z.string().date().optional(),
      })
      .parse(req.query);
    const { tab, type, page, limit, date } = i;
    const rows =
      await db()`SELECT r.id,r.display_number,r.request_number,r.request_type,r.appliance,r.service_name,r.status,r.status_source,r.preferred_date,r.preferred_time_window,r.confirmed_date,r.confirmed_time_window,r.version,a.id AS assignment_id,a.state AS assignment_state,a.version AS assignment_version,a.expires_at,c.full_name AS customer_name,COALESCE(NULLIF(r.address_snapshot->>'phone',''),c.phone_e164) AS customer_phone,r.address_snapshot,r.address_snapshot->>'area' AS area,r.address_snapshot->>'city' AS city,(SELECT w.state FROM technician_work_reports w WHERE w.request_id=r.id AND w.technician_id=a.technician_id ORDER BY w.version DESC LIMIT 1) AS latest_report_state,(SELECT w.outcome FROM technician_work_reports w WHERE w.request_id=r.id AND w.technician_id=a.technician_id ORDER BY w.version DESC LIMIT 1) AS latest_report_outcome,EXISTS(SELECT 1 FROM technician_estimates e WHERE e.request_id=r.id AND e.state IN ('AWAITING_CUSTOMER_APPROVAL','REJECTED','SUBMITTED')) AS completion_blocked_by_estimate,count(*) OVER()::int AS total FROM technician_assignments a JOIN service_requests r ON r.id=a.request_id JOIN customers c ON c.id=r.customer_id WHERE a.technician_id=${req.technician!.id} AND a.state='ACCEPTED' AND (${type || null}::text IS NULL OR r.request_type=${type || null}) AND (${date || null}::date IS NULL OR (${tab}='weekly' AND r.confirmed_date BETWEEN ${date || null}::date AND ${date || null}::date+6) OR (${tab}!='weekly' AND r.confirmed_date=${date || null}::date)) AND (${tab}='all' OR (${tab}='active' AND r.status NOT IN ('COMPLETED','CANCELLED')) OR (${tab}='weekly' AND r.status NOT IN ('COMPLETED','CANCELLED') AND r.confirmed_date BETWEEN COALESCE(${date || null}::date,(now() AT TIME ZONE 'Asia/Kolkata')::date) AND COALESCE(${date || null}::date,(now() AT TIME ZONE 'Asia/Kolkata')::date)+6) OR (${tab}='pending' AND r.status='TECHNICIAN_ASSIGNED') OR ((${tab}='today' AND r.confirmed_date=(now() AT TIME ZONE 'Asia/Kolkata')::date AND r.status NOT IN ('COMPLETED','CANCELLED')) OR (${tab}='upcoming' AND r.status NOT IN ('COMPLETED','CANCELLED') AND (r.confirmed_date>(now() AT TIME ZONE 'Asia/Kolkata')::date OR r.confirmed_date IS NULL)) OR (${tab}='in-progress' AND r.status IN ('TECHNICIAN_EN_ROUTE','TECHNICIAN_ARRIVED','IN_PROGRESS','ESTIMATE_PENDING_APPROVAL')) OR (${tab}='completed' AND r.status='COMPLETED'))) ORDER BY COALESCE(r.confirmed_date,r.preferred_date),a.created_at DESC LIMIT ${limit} OFFSET ${(page - 1) * limit}`;
    res.json({ data: rows, meta: { page, limit, total: rows[0]?.total || 0 } });
  }),
);
function checklist(
  appliance: string,
  type: string,
  configured?: string[],
): string[] {
  return type === "INSTALLATION"
    ? configured || [
        "Installation completed according to manufacturer instructions",
        "Safety and function checks completed",
        "Customer demonstration completed",
      ]
    : [
        "Reported issue assessed",
        "Work and safety checks completed",
        "Customer informed of outcome",
      ];
}
technicianRoutes.get(
  "/jobs/:id",
  route(async (req, res) => {
    const j = await ownedJob(req, false);
    const accepted = j.assignment_state === "ACCEPTED";
    const { address_snapshot, details, ...jobData } = j;
    const [customer, timeline, estimates, reports, configured, attachments] =
      await Promise.all([
        db()`SELECT full_name,phone_e164 FROM customers WHERE id=${j.customer_id}`,
        db()`SELECT id,status,note,actor_role,created_at FROM request_status_events WHERE request_id=${j.id} ORDER BY created_at`,
        db()`SELECT * FROM technician_estimates WHERE request_id=${j.id} ORDER BY version DESC`,
        db()`SELECT * FROM technician_work_reports WHERE request_id=${j.id} AND technician_id=${req.technician!.id} ORDER BY version DESC`,
        db()`SELECT items FROM technician_checklists WHERE lower(appliance)=lower(${j.appliance})`,
        db()`SELECT id,purpose,content_type,byte_size FROM technician_attachments WHERE request_id=${j.id} AND technician_id=${req.technician!.id} AND state='READY' ORDER BY created_at`,
      ]);
    res.json({
      data: {
        ...jobData,
        ...(accepted
          ? {
              address_snapshot,
              details,
              customer: {
                ...customer[0],
                phone_e164:
                  contactPhone(address_snapshot?.phone) ||
                  contactPhone(customer[0]?.phone_e164),
              },
            }
          : {}),
        timeline,
        estimates,
        reports,
        checklist: checklist(
          String(j.appliance),
          String(j.request_type),
          configured[0]?.items,
        ),
        attachments,
      },
    });
  }),
);

technicianRoutes.post(
  "/jobs/:id/complete",
  route(async (req, res) => {
    const i = z
        .object({ version: z.number().int().positive() })
        .strict()
        .parse(req.body),
      j = await ownedJob(req);
    if (j.status === "COMPLETED") {
      res.json({ data: j, alreadyCompleted: true });
      return;
    }
    if (
      j.status !== "IN_PROGRESS" ||
      j.version !== i.version ||
      !["SERVICE", "INSTALLATION"].includes(String(j.request_type))
    )
      throw conflict();
    const rows =
      await db()`WITH changed AS (UPDATE service_requests SET status_source='WORKFLOW',status='COMPLETED',completed_at=now(),version=version+1,updated_at=now() WHERE id=${j.id} AND version=${i.version} AND status='IN_PROGRESS' AND assigned_technician_id=${req.technician!.id} AND EXISTS(SELECT 1 FROM technician_assignments a WHERE a.request_id=service_requests.id AND a.technician_id=${req.technician!.id} AND a.state='ACCEPTED') AND EXISTS(SELECT 1 FROM technician_work_reports w WHERE w.request_id=service_requests.id AND w.technician_id=${req.technician!.id} AND w.state='SUBMITTED_FOR_REVIEW' AND w.outcome='RESOLVED' AND w.version=(SELECT max(latest.version) FROM technician_work_reports latest WHERE latest.request_id=service_requests.id)) AND NOT EXISTS(SELECT 1 FROM technician_estimates e WHERE e.request_id=service_requests.id AND e.state IN ('AWAITING_CUSTOMER_APPROVAL','REJECTED','SUBMITTED')) RETURNING *),report AS (UPDATE technician_work_reports SET state='APPROVED',reviewed_by_technician_id=${req.technician!.id} WHERE request_id IN (SELECT id FROM changed) AND state='SUBMITTED_FOR_REVIEW' AND outcome='RESOLVED' AND version=(SELECT max(latest.version) FROM technician_work_reports latest WHERE latest.request_id=technician_work_reports.request_id) RETURNING request_id,work_summary,notes),completion AS (INSERT INTO completion_reports(request_id,completed_by_technician_id,work_summary,completion_notes,completed_at) SELECT c.id,${req.technician!.id},r.work_summary,r.notes,c.completed_at FROM changed c JOIN report r ON r.request_id=c.id ON CONFLICT(request_id) DO NOTHING RETURNING request_id),event AS (INSERT INTO request_status_events(request_id,status,previous_status,note,actor_role,actor_technician_id) SELECT c.id,'COMPLETED','IN_PROGRESS',r.work_summary,'TECHNICIAN',${req.technician!.id} FROM changed c JOIN report r ON r.request_id=c.id RETURNING id),audit AS (INSERT INTO audit_logs(actor_role,action,entity_type,entity_id,previous_value,new_value,reason) SELECT 'TECHNICIAN','REQUEST_COMPLETED','SERVICE_REQUEST',c.id::text,'{"status":"IN_PROGRESS"}'::jsonb,jsonb_build_object('status','COMPLETED','technicianId',${req.technician!.id}::text,'version',c.version),r.work_summary FROM changed c JOIN report r ON r.request_id=c.id RETURNING id),notification AS (INSERT INTO customer_notifications(customer_id,request_id,kind,title,message) SELECT customer_id,id,'COMPLETION','Service completed','Your technician marked the work complete. Share your experience when you are ready.' FROM changed ON CONFLICT(request_id,kind) DO NOTHING RETURNING id) SELECT changed.* FROM changed WHERE EXISTS(SELECT 1 FROM completion) AND EXISTS(SELECT 1 FROM event)`;
    if (!rows[0]) throw conflict();
    res.json({ data: rows[0] });
  }),
);
technicianRoutes.post(
  "/jobs/:id/:action",
  route(async (req, res, next) => {
    const targets: Record<string, [string, string]> = {
        "on-the-way": ["APPOINTMENT_CONFIRMED", "TECHNICIAN_EN_ROUTE"],
        arrived: ["TECHNICIAN_EN_ROUTE", "TECHNICIAN_ARRIVED"],
        start: ["TECHNICIAN_ARRIVED", "IN_PROGRESS"],
      },
      target = targets[String(req.params.action)];
    if (!target) {
      next();
      return;
    }
    const i = z
        .object({ version: z.number().int().positive() })
        .strict()
        .parse(req.body),
      j = await ownedJob(req);
    if (j.status === target[1]) {
      res.json({ data: j, alreadyUpdated: true });
      return;
    }
    if (j.status !== target[0] || j.version !== i.version) throw conflict();
    const rows =
      await db()`WITH changed AS (UPDATE service_requests SET status_source='WORKFLOW',status=${target[1]},version=version+1,updated_at=now() WHERE id=${j.id} AND version=${i.version} AND status=${target[0]} AND assigned_technician_id=${req.technician!.id} AND EXISTS(SELECT 1 FROM technician_assignments a WHERE a.request_id=service_requests.id AND a.state='ACCEPTED' AND a.technician_id=${req.technician!.id}) RETURNING *),history AS (INSERT INTO request_status_events(request_id,status,previous_status,note,actor_role,actor_technician_id) SELECT id,status,${target[0]},${target[1].replaceAll("_", " ")},'TECHNICIAN',${req.technician!.id} FROM changed RETURNING id),audit AS (INSERT INTO audit_logs(actor_role,action,entity_type,entity_id,new_value) SELECT 'TECHNICIAN','JOB_PROGRESS','SERVICE_REQUEST',id::text,jsonb_build_object('status',status,'technicianId',assigned_technician_id) FROM changed RETURNING id),notification AS (INSERT INTO customer_notifications(customer_id,request_id,kind,title,message) SELECT customer_id,id,status,'Visit update',${target[1].replaceAll("_", " ")} FROM changed ON CONFLICT(request_id,kind) DO NOTHING RETURNING id) SELECT * FROM changed`;
    if (!rows[0]) throw conflict();
    res.json({ data: rows[0] });
  }),
);
technicianRoutes.post(
  "/jobs/:id/estimates",
  route(async (req, res) => {
    const i = technicianEstimateSchema.parse(req.body),
      j = await ownedJob(req);
    if (
      !["IN_PROGRESS", "ESTIMATE_PENDING_APPROVAL"].includes(
        String(j.status),
      ) ||
      j.version !== i.version
    )
      throw conflict();
    const subtotal = i.items.reduce(
      (s, v) => s + v.quantity * Math.round(v.unitPrice * 100),
      0,
    );
    if (subtotal <= 0)
      throw new ApiError(422, "INVALID_ESTIMATE", "Enter a positive estimate.");
    const rows =
      await db()`WITH changed AS (UPDATE service_requests SET status_source='WORKFLOW',status='ESTIMATE_PENDING_APPROVAL',version=version+1,updated_at=now() WHERE id=${j.id} AND version=${i.version} AND assigned_technician_id=${req.technician!.id} RETURNING *),superseded AS (UPDATE technician_estimates SET state='SUPERSEDED' WHERE request_id=${j.id} AND state IN ('SUBMITTED','AWAITING_CUSTOMER_APPROVAL','REJECTED','APPROVED') AND EXISTS(SELECT 1 FROM changed) RETURNING id),estimate AS (INSERT INTO technician_estimates(request_id,technician_id,version,state,diagnosis,items,subtotal_paise,tax_paise,total_paise) SELECT id,${req.technician!.id},COALESCE((SELECT max(version) FROM technician_estimates WHERE request_id=${j.id}),0)+1,'AWAITING_CUSTOMER_APPROVAL',${i.diagnosis},${JSON.stringify(i.items)}::jsonb,${subtotal},0,${subtotal} FROM changed WHERE (SELECT count(*) FROM superseded)>=0 RETURNING *),notification AS (INSERT INTO customer_notifications(customer_id,request_id,kind,title,message) SELECT c.customer_id,c.id,'estimate:'||e.id,'Estimate needs approval','Review the itemized estimate before additional work proceeds.' FROM changed c JOIN estimate e ON e.request_id=c.id RETURNING id),event AS (INSERT INTO request_status_events(request_id,status,previous_status,note,actor_role,actor_technician_id) SELECT id,status,${j.status},'Estimate submitted for customer approval','TECHNICIAN',${req.technician!.id} FROM changed RETURNING id) SELECT * FROM estimate`;
    if (!rows[0]) throw conflict();
    res.status(201).json({
      data: rows[0],
      taxPolicy: "No tax configured; amounts are INR, stored in paise.",
    });
  }),
);
technicianCustomerRoutes.get(
  "/requests/:id/estimates",
  requireAuth,
  route(async (req, res) => {
    const rows =
      await db()`SELECT e.id,e.version,e.state,e.diagnosis,e.items,e.subtotal_paise,e.tax_paise,e.total_paise,e.created_at FROM technician_estimates e JOIN service_requests r ON r.id=e.request_id WHERE r.id=${String(req.params.id)} AND r.customer_id=${req.customerId!} ORDER BY e.version DESC`;
    res.json({ data: rows });
  }),
);
technicianCustomerRoutes.post(
  "/estimates/:id/decision",
  requireAuth,
  route(async (req, res) => {
    const i = z
        .object({ decision: z.enum(["APPROVED", "REJECTED"]) })
        .strict()
        .parse(req.body),
      rows =
        await db()`SELECT e.*,r.version AS request_version FROM technician_estimates e JOIN service_requests r ON r.id=e.request_id WHERE e.id=${String(req.params.id)} AND r.customer_id=${req.customerId!}`,
      e = rows[0];
    if (!e) throw missing();
    if (e.state === i.decision) {
      res.json({ data: e });
      return;
    }
    if (e.state !== "AWAITING_CUSTOMER_APPROVAL") throw conflict();
    const result =
      await db()`WITH changed AS (UPDATE service_requests SET status_source='WORKFLOW',status=${i.decision === "APPROVED" ? "IN_PROGRESS" : "ESTIMATE_PENDING_APPROVAL"},version=version+1,updated_at=now() WHERE id=${e.request_id} AND version=${e.request_version} AND status='ESTIMATE_PENDING_APPROVAL' RETURNING *),estimate AS (UPDATE technician_estimates SET state=${i.decision},decided_at=now() WHERE id=${e.id} AND state='AWAITING_CUSTOMER_APPROVAL' AND EXISTS(SELECT 1 FROM changed) RETURNING *),notification AS (INSERT INTO technician_notifications(technician_id,request_id,event_key,title,message) SELECT technician_id,request_id,'estimate-decision:'||id,${"Estimate " + i.decision.toLowerCase()},'Customer responded to your estimate.' FROM estimate RETURNING id),event AS (INSERT INTO request_status_events(request_id,status,previous_status,note,actor_role) SELECT id,status,'ESTIMATE_PENDING_APPROVAL',${"Customer " + i.decision.toLowerCase() + " the estimate"},'CUSTOMER' FROM changed RETURNING id) SELECT * FROM estimate`;
    if (!result[0]) throw conflict();
    res.json({ data: result[0] });
  }),
);
technicianRoutes.post(
  "/jobs/:id/work-report",
  route(async (req, res) => {
    const i = technicianWorkReportSchema.parse(req.body),
      j = await ownedJob(req);
    if (j.status !== "IN_PROGRESS" || j.version !== i.version) throw conflict();
    const configured =
      await db()`SELECT items FROM technician_checklists WHERE lower(appliance)=lower(${j.appliance})`;
    if (
      checklist(
        String(j.appliance),
        String(j.request_type),
        configured[0]?.items,
      ).some((item) => !i.checklist.includes(item))
    )
      throw new ApiError(
        422,
        "CHECKLIST_INCOMPLETE",
        "Complete every applicable checklist item.",
      );
    const previous =
      await db()`SELECT state FROM technician_work_reports WHERE request_id=${j.id} ORDER BY version DESC LIMIT 1`;
    if (previous[0] && previous[0].state !== "CHANGES_REQUESTED")
      throw new ApiError(
        409,
        "REPORT_PENDING",
        "Report is awaiting review. Operations can request corrections.",
      );
    const photos =
      await db()`SELECT id FROM technician_attachments WHERE id=ANY(${i.attachmentIds}::uuid[]) AND request_id=${j.id} AND technician_id=${req.technician!.id} AND state='READY' AND report_id IS NULL`;
    if (photos.length !== i.attachmentIds.length)
      throw new ApiError(
        422,
        "INVALID_ATTACHMENT",
        "Select completed uploads from this job only.",
      );
    const result =
      await db()`WITH changed AS (UPDATE service_requests SET version=version+1,updated_at=now() WHERE id=${j.id} AND version=${i.version} AND status='IN_PROGRESS' AND assigned_technician_id=${req.technician!.id} AND NOT EXISTS(SELECT 1 FROM technician_estimates WHERE request_id=${j.id} AND state IN ('AWAITING_CUSTOMER_APPROVAL','REJECTED','SUBMITTED')) RETURNING *),superseded AS (UPDATE technician_work_reports SET state='SUPERSEDED' WHERE request_id=${j.id} AND state='CHANGES_REQUESTED' AND EXISTS(SELECT 1 FROM changed) RETURNING id),report AS (INSERT INTO technician_work_reports(request_id,technician_id,version,work_summary,checklist,outcome,notes,parts,unresolved_issues) SELECT id,${req.technician!.id},COALESCE((SELECT max(version) FROM technician_work_reports WHERE request_id=${j.id}),0)+1,${i.workSummary},${JSON.stringify(i.checklist)}::jsonb,${i.outcome},${i.notes},${i.parts},${i.unresolvedIssues} FROM changed WHERE (SELECT count(*) FROM superseded)>=0 RETURNING *),attachments AS (UPDATE technician_attachments SET report_id=(SELECT id FROM report) WHERE id=ANY(${i.attachmentIds}::uuid[]) AND EXISTS(SELECT 1 FROM report) RETURNING id),audit AS (INSERT INTO audit_logs(actor_role,action,entity_type,entity_id,new_value) SELECT 'TECHNICIAN','WORK_REPORT_SUBMITTED','SERVICE_REQUEST',request_id::text,jsonb_build_object('reportId',id,'technicianId',technician_id,'version',version) FROM report RETURNING id) SELECT * FROM report`;
    if (!result[0]) throw conflict();
    res.status(201).json({ data: result[0] });
  }),
);
technicianRoutes.get(
  "/notifications",
  route(async (req, res) => {
    const rows =
      await db()`SELECT (SELECT count(*)::int FROM technician_notifications all_notices WHERE all_notices.technician_id=${req.technician!.id} AND all_notices.read_at IS NULL) AS unread_count,id,request_id,title,message,read_at,created_at FROM technician_notifications WHERE technician_id=${req.technician!.id} ORDER BY created_at DESC LIMIT 100`;
    res.json({
      data: rows,
      meta: {
        unreadCount: Number(rows[0]?.unread_count || 0),
        fetchedAt: new Date().toISOString(),
      },
    });
  }),
);
technicianRoutes.post(
  "/notifications/read-all",
  route(async (req, res) => {
    const input = notificationReadAllSchema.parse(req.body);
    const data =
      await db()`UPDATE technician_notifications SET read_at=COALESCE(read_at,now()) WHERE technician_id=${req.technician!.id} AND ((${input.before || null}::timestamptz IS NOT NULL AND created_at<=${input.before || null}::timestamptz) OR id=ANY(${input.ids || []}::uuid[])) RETURNING id,read_at`;
    res.json({ data });
  }),
);
technicianRoutes.post(
  "/notifications/:id/read",
  route(async (req, res) => {
    const rows =
      await db()`UPDATE technician_notifications SET read_at=COALESCE(read_at,now()) WHERE id=${String(req.params.id)} AND technician_id=${req.technician!.id} RETURNING id`;
    if (!rows[0]) throw missing();
    res.json({ data: rows[0] });
  }),
);

technicianAdminRoutes.post(
  "/technicians/:id/invite",
  route(async (req, res) => {
    const i = z
        .object({
          email: z
            .string()
            .email()
            .max(254)
            .transform((v) => v.toLowerCase()),
        })
        .strict()
        .parse(req.body),
      value = token();
    const rows =
      await db()`INSERT INTO technician_accounts(technician_id,email,invite_hash,invite_expires_at) SELECT id,${i.email},${hash(value)},now()+interval '2 hours' FROM technicians WHERE id=${String(req.params.id)} AND active=true ON CONFLICT(technician_id) DO UPDATE SET email=EXCLUDED.email,invite_hash=EXCLUDED.invite_hash,invite_expires_at=EXCLUDED.invite_expires_at WHERE technician_accounts.status='INVITED' RETURNING technician_id,status`;
    if (!rows[0])
      throw new ApiError(
        409,
        "INVITE_UNAVAILABLE",
        "Only active technicians without an activated account can be invited.",
      );
    res.status(201).json({
      data: {
        ...rows[0],
        activationPath: "/technician/activate#token=" + value,
        expiresInMinutes: 120,
        delivery: "ADMIN_COPY_LINK",
      },
    });
  }),
);
technicianAdminRoutes.patch(
  "/technicians/:id/account",
  route(async (req, res) => {
    const i = z
        .object({ status: z.enum(["ACTIVE", "SUSPENDED"]) })
        .strict()
        .parse(req.body),
      result = await db().transaction([
        db()`UPDATE technician_accounts SET status=${i.status} WHERE technician_id=${String(req.params.id)} AND password_hash IS NOT NULL RETURNING technician_id,status`,
        db()`UPDATE technician_sessions SET revoked_at=now() WHERE technician_id=${String(req.params.id)}`,
      ]);
    if (!result[0]?.length) throw missing();
    res.json({ data: result[0][0] });
  }),
);
technicianAdminRoutes.get(
  "/technicians/:id/account",
  route(async (req, res) => {
    const rows =
      await db()`SELECT username,email,status,must_change_password FROM technician_accounts WHERE technician_id=${String(req.params.id)}`;
    res.json({ data: rows[0] || null });
  }),
);
technicianAdminRoutes.get(
  "/technician-workflow",
  route(async (_req, res) => {
    const [accounts, reports, assignments] = await Promise.all([
      db()`SELECT a.technician_id,a.email,a.status,t.full_name,t.verification_status FROM technician_accounts a JOIN technicians t ON t.id=a.technician_id ORDER BY t.full_name`,
      db()`SELECT w.*,r.request_number,r.request_type,r.appliance,r.version AS request_version,t.full_name AS technician_name FROM technician_work_reports w JOIN service_requests r ON r.id=w.request_id JOIN technicians t ON t.id=w.technician_id WHERE w.state IN ('SUBMITTED_FOR_REVIEW','CHANGES_REQUESTED') ORDER BY w.created_at DESC LIMIT 100`,
      db()`SELECT a.*,r.request_number,t.full_name AS technician_name FROM technician_assignments a JOIN service_requests r ON r.id=a.request_id JOIN technicians t ON t.id=a.technician_id ORDER BY a.created_at DESC LIMIT 100`,
    ]);
    res.json({ data: { accounts, reports, assignments } });
  }),
);
technicianAdminRoutes.get(
  "/requests/:id/eligible-technicians",
  route(async (req, res) => {
    const rows =
      await db()`SELECT t.id,t.full_name,t.service_area,t.verification_status,a.status AS account_status,(SELECT count(*)::int FROM service_requests j WHERE j.assigned_technician_id=t.id AND j.confirmed_date IS NOT NULL AND j.status NOT IN ('COMPLETED','CANCELLED')) AS scheduled_workload,(SELECT round(avg(v.rating),1)::float FROM request_reviews v WHERE v.technician_id=t.id) AS average_rating FROM technicians t LEFT JOIN technician_accounts a ON a.technician_id=t.id WHERE t.active AND EXISTS(SELECT 1 FROM service_requests r WHERE r.id=${String(req.params.id)}) ORDER BY t.full_name`;
    res.json({ data: rows });
  }),
);
technicianAdminRoutes.post(
  "/requests/:id/offer",
  route(async (req, res) => {
    const i = assignmentOfferSchema.parse(req.body);
    await db()`SELECT pg_advisory_xact_lock(hashtextextended(${"technician-account:" + i.technicianId},0))`;
    const liveAssignment =
      await db()`SELECT a.* FROM technician_assignments a JOIN service_requests r ON r.id=a.request_id WHERE r.id=${String(req.params.id)} AND a.technician_id=${i.technicianId} AND a.state='ACCEPTED'`;
    if (liveAssignment[0]) {
      res.json({ data: liveAssignment[0], alreadyProcessed: true });
      return;
    }
    const rows =
        await db()`SELECT r.* FROM service_requests r JOIN technicians t ON t.id=${i.technicianId} LEFT JOIN technician_accounts a ON a.technician_id=t.id WHERE r.id=${String(req.params.id)} AND t.active AND a.status IS DISTINCT FROM 'SUSPENDED'`,
      j = rows[0];
    if (!j)
      throw new ApiError(
        422,
        "TECHNICIAN_UNAVAILABLE",
        "This technician is inactive or their account is frozen. Choose another technician or contact an administrator.",
      );
    if (
      ![
        "UNDER_REVIEW",
        "ASSIGNMENT_PENDING",
        "EXECUTIVE_CONTACTED",
        "TECHNICIAN_ASSIGNED",
        "APPOINTMENT_CONFIRMED",
      ].includes(String(j.status)) ||
      j.version !== i.version
    )
      throw conflict();
    const result =
      await db()`WITH changed AS (UPDATE service_requests SET status_source='WORKFLOW',status='TECHNICIAN_ASSIGNED',assigned_technician_id=${i.technicianId},confirmed_date=NULL,confirmed_time_window=NULL,version=version+1,updated_at=now() WHERE id=${j.id} AND version=${i.version} RETURNING *),previous AS (UPDATE technician_assignments SET state='REASSIGNED',reason='Reassigned by operations',version=version+1 WHERE request_id=${j.id} AND state IN ('OFFERED','ACCEPTED') AND EXISTS(SELECT 1 FROM changed) RETURNING *),old_notification AS (INSERT INTO technician_notifications(technician_id,request_id,event_key,title,message) SELECT technician_id,request_id,'reassigned:'||id,'Assignment ended','This assignment was reassigned by operations.' FROM previous ON CONFLICT(event_key) DO NOTHING RETURNING id),assignment AS (INSERT INTO technician_assignments(request_id,technician_id,state,reason,offered_by,responded_at) SELECT id,${i.technicianId},'ACCEPTED',${i.reason},${req.staff!.id},now() FROM changed WHERE (SELECT count(*) FROM previous)>=0 RETURNING *),technician_notification AS (INSERT INTO technician_notifications(technician_id,request_id,event_key,title,message) SELECT technician_id,request_id,'assigned:'||id,'New job assigned','Operations assigned this job to you. Review it in My Jobs.' FROM assignment ON CONFLICT(event_key) DO NOTHING RETURNING id),assignment_event AS (INSERT INTO technician_assignment_events(assignment_id,state,actor_id,actor_role,reason) SELECT id,'ACCEPTED',${req.staff!.id},${req.staff!.role},${i.reason} FROM assignment RETURNING id),request_event AS (INSERT INTO request_status_events(request_id,status,previous_status,note,actor_staff_id,actor_role) SELECT id,'TECHNICIAN_ASSIGNED',${j.status},'Technician assigned by operations',${req.staff!.id},${req.staff!.role} FROM changed RETURNING id),customer_notification AS (INSERT INTO customer_notifications(customer_id,request_id,kind,title,message) SELECT customer_id,id,'TECHNICIAN_ASSIGNED:'||version,'Technician assigned','A technician has been assigned to your request. Operations will confirm the visit.' FROM changed ON CONFLICT(request_id,kind) DO NOTHING RETURNING id),audit AS (INSERT INTO audit_logs(actor_staff_id,actor_role,action,entity_type,entity_id,previous_value,new_value,reason) SELECT ${req.staff!.id},${req.staff!.role},'TECHNICIAN_ASSIGNED','SERVICE_REQUEST',c.id::text,jsonb_build_object('status',${j.status}::text,'version',${j.version}::int),jsonb_build_object('status',c.status,'version',c.version,'technicianId',a.technician_id,'assignmentId',a.id),${i.reason} FROM changed c JOIN assignment a ON a.request_id=c.id RETURNING id) SELECT * FROM assignment`;
    if (!result[0]) throw conflict();
    res.status(201).json({ data: result[0] });
  }),
);
technicianAdminRoutes.post(
  "/work-reports/:id/review",
  route(async (req, res) => {
    const i = z
        .object({
          decision: z.enum(["APPROVE", "CHANGES_REQUESTED"]),
          reason: z.string().trim().max(2000).default(""),
        })
        .strict()
        .parse(req.body),
      rows =
        await db()`SELECT w.*,r.version AS request_version,r.status AS request_status,r.assigned_technician_id FROM technician_work_reports w JOIN service_requests r ON r.id=w.request_id WHERE w.id=${String(req.params.id)}`,
      w = rows[0];
    if (!w) throw missing();
    if (i.decision === "APPROVE" && w.state === "APPROVED") {
      res.json({ data: w, alreadyApproved: true });
      return;
    }
    if (
      w.state !== "SUBMITTED_FOR_REVIEW" ||
      w.request_status !== "IN_PROGRESS" ||
      w.assigned_technician_id !== w.technician_id
    )
      throw conflict();
    if (i.decision === "APPROVE") {
      if (w.outcome !== "RESOLVED")
        throw new ApiError(
          422,
          "UNRESOLVED_REPORT",
          "Resolve outstanding issues before completing.",
        );
      const result = await completeRequest(
        String(w.request_id),
        Number(w.request_version),
        req.staff!,
        String(w.work_summary),
        String(w.notes),
      );
      if (!result[0]) throw conflict();
      res.json({ data: result[0] });
      return;
    }
    if (i.reason.length < 3)
      throw new ApiError(
        422,
        "REASON_REQUIRED",
        "Explain the corrections required.",
      );
    const result =
      await db()`WITH changed AS (UPDATE service_requests SET version=version+1,updated_at=now() WHERE id=${w.request_id} AND version=${w.request_version} AND status='IN_PROGRESS' RETURNING id),report AS (UPDATE technician_work_reports SET state='CHANGES_REQUESTED',correction_reason=${i.reason},reviewed_by=${req.staff!.id} WHERE id=${w.id} AND state='SUBMITTED_FOR_REVIEW' AND EXISTS(SELECT 1 FROM changed) RETURNING *),notification AS (INSERT INTO technician_notifications(technician_id,request_id,event_key,title,message) SELECT technician_id,request_id,'correction:'||id,'Report corrections requested',${i.reason} FROM report RETURNING id) SELECT * FROM report`;
    if (!result[0]) throw conflict();
    res.json({ data: result[0] });
  }),
);
technicianAdminRoutes.put(
  "/technician-checklists",
  route(async (req, res) => {
    const i = z
        .object({
          appliance: z.string().trim().min(2).max(100),
          items: z.array(z.string().trim().min(3).max(200)).min(1).max(30),
        })
        .strict()
        .parse(req.body),
      rows =
        await db()`INSERT INTO technician_checklists(appliance,items) VALUES(${i.appliance},${JSON.stringify(i.items)}::jsonb) ON CONFLICT(appliance) DO UPDATE SET items=EXCLUDED.items RETURNING *`;
    res.json({ data: rows[0] });
  }),
);

technicianRoutes.post(
  "/jobs/:id/support",
  route(async (req, res) => {
    const i = z
        .object({ message: z.string().trim().min(3).max(2000) })
        .strict()
        .parse(req.body),
      j = await ownedJob(req);
    const rows =
      await db()`INSERT INTO audit_logs(actor_role,action,entity_type,entity_id,new_value,reason) VALUES('TECHNICIAN','TECHNICIAN_ASSISTANCE_REQUESTED','SERVICE_REQUEST',${String(j.id)},jsonb_build_object('technicianId',${req.technician!.id}::text),${i.message}) RETURNING id`;
    res.status(201).json({ data: rows[0] });
  }),
);

technicianAdminRoutes.post(
  "/technicians/:id/password",
  route(async (req, res) => {
    const i = z
        .object({ temporaryPassword: password })
        .strict()
        .parse(req.body),
      encoded = await hashPassword(i.temporaryPassword),
      result =
        await db()`WITH updated AS (UPDATE technician_accounts SET password_hash=${encoded},must_change_password=true,reset_hash=NULL,reset_expires_at=NULL,invite_hash=NULL,invite_expires_at=NULL,failed_attempts=0,locked_until=NULL,mfa_secret=NULL,mfa_pending_secret=NULL,mfa_last_counter=0 WHERE technician_id=${String(req.params.id)} AND status IN ('ACTIVE','SUSPENDED') RETURNING technician_id),revoked AS (UPDATE technician_sessions SET revoked_at=now() WHERE technician_id IN (SELECT technician_id FROM updated) RETURNING id) SELECT technician_id FROM updated`;
    if (!result.length) throw missing();
    res.json({ data: { passwordReset: true, mustChangePassword: true } });
  }),
);

technicianAdminRoutes.get(
  "/work-reports/:id/notes",
  route(async (req, res) => {
    const rows =
      await db()`SELECT a.id,a.reason,a.created_at,s.full_name FROM audit_logs a LEFT JOIN staff_profiles s ON s.id=a.actor_staff_id WHERE a.action='REPORT_INTERNAL_NOTE' AND a.new_value->>'reportId'=${String(req.params.id)} ORDER BY a.created_at`;
    res.json({ data: rows });
  }),
);
technicianAdminRoutes.post(
  "/work-reports/:id/notes",
  route(async (req, res) => {
    const i = z
      .object({ note: z.string().trim().min(1).max(2000) })
      .strict()
      .parse(req.body);
    const rows =
      await db()`INSERT INTO audit_logs(actor_staff_id,actor_role,action,entity_type,entity_id,new_value,reason) SELECT ${req.staff!.id},${req.staff!.role},'REPORT_INTERNAL_NOTE','SERVICE_REQUEST',request_id::text,jsonb_build_object('reportId',id),${i.note} FROM technician_work_reports WHERE id=${String(req.params.id)} RETURNING id`;
    if (!rows.length) throw missing();
    res.status(201).json({ data: rows[0] });
  }),
);
