import { useDebouncedValue } from "@home/ui";
import { LoadingSkeleton } from "@home/ui/skeletons";
import { PasswordInput } from "@home/ui";
import { activeRecordRefresh } from "@home/ui";
import { ChangeRequestStatusModal } from "./ChangeRequestStatusModal";
import { BookingSummary } from "./BookingSummary";
import { Appointments } from "./Appointments";
import { requestReference } from "@home/shared";
import { LocationActions } from "@home/ui";
import { RequestWorkReport, type WorkReport } from "./RequestWorkReport";
import { AsyncActionButton as SafeAsyncButton } from "@home/ui";
import { WorkflowActions } from "./WorkflowActions";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useLocation,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { toast } from "sonner";
import axios from "axios";
import { api } from "./api";
import { Catalogue } from "./Catalogue";
import { FeedbackPage, FeedbackDetail } from "./Feedback";
import { AdminSupport } from "./Support";
import { Technicians } from "./Technicians";
import { RequestWorkspace } from "./RequestWorkspace";
import { OperationsPage } from "./OperationsPage";
import { AdminLayout } from "./AdminLayout";
import { Dashboard } from "./Dashboard";
import { CustomerAvatar, StatusBadge } from "./components";
import { icons, adminKeys } from "./design";

type Staff = {
  id: string;
  username: string;
  full_name?: string;
  fullName?: string;
  role: string;
};
type RequestRow = {
  display_number?: number | string;
  created_at?: string;
  work_reports?: WorkReport[];
  assignment_state?: string;
  offered_technician_name?: string;
  pending_report_id?: string;
  review_id?: string;
  customer_id?: string;
  customer_reference?: string;
  customer_email?: string;
  address_snapshot?: Record<string, string>;
  support_tickets?: {
    id: string;
    ticket_number: string;
    subject: string;
    status: string;
  }[];
  completed_by_name?: string;
  work_summary?: string;
  completion_notes?: string;
  completed_at?: string;
  id: string;
  request_number: string;
  request_type: string;
  customer_name: string;
  customer_phone: string;
  appliance: string;
  service_name: string;
  status: string;
  version: number;
  preferred_date: string;
  preferred_time_window: string;
  assigned_technician_name?: string;
  assigned_technician_phone?: string;
  confirmed_date?: string;
  confirmed_time_window?: string;
  details?: Record<string, unknown>;
  timeline?: {
    id: string;
    status: string;
    note: string;
    created_at: string;
    actor_role?: string;
    actor_staff_name?: string | null;
    actor_technician_name?: string | null;
  }[];
};
type CustomerRow = {
  id: string;
  customer_reference?: string;
  profile_photo_url?: string;
  full_name: string;
  email: string | null;
  phone_e164: string | null;
  account_status: string;
  created_at: string;
  last_login_at: string | null;
  sign_in_methods: string;
  total_requests?: number;
};
type CustomerList = {
  data: CustomerRow[];
  meta: { page: number; limit: number; total: number };
};
const errorMessage = (e: unknown, fallback: string) =>
  axios.isAxiosError(e)
    ? e.response?.data?.error?.message ||
      (!e.response ? "Unable to connect to the server." : fallback)
    : fallback;
export function App() {
  const location = useLocation();
  if (
    location.pathname === "/technician" ||
    location.pathname.startsWith("/technician/")
  )
    return <TechnicianRedirect />;
  return <AdminApp />;
}
function TechnicianRedirect() {
  const location = useLocation();
  useEffect(() => {
    window.location.replace(
      new URL(
        location.pathname + location.search,
        import.meta.env.VITE_TECHNICIAN_ORIGIN || "http://127.0.0.1:5175",
      ).href,
    );
  }, [location]);
  return <State title="Opening technician application..." />;
}
function AdminApp() {
  const me = useQuery({
    queryKey: adminKeys.me,
    staleTime: 30000,
    queryFn: async () => (await api.get<{ data: Staff }>("/auth/me")).data.data,
    retry: false,
  });
  if (me.isPending)
    return <LoadingSkeleton title="Loading admin session…" variant="profile" />;
  if (
    me.isError &&
    !(axios.isAxiosError(me.error) && me.error.response?.status === 401)
  )
    return (
      <State
        title="Unable to verify your session. Please try again."
        retry={() => me.refetch()}
      />
    );
  if (me.isError)
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  return (
    <AdminLayout staff={me.data}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route
          path="/service-requests"
          element={<Navigate to="/requests?type=SERVICE" replace />}
        />
        <Route
          path="/installation-requests"
          element={<Navigate to="/requests?type=INSTALLATION" replace />}
        />
        <Route
          path="/completed-requests"
          element={<RequestWorkspace key="completed" mode="COMPLETED" />}
        />
        <Route
          path="/appointments"
          element={
            <Appointments
              canManage={[
                "SUPER_ADMIN",
                "ADMIN",
                "OPERATIONS_MANAGER",
              ].includes(me.data.role)}
            />
          }
        />
        <Route path="/reports" element={<OperationsPage kind="reports" />} />
        <Route path="/notifications" element={null} />
        <Route path="/settings" element={<OperationsPage kind="settings" />} />
        <Route path="/requests" element={<RequestWorkspace mode="ALL" />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/feedback" element={<FeedbackPage />} />
        <Route
          path="/technicians"
          element={
            <Technicians
              canManage={["SUPER_ADMIN", "ADMIN"].includes(me.data.role)}
            />
          }
        />
        <Route
          path="/support"
          element={
            <AdminSupport
              canManage={[
                "SUPER_ADMIN",
                "ADMIN",
                "OPERATIONS_MANAGER",
                "SUPPORT_AGENT",
              ].includes(me.data.role)}
            />
          }
        />
        <Route
          path="/feedback/:id"
          element={
            <FeedbackDetail
              canManage={[
                "SUPER_ADMIN",
                "ADMIN",
                "OPERATIONS_MANAGER",
                "SUPPORT_AGENT",
              ].includes(me.data.role)}
            />
          }
        />
        <Route
          path="/catalogue"
          element={
            <Catalogue
              canManage={["SUPER_ADMIN", "ADMIN"].includes(me.data.role)}
            />
          }
        />
        <Route path="/customers/:id" element={<CustomerDetail />} />
        <Route
          path="/requests/:id"
          element={
            <RequestDetail
              canManage={[
                "SUPER_ADMIN",
                "ADMIN",
                "OPERATIONS_MANAGER",
              ].includes(me.data.role)}
            />
          }
        />
        <Route
          path="/unauthorized"
          element={
            <State title="You don't have permission to view this page." />
          }
        />
        <Route path="*" element={<State title="Page not found." />} />
      </Routes>
    </AdminLayout>
  );
}
function Login() {
  const [challenge, setChallenge] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const data = new FormData(e.currentTarget);
    try {
      if (!challenge) {
        const r = await api.post<{
          data: { challengeId: string; developmentCode?: string };
        }>("/auth/login", {
          username: data.get("username"),
          password: data.get("password"),
        });
        setChallenge(r.data.data.challengeId);
        setCode(r.data.data.developmentCode || "");
        toast.success("Password verified. Enter your MFA code.");
      } else {
        await api.post("/auth/mfa", { challengeId: challenge, code });
        toast.success("Welcome to Home Services Admin.");
        await qc.invalidateQueries({ queryKey: adminKeys.me });
        navigate("/");
      }
    } catch (e) {
      toast.error(errorMessage(e, "Unable to sign in."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login">
      <form onSubmit={submit}>
        <h1>Admin sign in</h1>
        <p>Authorized staff only</p>
        {!challenge ? (
          <>
            <label>
              Username
              <input name="username" autoComplete="username" required />
            </label>
            <label>
              Password
              <PasswordInput
                name="password"
                autoComplete="current-password"
                minLength={10}
                required
              />
            </label>
          </>
        ) : (
          <label>
            MFA code
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              maxLength={6}
              required
            />
          </label>
        )}
        <SafeAsyncButton
          disabled={busy}
          pending={busy}
          pendingLabel="Saving..."
        >
          {busy ? "Please wait…" : challenge ? "Verify MFA" : "Continue"}
        </SafeAsyncButton>
      </form>
    </main>
  );
}
function Customers() {
  const [search, setSearch] = useState("");
  const settledSearch = useDebouncedValue(search);
  const [page, setPage] = useState(1);
  const limit = 50;
  const q = useQuery({
    queryKey: [...adminKeys.customers, page, settledSearch],
    placeholderData: (previous) => previous,
    queryFn: async () =>
      (
        await api.get<CustomerList>("/customers", {
          params: { page, limit, q: settledSearch },
        })
      ).data,
  });
  if (q.isPending)
    return <LoadingSkeleton title="Loading customers…" variant="table" />;
  if (q.isError)
    return (
      <State title="Unable to load customers." retry={() => q.refetch()} />
    );
  const first = q.data.meta.total ? (page - 1) * limit + 1 : 0;
  const last = Math.min(page * limit, q.data.meta.total);
  return (
    <Page title="Customer accounts">
      <div className="admin-filters">
        <input
          aria-label="Search customers"
          placeholder="Customer ID, name, email, phone or request number"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      <div className="table">
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Contact</th>
              <th>Total requests</th>
              <th>Account status</th>
            </tr>
          </thead>
          <tbody>
            {q.data.data.map((customer) => (
              <tr key={customer.id}>
                <td>
                  <div className="customer-identity">
                    <CustomerAvatar
                      name={customer.full_name}
                      src={customer.profile_photo_url}
                    />
                    <Link to={`/customers/${customer.id}`}>
                      {customer.full_name || "Name not provided"}
                      <small>{customer.customer_reference}</small>
                    </Link>
                  </div>
                </td>
                <td>
                  {customer.email || "No email"}
                  <small>{customer.phone_e164 || "No phone number"}</small>
                </td>
                <td>{customer.total_requests ?? 0}</td>
                <td>
                  <StatusBadge status={customer.account_status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!q.data.data.length && <p>No customer accounts found.</p>}
      </div>
      <div className="table-pagination">
        <span>
          Showing {first}–{last} of {q.data.meta.total} customers
        </span>
        <div>
          <button
            disabled={page === 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Previous
          </button>
          <button
            disabled={last >= q.data.meta.total}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </Page>
  );
}
type CustomerDetailData = CustomerRow & {
  reviews: {
    id: string;
    rating: number;
    comment: string;
    handling_status: string;
  }[];
  addresses: {
    id: string;
    label: string;
    recipient_name: string;
    phone: string;
    line1: string;
    area: string;
    city: string;
    state: string;
    pin_code: string;
    is_default: boolean;
  }[];
  requests: RequestRow[];
  tickets: {
    id: string;
    ticket_number: string;
    subject: string;
    message: string;
    status: string;
  }[];
};
function CustomerDetail() {
  const { id } = useParams();
  const q = useQuery({
    queryKey: adminKeys.customer(id),
    queryFn: async () =>
      (await api.get<{ data: CustomerDetailData }>(`/customers/${id}`)).data
        .data,
  });
  if (q.isPending)
    return <LoadingSkeleton title="Loading customer…" variant="profile" />;
  if (q.isError)
    return <State title="Unable to load customer." retry={() => q.refetch()} />;
  const c = q.data;
  return (
    <Page title="Customer Details">
      <Link className="text-button" to="/customers">
        <icons.back /> Back to customers
      </Link>
      <section className="ui-panel customer-profile-header">
        <CustomerAvatar name={c.full_name} src={c.profile_photo_url} />
        <div>
          <h2>{c.full_name || "Customer"}</h2>
          <p className="customer-reference">{c.customer_reference || c.id}</p>
          <p>{c.email || "No email provided"}</p>
          <small>
            Registered {new Date(c.created_at).toLocaleDateString("en-IN")}
          </small>
        </div>
        <div className="workflow-actions">
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  c.customer_reference || c.id,
                );
                toast.success("Customer ID copied.");
              } catch {
                toast.error("Unable to copy Customer ID.");
              }
            }}
          >
            <icons.copy /> Copy Customer ID
          </button>
          {c.phone_e164 && (
            <a className="secondary" href={`tel:${c.phone_e164}`}>
              Call Customer
            </a>
          )}
        </div>
      </section>
      <div className="customer-summary-grid">
        {[
          ["Total Requests", c.requests.length],
          [
            "Active Requests",
            c.requests.filter(
              (r) => !["COMPLETED", "CANCELLED"].includes(r.status),
            ).length,
          ],
          [
            "Completed Requests",
            c.requests.filter((r) => r.status === "COMPLETED").length,
          ],
          ["Reviews", c.reviews?.length || 0],
        ].map(([label, value]) => (
          <article className="ui-panel" key={label}>
            <small>{label}</small>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
      <div className="customer-profile-grid">
        <section className="ui-panel">
          <h2>Personal Information</h2>
          <dl>
            <div>
              <dt>Google email</dt>
              <dd>{c.email || "Not provided"}</dd>
            </div>
            <div>
              <dt>Contact number</dt>
              <dd>{c.phone_e164 || "Not provided"}</dd>
            </div>
            <div>
              <dt>Account status</dt>
              <dd>{c.account_status}</dd>
            </div>
          </dl>
        </section>
        <section className="ui-panel">
          <h2>Saved Addresses</h2>
          {c.addresses.length ? (
            c.addresses.map((a) => (
              <article className="customer-address" key={a.id}>
                <strong>
                  {a.label}
                  {a.is_default ? " ? Default" : ""}
                </strong>
                <p>
                  {[a.line1, a.area, a.city, a.state, a.pin_code]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                <LocationActions address={a} />
              </article>
            ))
          ) : (
            <p>No saved addresses.</p>
          )}
        </section>
      </div>
      <section className="ui-panel">
        <h2>Request History</h2>
        {c.requests.length ? (
          c.requests.map((r) => (
            <Link
              className="customer-history-row"
              key={r.id}
              to={`/requests/${r.id}`}
            >
              <span className="request-reference">{requestReference(r)}</span>
              <span>
                {r.appliance}
                <small>
                  {r.service_name} ?{" "}
                  {r.request_type === "SERVICE" ? "Service" : "Installation"}
                </small>
              </span>
              <StatusBadge status={r.status} />
              <icons.next />
            </Link>
          ))
        ) : (
          <p>No requests yet.</p>
        )}
      </section>
      <div className="customer-profile-grid">
        <section className="ui-panel">
          <h2>Feedback History</h2>
          {c.reviews?.length ? (
            c.reviews.map((r) => (
              <article key={r.id}>
                <Link to={`/feedback/${r.id}`}>
                  <icons.star /> {r.rating}/5 ? View feedback
                </Link>
                <p>{r.comment}</p>
              </article>
            ))
          ) : (
            <p>No feedback yet.</p>
          )}
        </section>
        <section className="ui-panel">
          <h2>Support History</h2>
          {c.tickets.length ? (
            c.tickets.map((t) => (
              <article key={t.id}>
                <Link to={`/support?ticket=${t.id}`}>
                  {t.ticket_number} ? {t.subject}
                </Link>
                <p>{t.status}</p>
              </article>
            ))
          ) : (
            <p>No support tickets.</p>
          )}
        </section>
      </div>
    </Page>
  );
}

function RequestDetail({ canManage }: { canManage: boolean }) {
  const [changeStatus, setChangeStatus] = useState(false);
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const q = useQuery({
    queryKey: adminKeys.request(id),
    queryFn: async () =>
      (await api.get<{ data: RequestRow }>(`/requests/${id}`)).data.data,
    refetchInterval: activeRecordRefresh,
    refetchIntervalInBackground: false,
  });
  if (q.isPending)
    return <LoadingSkeleton title="Loading request..." variant="detail" />;
  if (q.isError)
    return <State title="Unable to load request" retry={() => q.refetch()} />;
  const r = q.data;
  return (
    <Page title={requestReference(r)}>
      <div className="ui-toolbar">
        <Link to="/requests">Back to requests</Link>
        <button onClick={() => q.refetch()} disabled={q.isFetching}>
          <icons.refresh /> Refresh
        </button>
      </div>
      {canManage && (
        <button className="secondary" onClick={() => setChangeStatus(true)}>
          Change Status
        </button>
      )}
      {changeStatus && (
        <ChangeRequestStatusModal
          request={r}
          onClose={() => setChangeStatus(false)}
        />
      )}
      {canManage && !["COMPLETED", "CANCELLED"].includes(r.status) && (
        <WorkflowActions
          key={r.id}
          request={r}
          initialAssign={searchParams.get("action") === "assign"}
          initialReschedule={searchParams.get("action") === "reschedule"}
        />
      )}
      <BookingSummary request={r} />
      <RequestWorkReport
        reports={r.work_reports || []}
        requestId={r.id}
        canManage={canManage}
      />
      {r.work_summary && (
        <article className="ui-panel">
          <h2>Completion and Feedback</h2>
          <p>{r.work_summary}</p>
          <p>{r.completion_notes}</p>
          <small>
            {r.completed_at && new Date(r.completed_at).toLocaleString()}
          </small>
          {r.review_id ? (
            <p>
              <Link to={"/feedback/" + r.review_id}>View Customer Review</Link>
            </p>
          ) : (
            <p>Awaiting customer feedback</p>
          )}
        </article>
      )}
      <section className="ui-panel">
        <h2>Progress Timeline</h2>
        <ol className="timeline">
          {r.timeline?.map((event) => (
            <li key={event.id}>
              <StatusBadge status={event.status} />
              <span>{event.note}</span>
              {(event.actor_technician_name ||
                event.actor_staff_name ||
                event.actor_role) && (
                <small>
                  Changed by{" "}
                  {event.actor_technician_name ||
                    event.actor_staff_name ||
                    event.actor_role?.toLowerCase()}
                </small>
              )}
              <small>{new Date(event.created_at).toLocaleString()}</small>
            </li>
          ))}
        </ol>
      </section>
      <details className="ui-panel">
        <summary>Help and Support</summary>
        {r.support_tickets?.length ? (
          r.support_tickets.map((ticket) => (
            <p key={ticket.id}>
              <Link to={`/support?ticket=${ticket.id}`}>
                {ticket.ticket_number} · {ticket.subject}
              </Link>
            </p>
          ))
        ) : (
          <p>No linked support conversations.</p>
        )}
      </details>
    </Page>
  );
}
function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <div className="page-title">
        <h1>{title}</h1>
      </div>
      {children}
    </section>
  );
}
function State({ title, retry }: { title: string; retry?: () => void }) {
  return (
    <main className="state">
      <h1>{title}</h1>
      {retry && <button onClick={retry}>Try again</button>}
    </main>
  );
}
