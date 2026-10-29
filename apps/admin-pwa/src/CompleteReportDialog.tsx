import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ConfirmActionDialog,
  AsyncActionButton,
  useSafeMutation,
} from "@home/ui";
import { toast } from "sonner";
import axios from "axios";
import { api } from "./api";
import { adminKeys, icons } from "./design";
import { ErrorState, LoadingSkeleton } from "./components";

export function CompleteReportDialog({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const [error, setError] = useState("");
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: adminKeys.request(id),
    queryFn: async () =>
      (
        await api.get<{
          data: {
            status: string;
            appliance: string;
            work_reports?: {
              id: string;
              state: string;
              outcome: string;
              work_summary: string;
            }[];
          };
        }>(`/requests/${id}`)
      ).data.data,
    refetchOnMount: "always",
    retry: false,
  });
  const report = query.data?.work_reports?.[0];
  const ready =
    query.data?.status === "IN_PROGRESS" &&
    report?.state === "SUBMITTED_FOR_REVIEW" &&
    report.outcome === "RESOLVED";
  const mutation = useSafeMutation(async () => {
    if (!ready) return false;
    await api.post(`/work-reports/${report!.id}/review`, {
      decision: "APPROVE",
      reason: "",
    });
    await Promise.all([
      qc.invalidateQueries({ queryKey: adminKeys.requests }),
      qc.invalidateQueries({ queryKey: adminKeys.request(id) }),
      qc.invalidateQueries({ queryKey: adminKeys.summary }),
      qc.invalidateQueries({ queryKey: adminKeys.dashboardActivity }),
      qc.invalidateQueries({ queryKey: ["admin", "allocation"] }),
      qc.invalidateQueries({ queryKey: ["admin", "appointments"] }),
      qc.invalidateQueries({ queryKey: ["admin", "technician-workflow"] }),
    ]);
    return true;
  });
  return (
    <ConfirmActionDialog
      title="Complete this request?"
      pending={mutation.isPending}
      onClose={onClose}
    >
      <div className="request-complete-dialog">
        {query.isPending ? (
          <LoadingSkeleton title="Loading work report..." variant="detail" />
        ) : query.isError ? (
          <ErrorState
            title="Unable to load work report"
            retry={() => query.refetch()}
          />
        ) : (
          <>
            <h3>{query.data?.appliance}</h3>
            {ready ? (
              <>
                <p className="request-report-preview">{report?.work_summary}</p>
                <p>
                  Approve this resolved work report and notify the customer.
                </p>
              </>
            ) : (
              <p>
                {query.data?.status === "COMPLETED"
                  ? "This request is already complete."
                  : "A resolved technician work report is needed before completion."}
              </p>
            )}
            {error && (
              <p className="safe-error" role="alert">
                {error}
              </p>
            )}
            <footer className="ui-actions">
              <button
                type="button"
                disabled={mutation.isPending}
                onClick={onClose}
              >
                Cancel
              </button>
              {ready ? (
                <AsyncActionButton
                  className="primary"
                  pending={mutation.isPending}
                  pendingLabel="Completing..."
                  onClick={async () => {
                    setError("");
                    try {
                      if (await mutation.run(undefined)) {
                        toast.success(
                          "Request marked as completed successfully.",
                        );
                        onClose();
                      }
                    } catch (failure) {
                      setError(
                        axios.isAxiosError(failure)
                          ? failure.response?.data?.error?.message ||
                              "Unable to complete. Please retry."
                          : "Unable to complete. Please retry.",
                      );
                    }
                  }}
                >
                  <icons.success aria-hidden="true" /> Confirm Completion
                </AsyncActionButton>
              ) : (
                <Link to={`/requests/${id}#work-report`} onClick={onClose}>
                  View work report
                </Link>
              )}
            </footer>
          </>
        )}
      </div>
    </ConfirmActionDialog>
  );
}
