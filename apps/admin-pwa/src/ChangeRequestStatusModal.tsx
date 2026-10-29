import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AsyncActionButton,
  AppCheckbox,
  ConfirmActionDialog,
  useSafeMutation,
} from "@home/ui";
import { requestReference } from "@home/shared";
import { toast } from "sonner";
import axios from "axios";
import { api } from "./api";
import { adminKeys } from "./design";
import { StatusBadge } from "./components";
export type StatusRequest = {
  id: string;
  request_number: string;
  display_number?: number | string;
  customer_name: string;
  appliance: string;
  status: string;
  version: number;
  assignment_state?: string;
  assigned_technician_id?: string | null;
};
const statuses = [
  ["PENDING", "Pending"],
  ["TECHNICIAN_ASSIGNED", "Technician Assigned"],
  ["COMPLETED", "Completed"],
  ["ON_HOLD", "On Hold"],
  ["CANCELLED", "Cancelled"],
] as const;
export function ChangeRequestStatusModal({
  request,
  onClose,
}: {
  request: StatusRequest;
  onClose: () => void;
}) {
  const [status, setStatus] = useState(""),
    [technicianId, setTechnicianId] = useState(""),
    [reopen, setReopen] = useState(false),
    [error, setError] = useState("");
  const qc = useQueryClient(),
    final = ["COMPLETED", "CANCELLED"].includes(request.status);
  const technicians = useQuery({
    queryKey: adminKeys.technicians,
    queryFn: async () =>
      (
        await api.get<{
          data: {
            id: string;
            full_name: string;
            verification_status: string;
            account_status: string | null;
          }[];
        }>("/technicians")
      ).data.data,
    enabled: status === "TECHNICIAN_ASSIGNED",
    staleTime: 30000,
  });
  const assignableTechnicians = technicians.data?.filter(
    (technician) =>
      technician.verification_status === "VERIFIED" &&
      technician.account_status === "ACTIVE",
  );
  const unchanged =
    status !== "TECHNICIAN_ASSIGNED" &&
    (status === "PENDING" ? "REQUESTED" : status) === request.status;
  const mutation = useSafeMutation(async () => {
    await api.patch(`/requests/${request.id}/status`, {
      status,
      expectedVersion: request.version,
      confirmReopen: final && reopen,
      ...(status === "TECHNICIAN_ASSIGNED" ? { technicianId } : {}),
    });
    await Promise.all(
      [
        adminKeys.requests,
        adminKeys.request(request.id),
        adminKeys.summary,
        adminKeys.dashboardActivity,
        adminKeys.technicians,
        adminKeys.customerDetails,
        ["admin", "allocation"],
        ["admin", "appointments"],
      ].map((queryKey) => qc.invalidateQueries({ queryKey })),
    );
    return true;
  });
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      if (await mutation.run(undefined)) {
        toast.success("Request status updated successfully.");
        onClose();
      }
    } catch (e) {
      setError(
        axios.isAxiosError(e)
          ? e.response?.data?.error?.message ||
              "Unable to update status. Please try again."
          : "Unable to update status. Please try again.",
      );
    }
  }
  return (
    <ConfirmActionDialog
      title="Change Request Status"
      pending={mutation.isPending}
      onClose={onClose}
    >
      <form className="change-request-status" onSubmit={submit}>
        <div className="status-request-summary">
          <strong>{requestReference(request)}</strong>
          <p>{request.customer_name}</p>
          <p>{request.appliance}</p>
          <span>
            Current status: <StatusBadge status={request.status} />
          </span>
        </div>
        <fieldset disabled={mutation.isPending}>
          <label>
            New Status
            <select
              aria-label="New Status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setReopen(false);
                setTechnicianId("");
              }}
              required
            >
              <option value="">Choose a status</option>
              {statuses.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {status && (
            <div className="status-selection">
              <StatusBadge status={status === "PENDING" ? "PENDING" : status} />
            </div>
          )}
          {request.assignment_state === "OFFERED" && (
            <p className="safe-help">
              Saving a manual status withdraws this legacy offer. Use Assign
              Technician to create an active assignment.
            </p>
          )}
          {status === "TECHNICIAN_ASSIGNED" && (
            <>
              <label>
                Technician
                <select
                  aria-label="Technician"
                  value={technicianId}
                  onChange={(e) => setTechnicianId(e.target.value)}
                  required
                  disabled={technicians.isPending || technicians.isError}
                >
                  <option value="">
                    {technicians.isPending
                      ? "Loading technicians..."
                      : "Choose a technician"}
                  </option>
                  {assignableTechnicians?.map((technician) => (
                    <option key={technician.id} value={technician.id}>
                      {technician.full_name}
                    </option>
                  ))}
                </select>
              </label>
              {technicians.isError && (
                <p className="safe-error" role="alert">
                  Unable to load technicians.{" "}
                  <button
                    type="button"
                    onClick={() => technicians.refetch()}
                    disabled={technicians.isFetching}
                  >
                    Retry
                  </button>
                </p>
              )}
              {!technicians.isPending &&
                !technicians.isError &&
                !assignableTechnicians?.length && (
                  <p role="status">
                    No verified technicians with active accounts are available.
                  </p>
                )}
              <p className="safe-help">
                Any active technician can be selected; skill matching is not
                required. The selected technician is assigned immediately and
                operations can complete the request after the work is done.
              </p>
            </>
          )}
          {final && status && !unchanged && (
            <label className="check-label">
              <AppCheckbox
                checked={reopen}
                onChange={(e) => setReopen(e.target.checked)}
                required
              />
              I confirm reopening this {request.status.toLowerCase()} request.
              Existing completion and feedback history will be preserved.
            </label>
          )}
        </fieldset>
        {error && (
          <p role="alert" className="safe-error">
            {error}
          </p>
        )}
        <footer>
          <button type="button" disabled={mutation.isPending} onClick={onClose}>
            Cancel
          </button>
          <AsyncActionButton
            type="submit"
            className="primary"
            pending={mutation.isPending}
            pendingLabel="Updating..."
            disabled={
              !status ||
              unchanged ||
              (final && !reopen) ||
              (status === "TECHNICIAN_ASSIGNED" &&
                (!technicianId || technicians.isPending || technicians.isError))
            }
          >
            Save Status
          </AsyncActionButton>
        </footer>
      </form>
    </ConfirmActionDialog>
  );
}
