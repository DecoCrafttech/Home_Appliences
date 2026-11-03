import { useState } from "react";
import {
  AssignTechnicianDrawer,
  type AssignmentRequest,
} from "./AssignTechnicianDrawer";
export function WorkflowActions({
  request,
  initialAssign = false,
}: {
  request: AssignmentRequest & {
    status: string;
    assignment_state?: string;
    assigned_technician_name?: string;
    pending_report_id?: string;
  };
  initialAssign?: boolean;
  initialReschedule?: boolean;
}) {
  const [open, setOpen] = useState(initialAssign);
  const canAssign = [
    "REQUESTED",
    "UNDER_REVIEW",
    "EXECUTIVE_CONTACTED",
    "ASSIGNMENT_PENDING",
    "TECHNICIAN_ASSIGNED",
    "APPOINTMENT_CONFIRMED",
  ].includes(request.status);
  return (
    <div className="workflow-actions">
      {canAssign && (
        <button className="primary" onClick={() => setOpen(true)}>
          Assign Technician
        </button>
      )}
      {open && (
        <AssignTechnicianDrawer
          request={request}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
