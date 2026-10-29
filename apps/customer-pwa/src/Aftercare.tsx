import { BookedPriceSummary } from "@home/ui";
import { AsyncActionButton as SafeAsyncButton } from "@home/ui";
import { EstimateApproval } from "./EstimateApproval";
import { customerKeys } from "./lib/queryKeys";
import { useEffect, useState, type FormEvent } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  requestReference,
  cancellationStatuses,
  reviewTags,
} from "@home/shared";
import { toast } from "sonner";
import axios from "axios";
import { api } from "./lib/api";
import type { RequestRecord, Review } from "./lib/types";
import { useTranslation, statusLabel } from "./lib/language";
import {
  AppModal,
  EmptyState,
  LoadingSkeleton,
  StarRating,
  StatusBadge,
} from "./components/ui";

const errorMessage = (error: unknown) =>
  axios.isAxiosError(error)
    ? error.response?.data?.error?.message ||
      "Unable to connect. Check your connection."
    : "Unable to complete this action.";
export function useRequests(enabled = true) {
  return useQuery({
    queryKey: customerKeys.requests,
    queryFn: async () =>
      (await api.get<{ data: RequestRecord[] }>("/requests")).data.data,
    retry: false,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    enabled,
  });
}
function nextStep(request: RequestRecord): string | undefined {
  switch (request.status) {
    case "REQUESTED":
    case "UNDER_REVIEW":
      return "We are reviewing your request. Your preferred visit is not confirmed yet.";
    case "EXECUTIVE_CONTACTED":
    case "ASSIGNMENT_PENDING":
    case "TECHNICIAN_ASSIGNED":
      return "We are arranging your visit. Check request updates for confirmation.";
    case "APPOINTMENT_CONFIRMED":
      return "Your visit is confirmed. Please keep your phone available.";
    case "TECHNICIAN_EN_ROUTE":
      return "Your technician is on the way. Please be available at the service address.";
    case "TECHNICIAN_ARRIVED":
    case "IN_PROGRESS":
      return "Your technician is handling the job. Any additional estimate needs your approval.";
    case "ESTIMATE_PENDING_APPROVAL":
      return "Review the estimate and approve or decline the additional work.";
    case "ON_HOLD":
      return "Your request is on hold. Check the latest update or contact support.";
    case "COMPLETED":
      return request.review_id
        ? undefined
        : "How did we do? Open this request to leave a review.";
    default:
      return undefined;
  }
}
export function RequestCard({
  request,
  compact = false,
}: {
  request: RequestRecord;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <article
      className={`request-card${compact ? " request-card-compact" : ""}`}
    >
      <div className="section-actions">
        <span className="eyebrow">{requestReference(request)}</span>
        <StatusBadge status={request.status} />
        {request.status_source === "ADMIN_OVERRIDE" && (
          <small>Manual admin status</small>
        )}
      </div>
      <h2>{t(request.appliance)}</h2>
      <p>
        {request.service_name} ·{" "}
        {t(request.request_type === "SERVICE" ? "Service" : "Installation")}
      </p>
      <div className="request-meta">
        <span>
          {request.confirmed_date ? "Confirmed: " : "Preferred: "}
          {(request.confirmed_date || request.preferred_date)?.slice(
            0,
            10,
          )} · {request.confirmed_time_window || request.preferred_time_window}
        </span>
      </div>
      {(!compact || request.status === "ESTIMATE_PENDING_APPROVAL") &&
        nextStep(request) && (
          <p className="request-next-step">{t(nextStep(request)!)}</p>
        )}
      <Link className="text-button" to={`/requests/${request.id}`}>
        {t(compact ? "Track Request" : "View details")} →
      </Link>
    </article>
  );
}
export function MyRequests() {
  const { t } = useTranslation();
  const query = useRequests();
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [submission] = useState<RequestRecord | undefined>(
    (location.state as { submitted?: RequestRecord } | null)?.submitted,
  );
  const [filters, setFilters] = useSearchParams();
  const tab = ["All", "Active", "Completed", "Cancelled"].includes(
    filters.get("status") || "",
  )
    ? filters.get("status")!
    : "All";
  const type = ["All", "Service", "Installation"].includes(
    filters.get("type") || "",
  )
    ? filters.get("type")!
    : "All";
  function updateFilter(key: string, value: string) {
    setFilters(
      () => {
        const next = new URLSearchParams(window.location.search);
        if (value === "All") next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );
  }
  const setTab = (value: string) => updateFilter("status", value);
  const setType = (value: string) => updateFilter("type", value);
  useEffect(() => {
    if (location.state?.submitted)
      navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate]);
  if (query.isPending)
    return (
      <section className="section page">
        <LoadingSkeleton />
      </section>
    );
  if (query.isError)
    return <RequestError error={query.error} retry={() => query.refetch()} />;
  const records =
    submission && !query.data.some((r) => r.id === submission.id)
      ? [submission, ...query.data]
      : query.data;
  const filtered = records.filter(
    (r) =>
      (tab === "All" ||
        (tab === "Active"
          ? !["COMPLETED", "CANCELLED"].includes(r.status)
          : r.status === tab.toUpperCase())) &&
      (type === "All" || r.request_type === type.toUpperCase()),
  );
  const reminder = query.data.find(
    (r) =>
      r.status === "COMPLETED" &&
      !r.review_id &&
      !r.review_reminder_dismissed_at,
  );
  return (
    <section className="section page">
      <div className="page-heading">
        <div>
          <h1>{t("My Requests")}</h1>
        </div>
        <SafeAsyncButton
          className="secondary"
          pending={query.isFetching}
          pendingLabel="Refreshing..."
          onClick={async () => {
            try {
              await query.refetch({ cancelRefetch: false, throwOnError: true });
            } catch (error) {
              toast.error(errorMessage(error));
            }
          }}
        >
          {t("Refresh")}
        </SafeAsyncButton>
        <Link className="primary" to="/services">
          + {t("Book a service")}
        </Link>
      </div>
      {submission && (
        <article className="confirmation-banner" role="status">
          <strong>{t("Request submitted successfully!")}</strong>
          <p>
            {t(
              "Our executive will contact you soon to confirm the next steps.",
            )}
          </p>
          <span>
            {requestReference(submission)} · {t(submission.appliance)} ·{" "}
            {submission.preferred_date?.slice(0, 10)} ·{" "}
            {submission.preferred_time_window}
          </span>
          <StatusBadge status={submission.status} />
          <Link to={`/requests/${submission.id}`} className="text-button">
            {t("View details")}
          </Link>
        </article>
      )}
      {reminder && (
        <div className="review-reminder">
          <div>
            <strong>
              {t("Service completed")} · {t(reminder.appliance)}
            </strong>
            <p>{t("How was your experience?")}</p>
          </div>
          <Link to={`/requests/${reminder.id}?review=1`} className="primary">
            {t("Rate & Review")}
          </Link>
          <button
            className="text-button"
            onClick={async () => {
              try {
                await api.patch(`/requests/${reminder.id}/review-reminder`);
                await qc.invalidateQueries({ queryKey: customerKeys.requests });
              } catch (error) {
                toast.error(errorMessage(error));
              }
            }}
          >
            {t("Not now")}
          </button>
        </div>
      )}
      <div className="filter-bar">
        <div className="filter-chips" aria-label="Request status">
          {["All", "Active", "Completed", "Cancelled"].map((value) => (
            <button
              key={value}
              aria-pressed={tab === value}
              className={tab === value ? "selected" : ""}
              onClick={() => setTab(value)}
            >
              {t(value)}
            </button>
          ))}
        </div>
        <select
          aria-label="Request type"
          value={type}
          onChange={(event) => setType(event.target.value)}
        >
          {["All", "Service", "Installation"].map((value) => (
            <option value={value} key={value}>
              {t(value)}
            </option>
          ))}
        </select>
      </div>
      <div className="requests-grid">
        {filtered.map((request) => (
          <RequestCard request={request} key={request.id} />
        ))}
      </div>
      {!filtered.length && (
        <EmptyState
          title={records.length ? "No matching requests" : "No requests yet"}
        >
          {records.length ? (
            <button
              className="secondary"
              type="button"
              onClick={() => {
                const next = new URLSearchParams(window.location.search);
                next.delete("status");
                next.delete("type");
                setFilters(next, { replace: true });
              }}
            >
              {t("Clear filters")}
            </button>
          ) : (
            <Link to="/services" className="text-button">
              {t("Choose your appliance")}
            </Link>
          )}
        </EmptyState>
      )}
    </section>
  );
}
export function RequestPage() {
  const { id } = useParams();
  const { t, locale } = useTranslation();
  const qc = useQueryClient();
  const [cancel, setCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copyFallback, setCopyFallback] = useState(false);
  const detail = useQuery({
    queryKey: customerKeys.request(id),
    queryFn: async () =>
      (await api.get<{ data: RequestRecord }>(`/requests/${id}`)).data.data,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
  const timeline = useQuery({
    queryKey: customerKeys.timeline(id),
    queryFn: async () =>
      (
        await api.get<{
          data: {
            id: string;
            status: string;
            note: string;
            created_at: string;
          }[];
        }>(`/requests/${id}/timeline`)
      ).data.data,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
  if (detail.isPending)
    return (
      <section className="section page">
        <LoadingSkeleton variant="detail" />
      </section>
    );
  if (detail.isError)
    return <RequestError error={detail.error} retry={() => detail.refetch()} />;
  const request = detail.data;
  const eligible = cancellationStatuses.includes(
    request.status as (typeof cancellationStatuses)[number],
  );
  const address = request.address_snapshot;
  async function confirmCancellation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const reason = String(
      new FormData(event.currentTarget).get("reason") || "",
    );
    setBusy(true);
    try {
      await api.post(`/requests/${id}/cancel`, {
        reason,
        version: request.version,
      });
      setCancel(false);
      await Promise.all([
        qc.invalidateQueries({ queryKey: customerKeys.request(id) }),
        qc.invalidateQueries({ queryKey: customerKeys.requests }),
        qc.invalidateQueries({ queryKey: customerKeys.timeline(id) }),
      ]);
      toast.success(t("Cancelled"));
    } catch (error) {
      toast.error(errorMessage(error));
      await detail.refetch();
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="section page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">{requestReference(request)}</span>
          <h1>{t(request.appliance)}</h1>
          <p>{request.service_name}</p>
        </div>
        <StatusBadge status={request.status} />
      </div>
      {nextStep(request) && (
        <p className="inline-note">{t(nextStep(request)!)}</p>
      )}
      <EstimateApproval
        requestId={request.id}
        closed={["COMPLETED", "CANCELLED"].includes(request.status)}
      />
      <div className="detail-actions">
        <SafeAsyncButton
          className="secondary"
          pending={detail.isFetching || timeline.isFetching}
          pendingLabel="Refreshing..."
          onClick={async () => {
            try {
              await Promise.all([
                detail.refetch({ cancelRefetch: false, throwOnError: true }),
                timeline.refetch({ cancelRefetch: false, throwOnError: true }),
                qc.refetchQueries(
                  { queryKey: ["customer-estimates", id], exact: true },
                  { cancelRefetch: false, throwOnError: true },
                ),
              ]);
            } catch (error) {
              toast.error(errorMessage(error));
            }
          }}
        >
          {t("Refresh")}
        </SafeAsyncButton>
        <button
          className="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(requestReference(request));
              toast.success("Request reference copied.");
            } catch {
              setCopyFallback(true);
            }
          }}
        >
          {t("Copy reference")}
        </button>
        <Link
          className="secondary"
          to={`/support?requestId=${request.id}&reference=${encodeURIComponent(requestReference(request))}`}
        >
          {t("Contact support")}
        </Link>
        <Link
          className="secondary"
          to={`/request/${request.request_type.toLowerCase()}?repeat=${request.id}`}
        >
          {t("Repeat request")}
        </Link>
        {eligible && (
          <button className="danger-button" onClick={() => setCancel(true)}>
            {t("Cancel request")}
          </button>
        )}
      </div>
      {!eligible && !["COMPLETED", "CANCELLED"].includes(request.status) && (
        <p className="inline-note">
          Online cancellation is no longer available at this stage. Contact
          support to discuss changes.
        </p>
      )}
      {request.status_source === "ADMIN_OVERRIDE" && (
        <p className="inline-note">
          An administrator updated this status. Your visit and technician
          details are shown below.
        </p>
      )}
      <div className="request-detail-grid">
        <article className="surface-card">
          <h2>{t("Location & contact")}</h2>
          <strong>
            {address.name} · {address.phone}
          </strong>
          <p>
            {address.line1}, {address.area}
            <br />
            {address.city}, {address.state} {address.pinCode}
          </p>
          <h2>{t("Visit details")}</h2>
          {request.assigned_technician_name && (
            <p>
              <strong>Technician: {request.assigned_technician_name}</strong>
              <br />
              {request.assigned_technician_phone}
            </p>
          )}
          {request.confirmed_date && (
            <p>
              <strong>Confirmed appointment</strong>
              <br />
              {request.confirmed_date?.slice(0, 10)} ·{" "}
              {request.confirmed_time_window}
            </p>
          )}
          <p>
            {request.preferred_date?.slice(0, 10)} ·{" "}
            {request.preferred_time_window}
          </p>
          {request.completed_at && (
            <section>
              <h2>{t("Work completed")}</h2>
              <p>{new Date(request.completed_at).toLocaleString()}</p>
              <p>
                {request.work_summary ||
                  "Completion details are available from support."}
              </p>
              {request.completion_notes && <p>{request.completion_notes}</p>}
            </section>
          )}
          {!request.completed_at && (
            <small>{t("Our executive will confirm availability.")}</small>
          )}
          <BookedPriceSummary details={request.details} />
          {Object.entries(request.details)
            .filter(
              ([key]) =>
                !key.startsWith("_") &&
                !["optionId", "optionIds"].includes(key),
            )
            .filter(([, value]) => value)
            .map(([key, value]) => (
              <p key={key}>
                <strong>
                  {(
                    request.details._fieldLabels as
                      | Record<string, string>
                      | undefined
                  )?.[key] || t("Additional details")}
                </strong>
                <br />
                {String(value)}
              </p>
            ))}
        </article>
        <article className="surface-card">
          <h2>Request updates</h2>
          {timeline.isPending ? (
            <LoadingSkeleton />
          ) : timeline.isError ? (
            <p role="alert">
              Unable to load timeline.{" "}
              <button onClick={() => timeline.refetch()}>
                {t("Try again")}
              </button>
            </p>
          ) : (
            <ol className="progress-timeline">
              {timeline.data.map((event) => (
                <li key={event.id}>
                  <span className="timeline-dot" />
                  <div>
                    <strong>{t(statusLabel(event.status))}</strong>
                    <p>{event.note}</p>
                    <small>
                      {new Date(event.created_at).toLocaleString(
                        locale === "ta" ? "ta-IN" : "en-IN",
                        { timeZone: "Asia/Kolkata" },
                      )}
                    </small>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </article>
      </div>
      {request.status === "COMPLETED" && <ReviewCard requestId={request.id} />}
      {cancel && (
        <AppModal
          title={t("Cancel request")}
          onClose={() => !busy && setCancel(false)}
        >
          <form onSubmit={confirmCancellation} className="workflow-form">
            <p>
              Cancellation is allowed before technician assignment. Your reason
              will be saved in the request timeline.
            </p>
            <label>
              {t("Cancellation reason")}
              <textarea name="reason" required minLength={3} maxLength={300} />
            </label>
            <SafeAsyncButton
              className="danger-button"
              disabled={busy}
              pending={busy}
              pendingLabel="Saving..."
            >
              {busy ? t("Loading…") : t("Confirm cancellation")}
            </SafeAsyncButton>
            <SafeAsyncButton
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => setCancel(false)}
              pending={busy}
              pendingLabel="Saving..."
            >
              {t("Keep request")}
            </SafeAsyncButton>
          </form>
        </AppModal>
      )}
      {copyFallback && (
        <AppModal
          title={t("Copy reference")}
          onClose={() => setCopyFallback(false)}
        >
          <p>Select and copy your request number:</p>
          <input
            readOnly
            value={requestReference(request)}
            onFocus={(event) => event.target.select()}
            autoFocus
            aria-label="Request reference"
          />
        </AppModal>
      )}
    </section>
  );
}
function ReviewCard({ requestId }: { requestId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(
    new URLSearchParams(window.location.search).has("review"),
  );
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: customerKeys.review(requestId),
    queryFn: async () =>
      (await api.get<{ data: Review | null }>(`/requests/${requestId}/review`))
        .data.data,
  });
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (rating < 1) {
      toast.error("Choose one to five stars.");
      return;
    }
    if (busy) return;
    const comment = String(
      new FormData(event.currentTarget).get("comment") || "",
    );
    setBusy(true);
    try {
      await api.post(`/requests/${requestId}/review`, {
        rating,
        comment,
        tags,
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: customerKeys.review(requestId) }),
        qc.invalidateQueries({ queryKey: customerKeys.requests }),
        qc.invalidateQueries({ queryKey: customerKeys.reviews }),
      ]);
      toast.success("Thank you for your feedback!");
      setOpen(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  if (query.isPending) return <LoadingSkeleton />;
  if (query.isError)
    return (
      <p role="alert">
        Unable to load your review.{" "}
        <button onClick={() => query.refetch()}>{t("Try again")}</button>
      </p>
    );
  return (
    <article className="surface-card feedback-card">
      <h2>{t(query.data ? "Your review" : "Service completed")}</h2>
      {query.data ? (
        <>
          <StarRating value={query.data.rating} />
          <p>{query.data.comment}</p>
          <div className="filter-chips">
            {query.data.tags.map((tag) => (
              <span key={tag}>{t(tag)}</span>
            ))}
          </div>
          <small>{new Date(query.data.created_at).toLocaleDateString()}</small>
        </>
      ) : open ? (
        <form onSubmit={submit}>
          <h3>{t("Rate & Review")}</h3>
          <StarRating value={rating} onChange={setRating} />
          <div className="filter-chips">
            {reviewTags.map((tag) => (
              <button
                type="button"
                key={tag}
                className={tags.includes(tag) ? "selected" : ""}
                aria-pressed={tags.includes(tag)}
                onClick={() =>
                  setTags((current) =>
                    current.includes(tag)
                      ? current.filter((value) => value !== tag)
                      : [...current, tag],
                  )
                }
              >
                {t(tag)}
              </button>
            ))}
          </div>
          <label className="form-field">
            {t("Written feedback")} · {t("Optional")}
            <textarea name="comment" maxLength={2000} />
          </label>
          <SafeAsyncButton
            className="primary"
            disabled={busy}
            pending={busy}
            pendingLabel="Saving..."
          >
            {t("Submit review")}
          </SafeAsyncButton>
        </form>
      ) : (
        <button className="primary" onClick={() => setOpen(true)}>
          {t("Rate & Review")}
        </button>
      )}
    </article>
  );
}
export function MyReviews() {
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: customerKeys.reviews,
    queryFn: async () =>
      (await api.get<{ data: Review[] }>("/profile/reviews")).data.data,
    retry: false,
  });
  if (query.isPending) return <LoadingSkeleton />;
  if (query.isError)
    return <RequestError error={query.error} retry={() => query.refetch()} />;
  return (
    <section className="section page">
      <h1>{t("My reviews")}</h1>
      {!query.data.length ? (
        <EmptyState title="No reviews yet" />
      ) : (
        query.data.map((review) => (
          <article className="surface-card" key={review.id}>
            <Link to={`/requests/${review.request_id}`} className="text-button">
              {review.request_number} · {t(review.appliance || "")}
            </Link>
            <StarRating value={review.rating} />
            <p>{review.comment}</p>
            <small>{new Date(review.created_at).toLocaleDateString()}</small>
          </article>
        ))
      )}
    </section>
  );
}
function RequestError({ error, retry }: { error: unknown; retry: () => void }) {
  const { t } = useTranslation();
  const unauthorized =
    axios.isAxiosError(error) && error.response?.status === 401;
  return (
    <section className="section page">
      <h1>{t("My Requests")}</h1>
      <p role="alert">{errorMessage(error)}</p>
      {unauthorized ? (
        <Link
          to={`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`}
          className="primary"
        >
          {t("Sign in")}
        </Link>
      ) : (
        <button className="primary" onClick={retry}>
          {t("Try again")}
        </button>
      )}
    </section>
  );
}
