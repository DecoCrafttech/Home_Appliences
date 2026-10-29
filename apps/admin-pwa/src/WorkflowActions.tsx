import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AsyncActionButton,
  ConfirmActionDialog,
  useSafeMutation,
} from "@home/ui";
import { requestTransitions, requestStatusPresentation } from "@home/shared";
import { toast } from "sonner";
import axios from "axios";
import { Link } from "react-router-dom";
import { api } from "./api";
import { adminKeys } from "./design";
import {
  AssignTechnicianDrawer,
  type AssignmentRequest,
} from "./AssignTechnicianDrawer";

const labels: Record<string, string> = {
  UNDER_REVIEW: "Start Review",
  EXECUTIVE_CONTACTED: "Customer Contacted",
  ASSIGNMENT_PENDING: "Ready for Assignment",
  APPOINTMENT_CONFIRMED: "Confirm Appointment",
  ON_HOLD: "Put on Hold",
  CANCELLED: "Cancel Request",
};
export function WorkflowActions({
  request,
  initialAssign = false,
  initialReschedule = false,
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
  const [assign, setAssign] = useState(initialAssign),
    [target, setTarget] = useState(
      initialReschedule && request.status === "APPOINTMENT_CONFIRMED"
        ? "APPOINTMENT_CONFIRMED"
        : "",
    ),
    [failure, setFailure] = useState("");
  const qc = useQueryClient();
  const mutation = useSafeMutation(async (body: Record<string, unknown>) => {
    await api.post(`/requests/${request.id}/status`, body);
    await Promise.all([
      qc.invalidateQueries({ queryKey: adminKeys.request(request.id) }),
      qc.invalidateQueries({ queryKey: adminKeys.requests }),
      qc.invalidateQueries({ queryKey: adminKeys.summary }),
      qc.invalidateQueries({ queryKey: adminKeys.dashboardActivity }),
      qc.invalidateQueries({ queryKey: ["admin", "allocation"] }),
      qc.invalidateQueries({ queryKey: ["admin", "appointments"] }),
    ]);
    return true;
  });
  const canAssign = [
    "REQUESTED",
    "UNDER_REVIEW",
    "EXECUTIVE_CONTACTED",
    "ASSIGNMENT_PENDING",
    "TECHNICIAN_ASSIGNED",
    "APPOINTMENT_CONFIRMED",
  ].includes(request.status);
  const next = (requestTransitions[request.status] || []).filter(
    (s) =>
      labels[s] &&
      s !== "ASSIGNMENT_PENDING" &&
      (s !== "APPOINTMENT_CONFIRMED" || !!request.assigned_technician_name),
  );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setFailure("");
    try {
      const result = await mutation.run({
        status: target,
        version: request.version,
        note: String(form.get("note") || labels[target]),
        ...(target === "APPOINTMENT_CONFIRMED"
          ? {
              confirmedDate: form.get("date"),
              confirmedTimeWindow: form.get("window"),
            }
          : {}),
      });
      if (result && mutation.isMounted()) {
        setTarget("");
        toast.success("Request status updated.");
      }
    } catch (e) {
      setFailure(
        axios.isAxiosError(e)
          ? e.response?.data?.error?.message ||
              "Unable to connect. Please try again."
          : "Unable to update status.",
      );
    }
  }
  return (
    <section id="update-status" className="workflow-panel">
      <h2>Next action</h2>
      <p>
        Current state:{" "}
        {requestStatusPresentation[request.status]?.label || request.status}
      </p>
      {request.assignment_state && (
        <p>
          Assignment:{" "}
          {request.assignment_state === "OFFERED"
            ? "Legacy offer — reassign to activate"
            : request.assignment_state}
        </p>
      )}
      <div className="workflow-actions">
        {canAssign && (
          <button className="primary" onClick={() => setAssign(true)}>
            {request.assignment_state
              ? "Reassign Technician"
              : "Assign Technician"}
          </button>
        )}
        {next
          .filter((s) => !["CANCELLED", "ON_HOLD"].includes(s))
          .map((s) => (
            <button
              key={s}
              onClick={() => {
                setFailure("");
                setTarget(s);
              }}
            >
              {labels[s]}
            </button>
          ))}
        {request.pending_report_id && (
          <Link
            className={request.assignment_state === "ACCEPTED" ? "" : "primary"}
            to="#work-report"
          >
            Review Work Report
          </Link>
        )}
        {["IN_PROGRESS", "ESTIMATE_PENDING_APPROVAL"].includes(
          request.status,
        ) &&
          !request.pending_report_id && (
            <span>
              Awaiting technician progress or a work report. Operations reviews
              the report before completion.
            </span>
          )}
      </div>
      {request.status === "APPOINTMENT_CONFIRMED" && (
        <details>
          <summary>Other actions</summary>
          <button onClick={() => setTarget("APPOINTMENT_CONFIRMED")}>
            Reschedule
          </button>
        </details>
      )}
      {assign && (
        <AssignTechnicianDrawer
          request={request}
          onClose={() => setAssign(false)}
        />
      )}
      {target && (
        <ConfirmActionDialog
          title={
            request.status === "APPOINTMENT_CONFIRMED" &&
            target === "APPOINTMENT_CONFIRMED"
              ? "Reschedule Appointment"
              : labels[target] || target
          }
          pending={mutation.isPending}
          onClose={() => setTarget("")}
        >
          <form onSubmit={submit}>
            {target === "APPOINTMENT_CONFIRMED" && (
              <>
                <label>
                  Confirmed date
                  <input
                    type="date"
                    name="date"
                    defaultValue={
                      request.confirmed_date || request.preferred_date
                    }
                    required
                  />
                </label>
                <label>
                  Confirmed visit window
                  <input
                    name="window"
                    defaultValue={
                      request.confirmed_time_window ||
                      request.preferred_time_window
                    }
                    pattern="([01][0-9]|2[0-3]):[0-5][0-9]-([01][0-9]|2[0-3]):[0-5][0-9]"
                    placeholder="09:00-12:00"
                    required
                  />
                </label>
              </>
            )}
            <label>
              {target === "CANCELLED" || target === "ON_HOLD"
                ? "Reason"
                : "Operational note (optional)"}
              <textarea
                name="note"
                minLength={3}
                maxLength={300}
                required={target === "CANCELLED" || target === "ON_HOLD"}
              />
            </label>
            {failure && (
              <p role="alert" className="safe-error">
                {failure}
              </p>
            )}
            <footer>
              <button
                type="button"
                disabled={mutation.isPending}
                onClick={() => setTarget("")}
              >
                Cancel
              </button>
              <AsyncActionButton
                className="primary"
                pending={mutation.isPending}
                pendingLabel="Updating..."
              >
                {labels[target]}
              </AsyncActionButton>
            </footer>
          </form>
        </ConfirmActionDialog>
      )}
    </section>
  );
}
