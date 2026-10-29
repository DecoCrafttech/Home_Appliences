import { writeFile } from "node:fs/promises";
import { env } from "./config/env.js";
import { db } from "./db.js";
if (env.NODE_ENV === "production" ||
    !["codex-customer-dev", "br-gentle-wind-b4tsvt43"].includes(process.env.NEON_BRANCH || ""))
    throw Error("Development branch required");
const [potentialBookings, assignments, reviews, completions, notifications, staleAssignments, statusHistory,] = await Promise.all([
    db() `SELECT customer_id,request_type,appliance,preferred_date,preferred_time_window,count(*)::int AS count FROM service_requests GROUP BY customer_id,request_type,appliance,preferred_date,preferred_time_window HAVING count(*)>1`,
    db() `SELECT request_id,count(*)::int AS count FROM technician_assignments WHERE state IN ('OFFERED','ACCEPTED') GROUP BY request_id HAVING count(*)>1`,
    db() `SELECT request_id,count(*)::int AS count FROM request_reviews GROUP BY request_id HAVING count(*)>1`,
    db() `SELECT request_id,count(*)::int AS count FROM completion_reports GROUP BY request_id HAVING count(*)>1`,
    db() `SELECT technician_id,event_key,count(*)::int AS count FROM technician_notifications GROUP BY technician_id,event_key HAVING count(*)>1`,
    db() `SELECT a.id,a.request_id,a.state,r.status FROM technician_assignments a JOIN service_requests r ON r.id=a.request_id WHERE (a.state='ACCEPTED' AND r.assigned_technician_id IS DISTINCT FROM a.technician_id) OR (a.state IN ('OFFERED','ACCEPTED') AND r.status='CANCELLED')`,
    db() `SELECT request_id,status,note,date_trunc('minute',created_at) AS minute,count(*)::int AS count FROM request_status_events GROUP BY request_id,status,note,date_trunc('minute',created_at) HAVING count(*)>1`,
]);
const result = {
    branch: process.env.NEON_BRANCH,
    checkedAt: new Date().toISOString(),
    potentialBookings,
    assignments,
    reviews,
    completions,
    notifications,
    staleAssignments,
    statusHistory,
    note: "Read-only audit. Repeated bookings or status labels are candidates for human review, not proven duplicates. No business records were deleted.",
};
await writeFile("../docs/workflow-db-audit.json", JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
