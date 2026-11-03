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
  contactPhone,
} from "@home/shared";
import { toast } from "sonner";
import axios from "axios";
import { api } from "./lib/api";
import { useGoogleConfiguration } from "./lib/googleAuth";
import {
  FaCalendarDay,
  FaCircleCheck,
  FaClock,
  FaLocationDot,
  FaPhone,
  FaScrewdriverWrench,
} from "react-icons/fa6";
import type { RequestRecord, Review } from "./lib/types";
import { useTranslation } from "./lib/language";
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
    refetchOnWindowFocus: "always",
    refetchOnReconnect: true,
    enabled,
  });
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
      {(request.address_snapshot?.area || request.address_snapshot?.city) && (
        <p className="muted">
          <FaLocationDot aria-hidden="true" />{" "}
          {[request.address_snapshot.area, request.address_snapshot.city]
            .filter(Boolean)
            .join(", ")}
        </p>
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
  const [submission, setSubmission] = useState<RequestRecord | undefined>(
    (location.state as { submitted?: RequestRecord } | null)?.submitted,
  );
  const [filters, setFilters] = useSearchParams();
  const tab = ["All", "Pending", "In Progress", "Completed"].includes(
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
        <LoadingSkeleton variant="requests" />
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
        (tab === "Pending"
          ? [
              "REQUESTED",
              "UNDER_REVIEW",
              "EXECUTIVE_CONTACTED",
              "ASSIGNMENT_PENDING",
            ].includes(r.status)
          : tab === "In Progress"
            ? ![
                "REQUESTED",
                "UNDER_REVIEW",
                "EXECUTIVE_CONTACTED",
                "ASSIGNMENT_PENDING",
                "COMPLETED",
                "CANCELLED",
              ].includes(r.status)
            : r.status === "COMPLETED")) &&
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
        <article className="confirmation-banner v6-confirmation" role="status">
          <div className="v6-success-art" aria-hidden="true">
            <FaCircleCheck />
          </div>
          <h2>Request Submitted!</h2>
          <p>Our executive will contact you soon.</p>
          <strong>{requestReference(submission)}</strong>
          <span>
            {t(submission.appliance)} &middot;{" "}
            {submission.preferred_date?.slice(0, 10)} &middot;{" "}
            {submission.preferred_time_window}
          </span>
          <div className="v6-confirmation-actions">
            <button
              className="primary"
              onClick={() => setSubmission(undefined)}
            >
              View My Requests
            </button>
            <Link className="secondary" to="/book">
              Book Another Service
            </Link>
          </div>
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
          {["All", "Pending", "In Progress", "Completed"].map((value) => (
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
          kind={
            tab === "Completed"
              ? "completed"
              : records.length
                ? "search"
                : "requests"
          }
          title={
            tab === "Completed"
              ? "No completed services yet"
              : records.length
                ? "No matching requests"
                : "No requests yet"
          }
          description={
            tab === "Completed"
              ? "Completed services will appear here."
              : "Your appliance care requests will appear here."
          }
        >
          {records.length || tab === "Completed" ? (
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
              {t(tab === "Completed" ? "View Requests" : "Clear filters")}
            </button>
          ) : (
            <Link to="/book" className="primary">
              Book a Service
            </Link>
          )}
        </EmptyState>
      )}
    </section>
  );
}
export function RequestPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const config = useGoogleConfiguration();
  const [cancel, setCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const detail = useQuery({
    queryKey: customerKeys.request(id),
    queryFn: async () =>
      (await api.get<{ data: RequestRecord }>(`/requests/${id}`)).data.data,
    refetchInterval: false,
    refetchOnWindowFocus: "always",
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
  const address = request.address_snapshot;
  const technicianPhone = contactPhone(request.assigned_technician_phone);
  const officePhone = contactPhone(config.data?.adminOfficePhone);
  const eligible = cancellationStatuses.includes(
    request.status as (typeof cancellationStatuses)[number],
  );
  async function confirmCancellation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await api.post(`/requests/${id}/cancel`, {
        reason: String(new FormData(event.currentTarget).get("reason") || ""),
        version: request.version,
      });
      setCancel(false);
      await Promise.all([
        qc.invalidateQueries({ queryKey: customerKeys.request(id) }),
        qc.invalidateQueries({ queryKey: customerKeys.requests }),
      ]);
      toast.success(t("Cancelled"));
    } catch (error) {
      toast.error(errorMessage(error));
      await detail.refetch();
    } finally {
      setBusy(false);
    }
  }
  const formatDate = (value?: string | null) =>
    value
      ? new Intl.DateTimeFormat("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone: "Asia/Kolkata",
        }).format(
          new Date(value.length === 10 ? `${value}T12:00:00+05:30` : value),
        )
      : "Not scheduled";
  return (
    <section className="section page request-details-page">
      <header className="request-detail-hero">
        <div className="request-appliance-icon">
          <FaScrewdriverWrench aria-hidden="true" />
        </div>
        <div>
          <span className="eyebrow">{requestReference(request)}</span>
          <h1>{t(request.appliance)}</h1>
          <p>
            {request.service_name} ·{" "}
            {request.request_type === "INSTALLATION"
              ? "Installation"
              : "Service"}
          </p>
        </div>
        <StatusBadge status={request.status} />
      </header>
      <div className="request-detail-sections">
        <article className="request-info-card">
          <h2>Request overview</h2>
          <dl>
            <div>
              <dt>Request ID</dt>
              <dd>{requestReference(request)}</dd>
            </div>
            <div>
              <dt>Requested on</dt>
              <dd>{formatDate(request.created_at)}</dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>
                {request.request_type === "INSTALLATION"
                  ? "Installation"
                  : "Service"}
              </dd>
            </div>
          </dl>
        </article>
        <article className="request-info-card">
          <h2>Schedule information</h2>
          <div className="request-info-row">
            <FaCalendarDay aria-hidden="true" />
            <div>
              <span>
                {request.confirmed_date ? "Confirmed date" : "Preferred date"}
              </span>
              <strong>
                {formatDate(request.confirmed_date || request.preferred_date)}
              </strong>
            </div>
          </div>
          <div className="request-info-row">
            <FaClock aria-hidden="true" />
            <div>
              <span>Time slot</span>
              <strong>
                {request.confirmed_time_window ||
                  request.preferred_time_window ||
                  "Not scheduled"}
              </strong>
            </div>
          </div>
          <div className="request-info-row">
            <FaLocationDot aria-hidden="true" />
            <div>
              <span>Service address</span>
              <strong>
                {[
                  address.line1,
                  address.area,
                  address.city,
                  address.state,
                  address.pinCode,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </strong>
            </div>
          </div>
        </article>
        {contactPhone(address.phone) && (
          <article className="request-info-card request-contact-card">
            <h2>Customer contact</h2>
            <strong>{address.name}</strong>
            <a href={`tel:${contactPhone(address.phone)}`}>
              {contactPhone(address.phone)}
            </a>
          </article>
        )}
        {request.assigned_technician_name && (
          <article className="request-info-card request-contact-card">
            <h2>Technician details</h2>
            <strong>{request.assigned_technician_name}</strong>
            {technicianPhone && (
              <a
                className="primary request-call-action"
                href={`tel:${technicianPhone}`}
              >
                <FaPhone aria-hidden="true" /> Call Technician:{" "}
                {technicianPhone}
              </a>
            )}
          </article>
        )}
        <article className="request-info-card request-contact-card admin-office-card">
          <h2>Admin Office</h2>
          {officePhone ? (
            <>
              <strong>{officePhone}</strong>
              <a
                className="primary request-call-action"
                href={`tel:${officePhone}`}
              >
                <FaPhone aria-hidden="true" /> Call Admin
              </a>
            </>
          ) : (
            <p role="status">
              The official office number is being configured. Use Contact
              Support for help.
            </p>
          )}
          <Link
            className="secondary"
            to={`/support?requestId=${request.id}&reference=${encodeURIComponent(requestReference(request))}`}
          >
            Contact Support
          </Link>
        </article>
      </div>
      <EstimateApproval
        requestId={request.id}
        closed={["COMPLETED", "CANCELLED"].includes(request.status)}
      />
      {request.completed_at && request.work_summary && (
        <article className="request-info-card request-completion-card">
          <h2>Work completed</h2>
          <p>{request.work_summary}</p>
        </article>
      )}
      <div className="detail-actions">
        <SafeAsyncButton
          className="secondary"
          pending={detail.isFetching}
          pendingLabel="Refreshing..."
          onClick={() => detail.refetch()}
        >
          {t("Refresh")}
        </SafeAsyncButton>
        {eligible && (
          <button className="danger-button" onClick={() => setCancel(true)}>
            {t("Cancel request")}
          </button>
        )}
      </div>
      {request.status === "COMPLETED" && <ReviewCard requestId={request.id} />}
      {cancel && (
        <AppModal
          title={t("Cancel request")}
          onClose={() => !busy && setCancel(false)}
        >
          <form onSubmit={confirmCancellation} className="workflow-form">
            <label>
              {t("Cancellation reason")}
              <textarea name="reason" required minLength={3} maxLength={300} />
            </label>
            <SafeAsyncButton
              className="danger-button"
              pending={busy}
              pendingLabel="Saving..."
            >
              {t("Confirm cancellation")}
            </SafeAsyncButton>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => setCancel(false)}
            >
              {t("Keep request")}
            </button>
          </form>
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
  if (query.isPending) return <LoadingSkeleton variant="feedback" />;
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
  if (query.isPending) return <LoadingSkeleton variant="feedback" />;
  if (query.isError)
    return <RequestError error={query.error} retry={() => query.refetch()} />;
  return (
    <section className="section page">
      <h1>{t("My reviews")}</h1>
      {!query.data.length ? (
        <EmptyState
          kind="feedback"
          title="Nothing to review yet"
          description="You can share feedback after a service is completed."
          primaryAction={
            <Link to="/bookings" className="secondary">
              View My Requests
            </Link>
          }
        />
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
      <div role="alert">
        <EmptyState
          kind={unauthorized ? "auth" : "network"}
          title={
            unauthorized
              ? "Sign in to view your requests"
              : "Unable to load information"
          }
          description={errorMessage(error)}
          primaryAction={
            unauthorized ? (
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
            )
          }
        />
      </div>
    </section>
  );
}
