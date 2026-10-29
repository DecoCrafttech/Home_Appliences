import { AsyncActionButton as SafeAsyncButton } from "@home/ui";
import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import axios from "axios";
import { api } from "./api";
import { StatusBadge } from "./components";
const error = (e: unknown) =>
  toast.error(
    axios.isAxiosError(e)
      ? e.response?.data?.error?.message || "Connection failed"
      : "Unable to save.",
  );
type Workflow = {
  accounts: {
    technician_id: string;
    email: string;
    status: string;
    full_name: string;
  }[];
  reports: {
    id: string;
    request_id: string;
    request_number: string;
    technician_name: string;
    state: string;
    work_summary: string;
    checklist: string[];
    outcome: string;
    notes: string;
    parts: string;
    unresolved_issues: string;
    version: number;
  }[];
  assignments: {
    id: string;
    request_number: string;
    technician_name: string;
    state: string;
    reason: string;
  }[];
};
export function TechnicianOperations({
  technicians,
}: {
  technicians: { id: string; full_name: string }[];
}) {
  const [params] = useSearchParams();
  const qc = useQueryClient(),
    [busy, setBusy] = useState(false),
    [invite, setInvite] = useState(""),
    [photos, setPhotos] = useState<
      { id: string; purpose: string; url: string }[]
    >([]);
  const q = useQuery({
    queryKey: ["admin", "technician-workflow"],
    queryFn: async () =>
      (await api.get<{ data: Workflow }>("/technician-workflow")).data.data,
    refetchInterval: false,
  });
  const reportId = params.get("report");
  useEffect(() => {
    if (reportId && q.data?.reports.some((r) => r.id === reportId)) {
      const element = document.getElementById("work-report-" + reportId);
      element?.scrollIntoView({ block: "start" });
      element?.focus();
    }
  }, [reportId, q.data]);
  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const r = await api.post("/technicians/" + f.get("id") + "/invite", {
        email: f.get("email"),
      });
      setInvite(
        new URL(
          r.data.data.activationPath,
          import.meta.env.VITE_TECHNICIAN_ORIGIN || "http://127.0.0.1:5175",
        ).href,
      );
      await q.refetch();
      toast.success(
        "Invitation created. Copy the secure link for the technician.",
      );
    } catch (e) {
      error(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="ui-panel">
      <h2>Technician accounts and completion review</h2>
      <TechnicianDocuments technicians={technicians} />
      <p>
        Invitations expire after two hours and can be activated once. Verify
        identity before approving a technician. Invitation delivery is by secure
        link.
      </p>
      <details>
        <summary>Invite an existing technician</summary>
        <form onSubmit={send}>
          <label>
            Technician
            <select name="id" required>
              <option value="">Choose existing technician</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Email
            <input type="email" name="email" required maxLength={254} />
          </label>
          <SafeAsyncButton
            disabled={busy}
            pending={busy}
            pendingLabel="Saving..."
          >
            Create invitation
          </SafeAsyncButton>
        </form>
        {invite && (
          <label>
            Single-use activation link
            <input readOnly value={invite} onFocus={(e) => e.target.select()} />
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(invite);
                  toast.success("Invitation copied.");
                } catch {
                  toast.error("Select and copy the link.");
                }
              }}
            >
              Copy invitation
            </button>
          </label>
        )}
      </details>
      {q.isError ? (
        <p role="alert">
          Unable to load technician workflow.{" "}
          <button onClick={() => q.refetch()}>Retry</button>
        </p>
      ) : (
        <>
          <h3>Account access</h3>
          {!q.data?.accounts.length && (
            <p>No technician accounts invited yet.</p>
          )}
          {q.data?.accounts.map((a) => (
            <article className="ui-panel" key={a.technician_id}>
              <strong>{a.full_name}</strong>
              <p>{a.email}</p>
              <small>Technician ID: {a.technician_id}</small>
              <StatusBadge status={a.status} />
              {a.status !== "INVITED" && (
                <SafeAsyncButton
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await api.patch(
                        "/technicians/" + a.technician_id + "/account",
                        {
                          status:
                            a.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED",
                        },
                      );
                      await q.refetch();
                      toast.success(
                        "Account access updated. Existing sessions revoked.",
                      );
                    } catch (e) {
                      error(e);
                    } finally {
                      setBusy(false);
                    }
                  }}
                  pending={busy}
                  pendingLabel="Saving..."
                >
                  {a.status === "SUSPENDED" ? "Reactivate" : "Suspend access"}
                </SafeAsyncButton>
              )}
            </article>
          ))}
          <h3>Pending completion approval</h3>
          {!q.data?.reports.length && <p>No work reports awaiting review.</p>}
          {q.data?.reports.map((r) => (
            <article
              className="ui-panel"
              key={r.id}
              id={"work-report-" + r.id}
              tabIndex={-1}
            >
              <Link to={"/requests/" + r.request_id}>{r.request_number}</Link>
              <p>
                {r.technician_name} · Report version {r.version}
              </p>
              <StatusBadge status={r.state} />
              <h4>{r.work_summary}</h4>
              <ReportPrivateNotes reportId={r.id} />
              <p>Outcome: {r.outcome}</p>
              <ul>
                {r.checklist.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <p>{r.notes}</p>
              <p>Parts: {r.parts || "None recorded"}</p>
              <p>Unresolved issues: {r.unresolved_issues || "None recorded"}</p>
              <button
                onClick={async () => {
                  try {
                    setPhotos(
                      (await api.get("/work-reports/" + r.id + "/photos")).data
                        .data,
                    );
                  } catch (e) {
                    error(e);
                  }
                }}
              >
                Review private photos
              </button>
              {r.state === "SUBMITTED_FOR_REVIEW" && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    setBusy(true);
                    try {
                      await api.post("/work-reports/" + r.id + "/review", {
                        decision: f.get("decision"),
                        reason: f.get("reason"),
                      });
                      await Promise.all([
                        q.refetch(),
                        qc.invalidateQueries({ queryKey: ["admin-requests"] }),
                        qc.invalidateQueries({ queryKey: ["summary"] }),
                      ]);
                      toast.success(
                        f.get("decision") === "APPROVE"
                          ? "Completion approved. Customer notified."
                          : "Corrections requested.",
                      );
                    } catch (e) {
                      error(e);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <label>
                    Review decision
                    <select name="decision">
                      <option value="CHANGES_REQUESTED">
                        Request corrections
                      </option>
                      <option value="APPROVE">Approve completion</option>
                    </select>
                  </label>
                  <label>
                    Correction reason
                    <textarea name="reason" maxLength={2000} />
                  </label>
                  <SafeAsyncButton
                    className="primary"
                    disabled={busy}
                    pending={busy}
                    pendingLabel="Submitting..."
                  >
                    Submit review decision
                  </SafeAsyncButton>
                </form>
              )}
            </article>
          ))}
          {photos.length > 0 && (
            <div className="tech-job-grid">
              {photos.map((p) => (
                <a key={p.id} href={p.url} target="_blank" rel="noreferrer">
                  <img
                    src={p.url}
                    alt={p.purpose + " job photo"}
                    style={{ maxWidth: "100%", maxHeight: 260 }}
                  />
                </a>
              ))}
            </div>
          )}
          <details>
            <summary>Recent assignment responses</summary>
            {q.data?.assignments.map((a) => (
              <p key={a.id}>
                {a.request_number} · {a.technician_name} ·{" "}
                <StatusBadge status={a.state} />
                {a.reason}
              </p>
            ))}
          </details>
        </>
      )}
    </section>
  );
}
export function TechnicianDocuments({
  technicians,
}: {
  technicians: { id: string; full_name: string }[];
}) {
  const [id, setId] = useState(""),
    [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: ["admin", "technician-documents", id],
    enabled: !!id,
    queryFn: async () =>
      (
        await api.get<{ data: { id: string; url: string }[] }>(
          "/technicians/" + id + "/documents",
        )
      ).data.data,
  });
  return (
    <details>
      <summary>Private identity documents</summary>
      <p>
        Review identity evidence before verifying account eligibility. Uploaded
        images are private and do not automatically approve an account.
      </p>
      <label>
        Technician for document review
        <select value={id} onChange={(e) => setId(e.target.value)}>
          <option value="">Choose technician</option>
          {technicians.map((t) => (
            <option key={t.id} value={t.id}>
              {t.full_name}
            </option>
          ))}
        </select>
      </label>
      {id && (
        <>
          <label>
            Upload verification image (up to 8 MB)
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setBusy(true);
                try {
                  const r = await api.post(
                    "/technicians/" + id + "/documents/upload",
                    { contentType: file.type, size: file.size },
                  );
                  await axios.put(r.data.data.uploadUrl, file, {
                    headers: { "Content-Type": file.type },
                  });
                  await api.post(
                    "/technicians/" +
                      id +
                      "/documents/" +
                      r.data.data.id +
                      "/confirm",
                  );
                  await q.refetch();
                  toast.success("Private verification evidence saved.");
                } catch (e) {
                  error(e);
                } finally {
                  setBusy(false);
                }
              }}
            />
          </label>
          {q.isError && (
            <p role="alert">Unable to retrieve verification evidence.</p>
          )}
          {q.data?.map((d, k) => (
            <a key={d.id} href={d.url} target="_blank" rel="noreferrer">
              View private evidence {k + 1}
            </a>
          ))}
        </>
      )}
    </details>
  );
}
function ReportPrivateNotes({ reportId }: { reportId: string }) {
  const [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: ["admin", "report-notes", reportId],
    queryFn: async () =>
      (
        await api.get<{
          data: { id: string; reason: string; full_name: string }[];
        }>("/work-reports/" + reportId + "/notes")
      ).data.data,
  });
  return (
    <details>
      <summary>Private operations notes</summary>
      {q.data?.map((n) => (
        <p key={n.id}>
          {n.full_name}: {n.reason}
        </p>
      ))}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          setBusy(true);
          try {
            await api.post("/work-reports/" + reportId + "/notes", {
              note: new FormData(form).get("note"),
            });
            form.reset();
            await q.refetch();
            toast.success("Private note saved.");
          } catch (e) {
            error(e);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Internal review note
          <textarea name="note" required maxLength={2000} />
        </label>
        <SafeAsyncButton
          disabled={busy}
          pending={busy}
          pendingLabel="Saving..."
        >
          Save private note
        </SafeAsyncButton>
      </form>
    </details>
  );
}
