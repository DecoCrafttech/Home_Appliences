import {
  JobFilters,
  useJobFilters,
  jobFilterQuery,
  jobFilterLabel,
  jobViews,
} from "./JobFilters";
import { AppErrorBoundary, BrandLogo } from "@home/ui";
import {
  AppInput,
  AppCheckbox,
  AppBackButton,
  AppSelect,
  AppTextarea,
  PasswordInput,
  AppCard,
  ImageWithFallback,
} from "@home/ui";
import { activeRecordRefresh } from "@home/ui";
import { contactPhone } from "@home/shared";
import { requestReference } from "@home/shared";
import { api } from "./api";
import {
  PushNotificationSettings,
  removeCurrentPushSubscription,
} from "@home/ui/push";
import { TechSchedule } from "./TechSchedule";
import { CompleteJobButton } from "./CompleteJobButton";
import {
  NotificationCenter,
  notificationInbox,
  type InboxNotice,
} from "@home/ui";
import { AsyncActionButton as SafeAsyncButton } from "@home/ui";
import { LocationActions, AsyncActionButton } from "@home/ui";
import { technicianWorkReportSchema } from "@home/shared";
import { useRef, useState, type FormEvent } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Routes,
  Route,
  useParams,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { icons } from "./design";
import { FaLocationDot, FaPhone, FaUser } from "react-icons/fa6";
import {
  PageHeader,
  StatusBadge,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "./components";
const message = (e: unknown) =>
  axios.isAxiosError(e)
    ? e.response?.data?.error?.message || "Connection failed. Please try again."
    : "Unable to complete this action.";
type Profile = {
  username?: string;
  must_change_password?: boolean;
  id: string;
  full_name: string;
  phone: string;
  email: string;
  service_area: string;
  verification_status: string;
  account_status: string;
  completed_count: number;
  average_rating: number | null;
  csrfToken: string;
};
type Estimate = {
  id: string;
  state: string;
  diagnosis: string;
  total_paise: number;
  items: {
    type: string;
    description: string;
    quantity: number;
    unitPrice: number;
  }[];
};
type Report = {
  id: string;
  state: string;
  outcome: string;
  work_summary: string;
  correction_reason: string;
};
type Job = {
  display_number?: number | string;
  id: string;
  request_number: string;
  request_type: string;
  appliance: string;
  service_name: string;
  status: string;
  version: number;
  assignment_id: string;
  assignment_state: string;
  assignment_version: number;
  latest_report_state?: string;
  latest_report_outcome?: string;
  completion_blocked_by_estimate?: boolean;
  area?: string;
  city?: string;
  status_source?: string;
  customer_phone?: string;
  customer_name?: string;
  preferred_date: string;
  preferred_time_window: string;
  confirmed_date?: string;
  confirmed_time_window?: string;
  address_snapshot?: Record<string, string>;
  customer?: { full_name: string; phone_e164: string };
  details?: Record<string, unknown>;
  timeline?: { id: string; status: string; note: string; created_at: string }[];
  checklist?: string[];
  estimates?: Estimate[];
  reports?: Report[];
  attachments?: { id: string; purpose: string }[];
};
export function TechnicianApp() {
  const qc = useQueryClient(),
    location = useLocation(),
    navigate = useNavigate();
  const me = useQuery({
    queryKey: ["technician", "me"],
    queryFn: async () => {
      const p = (await api.get<{ data: Profile }>("/auth/me")).data.data;
      api.defaults.headers.common["X-CSRF-Token"] = p.csrfToken;
      return p;
    },
    retry: false,
    staleTime: 30000,
    refetchOnWindowFocus: "always",
  });
  const notices = useQuery({
    queryKey: ["technician", "notifications", me.data?.id],
    queryFn: async () =>
      notificationInbox(
        (
          await api.get<{
            data: InboxNotice[];
            meta?: { unreadCount: number; fetchedAt: string };
          }>("/notifications")
        ).data,
      ),
    enabled: false,
    refetchInterval: false,
    retry: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 60000,
  });
  if (location.pathname === "/technician/activate")
    return <TechnicianLogin activate />;
  if (me.isPending)
    return (
      <LoadingSkeleton
        title="Checking technician session..."
        variant="profile"
      />
    );
  if (me.isError) {
    if (
      axios.isAxiosError(me.error) &&
      me.error.response?.data?.error?.code === "ACCOUNT_FROZEN"
    )
      return (
        <main className="tech-login">
          <section className="panel">
            <BrandLogo />
            <h1>Account access paused</h1>
            <p>
              Your technician account has been frozen. Contact an administrator
              to restore access.
            </p>
          </section>
        </main>
      );
    if (axios.isAxiosError(me.error) && me.error.response?.status === 401)
      return <TechnicianLogin />;
    return (
      <ErrorState
        title="Unable to verify your session"
        retry={() => me.refetch()}
      />
    );
  }
  if (me.data.must_change_password) return <FirstPasswordChange />;
  const links = [
    ["", "Home", icons.dashboard],
    ["/jobs", "My jobs", icons.service],
    ["/schedule", "Schedule", icons.calendar],
    ["/profile", "Profile", icons.customers],
  ] as const;
  return (
    <div className="tech-shell">
      <aside className="tech-sidebar">
        <Link className="tech-brand" to="/technician">
          <BrandLogo />
          <small>Technician workspace</small>
        </Link>
        <nav aria-label="Technician navigation">
          {links.map(([path, label, Icon]) => (
            <NavLink end={path === ""} key={path} to={"/technician" + path}>
              <Icon />
              {label}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={async () => {
            try {
              await removeCurrentPushSubscription(api).catch(() => undefined);
              await api.post("/auth/logout");
              qc.clear();
              locationReplace("/technician/login");
            } catch (e) {
              toast.error(message(e));
            }
          }}
        >
          Sign out
        </button>
      </aside>
      <div className="tech-main">
        <header className="tech-header">
          <Link
            to="/technician"
            className="tech-header-brand"
            aria-label="Fixbeez technician home"
          >
            <BrandLogo />
          </Link>
          <NotificationCenter
            query={notices}
            queryKey={["technician", "notifications", me.data?.id]}
            read={(id) => api.post(`/notifications/${id}/read`)}
            readAll={() =>
              api.post("/notifications/read-all", {
                before: notices.data?.fetchedAt,
              })
            }
            destination={(n) =>
              n.request_id ? `/technician/jobs/${n.request_id}` : "/technician"
            }
            navigate={navigate}
            initiallyOpen={location.pathname === "/technician/notifications"}
            onLegacyClose={() => navigate("/technician", { replace: true })}
          />
          <Link
            to="/technician/profile"
            className="tech-header-profile"
            aria-label={`${me.data.full_name} profile`}
          >
            <TechAvatar name={me.data.full_name} />
            <span>
              {me.data.full_name}
              <small>
                {me.data.verification_status.replaceAll("_", " ").toLowerCase()}
              </small>
            </span>
          </Link>
        </header>
        <main>
          <AppErrorBoundary key={location.pathname}>
            <Routes>
              <Route path="/" element={<TechHome />} />
              <Route path="/login" element={<TechHome />} />
              <Route path="/jobs" element={<TechJobs />} />
              <Route path="/jobs/:id" element={<TechJobRoute />} />
              <Route path="/schedule" element={<TechSchedule />} />
              <Route
                path="/history"
                element={
                  <Navigate to="/technician/jobs?view=completed" replace />
                }
              />
              <Route
                path="/profile"
                element={<TechProfile profile={me.data} />}
              />
              <Route path="/notifications" element={null} />
              <Route
                path="*"
                element={
                  <EmptyState
                    title="Page unavailable"
                    description="Choose a page from your technician navigation."
                  />
                }
              />
            </Routes>
          </AppErrorBoundary>
        </main>
      </div>
      <nav className="tech-bottom" aria-label="Mobile technician navigation">
        {links.map(([path, label, Icon]) => (
          <NavLink end={path === ""} key={path} to={"/technician" + path}>
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
function locationReplace(path: string) {
  window.location.assign(path);
}
function TechnicianLogin({ activate = false }: { activate?: boolean }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      if (activate) {
        if (f.get("password") !== f.get("confirm"))
          throw new Error("Passwords must match.");
        await api.post("/auth/activate", {
          token:
            new URLSearchParams(window.location.hash.slice(1)).get("token") ||
            "",
          password: f.get("password"),
        });
        window.history.replaceState(null, "", "/technician/login");
        toast.success("Account activated. Sign in with your new password.");
        locationReplace("/technician/login");
      } else {
        await api.post("/auth/login", {
          username: f.get("email"),
          password: f.get("password"),
          ...(f.get("code") ? { code: f.get("code") } : {}),
        });
        locationReplace("/technician");
      }
    } catch (e) {
      setError(
        e instanceof Error && !axios.isAxiosError(e) ? e.message : message(e),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="tech-login">
      <section className="panel">
        <BrandLogo />
        <span className="eyebrow">Fixbeez Operations</span>
        <h1>
          {activate ? "Activate technician account" : "Technician sign in"}
        </h1>
        <p>
          {activate
            ? "Create your own password. This invitation can only be used once."
            : "Use the account approved by your operations team."}
        </p>
        <form onSubmit={submit}>
          {!activate && (
            <label>
              Username or email
              <AppInput
                name="email"
                type="text"
                autoComplete="username"
                required
                maxLength={254}
              />
            </label>
          )}
          <label>
            {activate ? "New password" : "Password"}
            <PasswordInput
              name="password"
              autoComplete={activate ? "new-password" : "current-password"}
              minLength={activate ? 14 : 1}
              maxLength={128}
              required
            />
          </label>
          {activate && (
            <label>
              Confirm password
              <PasswordInput
                name="confirm"
                autoComplete="new-password"
                minLength={14}
                maxLength={128}
                required
              />
            </label>
          )}
          {!activate && (
            <label>
              Authenticator code (if enabled)
              <AppInput
                name="code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                autoComplete="one-time-code"
              />
            </label>
          )}
          {error && <p role="alert">{error}</p>}
          <SafeAsyncButton
            className="primary"
            disabled={busy}
            pending={busy}
            pendingLabel="Saving..."
          >
            {busy
              ? "Please wait..."
              : activate
                ? "Activate account"
                : "Sign in"}
          </SafeAsyncButton>
        </form>
        <p>
          Invitations, account approval or password assistance: contact an
          administrator.
        </p>
        <Link to="/">Staff sign in</Link>
      </section>
    </main>
  );
}
function FirstPasswordChange() {
  const qc = useQueryClient(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <main className="tech-login">
      <section className="panel">
        <BrandLogo />
        <h1>Choose your own password</h1>
        <p>Replace your temporary password before opening your assignments.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            const form = new FormData(e.currentTarget);
            setError("");
            if (form.get("newPassword") !== form.get("confirm")) {
              setError("New passwords must match.");
              return;
            }
            setBusy(true);
            try {
              await api.post("/auth/password", {
                currentPassword: form.get("currentPassword"),
                newPassword: form.get("newPassword"),
              });
              await qc.invalidateQueries({ queryKey: ["technician", "me"] });
              toast.success("Password changed. Your workspace is ready.");
            } catch (error) {
              setError(message(error));
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset disabled={busy}>
            <label>
              Temporary password
              <PasswordInput
                name="currentPassword"
                autoComplete="current-password"
                required
                maxLength={128}
              />
            </label>
            <label>
              New password
              <PasswordInput
                name="newPassword"
                autoComplete="new-password"
                required
                minLength={14}
                maxLength={128}
              />
            </label>
            <label>
              Confirm new password
              <PasswordInput
                name="confirm"
                autoComplete="new-password"
                required
                minLength={14}
                maxLength={128}
              />
            </label>
          </fieldset>
          {error && <p role="alert">{error}</p>}
          <AsyncActionButton
            type="submit"
            pending={busy}
            pendingLabel="Changing password..."
            className="primary"
          >
            Change password
          </AsyncActionButton>
        </form>
        <AsyncActionButton
          onClick={async () => {
            await removeCurrentPushSubscription(api).catch(() => undefined);
            await api.post("/auth/logout");
            qc.clear();
            locationReplace("/technician/login");
          }}
        >
          Sign out
        </AsyncActionButton>
      </section>
    </main>
  );
}
function JobCardSummary({
  job,
  showArea = true,
}: {
  job: Job;
  showArea?: boolean;
}) {
  const visitDate = (job.confirmed_date || job.preferred_date)?.slice(0, 10);
  const area = [job.area, job.city].filter(Boolean).join(", ");
  const customerName = job.customer_name || job.customer?.full_name;
  return (
    <>
      <div className="tech-job-heading">
        <span className="request-reference">{requestReference(job)}</span>
        <StatusBadge status={job.status} />
      </div>
      <div className="tech-job-service">
        <h2>{job.appliance}</h2>
        <p>
          {job.service_name ||
            (job.request_type === "INSTALLATION" ? "Installation" : "Service")}
        </p>
      </div>

      <div className="tech-job-facts">
        <div>
          <icons.calendar aria-hidden="true" />
          <p>
            <span>
              {job.confirmed_date ? "Confirmed visit" : "Preferred visit"}
            </span>
            <strong>
              {visitDate ? (
                <time dateTime={visitDate}>
                  {new Intl.DateTimeFormat("en-IN", {
                    day: "numeric",
                    month: "short",
                    timeZone: "Asia/Kolkata",
                  }).format(new Date(`${visitDate}T12:00:00+05:30`))}
                </time>
              ) : (
                "Date not set"
              )}
              {(job.confirmed_time_window || job.preferred_time_window) && (
                <> · {job.confirmed_time_window || job.preferred_time_window}</>
              )}
            </strong>
          </p>
        </div>
        {customerName ? (
          <div>
            <FaUser aria-hidden="true" />
            <p>{customerName}</p>
          </div>
        ) : null}
        {showArea && area && (
          <div>
            <FaLocationDot aria-hidden="true" />
            <p>{area}</p>
          </div>
        )}
      </div>
    </>
  );
}
function TechnicianJobCard({
  job,
  actionLabel = "View job",
}: {
  job: Job;
  actionLabel?: string;
}) {
  const phone = contactPhone(job.customer_phone || job.customer?.phone_e164);
  const onHold = job.status === "ON_HOLD";
  return (
    <AppCard variant="job" className="panel tech-job-card">
      <JobCardSummary job={job} showArea={!job.address_snapshot} />
      {phone && (
        <a href={`tel:${phone}`} aria-label="Call Customer">
          <FaPhone aria-hidden="true" /> Call Customer: {phone}
        </a>
      )}
      {job.address_snapshot && (
        <div className="tech-card-location">
          <p>
            {[
              job.address_snapshot.line1,
              job.address_snapshot.area,
              job.address_snapshot.city,
            ]
              .filter(Boolean)
              .join(", ")}
          </p>
          <LocationActions address={job.address_snapshot} directions compact />
        </div>
      )}
      <div className="tech-card-actions">
        <CompleteJobButton job={job} />
        {onHold ? (
          <span className="tech-action-disabled" aria-disabled="true">
            Job on hold
          </span>
        ) : (
          <Link
            className="primary tech-job-open"
            to={`/technician/jobs/${job.id}`}
          >
            {actionLabel}
          </Link>
        )}
        {onHold && (
          <Link className="secondary" to={`/technician/jobs/${job.id}`}>
            View details
          </Link>
        )}
      </div>
    </AppCard>
  );
}
function TechHome() {
  const { filters, apply } = useJobFilters();
  const filtered =
    filters.view !== "active" || !!filters.type || !!filters.date;
  const profile = useQueryClient().getQueryData<Profile>(["technician", "me"]);
  const q = useQuery({
    queryKey: ["technician", "dashboard"],
    queryFn: async () =>
      (
        await api.get<{
          data: {
            today: number;
            pending: number;
            in_progress: number;
            completed_today: number;
            next_jobs?: Job[];
          };
        }>("/dashboard")
      ).data.data,
    enabled: !filtered,
    refetchInterval: false,
    refetchOnMount: "always",
  });
  const matching = useQuery({
    queryKey: [
      "technician",
      "jobs",
      { tab: filters.view, type: filters.type, page: 1, date: filters.date },
    ],
    queryFn: async () =>
      (
        await api.get<{ data: Job[]; meta: { total: number } }>("/jobs", {
          params: {
            tab: filters.view,
            type: filters.type || undefined,
            date: filters.date || undefined,
            page: 1,
            limit: 20,
          },
        })
      ).data,
    enabled: filtered,
    refetchInterval: false,
  });
  const pending = filtered ? matching.isPending : q.isPending;
  const error = filtered ? matching.isError : q.isError;
  const fetching = filtered ? matching.isFetching : q.isFetching;
  const jobs = filtered ? matching.data?.data || [] : q.data?.next_jobs || [];
  const refresh = () => (filtered ? matching.refetch() : q.refetch());
  const jobsUrl = `/technician/jobs${jobFilterQuery(filters)}`;
  return (
    <section className="staff-workday">
      <PageHeader
        title="Your workday"
        description="A clear view of your visits and the work ahead."
        actions={
          <>
            <button
              className="secondary staff-refresh"
              aria-label="Refresh workday"
              disabled={fetching}
              onClick={refresh}
            >
              <icons.refresh aria-hidden="true" />
              <span>Refresh</span>
            </button>
            <JobFilters value={filters} onApply={apply} />
          </>
        }
      />
      {pending ? (
        <LoadingSkeleton title="Loading workday..." variant="workday" />
      ) : error ? (
        <ErrorState title="Unable to load your workday" retry={refresh} />
      ) : (
        <>
          <div className="staff-dashboard-hero staff-technician-hero">
            <div>
              <p className="staff-eyebrow">YOUR DAY, SIMPLIFIED</p>
              <h2>
                {profile?.full_name
                  ? `Good to see you, ${profile.full_name.split(" ")[0]}.`
                  : "A clear plan for your day."}
              </h2>
              <p>
                {filtered
                  ? jobFilterLabel(filters)
                  : "Keep your next visit, customer details and job updates together."}
              </p>
              <Link className="primary" to={jobsUrl}>
                Open My Jobs <icons.next aria-hidden="true" />
              </Link>
            </div>
            <div className="staff-hero-signal">
              <span>
                <icons.calendar aria-hidden="true" />
                {filtered ? "Matching jobs" : "Completed today"}
              </span>
              <strong>
                {filtered
                  ? (matching.data?.meta.total ?? "--")
                  : (q.data?.completed_today ?? "--")}
              </strong>
              <small>
                {filtered
                  ? "Across this filtered view"
                  : new Intl.DateTimeFormat("en-IN", {
                      weekday: "long",
                      day: "numeric",
                      month: "short",
                      timeZone: "Asia/Kolkata",
                    }).format(new Date())}
              </small>
            </div>
          </div>
          <div className="stat-grid workday-stats">
            {filtered ? (
              <>
                <Link className="stat-card" to={jobsUrl}>
                  <span>Showing now</span>
                  <strong>{jobs.length}</strong>
                  <small>
                    of {matching.data?.meta.total ?? 0} matching jobs
                  </small>
                </Link>
                <article className="stat-card staff-context-stat">
                  <span>Work view</span>
                  <strong>{jobViews[filters.view]}</strong>
                </article>
                <article className="stat-card staff-context-stat">
                  <span>Request type</span>
                  <strong>
                    {filters.type === "SERVICE"
                      ? "Service"
                      : filters.type === "INSTALLATION"
                        ? "Installation"
                        : "All types"}
                  </strong>
                </article>
              </>
            ) : (
              (
                [
                  ["pending", "Assigned jobs", "pending"],
                  ["today", "Today's jobs", "today"],
                  ["in_progress", "In progress", "in-progress"],
                ] as const
              ).map(([key, label, view]) => (
                <Link
                  className="stat-card"
                  key={key}
                  to={`/technician/jobs?view=${view}`}
                >
                  <span>{label}</span>
                  <strong>{q.data?.[key] ?? "--"}</strong>
                  <icons.next
                    className="workday-stat-arrow"
                    aria-hidden="true"
                  />
                </Link>
              ))
            )}
          </div>
          <div className="section-heading">
            <h2>{filtered ? "Filtered jobs" : "Up next"}</h2>
            <Link to={jobsUrl}>
              My jobs <icons.next aria-hidden="true" />
            </Link>
          </div>
          {!jobs.length ? (
            <EmptyState
              title={
                filtered ? "No jobs match these filters" : "No upcoming work"
              }
              description={
                filtered
                  ? "Try another work view or request type."
                  : "Jobs assigned by an administrator will appear here."
              }
              primaryAction={
                filtered ? (
                  <button
                    className="secondary"
                    onClick={() =>
                      apply({ view: "active", type: "", date: "" })
                    }
                  >
                    Clear filters
                  </button>
                ) : undefined
              }
            />
          ) : (
            <div className="tech-job-grid">
              {jobs.map((job) => (
                <TechnicianJobCard
                  job={job}
                  actionLabel={
                    ["COMPLETED", "CANCELLED"].includes(job.status)
                      ? "View job"
                      : "Continue job"
                  }
                  key={job.id}
                />
              ))}
            </div>
          )}
          {filtered && (matching.data?.meta.total || 0) > jobs.length && (
            <p className="staff-result-caption">
              Showing {jobs.length} of {matching.data?.meta.total} matching
              jobs. <Link to={jobsUrl}>View all matching jobs</Link>
            </p>
          )}
        </>
      )}
    </section>
  );
}
function TechJobs() {
  const { filters, apply } = useJobFilters();
  const tab = filters.view,
    type = filters.type;
  const [params, setParams] = useSearchParams();
  const requestedPage = Number(params.get("page") || 1);
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;
  function setPage(value: number) {
    const next = new URLSearchParams(window.location.search);
    next.set("page", String(value));
    setParams(next);
  }
  const q = useQuery({
    queryKey: ["technician", "jobs", { tab, type, page, date: filters.date }],
    queryFn: async () =>
      (
        await api.get<{ data: Job[]; meta: { total: number } }>("/jobs", {
          params: {
            tab,
            type: type || undefined,
            date: filters.date || undefined,
            page,
            limit: 20,
          },
        })
      ).data,
    refetchInterval: false,
  });
  return (
    <section>
      <PageHeader
        title="My jobs"
        description={jobFilterLabel(filters)}
        actions={
          <>
            <button
              className="secondary staff-refresh"
              disabled={q.isFetching}
              onClick={() => q.refetch()}
            >
              <icons.refresh aria-hidden="true" />
              <span>Refresh</span>
            </button>
            <JobFilters value={filters} onApply={apply} />
          </>
        }
      />
      {q.isPending ? (
        <LoadingSkeleton title="Loading jobs..." />
      ) : q.isError ? (
        <ErrorState title="Unable to load jobs" retry={() => q.refetch()} />
      ) : !q.data.data.length ? (
        <EmptyState
          title="No jobs in this view"
          description="Assigned work and confirmed visits will appear here."
        />
      ) : (
        <div className="tech-job-grid">
          {q.data.data.map((job) => (
            <TechnicianJobCard job={job} key={job.assignment_id} />
          ))}
        </div>
      )}
      {(q.data?.meta.total || 0) > 20 && (
        <nav className="ui-actions tech-pagination" aria-label="Job pages">
          <button
            disabled={page === 1 || q.isFetching}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
          <span>Page {page}</span>
          <button
            disabled={page * 20 >= (q.data?.meta.total || 0) || q.isFetching}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </nav>
      )}
    </section>
  );
}

function TechJobRoute() {
  const { id } = useParams();
  return <TechJob key={id} />;
}

function TechJob() {
  const { id } = useParams(),
    qc = useQueryClient(),
    busyRef = useRef(false),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [photoPurpose] = useState("AFTER"),
    [selected, setSelected] = useState<string[]>([]),
    [photos, setPhotos] = useState<string[]>([]),
    [outcome, setOutcome] = useState("RESOLVED");
  const q = useQuery({
    queryKey: ["technician", "job", id],
    queryFn: async () =>
      (await api.get<{ data: Job }>("/jobs/" + id)).data.data,
    refetchInterval: activeRecordRefresh,
    refetchIntervalInBackground: false,
    retry: false,
  });
  async function action(path: string, body: unknown, success: string) {
    if (busyRef.current) return;
    const schema = path.endsWith("/work-report")
      ? technicianWorkReportSchema
      : null;
    if (schema) {
      const validated = schema.safeParse(body);
      if (!validated.success) {
        toast.error(validated.error.issues[0]?.message || "Check the form");
        return;
      }
    }
    busyRef.current = true;
    setBusy(true);
    try {
      await api.post(path, body);
      toast.success(success);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["technician", "job", id] }),
        qc.invalidateQueries({ queryKey: ["technician", "jobs"] }),
        qc.invalidateQueries({ queryKey: ["technician", "dashboard"] }),
        qc.invalidateQueries({ queryKey: ["technician", "schedule"] }),
      ]);
      return true;
    } catch (e) {
      toast.error(message(e));
      await q.refetch();
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  if (q.isPending)
    return <LoadingSkeleton title="Loading job..." variant="detail" />;
  if (q.isError)
    return (
      <ErrorState
        title="Job unavailable or no longer assigned to you"
        retry={() => q.refetch()}
      />
    );
  const j = q.data;
  async function upload(file?: File) {
    if (!file || busyRef.current) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size === 0 ||
      file.size > 8388608
    ) {
      toast.error("Choose a JPEG, PNG or WebP image under 8 MB.");
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setProgress(1);
    try {
      const r = await api.post("/jobs/" + id + "/photos", {
        contentType: file.type,
        size: file.size,
        purpose: photoPurpose,
      });
      await axios.put(r.data.data.uploadUrl, file, {
        headers: { "Content-Type": file.type },
        onUploadProgress: (e) =>
          setProgress(Math.round((e.loaded / (e.total || file.size)) * 100)),
      });
      await api.post("/photos/" + r.data.data.id + "/confirm");
      setPhotos((v) => [...v, r.data.data.id]);
      toast.success("Photo uploaded.");
      await q.refetch();
    } catch (e) {
      toast.error(message(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
      setProgress(0);
    }
  }
  const latest = j.reports?.[0],
    estimateBlocked =
      !!j.completion_blocked_by_estimate ||
      !!j.estimates?.some((estimate) =>
        ["AWAITING_CUSTOMER_APPROVAL", "REJECTED", "SUBMITTED"].includes(
          estimate.state,
        ),
      ),
    canReport =
      j.status === "IN_PROGRESS" &&
      !estimateBlocked &&
      (!latest || latest.state === "CHANGES_REQUESTED");
  return (
    <>
      <AppBackButton className="tech-job-back" fallback="/technician/jobs">
        Back to my jobs
      </AppBackButton>
      <PageHeader
        title={j.appliance}
        description={requestReference(j) + " · " + j.service_name}
      />
      <section className="panel tech-visit-panel">
        <div className="tech-visit-heading">
          <h2>{j.confirmed_date ? "Confirmed visit" : "Preferred visit"}</h2>
          <StatusBadge status={j.status} />
        </div>
        <p className="tech-visit-date">
          {(j.confirmed_date || j.preferred_date)?.slice(0, 10)} ·{" "}
          {j.confirmed_time_window || j.preferred_time_window}
        </p>
        <div className="tech-job-contact">
          <FaUser aria-hidden="true" />
          <strong>{j.customer?.full_name || j.customer_name}</strong>
        </div>
        {j.status_source === "ADMIN_OVERRIDE" && (
          <p className="inline-note">
            An administrator updated this status. Your assignment and work
            report remain separate.
          </p>
        )}
        <p>
          {j.address_snapshot &&
            [
              j.address_snapshot.line1,
              j.address_snapshot.area,
              j.address_snapshot.city,
              j.address_snapshot.state,
              j.address_snapshot.pinCode || j.address_snapshot.pin_code,
            ]
              .filter(Boolean)
              .join(", ")}
        </p>
        <div className="tech-job-contact-actions">
          {contactPhone(j.customer?.phone_e164 || j.customer_phone) && (
            <a
              className="secondary"
              href={`tel:${contactPhone(j.customer?.phone_e164 || j.customer_phone)}`}
              aria-label="Call Customer"
            >
              <FaPhone aria-hidden="true" />
              <span>
                Call Customer
                <span className="tech-contact-number">
                  {contactPhone(j.customer?.phone_e164 || j.customer_phone)}
                </span>
              </span>
            </a>
          )}
          <LocationActions address={j.address_snapshot} directions compact />
        </div>
        {j.status === "ON_HOLD" && (
          <p className="tech-hold-notice" role="status">
            This job is on hold. You can view customer and location details, but
            work-progress actions are paused until operations resumes it.
          </p>
        )}
        <JobProgressAction job={j} onUpdated={() => q.refetch()} />
        {j.status === "TECHNICIAN_ASSIGNED" && (
          <p>Assigned by admin. Operations will complete this request.</p>
        )}
        {estimateBlocked && (
          <p className="tech-completion-hint">
            {j.estimates?.some((estimate) => estimate.state === "REJECTED")
              ? "This job is paused until the admin resolves the declined estimate."
              : "Waiting for customer approval. Additional work and completion are paused."}
          </p>
        )}
        {j.status === "COMPLETED" && (
          <p className="tech-job-finished">
            <icons.success aria-hidden="true" /> Job completed
          </p>
        )}
        <CompleteJobButton job={j} />
      </section>
      {j.assignment_state === "ACCEPTED" && (
        <>
          {(canReport || latest || photos.length > 0) && (
            <section className="panel tech-report-panel" id="work-report">
              <h2>Work report</h2>
              {photos.map((photoId) => (
                <PhotoPreview key={photoId} id={photoId} />
              ))}
              {latest && (
                <>
                  <StatusBadge status={latest.state} />
                  <p>{latest.work_summary}</p>
                  {latest.correction_reason && (
                    <p role="status">
                      Corrections required: {latest.correction_reason}
                    </p>
                  )}
                </>
              )}
              {j.status === "IN_PROGRESS" &&
                latest?.state === "SUBMITTED_FOR_REVIEW" &&
                latest.outcome !== "RESOLVED" && (
                  <p className="tech-completion-hint">
                    The job can be completed after the work is resolved and a
                    resolved report is submitted.
                  </p>
                )}
              {canReport && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    action(
                      "/jobs/" + id + "/work-report",
                      {
                        version: j.version,
                        workSummary: f.get("workSummary"),
                        checklist: selected,
                        outcome: f.get("outcome"),
                        notes: f.get("notes"),
                        parts: f.get("parts"),
                        unresolvedIssues:
                          outcome === "RESOLVED"
                            ? ""
                            : String(f.get("unresolvedIssues") || ""),
                        attachmentIds: photos,
                      },
                      "Work report submitted.",
                    );
                  }}
                >
                  <label>
                    Work performed
                    <AppTextarea
                      name="workSummary"
                      required
                      minLength={3}
                      maxLength={2000}
                      defaultValue={
                        latest?.state === "CHANGES_REQUESTED"
                          ? latest.work_summary
                          : ""
                      }
                    />
                  </label>
                  <fieldset>
                    <legend>Work checklist</legend>
                    {j.checklist?.map((item) => (
                      <label className="tech-check" key={item}>
                        <AppCheckbox
                          required
                          checked={selected.includes(item)}
                          onChange={(e) =>
                            setSelected(
                              e.target.checked
                                ? [...selected, item]
                                : selected.filter((v) => v !== item),
                            )
                          }
                        />
                        {item}
                      </label>
                    ))}
                  </fieldset>
                  {j.request_type === "INSTALLATION" && (
                    <p>
                      Follow manufacturer instructions and required professional
                      safety checks in addition to this digital checklist.
                    </p>
                  )}
                  <label>
                    Outcome
                    <AppSelect
                      name="outcome"
                      value={outcome}
                      onChange={(event) => setOutcome(event.target.value)}
                    >
                      <option value="RESOLVED">Resolved</option>
                      <option value="PARTIALLY_RESOLVED">
                        Partially resolved
                      </option>
                      <option value="UNRESOLVED">Unresolved</option>
                    </AppSelect>
                  </label>
                  <details className="tech-report-extras">
                    <summary>Parts and notes (optional)</summary>
                    <label>
                      Parts used
                      <AppTextarea name="parts" maxLength={2000} />
                    </label>
                    <label>
                      Additional notes
                      <AppTextarea name="notes" maxLength={4000} />
                    </label>
                  </details>
                  {outcome !== "RESOLVED" && (
                    <label>
                      Unresolved issues
                      <AppTextarea name="unresolvedIssues" maxLength={2000} />
                    </label>
                  )}
                  <label>
                    Optional completion photo (up to 8 MB)
                    <AppInput
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      capture="environment"
                      disabled={busy}
                      onChange={(e) => {
                        void upload(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {progress > 0 && (
                    <progress
                      value={progress}
                      max={100}
                      aria-label="Photo upload progress"
                    />
                  )}
                  <div className="ui-actions">
                    {photos.map((p, k) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPhotos(photos.filter((v) => v !== p))}
                      >
                        Remove photo {k + 1}
                      </button>
                    ))}
                  </div>
                  <SafeAsyncButton
                    className="primary"
                    disabled={busy}
                    pending={busy}
                    pendingLabel="Submitting..."
                  >
                    Submit work report
                  </SafeAsyncButton>
                </form>
              )}
            </section>
          )}
        </>
      )}
    </>
  );
}

function JobProgressAction({
  job,
  onUpdated,
}: {
  job: Pick<Job, "id" | "status" | "version">;
  onUpdated: () => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);
  const action =
    job.status === "APPOINTMENT_CONFIRMED"
      ? ["on-the-way", "Start visit"]
      : job.status === "TECHNICIAN_EN_ROUTE"
        ? ["arrived", "Mark arrived"]
        : job.status === "TECHNICIAN_ARRIVED"
          ? ["start", "Start job"]
          : null;
  if (!action) return null;
  const [actionName, actionLabel] = action;
  async function advance() {
    if (busy) return;
    setBusy(true);
    try {
      await api.post(`/jobs/${job.id}/${actionName}`, { version: job.version });
      await onUpdated();
      toast.success(actionLabel + " updated.");
    } catch (error) {
      toast.error(message(error));
      await onUpdated();
    } finally {
      setBusy(false);
    }
  }
  return (
    <SafeAsyncButton
      className="primary tech-progress-action"
      pending={busy}
      pendingLabel="Updating..."
      onClick={advance}
    >
      {actionLabel}
    </SafeAsyncButton>
  );
}
function TechProfile({ profile: p }: { profile: Profile }) {
  const qc = useQueryClient(),
    busyRef = useRef(false),
    [busy, setBusy] = useState(false);
  async function save(path: string, body: unknown) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await api.patch(path, body);
      await qc.invalidateQueries({ queryKey: ["technician", "me"] });
      toast.success("Saved.");
    } catch (e) {
      toast.error(message(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader title="My profile" />
      <div className="ui-actions">

        <button
          onClick={async () => {
            try {
              await removeCurrentPushSubscription(api).catch(() => undefined);
              await api.post("/auth/logout");
              qc.clear();
              window.location.assign("/technician/login");
            } catch (e) {
              toast.error(message(e));
            }
          }}
        >
          Sign out
        </button>
      </div>
      <section className="panel tech-profile-card">
        <PushNotificationSettings api={api} />
        <div className="tech-profile-identity">
          <TechAvatar name={p.full_name} />
          <div>
            <h2>{p.full_name}</h2>
            <p>{p.email}</p>
            <StatusBadge status={p.verification_status} />
          </div>
        </div>
        <dl className="tech-profile-facts">
          <div>
            <dt>Service area</dt>
            <dd>{p.service_area}</dd>
          </div>
        </dl>
        <p>
          {p.completed_count} completed jobs ·{" "}
          {p.average_rating === null
            ? "No ratings yet"
            : p.average_rating + " / 5 customer rating"}
        </p>
        <details className="tech-profile-editor">
          <summary>Edit personal details</summary>
          <ProfilePhotoUpload />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              save("/profile", {
                fullName: f.get("name"),
                phone: f.get("phone"),
              });
            }}
          >
            <label>
              Full name
              <AppInput
                name="name"
                required
                minLength={2}
                maxLength={100}
                defaultValue={p.full_name}
              />
            </label>
            <label>
              Mobile (+91)
              <AppInput
                name="phone"
                type="tel"
                autoComplete="tel"
                maxLength={13}
                required
                pattern="\+91[6-9][0-9]{9}"
                defaultValue={p.phone}
              />
            </label>
            <SafeAsyncButton
              disabled={busy}
              pending={busy}
              pendingLabel="Saving..."
            >
              Save personal details
            </SafeAsyncButton>
          </form>
        </details>
      </section>
    </>
  );
}
function PhotoPreview({ id }: { id: string }) {
  const q = useQuery({
    queryKey: ["technician", "photo", id],
    queryFn: async () =>
      (await api.get<{ data: { url: string } }>("/photos/" + id + "/access"))
        .data.data,
    staleTime: 30000,
  });
  return q.data ? (
    <ImageWithFallback
      src={q.data.url}
      alt="Selected completion photo"
      style={{ width: 160, maxWidth: "100%", borderRadius: 12 }}
    />
  ) : q.isError ? (
    <button type="button" onClick={() => q.refetch()}>
      Retry photo preview
    </button>
  ) : null;
}

function TechAvatar({ name }: { name: string }) {
  const [brokenUrl, setBrokenUrl] = useState<string>();
  const q = useQuery({
    queryKey: ["technician", "avatar"],
    queryFn: async () =>
      (await api.get<{ data: { url: string | null } }>("/profile/photo")).data
        .data,
    staleTime: 30000,
  });
  return q.data?.url && q.data.url !== brokenUrl ? (
    <img
      src={q.data.url}
      alt={name + " profile"}
      className="ui-avatar tech-profile-photo"
      onError={() => setBrokenUrl(q.data?.url || undefined)}
    />
  ) : (
    <span aria-hidden="true" className="ui-avatar">
      {name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase()}
    </span>
  );
}
function ProfilePhotoUpload() {
  const qc = useQueryClient(),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0);
  return (
    <label>
      Profile photo (JPEG, PNG or WebP, up to 8 MB)
      <AppInput
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={busy}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          if (
            !file.size ||
            file.size > 8 * 1024 * 1024 ||
            !["image/jpeg", "image/png", "image/webp"].includes(file.type)
          ) {
            toast.error("Choose a JPEG, PNG or WebP photo up to 8 MB.");
            return;
          }
          setBusy(true);
          try {
            const r = await api.post("/profile/photo/upload", {
              contentType: file.type,
              size: file.size,
            });
            await axios.put(r.data.data.uploadUrl, file, {
              headers: { "Content-Type": file.type },
              onUploadProgress: (e) =>
                setProgress(
                  Math.round((e.loaded / (e.total || file.size)) * 100),
                ),
            });
            await api.post("/profile/photo/" + r.data.data.id + "/confirm");
            await qc.invalidateQueries({ queryKey: ["technician", "avatar"] });
            toast.success("Profile photo updated.");
          } catch (e) {
            toast.error(message(e));
          } finally {
            setBusy(false);
            setProgress(0);
          }
        }}
      />
      {busy && (
        <progress
          value={progress}
          max={100}
          aria-label="Profile photo upload progress"
        />
      )}
    </label>
  );
}
