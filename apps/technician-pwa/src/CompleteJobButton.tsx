import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { FaCircleCheck } from "react-icons/fa6";
import {
  ConfirmActionDialog,
  AsyncActionButton,
  AppCheckbox,
  AppTextarea,
  useSafeMutation,
} from "@home/ui";
import { technicianWorkReportSchema } from "@home/shared";
import axios from "axios";
import { toast } from "sonner";
import { api } from "./api";
import { LoadingSkeleton, ErrorState } from "./components";

type CompletionJob = {
  id: string;
  version: number;
  status: string;
  appliance: string;
  checklist?: string[];
  estimates?: { state: string }[];
  reports?: { state: string; outcome: string; work_summary: string }[];
};
const blocked = (job: CompletionJob) =>
  job.estimates?.some((estimate) =>
    ["AWAITING_CUSTOMER_APPROVAL", "SUBMITTED", "REJECTED"].includes(
      estimate.state,
    ),
  );
const ready = (job: CompletionJob) =>
  job.reports?.[0]?.state === "SUBMITTED_FOR_REVIEW" &&
  job.reports[0].outcome === "RESOLVED";

export function CompleteJobButton({
  job,
}: {
  job: { id: string; status: string; assignment_state: string };
}) {
  const [open, setOpen] = useState(false);
  if (job.assignment_state !== "ACCEPTED" || job.status !== "IN_PROGRESS")
    return null;
  return (
    <>
      <button
        type="button"
        className="tech-complete-action"
        onClick={() => setOpen(true)}
      >
        <FaCircleCheck aria-hidden="true" /> Complete job
      </button>
      {open && <CompleteJobDialog id={job.id} onClose={() => setOpen(false)} />}
    </>
  );
}

function CompleteJobDialog({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const [summary, setSummary] = useState("");
  const [checks, setChecks] = useState<string[]>([]);
  const [error, setError] = useState("");
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["technician", "job", id],
    queryFn: async () =>
      (await api.get<{ data: CompletionJob }>(`/jobs/${id}`)).data.data,
    refetchOnMount: "always",
    retry: false,
  });
  const mutation = useSafeMutation(async () => {
    let job = query.data!;
    if (job.status === "COMPLETED") return true;
    if (job.status !== "IN_PROGRESS" || blocked(job))
      throw new Error("This job is not ready for completion.");
    if (!ready(job)) {
      if (job.reports?.[0] && job.reports[0].state !== "CHANGES_REQUESTED")
        throw new Error("The work report needs review before completion.");
      const report = technicianWorkReportSchema.safeParse({
        version: job.version,
        workSummary: summary,
        checklist: checks,
        outcome: "RESOLVED",
        notes: "",
        parts: "",
        unresolvedIssues: "",
        attachmentIds: [],
      });
      if (!report.success)
        throw new Error(
          report.error.issues[0]?.message || "Check the work details.",
        );
      await api.post(`/jobs/${id}/work-report`, report.data);
      job = (await api.get<{ data: CompletionJob }>(`/jobs/${id}`)).data.data;
      qc.setQueryData(["technician", "job", id], job);
    }
    if (!ready(job) || blocked(job))
      throw new Error("Review the job before completing it.");
    await api.post(`/jobs/${id}/complete`, { version: job.version });
    return true;
  });
  async function finish() {
    await Promise.all(
      ["job", "jobs", "dashboard", "schedule"].map((key) =>
        qc.invalidateQueries({
          queryKey:
            key === "job" ? ["technician", key, id] : ["technician", key],
        }),
      ),
    );
    toast.success(
      "Job completed. Operations and the customer have been notified.",
    );
    onClose();
  }
  const job = query.data;
  const needsReport =
    job &&
    !ready(job) &&
    (!job.reports?.[0] || job.reports[0].state === "CHANGES_REQUESTED");
  const canComplete =
    job &&
    job.status === "IN_PROGRESS" &&
    !blocked(job) &&
    (ready(job) || needsReport);
  return (
    <ConfirmActionDialog
      title="Complete this job?"
      pending={mutation.isPending}
      onClose={onClose}
    >
      <div className="tech-complete-dialog">
        {query.isPending ? (
          <LoadingSkeleton title="Loading job..." variant="detail" />
        ) : query.isError ? (
          <ErrorState
            title="Unable to load job"
            retry={() => query.refetch()}
          />
        ) : (
          <>
            <h3>{job?.appliance}</h3>
            {!canComplete ? (
              <p>
                {job?.status === "COMPLETED"
                  ? "This job is already complete."
                  : blocked(job!)
                    ? "Resolve the estimate approval before completing this job."
                    : "The work report needs review before completion."}
              </p>
            ) : (
              <form
                onSubmit={async (event) => {
                  event.preventDefault();
                  setError("");
                  try {
                    if (await mutation.run(undefined)) await finish();
                  } catch (failure) {
                    const current = await query.refetch();
                    if (current.data?.status === "COMPLETED") {
                      await finish();
                      return;
                    }
                    setError(
                      axios.isAxiosError(failure)
                        ? failure.response?.data?.error?.message ||
                            "Unable to complete. Please retry."
                        : failure instanceof Error
                          ? failure.message
                          : "Unable to complete. Please retry.",
                    );
                  }
                }}
              >
                <fieldset disabled={mutation.isPending}>
                  {needsReport ? (
                    <>
                      <label>
                        Work performed
                        <AppTextarea
                          value={summary}
                          onChange={(event) => setSummary(event.target.value)}
                          minLength={3}
                          maxLength={2000}
                          required
                        />
                      </label>
                      <div className="tech-complete-checks">
                        {job?.checklist?.map((item) => (
                          <label className="tech-check" key={item}>
                            <AppCheckbox
                              required
                              checked={checks.includes(item)}
                              onChange={(event) =>
                                setChecks((current) =>
                                  event.target.checked
                                    ? [...current, item]
                                    : current.filter((value) => value !== item),
                                )
                              }
                            />
                            {item}
                          </label>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="tech-saved-report">
                      {job?.reports?.[0]?.work_summary}
                    </p>
                  )}
                  <p className="safe-help">
                    Confirm the work is resolved. The customer will be notified.
                  </p>
                </fieldset>
                {error && (
                  <p role="alert" className="safe-error">
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
                  <AsyncActionButton
                    type="submit"
                    className="primary"
                    pending={mutation.isPending}
                    pendingLabel="Completing..."
                  >
                    <FaCircleCheck aria-hidden="true" /> Confirm completion
                  </AsyncActionButton>
                </footer>
              </form>
            )}
            {!canComplete && (
              <Link to={`/technician/jobs/${id}`} onClick={onClose}>
                View job
              </Link>
            )}
          </>
        )}
      </div>
    </ConfirmActionDialog>
  );
}
