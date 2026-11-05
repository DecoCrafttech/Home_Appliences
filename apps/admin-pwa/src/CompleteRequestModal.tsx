import { AsyncActionButton as SafeAsyncButton } from "@home/ui";
import { ConfirmModal } from "./components";
import { icons, adminKeys } from "./design";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { api } from "./api";

export type CompletionRequest = {
  id: string;
  request_number: string;
  customer_name: string;
  appliance: string;
  request_type: string;
  status: string;
  version: number;
};
export function CompleteRequestModal({
  request,
  initialSummary = "",
  onClose,
}: {
  request: CompletionRequest;
  initialSummary?: string;
  onClose: () => void;
}) {
  const guard = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState(initialSummary);
  const qc = useQueryClient();
  const latest = useQuery({
    queryKey: adminKeys.request(request.id),
    queryFn: async () =>
      (
        await api.get<{
          data: CompletionRequest & {
            technician_account_enabled?: boolean;
            pending_report_id?: string;
            work_summary?: string;
          };
        }>(`/requests/${request.id}`)
      ).data.data,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    retry: false,
  });
  if (latest.isPending || latest.isFetching)
    return (
      <ConfirmModal title="Complete request" busy={false} onClose={onClose}>
        <p role="status">Checking request…</p>
      </ConfirmModal>
    );
  if (latest.isError)
    return (
      <ConfirmModal title="Complete request" busy={false} onClose={onClose}>
        <p role="alert">Unable to check this request.</p>
        <button onClick={() => latest.refetch()}>Try again</button>
      </ConfirmModal>
    );
  const current = latest.data;
  if (current.status === "COMPLETED")
    return (
      <ConfirmModal title="Request completed" busy={false} onClose={onClose}>
        <p>This request is already complete.</p>
        <button
          className="primary"
          onClick={() => {
            void qc.invalidateQueries({ queryKey: adminKeys.requests });
            onClose();
          }}
        >
          Done
        </button>
      </ConfirmModal>
    );
  if (
    !["TECHNICIAN_ASSIGNED", "APPOINTMENT_CONFIRMED", "IN_PROGRESS"].includes(
      current.status,
    )
  )
    return (
      <ConfirmModal title="Request not ready" busy={false} onClose={onClose}>
        <p>Review this request’s latest status before completing it.</p>
        <Link
          className="primary"
          to={`/requests/${request.id}`}
          onClick={onClose}
        >
          View request
        </Link>
      </ConfirmModal>
    );
  if (current.technician_account_enabled)
    return (
      <ConfirmModal title="Review completion" busy={false} onClose={onClose}>
        <p>
          {current.pending_report_id
            ? "Review the technician’s work report to complete this job."
            : "The technician needs to submit a work report first."}
        </p>
        <div className="admin-dialog-actions">
          <button onClick={onClose}>Close</button>
          <Link
            className="primary"
            to={`/requests/${request.id}#work-report`}
            onClick={onClose}
          >
            {current.pending_report_id ? "Review report" : "View request"}
          </Link>
        </div>
      </ConfirmModal>
    );
  return (
    <ConfirmModal title="Complete request" busy={busy} onClose={onClose}>
      <p>
        <strong>{request.request_number}</strong> · {request.customer_name}
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (guard.current) return;
          const form = new FormData(e.currentTarget);
          const workSummary = String(form.get("workSummary") || "").trim();
          if (workSummary.length < 3) {
            setError("Describe the completed work in at least 3 characters.");
            return;
          }
          guard.current = true;
          setBusy(true);
          setError("");
          try {
            const response = await api.post(
              `/requests/${request.id}/complete`,
              {
                workSummary,
                completionNotes: "",
                attachmentIds: [],
                version: current.version,
              },
            );
            qc.setQueryData(
              adminKeys.request(request.id),
              (old: Record<string, unknown> | undefined) => ({
                ...old,
                ...response.data.data,
              }),
            );
            qc.setQueriesData<{
              data: (CompletionRequest & Record<string, unknown>)[];
              meta: unknown;
            }>({ queryKey: adminKeys.requests }, (old) =>
              old
                ? {
                    ...old,
                    data: old.data.map((row) =>
                      row.id === request.id
                        ? { ...row, ...response.data.data }
                        : row,
                    ),
                  }
                : old,
            );
            await Promise.all([
              qc.invalidateQueries({ queryKey: adminKeys.requests }),
              qc.invalidateQueries({ queryKey: adminKeys.request(request.id) }),
              qc.invalidateQueries({ queryKey: adminKeys.summary }),
              qc.invalidateQueries({ queryKey: adminKeys.operations }),
              qc.invalidateQueries({ queryKey: adminKeys.dashboardActivity }),
              qc.invalidateQueries({ queryKey: ["admin", "allocation"] }),
              qc.invalidateQueries({ queryKey: ["admin", "appointments"] }),
              qc.invalidateQueries({ queryKey: adminKeys.technicians }),
              qc.invalidateQueries({ queryKey: adminKeys.customerDetails }),
            ]);
            toast.success("Request marked as completed successfully.");
            onClose();
          } catch (err) {
            if (axios.isAxiosError(err) && err.response?.status === 409)
              void latest.refetch();
            setError(
              axios.isAxiosError(err)
                ? err.response?.data?.error?.message ||
                    "Unable to connect. Try again."
                : "Unable to complete request.",
            );
          } finally {
            guard.current = false;
            setBusy(false);
          }
        }}
      >
        <label>
          What work was completed?
          <textarea
            autoFocus
            name="workSummary"
            required
            minLength={3}
            maxLength={2000}
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            rows={3}
            placeholder="A short summary of the work"
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <div className="admin-dialog-actions">
          <button type="button" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <SafeAsyncButton
            disabled={busy}
            pending={busy}
            pendingLabel="Saving..."
          >
            <icons.success />
            {busy ? "Completing…" : "Complete request"}
          </SafeAsyncButton>
        </div>
      </form>
    </ConfirmModal>
  );
}
