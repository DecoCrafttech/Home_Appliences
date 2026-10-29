import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { requireStaff, allow } from "./adminRoutes.js";
import { ApiError } from "./customerRoutes.js";
import { db } from "./db.js";

export const statusOverrideRoutes = Router();
const inputSchema = z
  .object({
    status: z.enum([
      "PENDING",
      "TECHNICIAN_ASSIGNED",
      "IN_PROGRESS",
      "COMPLETED",
      "ON_HOLD",
      "CANCELLED",
    ]),
    reason: z.string().trim().min(3).max(2000).optional(),
    completionNote: z.string().trim().min(3).max(2000).optional(),
    technicianId: z.string().uuid().optional(),
    expectedVersion: z.number().int().positive(),
    confirmReopen: z.boolean().default(false),
  })
  .strict();
const route =
  (handler: RequestHandler): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(next);
statusOverrideRoutes.patch(
  "/requests/:id/status",
  requireStaff,
  allow("SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER"),
  route(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id),
      parsed = inputSchema.safeParse(req.body);
    if (!parsed.success)
      throw new ApiError(
        422,
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message || "Check status details",
      );
    const i = parsed.data,
      target = i.status === "PENDING" ? "REQUESTED" : i.status,
      reason =
        i.reason ||
        (target === "COMPLETED"
          ? "Administrative completion recorded by operations"
          : "Status changed by administrator"),
      completionNote =
        i.completionNote ||
        (target === "COMPLETED"
          ? "Administrative completion recorded by operations."
          : null);
    const current = (
      await db()`SELECT * FROM service_requests WHERE id=${id} FOR UPDATE`
    )[0];
    if (!current) throw new ApiError(404, "NOT_FOUND", "Request not found");
    if (!["SERVICE", "INSTALLATION"].includes(current.request_type))
      throw new ApiError(
        422,
        "INVALID_WORKFLOW",
        "Unsupported request workflow",
      );
    if (Number(current.version) !== i.expectedVersion)
      throw new ApiError(
        409,
        "STALE_REQUEST",
        "This request changed. Refresh it before saving another status.",
      );
    if (current.status === target && target !== "TECHNICIAN_ASSIGNED") {
      res.json({ data: current, unchanged: true });
      return;
    }
    if (["COMPLETED", "CANCELLED"].includes(current.status) && !i.confirmReopen)
      throw new ApiError(
        422,
        "REOPEN_CONFIRMATION_REQUIRED",
        "Confirm reopening this final request.",
      );
    if (target === "TECHNICIAN_ASSIGNED") {
      if (!i.technicianId)
        throw new ApiError(
          422,
          "TECHNICIAN_REQUIRED",
          "Choose a technician before assigning this status.",
        );
      const technician = (
        await db()`SELECT t.id FROM technicians t LEFT JOIN technician_accounts a ON a.technician_id=t.id WHERE t.id=${i.technicianId} AND t.active=true AND a.status IS DISTINCT FROM 'SUSPENDED'`
      )[0];
      if (!technician)
        throw new ApiError(
          422,
          "INVALID_TECHNICIAN",
          "Choose an active technician with an account that is not frozen.",
        );
    }
    const assignments =
      await db()`SELECT * FROM technician_assignments WHERE request_id=${id} AND state IN ('OFFERED','ACCEPTED') FOR UPDATE`;
    const acceptedAssignment = assignments.find((a) => a.state === "ACCEPTED");
    if (
      current.status === target &&
      current.assigned_technician_id === i.technicianId &&
      assignments.some(
        (a) => a.technician_id === i.technicianId && a.state === "ACCEPTED",
      )
    ) {
      res.json({ data: current, unchanged: true });
      return;
    }
    // Administrator assignment takes effect immediately.
    const revokeAssignments =
      target === "CANCELLED" || current.status === "CANCELLED";
    const resolvedAssignments = assignments.filter(
      (a) => a.state === "OFFERED" || revokeAssignments,
    );
    if (
      target === "TECHNICIAN_ASSIGNED" &&
      acceptedAssignment &&
      acceptedAssignment.technician_id !== i.technicianId
    )
      throw new ApiError(
        409,
        "ACCEPTED_ASSIGNMENT_ACTIVE",
        "This request already has an accepted technician. Use the assignment workflow to change its owner.",
      );
    for (const a of resolvedAssignments) {
      const resolution =
        a.state === "OFFERED"
          ? "Offer withdrawn after administrative status override"
          : reason;
      await db()`UPDATE technician_assignments SET state='CANCELLED',reason=${resolution},version=version+1 WHERE id=${a.id}`;
      await db()`INSERT INTO technician_assignment_events(assignment_id,state,actor_id,actor_role,reason) VALUES(${a.id},'CANCELLED',${req.staff!.id},${req.staff!.role},${resolution})`;
    }
    if (
      ["CANCELLED", "COMPLETED"].includes(target) ||
      current.status === "CANCELLED"
    ) {
      await db()`UPDATE appointment_reschedule_requests SET state='SUPERSEDED',decision_reason='Request closed by administrative status override',decided_by=${req.staff!.id},decided_at=now(),version=version+1 WHERE request_id=${id} AND state='PENDING'`;
    }
    const changed = (
      await db()`UPDATE service_requests SET status=${target},status_source='ADMIN_OVERRIDE',assigned_technician_id=CASE WHEN ${target}='TECHNICIAN_ASSIGNED' THEN ${i.technicianId || null}::uuid WHEN ${revokeAssignments} THEN NULL ELSE assigned_technician_id END,confirmed_date=CASE WHEN ${revokeAssignments} THEN NULL ELSE confirmed_date END,confirmed_time_window=CASE WHEN ${revokeAssignments} THEN NULL ELSE confirmed_time_window END,status_overridden_at=now(),completed_at=CASE WHEN ${target}='COMPLETED' THEN now() ELSE NULL END,version=version+1,updated_at=now() WHERE id=${id} AND version=${i.expectedVersion} RETURNING *`
    )[0];
    if (!changed)
      throw new ApiError(
        409,
        "STALE_REQUEST",
        "This request changed. Refresh and try again.",
      );
    let manualOffer: Record<string, unknown> | undefined;
    if (target === "TECHNICIAN_ASSIGNED" && !acceptedAssignment) {
      const rows =
        await db()`INSERT INTO technician_assignments(request_id,technician_id,state,offered_by,responded_at,reason) VALUES(${id},${i.technicianId},'ACCEPTED',${req.staff!.id},now(),${reason}) RETURNING *`;
      manualOffer = rows[0];
      await db()`INSERT INTO technician_assignment_events(assignment_id,state,actor_id,actor_role,reason) VALUES(${rows[0]!.id},'ACCEPTED',${req.staff!.id},${req.staff!.role},${reason})`;
      await db()`INSERT INTO technician_notifications(technician_id,request_id,event_key,title,message) VALUES(${i.technicianId},${id},${"manual-assigned:" + String(rows[0]!.id)},'Job assigned','An administrator assigned this job to you. View it in My Jobs.') ON CONFLICT(event_key) DO NOTHING`;
    }
    await db()`INSERT INTO request_status_overrides(request_id,request_version,previous_status,new_status,reason,completion_note,staff_id) VALUES(${id},${changed.version},${current.status},${target},${reason},${completionNote},${req.staff!.id})`;
    await db()`INSERT INTO request_status_events(request_id,status,previous_status,note,actor_staff_id,actor_role) VALUES(${id},${target},${current.status},${"Administrative status updated by operations"},${req.staff!.id},${req.staff!.role})`;
    await db()`INSERT INTO audit_logs(actor_staff_id,actor_role,action,entity_type,entity_id,previous_value,new_value,reason) VALUES(${req.staff!.id},${req.staff!.role},'ADMIN_STATUS_OVERRIDE','SERVICE_REQUEST',${id},${JSON.stringify({ status: current.status, version: current.version, technicianId: current.assigned_technician_id, confirmedDate: current.confirmed_date, confirmedTimeWindow: current.confirmed_time_window })}::jsonb,${JSON.stringify({ status: target, version: changed.version, technicianId: target === "TECHNICIAN_ASSIGNED" ? i.technicianId : changed.assigned_technician_id, completionNote, confirmedReopen: i.confirmReopen })}::jsonb,${reason})`;
    if (target === "COMPLETED")
      await db()`INSERT INTO completion_reports(request_id,completed_by,work_summary,completion_notes,completed_at) VALUES(${id},${req.staff!.id},${completionNote},'Manual administrative completion; see status override audit.',now()) ON CONFLICT(request_id) DO NOTHING`;
    const label =
      i.status === "PENDING"
        ? "Pending"
        : i.status.replaceAll("_", " ").toLowerCase();
    await db()`INSERT INTO customer_notifications(customer_id,request_id,kind,title,message) VALUES(${current.customer_id},${id},${"ADMIN_STATUS:" + changed.version},${target === "COMPLETED" ? "Request completed" : "Request status updated"},${"An administrator updated your request to " + label + ". Open My Requests for the latest details."}) ON CONFLICT(request_id,kind) DO NOTHING`;
    for (const a of assignments)
      await db()`INSERT INTO technician_notifications(technician_id,request_id,event_key,title,message) VALUES(${a.technician_id},${id},${"admin-status:" + id + ":" + changed.version},'Request status updated',${"Administrative status: " + label + (a.state === "OFFERED" ? ". The pending offer was withdrawn." : revokeAssignments ? ". Assignment access has ended." : ". Assignment acceptance and work reports remain separate.")}) ON CONFLICT(event_key) DO NOTHING`;
    res.json({ data: changed, manualOffer });
  }),
);
