import { AsyncActionButton as SafeAsyncButton } from "@home/ui";
import { ConfirmModal } from "./components";
import { icons, adminKeys } from "./design";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
  const qc = useQueryClient();
  return (
    <ConfirmModal title="Complete this request?" busy={busy} onClose={onClose}>
      <p>
        <strong>{request.request_number}</strong> · {request.customer_name}
      </p>
      <p>
        {request.appliance} · {request.request_type} ·{" "}
        {request.status.replaceAll("_", " ")}
      </p>
      <p>
        Confirm the work is finished. The customer will be notified and can
        leave a review.
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
                completionNotes: String(
                  form.get("completionNotes") || "",
                ).trim(),
                attachmentIds: [],
                version: request.version,
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
          Work completed summary
          <textarea
            autoFocus
            name="workSummary"
            required
            minLength={3}
            maxLength={2000}
            defaultValue={initialSummary}
          />
        </label>
        <label>
          Completion notes (optional)
          <textarea name="completionNotes" maxLength={4000} />
        </label>
        <p className="honest">
          Completion time is recorded automatically when you confirm.
        </p>
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
            {busy ? "Completing…" : "Confirm Completion"}
          </SafeAsyncButton>
        </div>
      </form>
    </ConfirmModal>
  );
}
