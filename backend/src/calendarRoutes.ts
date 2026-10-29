import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { db } from "./db.js";
import { ApiError } from "./customerRoutes.js";
import { requireStaff, allow } from "./adminRoutes.js";
import { requireTechnician } from "./technicianRoutes.js";
import { bookingSchema } from "./validation.js";
import { checkTechnicianSchedule } from "./technicianScheduling.js";
const route =
  (fn: RequestHandler): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch((error) =>
      next(
        error instanceof z.ZodError
          ? new ApiError(
              422,
              "VALIDATION_ERROR",
              error.issues[0]?.message || "Check appointment details.",
            )
          : error,
      ),
    );
const windowSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/)
  .refine(
    (v) => v.slice(0, 5) < v.slice(6),
    "End time must follow start time.",
  );
const rangeSchema = z
  .object({ from: z.string().date(), to: z.string().date() })
  .refine(
    (v) =>
      v.to > v.from &&
      new Date(v.to).getTime() - new Date(v.from).getTime() <= 93 * 86400000,
    "Choose a calendar range of up to 93 days.",
  );
export const adminCalendarRoutes = Router(),
  technicianCalendarRoutes = Router();
adminCalendarRoutes.get(
  "/appointments",
  requireStaff,
  route(async (req, res) => {
    const { from, to } = rangeSchema.parse(req.query);
    const rows =
      await db()`SELECT r.id,r.display_number,r.request_number,r.request_type,r.appliance,r.service_name,r.status,r.version,r.confirmed_date,r.confirmed_time_window,r.address_snapshot,c.full_name AS customer_name,COALESCE(NULLIF(r.address_snapshot->>'phone',''),c.phone_e164) AS customer_phone,t.full_name AS technician_name,r.assigned_technician_id FROM service_requests r JOIN customers c ON c.id=r.customer_id LEFT JOIN technicians t ON t.id=r.assigned_technician_id WHERE r.confirmed_date>=${from}::date AND r.confirmed_date<${to}::date AND r.status!='CANCELLED' ORDER BY r.confirmed_date,r.confirmed_time_window,r.id LIMIT 1001`;
    res.json({
      data: rows.slice(0, 1000),
      meta: { truncated: rows.length > 1000 },
    });
  }),
);
technicianCalendarRoutes.get(
  "/schedule",
  requireTechnician,
  route(async (req, res) => {
    const { from, to } = rangeSchema.parse(req.query);
    const rows =
      await db()`SELECT r.id,r.display_number,r.request_number,r.request_type,r.appliance,r.service_name,r.status,r.version,r.confirmed_date,r.confirmed_time_window,r.address_snapshot,c.full_name AS customer_name,COALESCE(NULLIF(r.address_snapshot->>'phone',''),c.phone_e164) AS customer_phone,t.full_name AS technician_name,r.assigned_technician_id FROM service_requests r JOIN technician_assignments a ON a.request_id=r.id AND a.technician_id=r.assigned_technician_id AND a.state='ACCEPTED' JOIN customers c ON c.id=r.customer_id JOIN technicians t ON t.id=a.technician_id WHERE a.technician_id=${req.technician!.id} AND r.confirmed_date>=${from}::date AND r.confirmed_date<${to}::date AND r.status!='CANCELLED' ORDER BY r.confirmed_date,r.confirmed_time_window,r.id LIMIT 1001`;
    res.json({
      data: rows.slice(0, 1000),
      meta: { truncated: rows.length > 1000 },
    });
  }),
);
technicianCalendarRoutes.post(
  "/jobs/:id/reschedule",
  requireTechnician,
  route(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id),
      i = z
        .object({
          date: bookingSchema.shape.preferredDate,
          timeWindow: windowSchema,
          reason: z.string().trim().max(1000).default(""),
          version: z.number().int().positive(),
        })
        .strict()
        .parse(req.body);
    const jobs =
      await db()`SELECT r.* FROM service_requests r JOIN technician_assignments a ON a.request_id=r.id AND a.technician_id=r.assigned_technician_id AND a.state='ACCEPTED' WHERE r.id=${id} AND a.technician_id=${req.technician!.id} FOR UPDATE OF r`;
    const job = jobs[0];
    if (!job) throw new ApiError(404, "NOT_FOUND", "Job not found.");
    if (
      !["TECHNICIAN_ASSIGNED", "APPOINTMENT_CONFIRMED"].includes(
        String(job.status),
      ) ||
      Number(job.version) !== i.version
    )
      throw new ApiError(
        409,
        "STALE_WORKFLOW",
        "Refresh this job before requesting a schedule change.",
      );
    if (
      String(job.confirmed_date).slice(0, 10) === i.date &&
      job.confirmed_time_window === i.timeWindow
    )
      throw new ApiError(
        422,
        "UNCHANGED_SCHEDULE",
        "Choose a different appointment time.",
      );
    await checkTechnicianSchedule(req.technician!.id, id, i.date, i.timeWindow);
    const rows =
      await db()`WITH proposal AS(INSERT INTO appointment_reschedule_requests(request_id,technician_id,proposed_date,proposed_time_window,reason) VALUES(${id},${req.technician!.id},${i.date}::date,${i.timeWindow},${i.reason}) ON CONFLICT(request_id) WHERE state='PENDING' DO NOTHING RETURNING *),history AS(INSERT INTO request_status_events(request_id,status,note,actor_role,actor_technician_id) SELECT request_id,${job.status},${`Technician proposed ${i.date} ${i.timeWindow}. Awaiting operations approval.`},'TECHNICIAN',technician_id FROM proposal RETURNING id) SELECT * FROM proposal`;
    if (!rows[0]) {
      const previous =
        await db()`SELECT * FROM appointment_reschedule_requests WHERE request_id=${id} AND state='PENDING'`;
      if (
        previous[0]?.technician_id === req.technician!.id &&
        String(previous[0]?.proposed_date).slice(0, 10) === i.date &&
        previous[0]?.proposed_time_window === i.timeWindow &&
        previous[0]?.reason === i.reason
      ) {
        res.json({ data: previous[0], alreadyProcessed: true });
        return;
      }
      throw new ApiError(
        409,
        "PENDING_RESCHEDULE",
        "Operations is already reviewing a schedule proposal for this job.",
      );
    }
    res.status(201).json({ data: rows[0] });
  }),
);
technicianCalendarRoutes.get(
  "/jobs/:id/reschedules",
  requireTechnician,
  route(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const owned =
      await db()`SELECT r.id FROM service_requests r JOIN technician_assignments a ON a.request_id=r.id AND a.technician_id=r.assigned_technician_id WHERE r.id=${id} AND a.state='ACCEPTED' AND a.technician_id=${req.technician!.id}`;
    if (!owned.length) throw new ApiError(404, "NOT_FOUND", "Job not found.");
    const rows =
      await db()`SELECT id,state,proposed_date,proposed_time_window,reason,decision_reason,requested_at,decided_at FROM appointment_reschedule_requests WHERE request_id=${id} AND technician_id=${req.technician!.id} ORDER BY requested_at DESC LIMIT 20`;
    res.json({ data: rows });
  }),
);
adminCalendarRoutes.get(
  "/appointment-reschedules",
  requireStaff,
  route(async (req, res) => {
    const state = z
      .enum(["PENDING", "APPROVED", "REJECTED", "ALL"])
      .default("PENDING")
      .parse(req.query.state);
    const rows =
      await db()`SELECT p.*,r.display_number,r.request_number,r.appliance,r.confirmed_date,r.confirmed_time_window,r.version AS request_version,r.status AS request_status,t.full_name AS technician_name,c.full_name AS customer_name FROM appointment_reschedule_requests p JOIN service_requests r ON r.id=p.request_id JOIN technicians t ON t.id=p.technician_id JOIN customers c ON c.id=r.customer_id WHERE (${state}='ALL' OR p.state=${state}) ORDER BY p.requested_at DESC LIMIT 100`;
    res.json({ data: rows });
  }),
);
adminCalendarRoutes.post(
  "/appointment-reschedules/:id/decision",
  requireStaff,
  allow("SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER"),
  route(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id),
      i = z
        .object({
          decision: z.enum(["APPROVED", "REJECTED"]),
          version: z.number().int().positive(),
          requestVersion: z.number().int().positive(),
          reason: z.string().trim().max(1000).default(""),
        })
        .strict()
        .parse(req.body);
    const rows =
        await db()`SELECT p.*,r.version AS request_version,r.status AS request_status,r.assigned_technician_id,r.customer_id FROM appointment_reschedule_requests p JOIN service_requests r ON r.id=p.request_id WHERE p.id=${id} FOR UPDATE OF p,r`,
      p = rows[0];
    if (!p)
      throw new ApiError(404, "NOT_FOUND", "Schedule proposal not found.");
    if (p.state === i.decision) {
      res.json({ data: p, alreadyProcessed: true });
      return;
    }
    if (
      p.state !== "PENDING" ||
      Number(p.version) !== i.version ||
      Number(p.request_version) !== i.requestVersion
    )
      throw new ApiError(
        409,
        "STALE_WORKFLOW",
        "The appointment changed. Refresh before making a decision.",
      );
    if (i.decision === "APPROVED") {
      if (
        !["TECHNICIAN_ASSIGNED", "APPOINTMENT_CONFIRMED"].includes(
          String(p.request_status),
        ) ||
        p.assigned_technician_id !== p.technician_id
      )
        throw new ApiError(
          409,
          "ASSIGNMENT_CHANGED",
          "The assignment changed. Reject this proposal and review the current job.",
        );
      const date = bookingSchema.shape.preferredDate.parse(
        String(p.proposed_date).slice(0, 10),
      );
      await checkTechnicianSchedule(
        String(p.technician_id),
        String(p.request_id),
        date,
        String(p.proposed_time_window),
      );
      const accepted =
        await db()`SELECT id FROM technician_assignments WHERE request_id=${p.request_id} AND technician_id=${p.technician_id} AND state='ACCEPTED'`;
      if (!accepted.length)
        throw new ApiError(
          409,
          "ASSIGNMENT_CHANGED",
          "An accepted assignment is required.",
        );
      await db()`UPDATE service_requests SET confirmed_date=${date}::date,confirmed_time_window=${p.proposed_time_window},status='APPOINTMENT_CONFIRMED',version=version+1,updated_at=now() WHERE id=${p.request_id} AND version=${i.requestVersion}`;
      await db()`INSERT INTO customer_notifications(customer_id,request_id,kind,title,message) VALUES(${p.customer_id},${p.request_id},${"RESCHEDULE:" + id},'Appointment rescheduled',${`Your confirmed visit is ${date} ${p.proposed_time_window}.`}) ON CONFLICT(request_id,kind) DO NOTHING`;
    }
    const changed =
      await db()`UPDATE appointment_reschedule_requests SET state=${i.decision},version=version+1,decided_at=now(),decided_by=${req.staff!.id},decision_reason=${i.reason} WHERE id=${id} RETURNING *`;
    await db()`INSERT INTO request_status_events(request_id,status,note,actor_role,actor_staff_id) VALUES(${p.request_id},${i.decision === "APPROVED" ? "APPOINTMENT_CONFIRMED" : p.request_status},${`Reschedule ${i.decision.toLowerCase()}: ${String(p.proposed_date).slice(0, 10)} ${p.proposed_time_window}. ${i.reason}`},${req.staff!.role},${req.staff!.id})`;
    await db()`INSERT INTO technician_notifications(technician_id,request_id,event_key,title,message) VALUES(${p.technician_id},${p.request_id},${"reschedule-decision:" + id},${i.decision === "APPROVED" ? "Reschedule approved" : "Reschedule declined"},${i.decision === "APPROVED" ? "Your confirmed schedule has been updated." : "Your confirmed schedule remains unchanged. " + i.reason}) ON CONFLICT(event_key) DO NOTHING`;
    await db()`INSERT INTO audit_logs(actor_staff_id,actor_role,action,entity_type,entity_id,new_value,reason) VALUES(${req.staff!.id},${req.staff!.role},'RESCHEDULE_DECIDED','SERVICE_REQUEST',${p.request_id}::text,${JSON.stringify({ proposalId: id, decision: i.decision })}::jsonb,${i.reason})`;
    res.json({ data: changed[0] });
  }),
);
