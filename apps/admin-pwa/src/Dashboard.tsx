import { FaPhone } from "react-icons/fa6";
import { DashboardFilters, type RangeOption } from "./DashboardFilters";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { contactPhone, requestReference } from "@home/shared";
import { api } from "./api";
import { icons, adminKeys } from "./design";
import {
  PageHeader,
  StatCard,
  LoadingSkeleton,
  ErrorState,
  StatusBadge,
  EmptyState,
} from "./components";
type Request = {
  id: string;
  request_number: string;
  customer_name: string;
  appliance: string;
  status: string;
  service_name?: string;
  confirmed_date?: string | null;
  confirmed_time_window?: string | null;
  assigned_technician_name?: string | null;
  customer_phone?: string | null;
  attention_reason?: string;
};
const isoDate = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
function rangeFor(option: RangeOption) {
  const today = new Date(),
    to = isoDate(today);
  if (option === "month") return { from: `${to.slice(0, 7)}-01`, to };
  const fromDate = new Date(today);
  fromDate.setDate(fromDate.getDate() - Number(option || 7) + 1);
  return { from: isoDate(fromDate), to };
}
export function Dashboard() {
  const [rangeOption, setRangeOption] = useState<RangeOption>(() => {
    try {
      const value = localStorage.getItem("admin-dashboard-range") || "7";
      return ["1", "3", "7", "month", "custom"].includes(value)
        ? (value as RangeOption)
        : "7";
    } catch {
      return "7";
    }
  });
  const [custom, setCustom] = useState(() => {
    const today = isoDate(new Date());
    try {
      const from = localStorage.getItem("admin-dashboard-from") || today,
        to = localStorage.getItem("admin-dashboard-to") || today;
      return /^\d{4}-\d{2}-\d{2}$/.test(from) &&
        /^\d{4}-\d{2}-\d{2}$/.test(to) &&
        from <= to &&
        to <= today
        ? { from, to }
        : { from: today, to: today };
    } catch {
      return { from: today, to: today };
    }
  });
  const range = useMemo(
    () => (rangeOption === "custom" ? custom : rangeFor(rangeOption)),
    [rangeOption, custom],
  );
  const validRange = range.from <= range.to;
  const params = validRange ? range : rangeFor("7");
  function applyFilters(
    option: RangeOption,
    dates: { from: string; to: string },
  ) {
    setRangeOption(option);
    setCustom(dates);
    try {
      localStorage.setItem("admin-dashboard-range", option);
      localStorage.setItem("admin-dashboard-from", dates.from);
      localStorage.setItem("admin-dashboard-to", dates.to);
    } catch {
      /* Keep filters usable when storage is disabled. */
    }
  }
  const allocation = useQuery({
    queryKey: ["admin", "allocation", params],
    queryFn: async () =>
      (
        await api.get<{
          data: {
            assignable: number;
            unassigned: number;
            offered: number;
            accepted: number;
            unavailable: number;
            workload: { id: string; full_name: string; jobs: number }[];
          };
        }>("/dashboard/allocation", { params })
      ).data.data,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const summary = useQuery({
    queryKey: [...adminKeys.summary, params],
    queryFn: async () =>
      (
        await api.get<{ data: Record<string, number> }>("/dashboard/summary", {
          params,
        })
      ).data.data,
    refetchInterval: false,
  });
  const activity = useQuery({
    queryKey: [...adminKeys.dashboardActivity, params],
    queryFn: async () =>
      (
        await api.get<{
          data: {
            trends: { date: string; service: number; installation: number }[];
            distribution: { request_type: string; count: number }[];
            recent: Request[];
            attention: Request[];
            alerts: { unassigned: number; overdue: number; negative: number };
          };
        }>("/dashboard/activity", { params })
      ).data.data,
    refetchInterval: false,
  });
  const header = (
    <PageHeader
      title="Overview"
      description="Your service operations, thoughtfully organized."
      actions={
        <>
          <button
            className="secondary icon-only"
            aria-label="Refresh dashboard"
            disabled={
              summary.isFetching || activity.isFetching || allocation.isFetching
            }
            onClick={() =>
              Promise.all([
                summary.refetch(),
                activity.refetch(),
                allocation.refetch(),
              ])
            }
          >
            <icons.refresh aria-hidden="true" />
          </button>
          <DashboardFilters
            value={rangeOption}
            dates={custom}
            today={isoDate(new Date())}
            onApply={applyFilters}
          />
        </>
      }
    />
  );
  if (summary.isPending)
    return (
      <section className="staff-dashboard">
        {header}
        <LoadingSkeleton title="Loading dashboard" variant="dashboard" />
      </section>
    );
  if (summary.isError)
    return (
      <section className="staff-dashboard">
        {header}
        <ErrorState
          title="Unable to load dashboard"
          retry={() => summary.refetch()}
        />
      </section>
    );
  const data = summary.data;
  const metrics = [
    {
      label: "Total requests",
      value: data.total_requests,
      icon: icons.service,
      to: "/requests",
    },
    {
      label: "Open requests",
      value: data.pending_requests,
      icon: icons.calendar,
      to: "/requests",
    },
    {
      label: "In progress now",
      value: data.in_progress_requests,
      icon: icons.service,
      to: "/requests?group=IN_PROGRESS",
    },
    {
      label: "Completed Requests",
      value: data.completed_requests,
      icon: icons.success,
      to: "/completed-requests",
    },
    {
      label: "Unassigned requests",
      value: allocation.data?.unassigned,
      icon: icons.technicians,
      to: "/requests?assignment=unassigned",
    },
    {
      label: "Available technicians",
      value: data.available_technicians,
      icon: icons.technicians,
      to: "/technicians",
    },
  ];
  const max = Math.max(
    1,
    ...(activity.data?.trends || []).map((t) => t.service + t.installation),
  );
  return (
    <section className="staff-dashboard">
      {header}
      <div className="kpis dashboard-kpis">
        {metrics.map((m) => (
          <StatCard key={m.label} {...m} value={m.value ?? "--"} />
        ))}
      </div>
      {activity.isError ? (
        <ErrorState
          title="Unable to load dashboard activity"
          retry={() => activity.refetch()}
        />
      ) : activity.isPending ? (
        <LoadingSkeleton title="Loading recent activity…" variant="table" />
      ) : (
        <>
          <section className="staff-dashboard-insights">
            <div className="staff-section-heading">
              <h2>Trends &amp; team workload</h2>
              <span>For the selected date range</span>
            </div>
            <div className="dashboard-charts">
              <article className="ui-panel">
                <h2>
                  Requests created{" "}
                  <span>
                    {range.from} to {range.to}
                  </span>
                </h2>
                <div className="trend-legend">
                  <i className="service-dot" />
                  Service <i className="installation-dot" />
                  Installation
                </div>
                <div
                  className="trend-bars"
                  role="img"
                  aria-label="Daily service and installation requests"
                >
                  {activity.data.trends.map((t) => (
                    <div
                      className="trend-day"
                      key={t.date}
                      title={`${t.date}: ${t.service} service, ${t.installation} installation`}
                    >
                      <span className="trend-value">
                        {t.service + t.installation}
                      </span>
                      <div className="trend-track">
                        <i
                          style={{ height: `${(t.installation / max) * 100}%` }}
                          className="installation-bar"
                        />
                        <i
                          style={{ height: `${(t.service / max) * 100}%` }}
                          className="service-bar"
                        />
                      </div>
                      <small>
                        {new Date(t.date + "T12:00:00").toLocaleDateString(
                          "en-IN",
                          { weekday: "short" },
                        )}
                      </small>
                    </div>
                  ))}
                </div>
                {!activity.data.trends.some(
                  (t) => t.service + t.installation > 0,
                ) && (
                  <p className="muted">No new requests in this date range.</p>
                )}
              </article>
              <article className="ui-panel allocation-overview">
                <h2>Team workload</h2>
                {allocation.isPending ? (
                  <LoadingSkeleton title="Loading allocation..." />
                ) : allocation.isError ? (
                  <ErrorState
                    title="Unable to load allocation"
                    retry={() => allocation.refetch()}
                  />
                ) : (
                  <>
                    <div className="allocation-metrics">
                      {[
                        {
                          label: "Assignable requests",
                          value: allocation.data.assignable,
                          to: "/requests",
                        },
                        {
                          label: "Unassigned",
                          value: allocation.data.unassigned,
                          to: "/requests?assignment=unassigned",
                        },
                        {
                          label: "Offers awaiting response",
                          value: allocation.data.offered,
                          to: "/requests?assignment=offered",
                        },
                        {
                          label: "Accepted assignments",
                          value: allocation.data.accepted,
                          to: "/requests?assignment=accepted",
                        },
                        {
                          label: "Technicians unavailable",
                          value: allocation.data.unavailable,
                          to: "/technicians",
                        },
                      ].map((m) => (
                        <Link key={m.label} to={m.to}>
                          <span>{m.label}</span>
                          <strong>{m.value}</strong>
                          <icons.next />
                        </Link>
                      ))}
                    </div>
                    {!!allocation.data.workload.length && (
                      <details>
                        <summary>Workload by technician</summary>
                        {allocation.data.workload.map((t) => (
                          <Link
                            className="allocation-workload"
                            to={`/requests?technicianId=${t.id}`}
                            key={t.id}
                          >
                            {t.full_name}
                            <strong>{t.jobs} jobs</strong>
                          </Link>
                        ))}
                      </details>
                    )}
                  </>
                )}
              </article>
            </div>
          </section>
          <div className="dashboard-lists">
            {[
              {
                title: "Needs Assignment",
                rows: activity.data.attention.filter(
                  (r) => !r.assigned_technician_name,
                ),
              },
            ].map((section) => (
              <article className="ui-panel" key={section.title}>
                <h2>{section.title}</h2>
                <div className="assignment-table-heading">
                  <span>Reference</span>
                  <span>Customer</span>
                  <span>Appliance &amp; service</span>
                  <span>Status</span>
                  <span>Actions</span>
                </div>
                {section.rows.length ? (
                  section.rows.map((r) => (
                    <div className="assignment-row" key={r.id}>
                      <small>{requestReference(r)}</small>
                      <strong>{r.customer_name}</strong>
                      <div className="assignment-service">
                        <strong>{r.appliance}</strong>
                        <span>{r.service_name || "Service"}</span>
                      </div>
                      <StatusBadge status={r.status} />
                      <div className="attention-actions">
                        <Link to={`/requests/${r.id}`}>View request</Link>
                        {!r.assigned_technician_name && (
                          <Link to={`/requests/${r.id}?action=assign`}>
                            Assign technician
                          </Link>
                        )}
                        {contactPhone(r.customer_phone) && (
                          <a
                            className="icon-only"
                            aria-label="Contact Customer"
                            title="Contact Customer"
                            href={`tel:${contactPhone(r.customer_phone)}`}
                          >
                            <FaPhone aria-hidden="true" />
                          </a>
                        )}
                        <Link to={`/requests/${r.id}?action=status`}>
                          Change status
                        </Link>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState title="All caught up" />
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
