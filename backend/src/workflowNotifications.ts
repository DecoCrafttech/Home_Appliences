import type { Request } from "express";
import { db } from "./db.js";

export async function createWorkflowNotifications(req: Request, body: unknown) {
  const data = (body as { data?: Record<string, unknown> })?.data;
  if (!data) return;
  if ((body as { unchanged?: boolean }).unchanged) return;
  const path = req.originalUrl.split("?")[0] || "";
  const requestMatch = path.match(/\/requests\/([0-9a-f-]{36})/);
  let requestId =
    requestMatch?.[1] ||
    (typeof data.request_id === "string" ? data.request_id : null);
  let title = "",
    event = "",
    destination = "";
  let ticketId: string | null = null;
  if (
    /\/api\/v1\/(?:requests\/(?:service|installation)|service-requests|installation-requests)$/.test(
      path,
    )
  ) {
    requestId = String(data.id);
    title = "New customer request";
    event = "request:" + requestId;
    await db()`INSERT INTO customer_notifications(customer_id,request_id,kind,title,message) SELECT customer_id,id,'REQUEST_RECEIVED','Request received','Operations will review your request.' FROM service_requests WHERE id=${requestId} ON CONFLICT(request_id,kind) DO NOTHING`;
  } else if (
    /\/admin\/requests\/[^/]+\/status$/.test(path) &&
    req.method === "PATCH"
  ) {
    title = "Request status overridden";
    event = "admin-status:" + requestId + ":" + data.version;
  } else if (/\/technician\/jobs\/[^/]+\/reschedule$/.test(path)) {
    title = "Technician requested reschedule";
    event = "reschedule:" + data.id;
    destination = "/appointments?proposal=" + data.id;
  } else if (/\/technician\/jobs\/[^/]+\/work-report$/.test(path)) {
    title = "Completion approval required";
    event = "report:" + data.id;
  } else if (/\/requests\/[^/]+\/review$/.test(path) && req.method === "POST") {
    title = "New customer review";
    event = "review:" + data.id;
    destination = "/feedback/" + data.id;
  } else if (path === "/api/v1/support/tickets") {
    ticketId = String(data.id);
    title = "New support ticket";
    event = "ticket:" + data.id;
    destination = "/support?ticket=" + data.id;
  } else if (/^\/api\/v1\/support\/tickets\/[^/]+\/messages$/.test(path)) {
    ticketId = path.split("/").at(-2) || null;
    title = "Customer support reply";
    event = "support-message:" + data.id;
    destination = "/support?ticket=" + ticketId;
  }
  if (title && event) {
    if (!destination)
      destination = requestId ? "/requests/" + requestId : "/support";
    await db()`INSERT INTO staff_notifications(staff_id,request_id,support_ticket_id,related_path,event_key,title,message) SELECT id,${requestId}::uuid,${ticketId}::uuid,${destination},${event},${title},${title + ". Open to review the latest details."} FROM staff_profiles WHERE active AND role IN ('SUPER_ADMIN','ADMIN','OPERATIONS_MANAGER','SUPPORT_AGENT') ON CONFLICT(staff_id,event_key) DO NOTHING`;
  }
  if (/^\/api\/v1\/admin\/support\/tickets\/[^/]+\/messages$/.test(path))
    await db()`UPDATE customer_notifications SET related_path=${"/support?ticket=" + path.split("/").at(-2)} WHERE kind=${"SUPPORT_" + data.id}`;
  if (
    /\/admin\/requests\/[^/]+\/status$/.test(path) &&
    data.status === "APPOINTMENT_CONFIRMED"
  ) {
    await db()`INSERT INTO customer_notifications(customer_id,request_id,kind,title,message) SELECT customer_id,id,${"APPOINTMENT:" + data.version},'Appointment confirmed','Your visit date and time have been confirmed.' FROM service_requests WHERE id=${requestId} ON CONFLICT(request_id,kind) DO NOTHING`;
  }
}
