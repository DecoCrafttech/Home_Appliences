import { db } from "./db.js";
import { sendPushToRole, sendRequestNotification } from "./pushService.js";
export async function createWorkflowNotifications(req, body) {
    const data = body?.data;
    if (!data)
        return;
    if (body.unchanged)
        return;
    const path = req.originalUrl.split("?")[0] || "";
    const requestMatch = path.match(/\/requests\/([0-9a-f-]{36})/);
    let requestId = requestMatch?.[1] ||
        (typeof data.request_id === "string" ? data.request_id : null);
    let title = "", event = "", destination = "";
    let ticketId = null;
    if (/\/api\/v1\/(?:requests\/(?:service|installation)|service-requests|installation-requests)$/.test(path)) {
        requestId = String(data.id);
        title = "New customer request";
        event = "request:" + requestId;
        await db() `INSERT INTO customer_notifications(customer_id,request_id,kind,title,message) SELECT customer_id,id,'REQUEST_RECEIVED','Request received','Operations will review your request.' FROM service_requests WHERE id=${requestId} ON CONFLICT(request_id,kind) DO NOTHING`;
        await sendPushToRole("ADMIN", `new-request:${requestId}`, { title: "New Service Request", body: "A customer submitted a new service request.", path: `/requests/${requestId}`, tag: `request-${requestId}-new` }, requestId);
    }
    else if (/\/admin\/requests\/[^/]+\/status$/.test(path) &&
        req.method === "PATCH") {
        title = "Request status overridden";
        event = "admin-status:" + requestId + ":" + data.version;
    }
    else if (/\/technician\/jobs\/[^/]+\/work-report$/.test(path)) {
        title = "Completion approval required";
        event = "report:" + data.id;
    }
    else if (/\/requests\/[^/]+\/review$/.test(path) && req.method === "POST") {
        title = "New customer review";
        event = "review:" + data.id;
        destination = "/feedback/" + data.id;
    }
    else if (path === "/api/v1/support/tickets") {
        ticketId = String(data.id);
        title = "New support ticket";
        event = "ticket:" + data.id;
        destination = "/support?ticket=" + data.id;
    }
    else if (/^\/api\/v1\/support\/tickets\/[^/]+\/messages$/.test(path)) {
        ticketId = path.split("/").at(-2) || null;
        title = "Customer support reply";
        event = "support-message:" + data.id;
        destination = "/support?ticket=" + ticketId;
    }
    if (title && event) {
        if (!destination)
            destination = requestId ? "/requests/" + requestId : "/support";
        await db() `INSERT INTO staff_notifications(staff_id,request_id,support_ticket_id,related_path,event_key,title,message) SELECT id,${requestId}::uuid,${ticketId}::uuid,${destination},${event},${title},${title + ". Open to review the latest details."} FROM staff_profiles WHERE active AND role IN ('SUPER_ADMIN','ADMIN','OPERATIONS_MANAGER','SUPPORT_AGENT') ON CONFLICT(staff_id,event_key) DO NOTHING`;
    }
    if (/^\/api\/v1\/admin\/support\/tickets\/[^/]+\/messages$/.test(path))
        await db() `UPDATE customer_notifications SET related_path=${"/support?ticket=" + path.split("/").at(-2)} WHERE kind=${"SUPPORT_" + data.id}`;
    if (/\/admin\/requests\/[^/]+\/status$/.test(path) &&
        data.status === "APPOINTMENT_CONFIRMED") {
        await db() `INSERT INTO customer_notifications(customer_id,request_id,kind,title,message) SELECT customer_id,id,${"APPOINTMENT:" + data.version},'Appointment confirmed','Your visit date and time have been confirmed.' FROM service_requests WHERE id=${requestId} ON CONFLICT(request_id,kind) DO NOTHING`;
    }
    if (requestId && /\/admin\/requests\/[^/]+\/status$/.test(path)) {
        const rows = await db() `SELECT r.customer_id,r.assigned_technician_id,r.status,r.version,(SELECT status FROM request_status_events e WHERE e.request_id=r.id ORDER BY e.created_at DESC OFFSET 1 LIMIT 1) AS previous_status FROM service_requests r WHERE r.id=${requestId}`;
        const request = rows[0];
        if (request?.status === "TECHNICIAN_ASSIGNED" && request.assigned_technician_id) {
            await Promise.all([
                sendRequestNotification("TECHNICIAN", String(request.assigned_technician_id), requestId, `assigned:${request.version}`, "New Job Assigned", "A new service job has been assigned to you.", `/technician/jobs/${requestId}`),
                sendRequestNotification("CUSTOMER", String(request.customer_id), requestId, `assigned:${request.version}`, "Technician Assigned", "A technician has been assigned to your request.", `/requests/${requestId}`)
            ]);
        }
        else if (request?.status === "ON_HOLD" && request.assigned_technician_id)
            await sendRequestNotification("TECHNICIAN", String(request.assigned_technician_id), requestId, `hold:${request.version}`, "Job On Hold", "Operations placed this job on hold.", `/technician/jobs/${requestId}`);
        else if (request?.previous_status === "ON_HOLD" && request.assigned_technician_id)
            await sendRequestNotification("TECHNICIAN", String(request.assigned_technician_id), requestId, `resumed:${request.version}`, "Job Resumed", "Operations resumed this job.", `/technician/jobs/${requestId}`);
        else if (request?.assigned_technician_id)
            await sendRequestNotification("TECHNICIAN", String(request.assigned_technician_id), requestId, `status:${request.version}`, "Job Updated", `The job is now ${String(request.status).replaceAll("_", " ").toLowerCase()}.`, `/technician/jobs/${requestId}`);
        if (request?.status === "COMPLETED")
            await Promise.all([
                sendPushToRole("ADMIN", `completed:${requestId}:${request.version}`, { title: "Service Completed", body: "A service request was completed.", path: `/requests/${requestId}`, tag: `request-${requestId}-completed` }, requestId),
                sendRequestNotification("CUSTOMER", String(request.customer_id), requestId, `completed:${request.version}`, "Service Completed", "Your service request is complete.", `/requests/${requestId}`)
            ]);
    }
    if (requestId && /\/technician\/jobs\/[^/]+\/work-report$/.test(path)) {
        const rows = await db() `SELECT customer_id,version FROM service_requests WHERE id=${requestId}`;
        const request = rows[0];
        if (request)
            await Promise.all([
                sendPushToRole("ADMIN", `completed:${requestId}:${request.version}`, { title: "Service Completed", body: "A technician completed a service request.", path: `/requests/${requestId}`, tag: `request-${requestId}-completed` }, requestId),
                sendRequestNotification("CUSTOMER", String(request.customer_id), requestId, `completed:${request.version}`, "Service Completed", "Your service request is complete.", `/requests/${requestId}`)
            ]);
    }
}
