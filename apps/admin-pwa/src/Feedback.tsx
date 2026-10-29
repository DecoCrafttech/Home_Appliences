import { useDebouncedValue, AppCheckbox } from "@home/ui";
import { LoadingSkeleton } from "@home/ui/skeletons";
import { AsyncActionButton as SafeAsyncButton } from "@home/ui";
import { icons, adminKeys } from "./design";
import { StatCard, StatusBadge } from "./components";
import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { api } from "./api";
type Feedback = {
  id: string;
  request_id: string;
  customer_id: string;
  customer_reference: string;
  full_name: string;
  request_number: string;
  appliance: string;
  request_type: string;
  rating: number;
  comment: string;
  tags: string[];
  handling_status: string;
  created_at: string;
  completed_at: string;
  notes: { id: string; note: string; full_name: string; created_at: string }[];
  history: {
    id: string;
    status: string;
    note: string;
    full_name: string;
    created_at: string;
  }[];
};
const errorMessage = (error: unknown) =>
  axios.isAxiosError(error)
    ? error.response?.data?.error?.message || "Unable to connect to the server."
    : "Unable to save changes.";
export function FeedbackPage() {
  const [filters, setFilters] = useState({
    q: "",
    rating: "",
    status: "",
    type: "",
    attention: "false",
  });
  const settledFilters = useDebouncedValue(filters);
  const [page, setPage] = useState(1);
  const summary = useQuery({
    queryKey: adminKeys.feedbackSummary,
    queryFn: async () =>
      (await api.get<{ data: Record<string, number> }>("/feedback/summary"))
        .data.data,
    refetchInterval: false,
  });
  const query = useQuery({
    queryKey: [...adminKeys.feedback, settledFilters, page],
    queryFn: async () =>
      (
        await api.get<{ data: Feedback[]; meta: { total: number } }>(
          "/feedback",
          { params: { ...settledFilters, page, limit: 20 } },
        )
      ).data,
    refetchInterval: false,
  });
  function filter(key: keyof typeof filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }
  return (
    <section>
      <div className="page-title">
        <h1>Feedback &amp; Reviews</h1>
        <SafeAsyncButton
          className="secondary"
          pending={query.isFetching || summary.isFetching}
          onClick={() => Promise.all([query.refetch(), summary.refetch()])}
        >
          Refresh feedback
        </SafeAsyncButton>
      </div>
      {summary.isPending ? (
        <LoadingSkeleton
          title="Loading review summary..."
          variant="kpis"
          count={4}
        />
      ) : (
        summary.data && (
          <div className="kpis feedback-kpis">
            {[
              {
                key: "total_reviews",
                label: "Total Reviews",
                icon: icons.star,
              },
              {
                key: "average_rating",
                label: "Average Rating",
                icon: icons.star,
              },
              { key: "low_ratings", label: "Low Ratings", icon: icons.support },
              {
                key: "needs_attention",
                label: "Needs Attention",
                icon: icons.bell,
              },
            ].map((item) => (
              <StatCard
                key={item.key}
                label={item.label}
                value={summary.data[item.key] ?? 0}
                icon={item.icon}
              />
            ))}
          </div>
        )
      )}
      <div className="admin-filters">
        <input
          aria-label="Search feedback"
          placeholder="Request, Customer ID or name"
          value={filters.q}
          onChange={(event) => filter("q", event.target.value)}
        />
        <select
          aria-label="Rating"
          value={filters.rating}
          onChange={(event) => filter("rating", event.target.value)}
        >
          <option value="">All ratings</option>
          {[5, 4, 3, 2, 1].map((r) => (
            <option key={r} value={r}>
              {r} stars
            </option>
          ))}
        </select>
        <select
          aria-label="Feedback status"
          value={filters.status}
          onChange={(event) => filter("status", event.target.value)}
        >
          <option value="">All handling statuses</option>
          {["NEW", "IN_REVIEW", "RESOLVED"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          aria-label="Request type"
          value={filters.type}
          onChange={(event) => filter("type", event.target.value)}
        >
          <option value="">All types</option>
          <option value="SERVICE">Service</option>
          <option value="INSTALLATION">Installation</option>
        </select>
        <label className="admin-check">
          <AppCheckbox
            checked={filters.attention === "true"}
            onChange={(event) =>
              filter("attention", String(event.target.checked))
            }
          />
          Needs attention
        </label>
      </div>
      {query.isPending ? (
        <LoadingSkeleton title="Loading feedback…" variant="table" />
      ) : query.isError ? (
        <p role="alert">
          Unable to load feedback.{" "}
          <button onClick={() => query.refetch()}>Try again</button>
        </p>
      ) : (
        <>
          <div className="table">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Request</th>
                  <th>Rating</th>
                  <th>Feedback</th>
                  <th>Submitted</th>
                  <th>Handling</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {query.data.data.map((review) => (
                  <tr key={review.id}>
                    <td>
                      <Link to={`/customers/${review.customer_id}`}>
                        {review.full_name}
                      </Link>
                      <small>{review.customer_reference}</small>
                    </td>
                    <td>
                      <Link to={`/requests/${review.request_id}`}>
                        {review.request_number}
                      </Link>
                      <small>
                        {review.appliance} · {review.request_type}
                      </small>
                    </td>
                    <td>
                      <span
                        className={`rating-pill ${review.rating <= 2 ? "low" : ""}`}
                      >
                        <icons.star /> {review.rating}/5
                      </span>
                    </td>
                    <td className="feedback-comment">
                      <span className="review-excerpt" title={review.comment}>
                        {review.comment || "No written comment"}
                      </span>
                    </td>
                    <td>{new Date(review.created_at).toLocaleDateString()}</td>
                    <td>
                      <span className="badge">
                        {review.handling_status.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td>
                      <Link to={`/feedback/${review.id}`}>
                        <icons.view /> View feedback
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!query.data.data.length && (
              <p className="admin-empty">No feedback matches these filters.</p>
            )}
          </div>
          <div className="table-pagination">
            <span>{query.data.meta.total} reviews</span>
            <div>
              <button
                disabled={page === 1}
                onClick={() => setPage((current) => current - 1)}
              >
                Previous
              </button>
              <button
                disabled={page * 20 >= query.data.meta.total}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
export function FeedbackDetail({ canManage }: { canManage: boolean }) {
  const { id } = useParams();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: adminKeys.feedbackDetail(id),
    queryFn: async () =>
      (await api.get<{ data: Feedback }>(`/feedback/${id}`)).data.data,
  });
  async function save(
    event: FormEvent<HTMLFormElement>,
    kind: "notes" | "handling",
  ) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    try {
      if (kind === "notes")
        await api.post(`/feedback/${id}/notes`, { note: data.get("note") });
      else
        await api.patch(`/feedback/${id}/handling`, {
          status: data.get("status"),
          note: data.get("note"),
        });
      await Promise.all([
        qc.invalidateQueries({ queryKey: adminKeys.feedbackDetail(id) }),
        qc.invalidateQueries({ queryKey: adminKeys.feedback }),
        qc.invalidateQueries({ queryKey: adminKeys.feedbackSummary }),
        qc.invalidateQueries({ queryKey: adminKeys.dashboardActivity }),
        qc.invalidateQueries({ queryKey: adminKeys.summary }),
        qc.invalidateQueries({ queryKey: adminKeys.customerDetails }),
      ]);
      form.reset();
      toast.success("Feedback updated successfully.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  if (query.isPending)
    return <LoadingSkeleton title="Loading feedback..." variant="detail" />;
  if (query.isError)
    return (
      <p role="alert">
        Unable to load feedback.{" "}
        <button onClick={() => query.refetch()}>Try again</button>
      </p>
    );
  const review = query.data;
  return (
    <section>
      <Link to="/feedback">
        <icons.back /> Feedback &amp; Reviews
      </Link>
      <div className="page-title">
        <h1>{review.request_number} · Feedback</h1>
        <StatusBadge status={review.handling_status} />
      </div>
      <div className="detail">
        <article>
          <h2>Customer experience</h2>
          {canManage && (
            <SafeAsyncButton
              className="feedback-followup"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const result = await api.post<{
                    data: { ticket_number: string };
                  }>(`/feedback/${id}/support`);
                  toast.success(
                    `Support ticket ${result.data.data.ticket_number} is ready.`,
                  );
                } catch (error) {
                  toast.error(errorMessage(error));
                } finally {
                  setBusy(false);
                }
              }}
              pending={busy}
              pendingLabel="Saving..."
            >
              Create support follow-up
            </SafeAsyncButton>
          )}
          <span className={`rating-pill ${review.rating <= 2 ? "low" : ""}`}>
            <icons.star /> {review.rating}/5
          </span>
          <p>{review.comment || "No written comment"}</p>
          <div className="tag-list">
            {review.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
          <p>
            <Link to={`/customers/${review.customer_id}`}>
              {review.full_name} · {review.customer_reference}
            </Link>
          </p>
          <p>
            <Link to={`/requests/${review.request_id}`}>
              {review.request_number} · {review.appliance}
            </Link>
          </p>
          <small>
            Completed:{" "}
            {review.completed_at
              ? new Date(review.completed_at).toLocaleString()
              : "Not recorded"}
            <br />
            Reviewed: {new Date(review.created_at).toLocaleString()}
          </small>
          <p className="honest">
            Customer ratings and comments cannot be edited by staff.
          </p>
        </article>
        {canManage && (
          <form onSubmit={(event) => save(event, "handling")}>
            <h2>Review handling</h2>
            <label>
              Status
              <select
                name="status"
                aria-label="Status"
                defaultValue={review.handling_status}
              >
                {["NEW", "IN_REVIEW", "RESOLVED"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Reason
              <textarea name="note" required minLength={3} maxLength={1000} />
            </label>
            <SafeAsyncButton
              disabled={busy}
              pending={busy}
              pendingLabel="Saving..."
            >
              <icons.save /> Save handling status
            </SafeAsyncButton>
          </form>
        )}
      </div>
      <div className="detail feedback-notes">
        <article>
          <h2>Internal notes</h2>
          {review.notes.map((note) => (
            <div className="internal-note" key={note.id}>
              <p>{note.note}</p>
              <small>
                {note.full_name} · {new Date(note.created_at).toLocaleString()}
              </small>
            </div>
          ))}
          {!review.notes.length && <p>No internal notes yet.</p>}
          {canManage && (
            <form onSubmit={(event) => save(event, "notes")}>
              <label>
                Add internal note
                <textarea name="note" minLength={3} maxLength={2000} required />
              </label>
              <SafeAsyncButton
                disabled={busy}
                pending={busy}
                pendingLabel="Saving..."
              >
                Add note
              </SafeAsyncButton>
            </form>
          )}
        </article>
        <article>
          <h2>Handling history</h2>
          {review.history.map((event) => (
            <div className="internal-note" key={event.id}>
              <strong>{event.status.replaceAll("_", " ")}</strong>
              <p>{event.note}</p>
              <small>
                {event.full_name} ·{" "}
                {new Date(event.created_at).toLocaleString()}
              </small>
            </div>
          ))}
          {!review.history.length && <p>No handling changes recorded.</p>}
        </article>
      </div>
    </section>
  );
}
