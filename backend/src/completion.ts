import { db } from "./db.js";
export async function completeRequest(
  id: string,
  version: number,
  staff: { id: string; role: string },
  workSummary: string,
  completionNotes: string,
) {
  const updated =
    await db()`WITH prior AS (SELECT id,status FROM service_requests WHERE id=${id} FOR UPDATE),changed AS (UPDATE service_requests r SET status_source='WORKFLOW',status='COMPLETED',completed_at=now(),updated_at=now(),version=version+1 FROM prior WHERE r.id=prior.id AND r.status IN ('TECHNICIAN_ASSIGNED','APPOINTMENT_CONFIRMED','IN_PROGRESS') AND r.version=${version} RETURNING r.*),approved AS (UPDATE technician_work_reports SET state='APPROVED',reviewed_by=${staff.id} WHERE request_id IN (SELECT id FROM changed) AND state='SUBMITTED_FOR_REVIEW' RETURNING id),tech_notification AS (INSERT INTO technician_notifications(technician_id,request_id,event_key,title,message) SELECT assigned_technician_id,id,'completed:'||id,'Completion approved','Operations approved your work report.' FROM changed WHERE EXISTS(SELECT 1 FROM technician_accounts WHERE technician_id=changed.assigned_technician_id) ON CONFLICT(event_key) DO NOTHING RETURNING id),report AS (INSERT INTO completion_reports(request_id,completed_by,work_summary,completion_notes,completed_at) SELECT id,${staff.id},${workSummary},${completionNotes},completed_at FROM changed ON CONFLICT(request_id) DO NOTHING RETURNING id),event AS (INSERT INTO request_status_events(request_id,status,previous_status,note,actor_staff_id,actor_role) SELECT id,status,(SELECT status FROM prior),${workSummary},${staff.id},${staff.role} FROM changed RETURNING id),notification AS (INSERT INTO customer_notifications(customer_id,request_id,kind,title,message) SELECT customer_id,id,'COMPLETION','Request completed','Your request is complete. Share your experience when you are ready.' FROM changed ON CONFLICT(request_id,kind) DO NOTHING RETURNING id),audit AS (INSERT INTO audit_logs(actor_staff_id,actor_role,action,entity_type,entity_id,previous_value,new_value,reason) SELECT ${staff.id},${staff.role},'REQUEST_COMPLETED','SERVICE_REQUEST',id,jsonb_build_object('status',(SELECT status FROM prior)),jsonb_build_object('status','COMPLETED','completedAt',completed_at),${workSummary} FROM changed RETURNING entity_id) SELECT * FROM changed`;
  return updated;
}
