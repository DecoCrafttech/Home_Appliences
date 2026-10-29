import { ImageWithFallback } from "@home/ui";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AsyncActionButton, useSafeMutation } from "@home/ui";
import { toast } from "sonner";
import axios from "axios";
import { api } from "./api";
export type WorkReport = {
  id: string;
  technician_name: string;
  state: string;
  work_summary: string;
  checklist: string[];
  outcome: string;
  notes: string;
  parts: string;
  unresolved_issues: string;
  created_at: string;
  version: number;
  reviewed_by_technician_name?: string | null;
};
export function RequestWorkReport({
  reports,
  requestId,
  canManage,
}: {
  reports: WorkReport[];
  requestId: string;
  canManage: boolean;
}) {
  const qc = useQueryClient(),
    [photos, setPhotos] = useState<
      { id: string; purpose: string; url: string }[]
    >([]);
  const mutation = useSafeMutation(
    async ({
      id,
      decision,
      reason,
    }: {
      id: string;
      decision: string;
      reason: string;
    }) => {
      await api.post(`/work-reports/${id}/review`, { decision, reason });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin-request", requestId] }),
        qc.invalidateQueries({ queryKey: ["admin-requests"] }),
        qc.invalidateQueries({ queryKey: ["summary"] }),
        qc.invalidateQueries({ queryKey: ["admin", "allocation"] }),
        qc.invalidateQueries({ queryKey: ["admin", "appointments"] }),
      ]);
      return true;
    },
  );
  if (!reports.length) return null;
  return (
    <section className="ui-panel" id="work-report" tabIndex={-1}>
      <h2>Work Report</h2>
      {reports.map((r) => (
        <article className="request-report" key={r.id}>
          <h3>
            {r.technician_name} · Report {r.version}
          </h3>
          <small>
            {new Date(r.created_at).toLocaleString()} ·{" "}
            {r.state.replaceAll("_", " ")}
            {r.reviewed_by_technician_name &&
              ` · Completed by ${r.reviewed_by_technician_name}`}
          </small>
          <p>{r.work_summary}</p>
          <dl>
            <div>
              <dt>Outcome</dt>
              <dd>{r.outcome}</dd>
            </div>
            <div>
              <dt>Parts used</dt>
              <dd>{r.parts || "None recorded"}</dd>
            </div>
            <div>
              <dt>Notes</dt>
              <dd>{r.notes || "None"}</dd>
            </div>
            <div>
              <dt>Unresolved issues</dt>
              <dd>{r.unresolved_issues || "None recorded"}</dd>
            </div>
          </dl>
          <details>
            <summary>Completed checklist</summary>
            <ul>
              {r.checklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </details>
          <AsyncActionButton
            onClick={async () => {
              try {
                setPhotos(
                  (await api.get(`/work-reports/${r.id}/photos`)).data.data,
                );
              } catch {
                toast.error("Unable to load report photos.");
              }
            }}
          >
            Review private photos
          </AsyncActionButton>
          {canManage && r.state === "SUBMITTED_FOR_REVIEW" && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                try {
                  const result = await mutation.run({
                    id: r.id,
                    decision: String(f.get("decision")),
                    reason: String(f.get("reason") || ""),
                  });
                  if (result)
                    toast.success(
                      f.get("decision") === "APPROVE"
                        ? "Completion approved."
                        : "Changes requested.",
                    );
                } catch (error) {
                  toast.error(
                    axios.isAxiosError(error)
                      ? error.response?.data?.error?.message ||
                          "Unable to review report."
                      : "Unable to review report.",
                  );
                }
              }}
            >
              <fieldset disabled={mutation.isPending}>
                <label>
                  Review decision
                  <select name="decision">
                    <option value="CHANGES_REQUESTED">Request changes</option>
                    <option value="APPROVE">Approve completion</option>
                  </select>
                </label>
                <label>
                  Reason for changes
                  <textarea name="reason" maxLength={2000} />
                </label>
              </fieldset>
              <AsyncActionButton
                className="primary"
                type="submit"
                pending={mutation.isPending}
                pendingLabel="Submitting..."
              >
                Submit review decision
              </AsyncActionButton>
            </form>
          )}
        </article>
      ))}
      {!!photos.length && (
        <div className="report-photos">
          {photos.map((p) => (
            <a href={p.url} key={p.id} target="_blank" rel="noreferrer">
              <ImageWithFallback src={p.url} alt={`${p.purpose} job photo`} />
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
