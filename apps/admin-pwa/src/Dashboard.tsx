import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
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
};
export function Dashboard() {
  const allocation = useQuery({
    queryKey: ["admin", "allocation"],
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
        }>("/dashboard/allocation")
      ).data.data,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const summary = useQuery({
    queryKey: adminKeys.summary,
    queryFn: async () =>
      (await api.get<{ data: Record<string, number> }>("/dashboard/summary"))
        .data.data,
    refetchInterval: false,
  });
  const activity = useQuery({
    queryKey: adminKeys.dashboardActivity,
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
        }>("/dashboard/activity")
      ).data.data,
    refetchInterval: false,
  });
  if (summary.isPending)
    return <LoadingSkeleton title="Loading dashboard…" variant="dashboard" />;
  if (summary.isError)
    return (
      <ErrorState
        title="Unable to load dashboard"
        retry={() => summary.refetch()}
      />
    );
  const data = summary.data;
  const metrics = [
    {
      label: "Needs attention",
      value: data.needs_attention,
      icon: icons.warning,
      to: "/requests",
    },
    {
      label: "New requests",
      value:
        (data.new_service_requests || 0) +
        (data.new_installation_requests || 0),
      icon: icons.service,
      to: "/requests?status=REQUESTED",
    },
    {
      label: "Active Requests",
      value: data.pending_requests,
      icon: icons.calendar,
      to: "/requests",
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
    <section>
      <PageHeader title="Overview" />
      <div className="ui-actions overview-actions">
        <button
          className="secondary"
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
          Refresh
        </button>
        <Link className="primary" to="/requests?assignment=unassigned">
          Assign technicians
        </Link>
        <Link className="secondary" to="/appointments">
          View appointments
        </Link>
      </div>
      <div className="kpis dashboard-kpis">
        {metrics.map((m) => (
          <StatCard key={m.label} {...m} value={m.value ?? 0} />
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
          <div className="dashboard-lists">
            {[{ title: "Needs Attention", rows: activity.data.attention }].map(
              (section) => (
                <article className="ui-panel" key={section.title}>
                  <h2>{section.title}</h2>
                  {section.rows.length ? (
                    section.rows.map((r) => (
                      <Link
                        className="dashboard-request"
                        to={`/requests/${r.id}`}
                        key={r.id}
                      >
                        <div>
                          <strong>{r.request_number}</strong>
                          <span>
                            {r.customer_name} · {r.appliance}
                          </span>
                        </div>
                        <StatusBadge status={r.status} />
                      </Link>
                    ))
                  ) : (
                    <EmptyState title="All caught up" />
                  )}
                </article>
              ),
            )}
          </div>
          <details className="dashboard-insights ui-panel">
            <summary>Trends & team workload</summary>
            <div className="dashboard-charts">
              <article className="ui-panel">
                <h2>
                  Request trends <span>Last 7 days</span>
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
                  <p className="muted">
                    No new requests in the last seven days.
                  </p>
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
          </details>
        </>
      )}
    </section>
  );
}
