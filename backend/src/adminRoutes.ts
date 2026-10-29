import {
  catalogueOptionsSchema,
  technicianUsernameSchema,
  temporaryPasswordSchema,
} from "@home/shared";
import { checkTechnicianSchedule } from "./technicianScheduling.js";
import { completeRequest } from "./completion.js";
import { Router, type RequestHandler } from "express";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "./db.js";
import { env } from "./config/env.js";
import { ApiError } from "./customerRoutes.js";
import { hashPassword, verifyPassword } from "./security/password.js";
import { serviceFormSchema, requestTransitions } from "@home/shared";
import { bookingSchema, mobile } from "./validation.js";

const router = Router();
router.param("id", (_req, _res, next, id) => {
  next(
    z.string().uuid().safeParse(id).success
      ? undefined
      : new ApiError(422, "VALIDATION_ERROR", "Invalid record ID"),
  );
});
const hash = (v: string) => createHash("sha256").update(v).digest("hex");
const asyncRoute =
  (h: RequestHandler): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(h(req, res, next)).catch(next);
const cookie = (header: string | undefined, name: string) =>
  header
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(`${name}=`))
    ?.slice(name.length + 1);
type Role =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "OPERATIONS_MANAGER"
  | "SUPPORT_AGENT"
  | "FINANCE_MANAGER";
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      staff?: { id: string; role: Role };
    }
  }
}
export const requireStaff: RequestHandler = asyncRoute(
  async (req, _res, next) => {
    const token = cookie(req.headers.cookie, "staff_session");
    if (!token)
      throw new ApiError(401, "UNAUTHORIZED", "Admin sign in required");
    const rows =
      await db()`SELECT s.id,s.role FROM staff_sessions x JOIN staff_profiles s ON s.id=x.staff_id WHERE x.token_hash=${hash(token)} AND x.revoked_at IS NULL AND x.expires_at>now() AND s.active=true`;
    if (!rows[0])
      throw new ApiError(401, "SESSION_EXPIRED", "Your session has expired");
    req.staff = { id: String(rows[0].id), role: rows[0].role as Role };
    next();
  },
);
export const allow =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.staff || !roles.includes(req.staff.role))
      return next(
        new ApiError(
          403,
          "FORBIDDEN",
          "You don't have permission to perform this action",
        ),
      );
    next();
  };
router.post(
  "/auth/login",
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        username: z.string().trim().min(3).max(50),
        password: z.string().min(10),
      })
      .safeParse(req.body);
    if (!input.success)
      throw new ApiError(422, "VALIDATION_ERROR", "Check your login details");
    const rows =
      await db()`SELECT id,username,full_name,password_hash,role,active,must_change_password,locked_until FROM staff_profiles WHERE lower(username)=lower(${input.data.username})`;
    const staff = rows[0];
    if (
      !staff ||
      !staff.active ||
      (staff.locked_until &&
        new Date(String(staff.locked_until)) > new Date()) ||
      !(await verifyPassword(input.data.password, String(staff.password_hash)))
    )
      throw new ApiError(
        401,
        "INVALID_CREDENTIALS",
        "Invalid username or password",
      );
    const code =
      env.NODE_ENV === "production"
        ? String(Math.floor(100000 + Math.random() * 900000))
        : "123456";
    const challenge =
      await db()`INSERT INTO staff_login_challenges(staff_id,code_hash,expires_at) VALUES(${staff.id},${hash(code)},now()+interval '5 minutes') RETURNING id`;
    res.json({
      data: {
        challengeId: challenge[0]!.id,
        mustChangePassword: staff.must_change_password,
        ...(env.NODE_ENV !== "production" ? { developmentCode: code } : {}),
      },
    });
  }),
);
router.post(
  "/auth/mfa",
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        challengeId: z.string().uuid(),
        code: z.string().regex(/^\d{6}$/),
      })
      .safeParse(req.body);
    if (!input.success)
      throw new ApiError(422, "VALIDATION_ERROR", "Invalid verification code");
    const rows =
      await db()`SELECT c.*,s.username,s.full_name,s.role,s.active,s.must_change_password FROM staff_login_challenges c JOIN staff_profiles s ON s.id=c.staff_id WHERE c.id=${input.data.challengeId}`;
    const challenge = rows[0];
    if (
      !challenge ||
      !challenge.active ||
      challenge.consumed_at ||
      challenge.attempts >= 5 ||
      new Date(String(challenge.expires_at)) < new Date() ||
      challenge.code_hash !== hash(input.data.code)
    ) {
      if (challenge)
        await db()`UPDATE staff_login_challenges SET attempts=attempts+1 WHERE id=${input.data.challengeId}`;
      throw new ApiError(
        401,
        "INVALID_MFA",
        "Invalid or expired verification code",
      );
    }
    await db()`UPDATE staff_login_challenges SET consumed_at=now() WHERE id=${input.data.challengeId}`;
    const token = randomUUID() + randomUUID();
    await db()`INSERT INTO staff_sessions(staff_id,token_hash,expires_at) VALUES(${challenge.staff_id},${hash(token)},now()+interval '12 hours')`;
    res
      .cookie("staff_session", token, {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 43200000,
        path: "/",
      })
      .json({
        data: {
          staff: {
            id: challenge.staff_id,
            username: challenge.username,
            fullName: challenge.full_name,
            role: challenge.role,
            mustChangePassword: challenge.must_change_password,
          },
        },
      });
  }),
);
router.get(
  "/auth/me",
  requireStaff,
  asyncRoute(async (req, res) => {
    const rows =
      await db()`SELECT id,username,full_name,role,must_change_password FROM staff_profiles WHERE id=${req.staff!.id}`;
    res.json({ data: rows[0] });
  }),
);
router.patch(
  "/auth/profile",
  requireStaff,
  asyncRoute(async (req, res) => {
    const input = z
      .object({ fullName: z.string().trim().min(2).max(100) })
      .strict()
      .safeParse(req.body);
    if (!input.success)
      throw new ApiError(422, "VALIDATION_ERROR", "Enter your name");
    const rows =
      await db()`UPDATE staff_profiles SET full_name=${input.data.fullName} WHERE id=${req.staff!.id} RETURNING id,username,full_name,role,must_change_password`;
    res.json({ data: rows[0] });
  }),
);
router.post(
  "/auth/password",
  requireStaff,
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        currentPassword: z.string().min(1).max(128),
        newPassword: z.string().min(14).max(128),
      })
      .strict()
      .safeParse(req.body);
    if (!input.success)
      throw new ApiError(
        422,
        "VALIDATION_ERROR",
        "Use a new password with 14 to 128 characters",
      );
    const rows =
      await db()`SELECT password_hash FROM staff_profiles WHERE id=${req.staff!.id}`;
    if (
      !rows[0] ||
      !(await verifyPassword(
        input.data.currentPassword,
        String(rows[0].password_hash),
      ))
    )
      throw new ApiError(
        403,
        "INVALID_PASSWORD",
        "Current password is incorrect",
      );
    if (input.data.currentPassword === input.data.newPassword)
      throw new ApiError(
        422,
        "VALIDATION_ERROR",
        "Choose a different new password",
      );
    const passwordHash = await hashPassword(input.data.newPassword);
    const currentToken = hash(cookie(req.headers.cookie, "staff_session")!);
    const changed =
      await db()`WITH changed AS(UPDATE staff_profiles SET password_hash=${passwordHash},must_change_password=false WHERE id=${req.staff!.id} AND password_hash=${String(rows[0].password_hash)} RETURNING id),revoked AS(UPDATE staff_sessions SET revoked_at=now() WHERE staff_id IN(SELECT id FROM changed) AND token_hash!=${currentToken} RETURNING id) SELECT id FROM changed`;
    if (!changed[0])
      throw new ApiError(
        409,
        "STALE_PROFILE",
        "Your password changed in another session. Try again",
      );
    res.json({ data: { updated: true } });
  }),
);
router.post(
  "/auth/logout",
  requireStaff,
  asyncRoute(async (req, res) => {
    const token = cookie(req.headers.cookie, "staff_session")!;
    await db()`UPDATE staff_sessions SET revoked_at=now() WHERE token_hash=${hash(token)}`;
    res.clearCookie("staff_session", { path: "/" }).status(204).end();
  }),
);
router.get(
  "/dashboard/summary",
  requireStaff,
  asyncRoute(async (_req, res) => {
    const rows =
      await db()`SELECT (SELECT count(*)::int FROM customers) AS total_customers,(SELECT count(*)::int FROM service_requests WHERE request_type='SERVICE') AS service_requests,(SELECT count(*)::int FROM service_requests WHERE request_type='INSTALLATION') AS installation_requests,(SELECT count(*)::int FROM service_requests WHERE status NOT IN ('COMPLETED','CANCELLED')) AS pending_requests,(SELECT count(*)::int FROM service_requests WHERE status='COMPLETED') AS completed_requests,(SELECT count(*)::int FROM support_tickets WHERE status='OPEN') AS open_tickets,(SELECT COALESCE(round(avg(rating)::numeric,1),0)::float FROM request_reviews) AS average_rating,(SELECT count(*)::int FROM request_reviews WHERE handling_status='NEW') AS new_feedback,(SELECT count(*)::int FROM service_requests WHERE request_type='SERVICE' AND status='REQUESTED') AS new_service_requests,(SELECT count(*)::int FROM service_requests WHERE request_type='INSTALLATION' AND status='REQUESTED') AS new_installation_requests,(SELECT count(*)::int FROM technicians t JOIN technician_accounts a ON a.technician_id=t.id WHERE t.active AND t.verification_status='VERIFIED' AND a.status='ACTIVE') AS available_technicians,(SELECT count(*)::int FROM service_requests r WHERE r.status IN ('REQUESTED','UNDER_REVIEW','EXECUTIVE_CONTACTED','ASSIGNMENT_PENDING','TECHNICIAN_ASSIGNED') OR EXISTS(SELECT 1 FROM technician_work_reports w WHERE w.request_id=r.id AND w.state='SUBMITTED_FOR_REVIEW')) AS needs_attention`;
    res.json({ data: rows[0] });
  }),
);
router.get(
  "/dashboard/allocation",
  requireStaff,
  asyncRoute(async (_req, res) => {
    const [totals, workload] = await Promise.all([
      db()`SELECT (SELECT count(*)::int FROM service_requests WHERE status NOT IN ('COMPLETED','CANCELLED','ON_HOLD')) AS assignable,(SELECT count(*)::int FROM service_requests r WHERE r.status NOT IN ('COMPLETED','CANCELLED','ON_HOLD') AND r.assigned_technician_id IS NULL AND NOT EXISTS(SELECT 1 FROM technician_assignments a WHERE a.request_id=r.id AND a.state='OFFERED' AND a.expires_at>now())) AS unassigned,(SELECT count(*)::int FROM technician_assignments a JOIN service_requests r ON r.id=a.request_id WHERE a.state='OFFERED' AND a.expires_at>now() AND r.status NOT IN ('COMPLETED','CANCELLED')) AS offered,(SELECT count(*)::int FROM technician_assignments a JOIN service_requests r ON r.id=a.request_id WHERE a.state='ACCEPTED' AND r.status NOT IN ('COMPLETED','CANCELLED')) AS accepted,(SELECT count(*)::int FROM technicians t LEFT JOIN technician_accounts a ON a.technician_id=t.id WHERE t.active AND (t.verification_status!='VERIFIED' OR a.status IS DISTINCT FROM 'ACTIVE')) AS unavailable`,
      db()`SELECT t.id,t.full_name,count(a.id)::int AS jobs FROM technicians t JOIN technician_assignments a ON a.technician_id=t.id JOIN service_requests r ON r.id=a.request_id WHERE t.active AND a.state IN ('OFFERED','ACCEPTED') AND (a.state!='OFFERED' OR a.expires_at>now()) AND r.status NOT IN ('COMPLETED','CANCELLED') GROUP BY t.id ORDER BY count(a.id) DESC,t.full_name LIMIT 6`,
    ]);
    res.json({ data: { ...totals[0], workload } });
  }),
);
router.get(
  "/dashboard/activity",
  requireStaff,
  asyncRoute(async (_req, res) => {
    const [trends, distribution, recent, attention, alerts] = await Promise.all(
      [
        db()`SELECT days.day::date::text AS date,count(r.id) FILTER(WHERE r.request_type='SERVICE')::int AS service,count(r.id) FILTER(WHERE r.request_type='INSTALLATION')::int AS installation FROM generate_series((now() AT TIME ZONE 'Asia/Kolkata')::date-6,(now() AT TIME ZONE 'Asia/Kolkata')::date,interval '1 day') AS days(day) LEFT JOIN service_requests r ON (r.created_at AT TIME ZONE 'Asia/Kolkata')::date=days.day::date GROUP BY days.day ORDER BY days.day`,
        db()`SELECT request_type,count(*)::int AS count FROM service_requests GROUP BY request_type`,
        db()`SELECT r.id,r.request_number,r.appliance,r.status,c.full_name AS customer_name FROM service_requests r JOIN customers c ON c.id=r.customer_id ORDER BY r.created_at DESC LIMIT 5`,
        db()`SELECT r.id,r.request_number,r.appliance,r.status,c.full_name AS customer_name FROM service_requests r JOIN customers c ON c.id=r.customer_id WHERE r.status IN ('REQUESTED','UNDER_REVIEW','EXECUTIVE_CONTACTED','ASSIGNMENT_PENDING','TECHNICIAN_ASSIGNED') OR EXISTS(SELECT 1 FROM technician_work_reports w WHERE w.request_id=r.id AND w.state='SUBMITTED_FOR_REVIEW') ORDER BY r.created_at LIMIT 8`,
        db()`SELECT (SELECT count(*)::int FROM service_requests WHERE assigned_technician_id IS NULL AND status NOT IN ('COMPLETED','CANCELLED')) AS unassigned,(SELECT count(*)::int FROM service_requests WHERE confirmed_date IS NULL AND preferred_date<(now() AT TIME ZONE 'Asia/Kolkata')::date AND status NOT IN ('COMPLETED','CANCELLED')) AS overdue,(SELECT count(*)::int FROM request_reviews WHERE rating<=2 AND handling_status!='RESOLVED') AS negative`,
      ],
    );
    res.json({
      data: { trends, distribution, recent, attention, alerts: alerts[0] },
    });
  }),
);
router.get(
  "/customers",
  requireStaff,
  asyncRoute(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const search =
      typeof req.query.q === "string" ? req.query.q.trim().slice(0, 120) : "";
    const rows =
      await db()`SELECT c.id,c.customer_reference,c.profile_photo_url,c.full_name,c.email,c.phone_e164,c.account_status,c.created_at,c.last_login_at,(SELECT count(*)::int FROM service_requests requests WHERE requests.customer_id=c.id) AS total_requests,COALESCE(string_agg(DISTINCT i.provider, ', ' ORDER BY i.provider),'') AS sign_in_methods,count(*) OVER()::int AS total_count FROM customers c LEFT JOIN customer_auth_identities i ON i.customer_id=c.id WHERE (${search}='' OR c.customer_reference ILIKE '%' || ${search} || '%' OR c.id::text=${search} OR c.full_name ILIKE '%' || ${search} || '%' OR c.email ILIKE '%' || ${search} || '%' OR c.phone_e164 ILIKE '%' || ${search} || '%' OR EXISTS(SELECT 1 FROM service_requests r WHERE r.customer_id=c.id AND r.request_number ILIKE '%' || ${search} || '%')) GROUP BY c.id ORDER BY c.last_login_at DESC NULLS LAST,c.created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    res.json({
      data: rows,
      meta: { page, limit, total: rows[0]?.total_count || 0 },
    });
  }),
);
router.get(
  "/operations",
  requireStaff,
  asyncRoute(async (_req, res) => {
    const totals =
      await db()`SELECT request_type,status,count(*)::int AS count FROM service_requests GROUP BY request_type,status ORDER BY request_type,status`;
    const activity =
      await db()`SELECT a.id,a.action,a.reason,a.created_at,r.request_number,r.id AS request_id,s.full_name AS staff_name FROM audit_logs a LEFT JOIN service_requests r ON r.id::text=a.entity_id LEFT JOIN staff_profiles s ON s.id=a.actor_staff_id WHERE a.entity_type='SERVICE_REQUEST' ORDER BY a.created_at DESC LIMIT 100`;
    res.json({ data: { totals, activity } });
  }),
);
router.get(
  "/requests",
  requireStaff,
  asyncRoute(async (req, res) => {
    const pagination = z
      .object({
        page: z.coerce.number().int().min(1).max(100000).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
      })
      .safeParse(req.query);
    if (!pagination.success)
      throw new ApiError(422, "VALIDATION_ERROR", "Invalid pagination");
    const { page, limit } = pagination.data,
      offset = (page - 1) * limit;
    const search =
      typeof req.query.q === "string" ? req.query.q.trim().slice(0, 120) : "";
    const status = typeof req.query.status === "string" ? req.query.status : "";
    const type =
      req.query.type === "INSTALLATION"
        ? "INSTALLATION"
        : req.query.type === "SERVICE"
          ? "SERVICE"
          : null;
    const filter = z
      .object({
        from: z.string().date().optional(),
        to: z.string().date().optional(),
        technicianId: z.string().uuid().optional(),
        rating: z.coerce.number().int().min(1).max(5).optional(),
        appointments: z.enum(["true"]).optional(),
        assignment: z.enum(["unassigned", "offered", "accepted"]).optional(),
        sort: z
          .enum(["newest", "oldest", "appointment", "status", "customer"])
          .default("newest"),
        group: z
          .enum([
            "PENDING",
            "TECHNICIAN_ASSIGNED",
            "IN_PROGRESS",
            "COMPLETED",
            "CANCELLED",
            "ON_HOLD",
          ])
          .optional(),
        appliance: z.string().trim().max(100).optional(),
      })
      .safeParse(req.query);
    if (!filter.success)
      throw new ApiError(422, "VALIDATION_ERROR", "Check request filters");
    const {
      from,
      to,
      technicianId,
      rating,
      appointments,
      appliance,
      assignment,
      sort,
      group,
    } = filter.data;
    if (from && to && from > to)
      throw new ApiError(
        422,
        "VALIDATION_ERROR",
        "End date must follow the start date",
      );
    const rows =
      await db()`SELECT r.*,(SELECT a.state FROM technician_assignments a WHERE a.request_id=r.id AND a.state IN ('OFFERED','ACCEPTED') LIMIT 1) AS assignment_state,(SELECT t2.full_name FROM technician_assignments a JOIN technicians t2 ON t2.id=a.technician_id WHERE a.request_id=r.id AND a.state='OFFERED' LIMIT 1) AS offered_technician_name,(SELECT COALESCE(actor_technician.full_name,actor_staff.full_name) FROM request_status_events e LEFT JOIN technicians actor_technician ON actor_technician.id=e.actor_technician_id LEFT JOIN staff_profiles actor_staff ON actor_staff.id=e.actor_staff_id WHERE e.request_id=r.id AND e.status='COMPLETED' ORDER BY e.created_at DESC LIMIT 1) AS completion_actor_name,c.customer_reference,t.full_name AS assigned_technician_name,v.rating,v.id AS review_id,p.work_summary,c.full_name AS customer_name,COALESCE(NULLIF(r.address_snapshot->>'phone',''),c.phone_e164) AS customer_phone,count(*) OVER()::int AS total_count FROM service_requests r JOIN customers c ON c.id=r.customer_id LEFT JOIN technicians t ON t.id=r.assigned_technician_id LEFT JOIN request_reviews v ON v.request_id=r.id LEFT JOIN completion_reports p ON p.request_id=r.id WHERE (${group || null}::text IS NULL OR CASE WHEN r.status IN ('REQUESTED','UNDER_REVIEW','EXECUTIVE_CONTACTED','ASSIGNMENT_PENDING') THEN 'PENDING' WHEN r.status IN ('TECHNICIAN_ASSIGNED','APPOINTMENT_CONFIRMED') THEN 'TECHNICIAN_ASSIGNED' WHEN r.status IN ('TECHNICIAN_EN_ROUTE','TECHNICIAN_ARRIVED','IN_PROGRESS','ESTIMATE_PENDING_APPROVAL') THEN 'IN_PROGRESS' ELSE r.status END=${group || null}) AND (${assignment || null}::text IS NULL OR (${assignment || null}='unassigned' AND r.assigned_technician_id IS NULL AND NOT EXISTS(SELECT 1 FROM technician_assignments ax WHERE ax.request_id=r.id AND ax.state='OFFERED' AND ax.expires_at>now())) OR EXISTS(SELECT 1 FROM technician_assignments ax WHERE ax.request_id=r.id AND ax.state=upper(${assignment || null}) AND (ax.state!='OFFERED' OR ax.expires_at>now()))) AND (${appliance || null}::text IS NULL OR r.appliance=${appliance || null}) AND (${from || null}::date IS NULL OR COALESCE(r.completed_at::date,r.confirmed_date,r.preferred_date)>=${from || null}::date) AND (${to || null}::date IS NULL OR COALESCE(r.completed_at::date,r.confirmed_date,r.preferred_date)<=${to || null}::date) AND (${technicianId || null}::uuid IS NULL OR r.assigned_technician_id=${technicianId || null}::uuid OR EXISTS(SELECT 1 FROM technician_assignments af WHERE af.request_id=r.id AND af.technician_id=${technicianId || null}::uuid AND af.state IN ('OFFERED','ACCEPTED') AND (af.state!='OFFERED' OR af.expires_at>now()))) AND (${rating || null}::int IS NULL OR v.rating=${rating || null}::int) AND (${appointments || null}::text IS NULL OR (r.confirmed_date IS NOT NULL AND r.status NOT IN ('COMPLETED','CANCELLED'))) AND (${type}::text IS NULL OR r.request_type=${type}) AND (${status}='' OR r.status=${status}) AND (${search}='' OR r.request_number ILIKE '%' || ${search} || '%' OR lpad(r.display_number::text,greatest(6,length(r.display_number::text)),'0')=${search} OR c.customer_reference ILIKE '%' || ${search} || '%' OR c.id::text=${search} OR c.full_name ILIKE '%' || ${search} || '%') ORDER BY CASE WHEN ${sort}='oldest' THEN r.created_at END ASC,CASE WHEN ${sort}='appointment' THEN COALESCE(r.confirmed_date,r.preferred_date) END ASC NULLS LAST,CASE WHEN ${sort}='status' THEN r.status END ASC,CASE WHEN ${sort}='customer' THEN lower(c.full_name) END ASC,CASE WHEN ${status}='COMPLETED' THEN r.completed_at ELSE r.created_at END DESC NULLS LAST,r.id LIMIT ${limit} OFFSET ${offset}`;
    res.json({
      data: rows,
      meta: { page, limit, total: rows[0]?.total_count || 0 },
    });
  }),
);
router.get(
  "/requests/:id",
  requireStaff,
  asyncRoute(async (req, res) => {
    const rows =
      await db()`SELECT r.*,(SELECT a.state FROM technician_assignments a WHERE a.request_id=r.id AND a.state IN ('OFFERED','ACCEPTED') LIMIT 1) AS assignment_state,(SELECT t2.full_name FROM technician_assignments a JOIN technicians t2 ON t2.id=a.technician_id WHERE a.request_id=r.id AND a.state='OFFERED' LIMIT 1) AS offered_technician_name,(SELECT w.id FROM technician_work_reports w WHERE w.request_id=r.id AND w.state='SUBMITTED_FOR_REVIEW' ORDER BY w.version DESC LIMIT 1) AS pending_report_id,(SELECT v.id FROM request_reviews v WHERE v.request_id=r.id) AS review_id,p.work_summary,p.completion_notes,COALESCE(completed_staff.full_name,completed_technician.full_name) AS completed_by_name,c.customer_reference,c.full_name AS customer_name,COALESCE(NULLIF(r.address_snapshot->>'phone',''),c.phone_e164) AS customer_phone,c.email AS customer_email,t.full_name AS assigned_technician_name,t.phone AS assigned_technician_phone FROM service_requests r JOIN customers c ON c.id=r.customer_id LEFT JOIN technicians t ON t.id=r.assigned_technician_id LEFT JOIN completion_reports p ON p.request_id=r.id LEFT JOIN staff_profiles completed_staff ON completed_staff.id=p.completed_by LEFT JOIN technicians completed_technician ON completed_technician.id=p.completed_by_technician_id WHERE r.id=${req.params.id}`;
    if (!rows[0]) throw new ApiError(404, "NOT_FOUND", "Request not found");
    const timeline =
      await db()`SELECT e.id,e.status,e.previous_status,e.note,e.actor_staff_id,e.actor_technician_id,e.actor_role,staff.full_name AS actor_staff_name,technician.full_name AS actor_technician_name,e.created_at FROM request_status_events e LEFT JOIN staff_profiles staff ON staff.id=e.actor_staff_id LEFT JOIN technicians technician ON technician.id=e.actor_technician_id WHERE e.request_id=${req.params.id} ORDER BY e.created_at`;
    const tickets =
      await db()`SELECT id,ticket_number,subject,status FROM support_tickets WHERE request_id=${req.params.id} ORDER BY created_at DESC`;
    const reports =
      await db()`SELECT w.*,t.full_name AS technician_name,reviewer.full_name AS reviewed_by_technician_name FROM technician_work_reports w JOIN technicians t ON t.id=w.technician_id LEFT JOIN technicians reviewer ON reviewer.id=w.reviewed_by_technician_id WHERE w.request_id=${req.params.id} ORDER BY w.version DESC`;
    res.json({
      data: {
        ...rows[0],
        timeline,
        support_tickets: tickets,
        work_reports: reports,
      },
    });
  }),
);
router.post(
  "/requests/:id/complete",
  requireStaff,
  allow("SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER"),
  asyncRoute(async (req, res) => {
    if (!z.string().uuid().safeParse(req.params.id).success)
      throw new ApiError(422, "VALIDATION_ERROR", "Invalid request ID");
    const input = z
      .object({
        workSummary: z.string().trim().min(3).max(2000),
        completionNotes: z.string().trim().max(4000).default(""),
        attachmentIds: z
          .array(z.string().uuid())
          .max(0, "Completion uploads are not available yet")
          .default([]),
        version: z.number().int().positive().optional(),
      })
      .strict()
      .safeParse(req.body);
    if (!input.success)
      throw new ApiError(
        422,
        "VALIDATION_ERROR",
        input.error.issues[0]?.message || "Check completion details",
      );
    const rows =
      await db()`SELECT * FROM service_requests WHERE id=${req.params.id}`;
    const current = rows[0];
    if (!current) throw new ApiError(404, "NOT_FOUND", "Request not found");
    if (current.status === "COMPLETED") {
      res.json({ data: current, alreadyCompleted: true });
      return;
    }
    if (
      !["SERVICE", "INSTALLATION"].includes(String(current.request_type)) ||
      !["TECHNICIAN_ASSIGNED", "APPOINTMENT_CONFIRMED", "IN_PROGRESS"].includes(
        String(current.status),
      )
    )
      throw new ApiError(
        409,
        "INVALID_TRANSITION",
        "Only work in progress can be completed. Resolve pending estimates first.",
      );
    if (!current.assigned_technician_id)
      throw new ApiError(
        409,
        "TECHNICIAN_REQUIRED",
        "Assign a technician before completing this request",
      );
    if (
      input.data.version !== undefined &&
      Number(current.version) !== input.data.version
    )
      throw new ApiError(
        409,
        "STALE_REQUEST",
        "This request was updated. Refresh before completing it.",
      );
    const updated = await completeRequest(
      String(req.params.id),
      Number(current.version),
      req.staff!,
      input.data.workSummary,
      input.data.completionNotes,
    );
    if (!updated[0]) {
      const latest =
        await db()`SELECT * FROM service_requests WHERE id=${req.params.id}`;
      if (latest[0]?.status === "COMPLETED") {
        res.json({ data: latest[0], alreadyCompleted: true });
        return;
      }
      throw new ApiError(
        409,
        "STALE_REQUEST",
        "This request was updated. Refresh before completing it.",
      );
    }
    res.json({ data: updated[0] });
  }),
);
const transitions = requestTransitions;
router.post(
  ["/requests/:id/status", "/requests/:id/contacted"],
  requireStaff,
  allow("SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER"),
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        status: z.string(),
        note: z.string().trim().min(3).max(300),
        version: z.number().int().positive(),
        technicianId: z.string().uuid().optional(),
        confirmedDate: bookingSchema.shape.preferredDate.optional(),
        confirmedTimeWindow: z
          .string()
          .regex(/^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/)
          .optional(),
      })
      .safeParse({
        ...req.body,
        ...(req.path.endsWith("/complete")
          ? { status: "COMPLETED" }
          : req.path.endsWith("/contacted")
            ? { status: "EXECUTIVE_CONTACTED" }
            : {}),
      });
    if (!input.success)
      throw new ApiError(422, "VALIDATION_ERROR", "Check the status update");
    if (input.data.status === "COMPLETED")
      throw new ApiError(
        422,
        "COMPLETION_REPORT_REQUIRED",
        "Use the completion form to record the work completed",
      );
    const current =
      await db()`SELECT * FROM service_requests WHERE id=${req.params.id}`;
    if (!current[0]) throw new ApiError(404, "NOT_FOUND", "Request not found");
    const rescheduling =
      current[0].status === "APPOINTMENT_CONFIRMED" &&
      input.data.status === "APPOINTMENT_CONFIRMED" &&
      input.data.confirmedDate &&
      input.data.confirmedTimeWindow &&
      (input.data.confirmedDate !== current[0].confirmed_date ||
        input.data.confirmedTimeWindow !== current[0].confirmed_time_window);
    if (current[0].status === input.data.status && !rescheduling) {
      res.json({ data: current[0], alreadyProcessed: true });
      return;
    }
    if (Number(current[0].version) !== input.data.version)
      throw new ApiError(
        409,
        "STALE_REQUEST",
        "This request was updated by another user",
      );
    if (
      !rescheduling &&
      !transitions[String(current[0].status)]?.includes(input.data.status)
    )
      throw new ApiError(
        409,
        "INVALID_TRANSITION",
        "This status change is not allowed",
      );
    if (input.data.status === "TECHNICIAN_ASSIGNED") {
      const managed =
        await db()`SELECT technician_id FROM technician_accounts WHERE technician_id=${input.data.technicianId || null}::uuid`;
      if (managed.length)
        throw new ApiError(
          422,
          "OFFER_REQUIRED",
          "Send an assignment offer. The technician must accept before appointment confirmation.",
        );

      if (!input.data.technicianId)
        throw new ApiError(
          422,
          "TECHNICIAN_REQUIRED",
          "Choose a technician before assigning the request",
        );
      const technician =
        await db()`SELECT id FROM technicians WHERE id=${input.data.technicianId} AND active=true`;
      if (!technician[0])
        throw new ApiError(
          422,
          "INVALID_TECHNICIAN",
          "Choose an active technician",
        );
    }
    if (
      input.data.status === "APPOINTMENT_CONFIRMED" &&
      (!current[0].assigned_technician_id ||
        !input.data.confirmedDate ||
        !input.data.confirmedTimeWindow)
    )
      throw new ApiError(
        422,
        "APPOINTMENT_REQUIRED",
        "Assign a technician and enter the confirmed visit date and window",
      );
    if (input.data.status === "APPOINTMENT_CONFIRMED") {
      await checkTechnicianSchedule(
        String(current[0].assigned_technician_id),
        String(req.params.id),
        input.data.confirmedDate!,
        input.data.confirmedTimeWindow!,
      );
      const window = input.data.confirmedTimeWindow!;
      if (window.slice(0, 5) >= window.slice(6))
        throw new ApiError(
          422,
          "VALIDATION_ERROR",
          "Appointment end must follow its start",
        );
      const unknown =
        await db()`SELECT id FROM service_requests WHERE assigned_technician_id=${current[0].assigned_technician_id} AND confirmed_date=${input.data.confirmedDate}::date AND status NOT IN ('COMPLETED','CANCELLED') AND confirmed_time_window IS NOT NULL AND appointment_start_minute IS NULL AND id!=${req.params.id} LIMIT 1`;
      if (unknown.length)
        throw new ApiError(
          409,
          "APPOINTMENT_CONFLICT",
          "Review this technician's existing schedule before confirming another visit",
        );
    }
    const updated =
      await db()`WITH changed AS (UPDATE service_requests SET status_source='WORKFLOW',status=${input.data.status},assigned_technician_id=COALESCE(${input.data.status === "TECHNICIAN_ASSIGNED" ? input.data.technicianId || null : null}::uuid,assigned_technician_id),confirmed_date=COALESCE(${input.data.status === "APPOINTMENT_CONFIRMED" ? input.data.confirmedDate || null : null}::date,confirmed_date),confirmed_time_window=COALESCE(${input.data.status === "APPOINTMENT_CONFIRMED" ? input.data.confirmedTimeWindow || null : null},confirmed_time_window),completed_at=CASE WHEN ${input.data.status}='COMPLETED' THEN now() ELSE completed_at END,version=version+1,updated_at=now() WHERE id=${req.params.id} AND version=${input.data.version} RETURNING *),tech_notice AS (INSERT INTO technician_notifications(technician_id,request_id,event_key,title,message) SELECT a.technician_id,c.id,'booking:'||c.id||':'||c.version,'Visit update',${input.data.status.replaceAll("_", " ")} FROM changed c JOIN technician_assignments a ON a.request_id=c.id AND a.state IN ('OFFERED','ACCEPTED') ON CONFLICT(event_key) DO NOTHING RETURNING id),cancelled_assignment AS (UPDATE technician_assignments SET state='CANCELLED',reason=${input.data.note},version=version+1 WHERE request_id IN (SELECT id FROM changed WHERE status='CANCELLED') AND state IN ('OFFERED','ACCEPTED') RETURNING id),event AS (INSERT INTO request_status_events(request_id,status,note,actor_staff_id,actor_role) SELECT id,status,${input.data.note},${req.staff!.id},${req.staff!.role} FROM changed RETURNING id),notification AS (INSERT INTO customer_notifications(customer_id,request_id,kind,title,message) SELECT customer_id,id,'COMPLETION','Service completed','Your request is complete. Share your experience when you are ready.' FROM changed WHERE status='COMPLETED' ON CONFLICT(request_id,kind) DO NOTHING RETURNING id),audit AS (INSERT INTO audit_logs(actor_staff_id,actor_role,action,entity_type,entity_id,previous_value,new_value,reason) SELECT ${req.staff!.id},${req.staff!.role},'REQUEST_STATUS_UPDATED','SERVICE_REQUEST',id,${JSON.stringify({ status: current[0].status })}::jsonb,jsonb_build_object('status',status,'version',version,'technicianId',assigned_technician_id,'confirmedDate',confirmed_date,'confirmedTimeWindow',confirmed_time_window),${input.data.note} FROM changed RETURNING entity_id) SELECT * FROM changed`;
    if (!updated[0])
      throw new ApiError(
        409,
        "STALE_REQUEST",
        "This request was updated by another user",
      );
    res.json({ data: updated[0] });
  }),
);
router.get(
  "/customers/:id",
  requireStaff,
  asyncRoute(async (req, res) => {
    if (!z.string().uuid().safeParse(req.params.id).success)
      throw new ApiError(422, "VALIDATION_ERROR", "Invalid customer ID");
    const customer =
      await db()`SELECT id,customer_reference,profile_photo_url,full_name,email,phone_e164,account_status,created_at,last_login_at FROM customers WHERE id=${req.params.id}`;
    if (!customer[0])
      throw new ApiError(404, "NOT_FOUND", "Customer not found");
    const addresses =
      await db()`SELECT id,label,recipient_name,phone,line1,area,landmark,city,state,pin_code,is_default FROM customer_addresses WHERE customer_id=${req.params.id} ORDER BY is_default DESC,created_at DESC`;
    const requests =
      await db()`SELECT id,request_number,request_type,appliance,service_name,status,preferred_date,preferred_time_window,created_at FROM service_requests WHERE customer_id=${req.params.id} ORDER BY created_at DESC`;
    const tickets =
      await db()`SELECT id,ticket_number,subject,message,status,created_at FROM support_tickets WHERE customer_id=${req.params.id} ORDER BY created_at DESC`;
    const reviews =
      await db()`SELECT id,request_id,rating,comment,handling_status,created_at FROM request_reviews WHERE customer_id=${req.params.id} ORDER BY created_at DESC`;
    res.json({
      data: { ...customer[0], addresses, requests, tickets, reviews },
    });
  }),
);
const manageCatalogue = allow("SUPER_ADMIN", "ADMIN");
const serviceBody = z.object({
  applianceCategoryId: z.string().uuid(),
  requestType: z.enum(["SERVICE", "INSTALLATION"]),
  name: z.string().trim().min(2).max(120),
  formFields: serviceFormSchema.default([]),
  basePrice: z.number().min(0).max(10000000).nullable().optional(),
  description: z.string().trim().max(1500).optional(),
  displayOrder: z.number().int().min(0).max(10000).optional(),
  publicationStatus: z.enum(["DRAFT", "PUBLISHED"]).optional(),
  options: catalogueOptionsSchema.optional(),
  iconObjectKey: z.string().max(160).nullable().optional(),
});
router.get(
  "/catalogue",
  requireStaff,
  asyncRoute(async (_req, res) => {
    const categories =
      await db()`SELECT a.id,a.slug,a.name,a.icon_object_key,a.publication_status,(SELECT '/api/v1/admin/catalogue/media/'||m.id::text FROM catalogue_media m WHERE m.object_key=a.icon_object_key) AS icon_preview_url FROM appliance_categories a WHERE a.active=true ORDER BY a.name`;
    const services =
      await db()`SELECT s.*,(SELECT '/api/v1/catalogue/media/'||m.id::text FROM catalogue_media m WHERE m.object_key=s.icon_object_key) AS icon_url,(SELECT '/api/v1/admin/catalogue/media/'||m.id::text FROM catalogue_media m WHERE m.object_key=s.icon_object_key) AS icon_preview_url,a.name AS appliance_name FROM service_catalogue s JOIN appliance_categories a ON a.id=s.appliance_category_id WHERE s.active=true AND a.active=true ORDER BY s.display_order,a.name,s.name`;
    res.json({ data: { categories, services } });
  }),
);
router.post(
  "/catalogue/services",
  requireStaff,
  manageCatalogue,
  asyncRoute(async (req, res) => {
    const input = serviceBody.safeParse(req.body);
    if (!input.success)
      throw new ApiError(
        422,
        "VALIDATION_ERROR",
        input.error.issues[0]?.message || "Check service details",
      );
    const s = input.data;
    if (
      s.publicationStatus === "PUBLISHED" &&
      s.options === undefined &&
      req.params.id
    ) {
      const previous =
        await db()`SELECT booking_options FROM service_catalogue WHERE id=${req.params.id}`;
      if (
        !previous[0] ||
        !catalogueOptionsSchema
          .parse(previous[0].booking_options)
          .some((o) => o.active)
      )
        throw new ApiError(
          422,
          "INCOMPLETE_SERVICE",
          "Add an active priced or quote-based option before publishing.",
        );
    }
    if (s.iconObjectKey) {
      const media =
        await db()`SELECT id FROM catalogue_media WHERE object_key=${s.iconObjectKey}`;
      if (!media.length)
        throw new ApiError(
          422,
          "INVALID_ICON",
          "Upload and select an approved icon.",
        );
    }
    if (
      s.publicationStatus === "PUBLISHED" &&
      s.options &&
      !s.options.some((o) => o.active)
    )
      throw new ApiError(
        422,
        "INCOMPLETE_SERVICE",
        "Add at least one active booking option before publishing.",
      );
    const categories =
      await db()`SELECT id FROM appliance_categories WHERE id=${s.applianceCategoryId} AND active=true`;
    if (!categories[0])
      throw new ApiError(
        422,
        "INVALID_CATEGORY",
        "Choose an available appliance",
      );
    const rows =
      await db()`INSERT INTO service_catalogue(appliance_category_id,request_type,slug,name,form_fields,base_price,description,display_order,publication_status,booking_options,icon_object_key) VALUES(${s.applianceCategoryId},${s.requestType},${randomUUID()},${s.name},${JSON.stringify(s.formFields)}::jsonb,${s.basePrice ?? null},${s.description || ""},${s.displayOrder || 0},${s.publicationStatus || "PUBLISHED"},${JSON.stringify(s.options || [])}::jsonb,${s.iconObjectKey || null}) RETURNING *`;
    res.status(201).json({ data: rows[0] });
  }),
);
router.patch(
  "/catalogue/services/:id/icon",
  requireStaff,
  manageCatalogue,
  asyncRoute(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const { iconObjectKey } = z
      .object({
        iconObjectKey: z.string().min(1).max(160).nullable(),
      })
      .strict()
      .parse(req.body);
    if (iconObjectKey) {
      const media =
        await db()`SELECT id FROM catalogue_media WHERE object_key=${iconObjectKey}`;
      if (!media.length)
        throw new ApiError(
          422,
          "INVALID_ICON",
          "Upload and select an approved icon.",
        );
    }
    const rows =
      await db()`UPDATE service_catalogue SET icon_object_key=${iconObjectKey} WHERE id=${id} AND active=true RETURNING id,icon_object_key`;
    if (!rows[0]) throw new ApiError(404, "NOT_FOUND", "Service not found.");
    res.json({ data: rows[0] });
  }),
);
router.patch(
  "/catalogue/services/:id",
  requireStaff,
  manageCatalogue,
  asyncRoute(async (req, res) => {
    const input = serviceBody.safeParse(req.body);
    if (!input.success)
      throw new ApiError(
        422,
        "VALIDATION_ERROR",
        input.error.issues[0]?.message || "Check service details",
      );
    const s = input.data;
    if (
      s.publicationStatus === "PUBLISHED" &&
      s.options === undefined &&
      req.params.id
    ) {
      const previous =
        await db()`SELECT booking_options FROM service_catalogue WHERE id=${req.params.id}`;
      if (
        !previous[0] ||
        !catalogueOptionsSchema
          .parse(previous[0].booking_options)
          .some((o) => o.active)
      )
        throw new ApiError(
          422,
          "INCOMPLETE_SERVICE",
          "Add an active priced or quote-based option before publishing.",
        );
    }
    if (s.iconObjectKey) {
      const media =
        await db()`SELECT id FROM catalogue_media WHERE object_key=${s.iconObjectKey}`;
      if (!media.length)
        throw new ApiError(
          422,
          "INVALID_ICON",
          "Upload and select an approved icon.",
        );
    }
    if (
      s.publicationStatus === "PUBLISHED" &&
      s.options &&
      !s.options.some((o) => o.active)
    )
      throw new ApiError(
        422,
        "INCOMPLETE_SERVICE",
        "Add at least one active booking option before publishing.",
      );
    const categories =
      await db()`SELECT id FROM appliance_categories WHERE id=${s.applianceCategoryId} AND active=true`;
    if (!categories[0])
      throw new ApiError(
        422,
        "INVALID_CATEGORY",
        "Choose an available appliance",
      );
    const rows =
      await db()`UPDATE service_catalogue SET appliance_category_id=${s.applianceCategoryId},request_type=${s.requestType},name=${s.name},description=COALESCE(${s.description ?? null},description),display_order=COALESCE(${s.displayOrder ?? null}::int,display_order),publication_status=COALESCE(${s.publicationStatus ?? null},publication_status),booking_options=CASE WHEN ${s.options !== undefined} THEN ${JSON.stringify(s.options || [])}::jsonb ELSE booking_options END,icon_object_key=CASE WHEN ${s.iconObjectKey !== undefined} THEN ${s.iconObjectKey || null} ELSE icon_object_key END,form_fields=${JSON.stringify(s.formFields)}::jsonb,base_price=CASE WHEN ${s.basePrice !== undefined} THEN ${s.basePrice ?? null}::numeric ELSE base_price END WHERE id=${req.params.id} AND active=true RETURNING *`;
    if (!rows[0]) throw new ApiError(404, "NOT_FOUND", "Service not found");
    res.json({ data: rows[0] });
  }),
);
router.delete(
  "/catalogue/services/:id",
  requireStaff,
  manageCatalogue,
  asyncRoute(async (req, res) => {
    const rows =
      await db()`UPDATE service_catalogue SET active=false WHERE id=${req.params.id} AND active=true RETURNING id`;
    if (!rows[0]) throw new ApiError(404, "NOT_FOUND", "Service not found");
    res.status(204).end();
  }),
);
router.get(
  "/technicians",
  requireStaff,
  asyncRoute(async (_req, res) => {
    const rows =
      await db()`SELECT t.id,t.full_name,t.phone,t.service_area,t.verification_status,(SELECT a.username FROM technician_accounts a WHERE a.technician_id=t.id) AS username,(SELECT a.status FROM technician_accounts a WHERE a.technician_id=t.id) AS account_status,(SELECT count(*)::int FROM service_requests r WHERE r.assigned_technician_id=t.id AND r.status NOT IN ('COMPLETED','CANCELLED')) AS assigned_requests FROM technicians t WHERE active=true ORDER BY full_name`;
    res.json({ data: rows });
  }),
);
const technicianBody = z
  .object({
    fullName: z.string().trim().min(2).max(100),
    phone: mobile,
    serviceArea: z.string().trim().max(300).default(""),
    verificationStatus: z
      .enum(["VERIFIED", "UNVERIFIED"])
      .default("UNVERIFIED"),
  })
  .strict();
router.post(
  "/technicians",
  requireStaff,
  allow("SUPER_ADMIN", "ADMIN"),
  asyncRoute(async (req, res) => {
    const input = technicianBody
      .extend({
        username: technicianUsernameSchema.optional(),
        temporaryPassword: temporaryPasswordSchema.optional(),
        email: z.string().trim().email().max(254).optional(),
      })
      .superRefine((value, context) => {
        if (!!value.username !== !!value.temporaryPassword)
          context.addIssue({
            code: "custom",
            message: "Provide both a username and a temporary password.",
          });
      })
      .safeParse(req.body);
    if (!input.success)
      throw new ApiError(
        422,
        "VALIDATION_ERROR",
        input.error.issues[0]?.message ||
          "Check the technician name, mobile and details",
      );
    const t = input.data;
    const encodedPassword = t.temporaryPassword
      ? await hashPassword(t.temporaryPassword)
      : null;
    const rows =
      await db()`INSERT INTO technicians(full_name,phone,service_area,verification_status) VALUES(${t.fullName},${t.phone},${t.serviceArea},${t.verificationStatus}) RETURNING id,full_name,phone,service_area,verification_status`;
    if (t.username && encodedPassword) {
      const account =
        await db()`INSERT INTO technician_accounts(technician_id,username,email,password_hash,status,must_change_password) VALUES(${rows[0]!.id},${t.username},${t.email || null},${encodedPassword},'ACTIVE',true) ON CONFLICT DO NOTHING RETURNING technician_id`;
      if (!account.length)
        throw new ApiError(
          409,
          "USERNAME_UNAVAILABLE",
          "Username or email is already in use. Choose another username or email.",
        );
    }
    res.status(201).json({ data: rows[0] });
  }),
);
router.patch(
  "/technicians/:id",
  requireStaff,
  allow("SUPER_ADMIN", "ADMIN"),
  asyncRoute(async (req, res) => {
    const input = technicianBody.safeParse(req.body);
    if (!input.success)
      throw new ApiError(422, "VALIDATION_ERROR", "Check technician details");
    const t = input.data;
    const rows =
      await db()`UPDATE technicians SET full_name=${t.fullName},phone=${t.phone},service_area=${t.serviceArea},verification_status=${t.verificationStatus} WHERE id=${req.params.id} AND active=true RETURNING id,full_name,phone,service_area,verification_status`;
    if (!rows[0]) throw new ApiError(404, "NOT_FOUND", "Technician not found");
    res.json({ data: rows[0] });
  }),
);
router.delete(
  "/technicians/:id",
  requireStaff,
  allow("SUPER_ADMIN", "ADMIN"),
  asyncRoute(async (req, res) => {
    await db()`SELECT pg_advisory_xact_lock(hashtextextended(${"technician-account:" + req.params.id},0))`;
    const rows =
      await db()`WITH archived AS (UPDATE technicians t SET active=false WHERE id=${req.params.id} AND active=true AND NOT EXISTS(SELECT 1 FROM service_requests r WHERE r.assigned_technician_id=t.id AND r.status NOT IN ('COMPLETED','CANCELLED')) AND NOT EXISTS(SELECT 1 FROM technician_assignments a JOIN service_requests r ON r.id=a.request_id WHERE a.technician_id=t.id AND a.state IN ('OFFERED','ACCEPTED') AND (a.state!='OFFERED' OR a.expires_at>now()) AND r.status NOT IN ('COMPLETED','CANCELLED')) RETURNING id),account AS (UPDATE technician_accounts SET status='SUSPENDED' WHERE technician_id IN(SELECT id FROM archived) RETURNING technician_id),sessions AS(UPDATE technician_sessions SET revoked_at=now() WHERE technician_id IN(SELECT id FROM archived) RETURNING id) SELECT id FROM archived`;
    if (!rows[0])
      throw new ApiError(
        409,
        "ACTIVE_JOBS",
        "Reassign or resolve current jobs before removing this technician. The account may already be archived.",
      );
    res.status(204).end();
  }),
);
export { router as adminRoutes };
