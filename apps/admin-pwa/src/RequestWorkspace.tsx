import { contactPhone } from "@home/shared";
import { FaPhone } from "react-icons/fa6";
import {
  ChangeRequestStatusModal,
  type StatusRequest,
} from "./ChangeRequestStatusModal";
import { requestReference, operationalStatus } from "@home/shared";
import { LocationActions } from "@home/ui";
import { toast } from "sonner";
import {
  AssignTechnicianDrawer,
  type AssignmentRequest,
} from "./AssignTechnicianDrawer";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "./api";
import {
  CompleteRequestModal,
  type CompletionRequest,
} from "./CompleteRequestModal";
import {
  PageHeader,
  PageToolbar,
  SearchField,
  FilterPanel,
  DateRangeFilter,
  DataTable,
  StatusBadge,
  Pagination,
  ActionMenu,
  EmptyState,
  LoadingSkeleton,
  ErrorState,
} from "./components";
import { icons, adminKeys } from "./design";
type Row = CompletionRequest & {
  display_number?: number | string;
  status_source?: string;
  customer_phone?: string;
  customer_id: string;
  customer_reference: string;
  service_name: string;
  preferred_date: string;
  preferred_time_window?: string;
  address_snapshot?: Record<string, string>;
  confirmed_date?: string;
  confirmed_time_window?: string;
  assigned_technician_name?: string;
  assignment_state?: string;
  offered_technician_name?: string;
  completed_at?: string;
  completion_actor_name?: string;
  rating?: number;
  review_id?: string;
  work_summary?: string;
  details?: Record<string, unknown>;
};
const column = createColumnHelper<Row>();
type Mode =
  | "SERVICE"
  | "INSTALLATION"
  | "COMPLETED"
  | "APPOINTMENTS"
  | "ALL";
export function RequestWorkspace({ mode }: { mode: Mode }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = {
    q: searchParams.get("q") || "",
    status: searchParams.get("status") || "",
    group: searchParams.get("group") || "",
    assignment: searchParams.get("assignment") || "",
    sort: searchParams.get("sort") || "newest",
    type: searchParams.get("type") || "",
    from: searchParams.get("from") || "",
    to: searchParams.get("to") || "",
    technicianId: searchParams.get("technicianId") || "",
    rating: searchParams.get("rating") || "",
    appliance: searchParams.get("appliance") || "",
  };
  const rawPage = Number(searchParams.get("page") || 1);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const [searchInput, setSearchInput] = useState(filters.q);
  const urlSearch = filters.q;
  useEffect(() => {
    setSearchInput(urlSearch);
  }, [urlSearch]);
  useEffect(() => {
    if (searchInput.trim() === urlSearch) return;
    const timeout = setTimeout(() => {
      setSearchParams(
        () => {
          const next = new URLSearchParams(window.location.search);
          if (searchInput.trim()) next.set("q", searchInput.trim());
          else next.delete("q");
          next.delete("page");
          return next;
        },
        { replace: true },
      );
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchInput, urlSearch, setSearchParams]);
  function setPage(value: number) {
    setSearchParams(() => {
      const next = new URLSearchParams(window.location.search);
      if (value > 1) next.set("page", String(value));
      else next.delete("page");
      return next;
    });
  }
  const [assignment, setAssignment] = useState<AssignmentRequest | null>(null);
  const [statusRequest, setStatusRequest] = useState<StatusRequest | null>(
    null,
  );
  const [completion, setCompletion] = useState<Row | null>(null);
  const me = useQuery({
    queryKey: adminKeys.me,
    queryFn: async () => (await api.get("/auth/me")).data.data,
    staleTime: 30000,
  });
  const canManage = ["SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER"].includes(
    me.data?.role,
  );
  const technicians = useQuery({
    queryKey: adminKeys.technicians,
    queryFn: async () =>
      (
        await api.get<{ data: { id: string; full_name: string }[] }>(
          "/technicians",
        )
      ).data.data,
    staleTime: 30000,
  });
  const catalogue = useQuery({
    queryKey: adminKeys.catalogue,
    queryFn: async () =>
      (
        await api.get<{ data: { categories: { id: string; name: string }[] } }>(
          "/catalogue",
        )
      ).data.data,
    staleTime: 60000,
  });
  const params = {
    ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
    page,
    limit: 20,
    ...(mode === "COMPLETED"
      ? { status: "COMPLETED" }
      : mode === "APPOINTMENTS"
          ? { appointments: "true" }
          : mode === "ALL"
            ? {}
            : { type: mode }),
  };
  const q = useQuery({
    queryKey: [
      ...adminKeys.requests,
      mode,
      filters,
      page,
      searchParams.get("q"),
    ],
    queryFn: async ({ signal }) =>
      (
        await api.get<{ data: Row[]; meta: { total: number } }>("/requests", {
          params,
          signal,
        })
      ).data,
    refetchInterval: false,
  });
  const title =
    mode === "COMPLETED"
      ? "Completed Requests"
      : mode === "APPOINTMENTS"
          ? "Appointments"
          : mode === "ALL"
            ? "Requests"
            : mode === "SERVICE"
              ? "Service Requests"
              : "Installation Requests";
  function filter(key: keyof typeof filters, value: string) {
    // Merge current history: a second control can change before React renders the first URL update.
    setSearchParams(
      () => {
        const next = new URLSearchParams(window.location.search);
        if (value) next.set(key, value);
        else next.delete(key);
        next.delete("page");
        return next;
      },
      { replace: true },
    );
  }
  function actions(r: Row) {
    return (
      <div className="request-actions">
        <Link className="ui-view-action" to={"/requests/" + r.id}>
          <icons.view /> View Details
        </Link>
        {canManage &&
          [
            "REQUESTED",
            "UNDER_REVIEW",
            "EXECUTIVE_CONTACTED",
            "ASSIGNMENT_PENDING",
            "TECHNICIAN_ASSIGNED",
            "APPOINTMENT_CONFIRMED",
          ].includes(r.status) && (
            <button
              className="request-assign-button"
              onClick={() => setAssignment(r)}
            >
              <icons.technicians aria-hidden="true" />{" "}
              {r.assignment_state ? "Reassign Technician" : "Assign Technician"}
            </button>
          )}
        {canManage &&
          ["TECHNICIAN_ASSIGNED", "APPOINTMENT_CONFIRMED", "IN_PROGRESS"].includes(
            r.status,
          ) &&
          (r.assigned_technician_name || r.assignment_state === "ACCEPTED") && (
            <button
              className="request-complete-button"
              onClick={() =>
                setCompletion(r)
              }
            >
              <icons.success aria-hidden="true" /> Complete
            </button>
          )}
        <ActionMenu>
          {canManage && (
            <button onClick={() => setStatusRequest(r)}>
              <icons.edit aria-hidden="true" /> Change Status
            </button>
          )}
          {canManage && r.status === "APPOINTMENT_CONFIRMED" && (
            <Link to={"/requests/" + r.id + "?action=reschedule#update-status"}>
              <icons.calendar /> Reschedule
            </Link>
          )}
          <Link to={"/customers/" + r.customer_id}>
            <icons.customers /> View Customer
          </Link>
        </ActionMenu>
      </div>
    );
  }
  const columns = [
    column.accessor("customer_name", {
      header: "Customer",
      cell: (c) => (
        <>
          <Link to={`/customers/${c.row.original.customer_id}`}>
            {c.getValue()}
          </Link>
          <small>
            {contactPhone(c.row.original.customer_phone) ? (
              <a href={`tel:${contactPhone(c.row.original.customer_phone)}`}>
                <FaPhone aria-hidden="true" />{" "}
                {contactPhone(c.row.original.customer_phone)}
              </a>
            ) : (
              "Phone number not provided"
            )}
          </small>
        </>
      ),
    }),
    column.accessor("request_number", {
      header: "Request",
      cell: (c) => (
        <div className="request-service-cell">
          <div className="request-reference">
            <Link to={`/requests/${c.row.original.id}`}>
              {requestReference(c.row.original)}
            </Link>
            <button
              type="button"
              aria-label="Copy request ID"
              title="Copy request ID"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    requestReference(c.row.original),
                  );
                  toast.success("Request ID copied.");
                } catch {
                  toast.error("Unable to copy request ID.");
                }
              }}
            >
              <icons.copy />
            </button>
          </div>
          {mode !== "COMPLETED" && (
            <>
              <strong>{c.row.original.appliance}</strong>
              <small>{c.row.original.service_name}</small>
            </>
          )}
        </div>
      ),
    }),
    column.accessor("appliance", {
      header: mode === "COMPLETED" ? "Appliance" : "Problem / Service",
      cell: (c) => (
        <>
          {c.getValue()}
          <small>{c.row.original.service_name}</small>
          <small>
            {c.row.original.request_type === "INSTALLATION"
              ? "Installation"
              : "Service"}
            {c.row.original.details?.problem
              ? ` \u00b7 ${c.row.original.details.problem}`
              : ""}
          </small>
        </>
      ),
    }),
    column.accessor("preferred_date", {
      header: mode === "COMPLETED" ? "Completed date" : "Schedule",
      cell: (c) =>
        mode === "COMPLETED" ? (
          c.row.original.completed_at ? (
            new Date(c.row.original.completed_at).toLocaleString()
          ) : (
            "Not recorded"
          )
        ) : (
          <>
            {(c.row.original.confirmed_date || c.getValue())?.slice(0, 10)}
            <small>
              {c.row.original.confirmed_date
                ? `Confirmed · ${c.row.original.confirmed_time_window || ""}`
                : `Preferred · ${c.row.original.preferred_time_window || ""}`}
            </small>
            <small>
              {[
                c.row.original.address_snapshot?.area,
                c.row.original.address_snapshot?.city,
              ]
                .filter(Boolean)
                .join(", ")}
            </small>
          </>
        ),
    }),
    ...(mode === "COMPLETED"
      ? []
      : [
          column.display({
            id: "location",
            header: "Location",
            cell: ({ row }) => (
              <>
                <span>
                  {[
                    row.original.address_snapshot?.area,
                    row.original.address_snapshot?.city,
                  ]
                    .filter(Boolean)
                    .join(", ") || "Not provided"}
                </span>
                <LocationActions address={row.original.address_snapshot} />
              </>
            ),
          }),
        ]),
    column.accessor("assigned_technician_name", {
      header: "Technician",
      cell: (c) => (
        <>
          {c.getValue() ||
            c.row.original.offered_technician_name ||
            "Unassigned"}
          {c.row.original.assignment_state && (
            <small>
              {c.row.original.assignment_state === "OFFERED"
                ? "Legacy offer — reassign to activate"
                : "Accepted"}
            </small>
          )}
        </>
      ),
    }),
    column.display({
      id: "state",
      header: mode === "COMPLETED" ? "Customer rating" : "Status",
      cell: ({ row: { original: r } }) =>
        mode === "COMPLETED" ? (
          r.review_id ? (
            <>
              <Link to={`/feedback/${r.review_id}`}>
                <icons.star className="rating-star" /> {r.rating}/5 · View
                review
              </Link>
              {r.completion_actor_name && (
                <small>Completed by {r.completion_actor_name}</small>
              )}
            </>
          ) : (
            <>
              <span className="muted">Awaiting review</span>
              {r.completion_actor_name && (
                <small>Completed by {r.completion_actor_name}</small>
              )}
            </>
          )
        ) : (
          <>
            <StatusBadge status={operationalStatus(r.status)} />
            {r.status_source === "ADMIN_OVERRIDE" && (
              <small>Manual admin status</small>
            )}
          </>
        ),
    }),
    column.display({
      id: "actions",
      header: "Actions",
      cell: ({ row: { original: r } }) => actions(r),
    }),
  ];
  const table = useReactTable({
    data: q.data?.data || [],
    columns:
      mode === "COMPLETED"
        ? [
            columns[1]!,
            columns[0]!,
            column.accessor("request_type", {
              header: "Service / Installation",
              cell: (c) =>
                c.getValue() === "SERVICE" ? "Service" : "Installation",
            }),
            columns[2]!,
            columns[4]!,
            columns[3]!,
            columns[5]!,
            columns[6]!,
          ]
        : columns.filter(
            (definition) =>
              definition.id !== "location" &&
              (!("accessorKey" in definition) ||
                definition.accessorKey !== "appliance"),
          ),
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });
  return (
    <section className="request-workspace">
      <PageHeader
        title={title}
        description={
          mode === "COMPLETED"
            ? "Finished work, completion reports and customer feedback."
            : mode === "APPOINTMENTS"
                ? "Confirmed visits for your team."
                : "Manage service and installation bookings."
        }
      />
      {mode === "ALL" && (
        <div
          className="filter-chips request-type-tabs"
          aria-label="Request type"
        >
          {[
            ["", "All"],
            ["SERVICE", "Service"],
            ["INSTALLATION", "Installation"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filters.type === value}
              onClick={() => filter("type", value!)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <PageToolbar>
        <SearchField
          onClear={() => {
            setSearchInput("");
          }}
          busy={q.isFetching}
          aria-label="Search requests"
          placeholder="Request, Customer ID or name"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <label className="request-sort">
          Sort
          <select
            aria-label="Sort requests"
            value={filters.sort}
            onChange={(e) => filter("sort", e.target.value)}
          >
            {[
              ["newest", "Newest"],
              ["oldest", "Oldest"],
              ["appointment", "Upcoming appointment"],
              ["status", "Status"],
              ["customer", "Customer name"],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <div className="ui-toolbar-actions">
          <FilterPanel
            count={
              Object.entries(filters).filter(
                ([k, v]) =>
                  k !== "q" &&
                  k !== "sort" &&
                  !(mode === "ALL" && k === "type") &&
                  v,
              ).length
            }
          >
            {mode === "COMPLETED" && (
              <label>
                Request type
                <select
                  aria-label="Request type"
                  value={filters.type}
                  onChange={(e) => filter("type", e.target.value)}
                >
                  <option value="">All types</option>
                  <option>SERVICE</option>
                  <option>INSTALLATION</option>
                </select>
              </label>
            )}
            {mode !== "COMPLETED" && (
              <>
                <label>
                  Status
                  <select
                    aria-label="Status"
                    value={filters.group}
                    onChange={(e) => filter("group", e.target.value)}
                  >
                    <option value="">All statuses</option>
                    {[
                      "PENDING",
                      "TECHNICIAN_ASSIGNED",
                      "COMPLETED",
                      "CANCELLED",
                      "ON_HOLD",
                    ].map((g) => (
                      <option value={g} key={g}>
                        {g === "PENDING"
                          ? "Pending"
                          : g === "ON_HOLD"
                            ? "On Hold"
                            : g.charAt(0) +
                              g.slice(1).toLowerCase().replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Assignment
                  <select
                    aria-label="Assignment"
                    value={filters.assignment}
                    onChange={(e) => filter("assignment", e.target.value)}
                  >
                    <option value="">All assignments</option>
                    <option value="unassigned">Unassigned</option>
                    <option value="offered">Offer pending</option>
                    <option value="accepted">Accepted</option>
                  </select>
                </label>
              </>
            )}
            <label>
              Appliance
              <select
                aria-label="Appliance category"
                value={filters.appliance}
                onChange={(e) => filter("appliance", e.target.value)}
              >
                <option value="">All appliances</option>
                {catalogue.data?.categories?.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <DateRangeFilter
              from={filters.from}
              to={filters.to}
              onChange={filter}
            />
            <label>
              Technician
              <select
                aria-label="Technician"
                value={filters.technicianId}
                onChange={(e) => filter("technicianId", e.target.value)}
              >
                <option value="">All technicians</option>
                {technicians.data?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name}
                  </option>
                ))}
              </select>
            </label>
            {mode === "COMPLETED" && (
              <label>
                Rating
                <select
                  aria-label="Rating"
                  value={filters.rating}
                  onChange={(e) => filter("rating", e.target.value)}
                >
                  <option value="">All ratings</option>
                  {[1, 2, 3, 4, 5].map((r) => (
                    <option key={r} value={r}>
                      {r} stars
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button
              onClick={() => {
                setSearchInput("");
                setSearchParams({}, { replace: true });
              }}
            >
              Clear filters
            </button>
          </FilterPanel>
          <button
            onClick={() => q.refetch()}
            disabled={q.isFetching}
            title="Refresh requests"
          >
            <icons.refresh /> Refresh
          </button>
        </div>
      </PageToolbar>
      {q.isPending ? (
        <LoadingSkeleton title="Loading requests…" variant="table" />
      ) : q.isError ? (
        <ErrorState title="Unable to load requests" retry={() => q.refetch()} />
      ) : !q.data.data.length ? (
        <EmptyState
          title="No requests match your filters"
          description="Try a different search or clear the filters."
        />
      ) : (
        <>
          <div className="desktop-request-table">
            <DataTable>
              <table>
                <thead>
                  {table.getHeaderGroups().map((g) => (
                    <tr key={g.id}>
                      {g.headers.map((h) => (
                        <th key={h.id}>
                          {flexRender(
                            h.column.columnDef.header,
                            h.getContext(),
                          )}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((r) => (
                    <tr key={r.id}>
                      {r.getVisibleCells().map((c) => (
                        <td key={c.id}>
                          {flexRender(c.column.columnDef.cell, c.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTable>
          </div>
          <div className="mobile-request-list">
            {q.data.data.map((r) => (
              <article className="mobile-request-card" key={r.id}>
                <div className="request-card-heading">
                  <Link to={`/requests/${r.id}`}>{requestReference(r)}</Link>
                  <>
                    <StatusBadge status={operationalStatus(r.status)} />
                    {r.status_source === "ADMIN_OVERRIDE" && (
                      <small>Manual admin status</small>
                    )}
                    {mode === "COMPLETED" && r.completion_actor_name && (
                      <small>Completed by {r.completion_actor_name}</small>
                    )}
                  </>
                </div>
                <div className="request-card-service">
                  <span className="request-appliance-icon">
                    {r.request_type === "INSTALLATION" ? (
                      <icons.installation aria-hidden="true" />
                    ) : (
                      <icons.service aria-hidden="true" />
                    )}
                  </span>
                  <div>
                    <h2>{r.appliance}</h2>
                    <p>{r.service_name}</p>
                  </div>
                </div>
                <div className="request-card-customer">
                  <strong>{r.customer_name}</strong>
                  {contactPhone(r.customer_phone) ? (
                    <a href={`tel:${contactPhone(r.customer_phone)}`}>
                      <FaPhone aria-hidden="true" />{" "}
                      {contactPhone(r.customer_phone)}
                    </a>
                  ) : null}
                </div>
                <p className="request-card-area">
                  {[r.address_snapshot?.area, r.address_snapshot?.city]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                <dl>
                  <div>
                    <dt>{mode === "COMPLETED" ? "Completed" : "Visit date"}</dt>
                    <dd>
                      {(
                        r.completed_at ||
                        r.confirmed_date ||
                        r.preferred_date
                      )?.slice(0, 10)}
                      {mode !== "COMPLETED" && (
                        <small>
                          {r.confirmed_time_window || r.preferred_time_window}
                        </small>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Technician</dt>
                    <dd>
                      {r.assigned_technician_name ||
                        r.offered_technician_name ||
                        "Unassigned"}
                      {r.assignment_state === "OFFERED" && (
                        <small>Legacy offer · reassign to activate</small>
                      )}
                    </dd>
                  </div>
                </dl>
                {r.review_id && (
                  <Link to={`/feedback/${r.review_id}`}>
                    <icons.star /> {r.rating}/5 · View review
                  </Link>
                )}
                {actions(r)}
              </article>
            ))}
          </div>
          {q.data.meta.total > 20 && (
            <Pagination
              page={page}
              total={q.data.meta.total}
              onChange={setPage}
            />
          )}
        </>
      )}
      {assignment && (
        <AssignTechnicianDrawer
          request={assignment}
          onClose={() => setAssignment(null)}
        />
      )}
      {statusRequest && (
        <ChangeRequestStatusModal
          request={statusRequest}
          onClose={() => setStatusRequest(null)}
        />
      )}
      {completion && (
        <CompleteRequestModal
          request={completion}
          onClose={() => setCompletion(null)}
        />
      )}
    </section>
  );
}
