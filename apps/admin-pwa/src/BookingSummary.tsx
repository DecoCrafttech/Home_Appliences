import { BookedPriceSummary } from "@home/ui";
import { Link } from "react-router-dom";
import { CustomerContact, LocationActions } from "@home/ui";
import { requestReference, operationalStatus } from "@home/shared";
import { StatusBadge } from "./components";
type Booking = {
  request_number: string;
  display_number?: number | string;
  request_type: string;
  appliance: string;
  service_name: string;
  details?: Record<string, unknown>;
  customer_id?: string;
  status_source?: string;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  customer_reference?: string;
  address_snapshot?: Record<string, string>;
  preferred_date: string;
  preferred_time_window: string;
  confirmed_date?: string;
  confirmed_time_window?: string;
  created_at?: string;
  status: string;
  assigned_technician_name?: string;
  offered_technician_name?: string;
  assignment_state?: string;
  timeline?: {
    status: string;
    created_at: string;
    actor_role?: string;
    actor_staff_name?: string | null;
    actor_technician_name?: string | null;
  }[];
};
export function BookingSummary({ request: r }: { request: Booking }) {
  const labels = r.details?._fieldLabels as Record<string, string> | undefined;
  return (
    <>
      {r.status_source === "ADMIN_OVERRIDE" && (
        <p className="inline-note">
          Manual administrative status. Technician assignments and work reports
          are tracked separately.
        </p>
      )}
      <div className="booking-summary-grid">
        <section className="ui-panel">
          <h2>
            <span>1</span> Appliance / Service
          </h2>
          <h3>{r.appliance}</h3>
          <p>{r.service_name}</p>
          <dl>
            {Object.entries(r.details || {})
              .filter(
                ([key, value]) =>
                  !key.startsWith("_") &&
                  !["optionId", "optionIds"].includes(key) &&
                  typeof value === "string" &&
                  value,
              )
              .map(([key, value]) => (
                <div key={key}>
                  <dt>{labels?.[key] || key.replaceAll("_", " ")}</dt>
                  <dd>{String(value)}</dd>
                </div>
              ))}
          </dl>
        </section>
        <section className="ui-panel">
          <h2>
            <span>2</span> Customer / Location
          </h2>
          <CustomerContact
            name={r.customer_name}
            phone={r.customer_phone}
            reference={r.customer_reference}
          />
          <Link to={`/customers/${r.customer_id}`}>View Customer</Link>
          {r.customer_email && <p>{r.customer_email}</p>}
          <p>
            {[
              r.address_snapshot?.line1,
              r.address_snapshot?.area,
              r.address_snapshot?.city,
              r.address_snapshot?.state,
              r.address_snapshot?.pinCode || r.address_snapshot?.pin_code,
            ]
              .filter(Boolean)
              .join(", ")}
          </p>
          <LocationActions address={r.address_snapshot} />
        </section>
        <section className="ui-panel">
          <h2>
            <span>3</span> Schedule
          </h2>
          <dl>
            <div>
              <dt>Preferred visit</dt>
              <dd>
                {r.preferred_date?.slice(0, 10)} · {r.preferred_time_window}
              </dd>
            </div>
            <div>
              <dt>Confirmed appointment</dt>
              <dd>
                {r.confirmed_date
                  ? `${r.confirmed_date.slice(0, 10)} · ${r.confirmed_time_window}`
                  : "Awaiting operations confirmation"}
              </dd>
            </div>
            <div>
              <dt>Technician</dt>
              <dd>
                {r.assigned_technician_name ||
                  r.offered_technician_name ||
                  "Unassigned"}
                {r.assignment_state && (
                  <small>
                    {r.assignment_state === "OFFERED"
                      ? "Legacy offer — reassign to activate"
                      : r.assignment_state === "ACCEPTED"
                        ? "Accepted"
                        : r.assignment_state}
                  </small>
                )}
              </dd>
            </div>
          </dl>
        </section>
        <section className="ui-panel">
          <h2>
            <span>4</span> Request Summary
          </h2>
          <span className="request-reference">{requestReference(r)}</span>
          <p>{r.request_type === "SERVICE" ? "Service" : "Installation"}</p>
          {r.created_at && (
            <p>Submitted {new Date(r.created_at).toLocaleString("en-IN")}</p>
          )}
          <StatusBadge status={operationalStatus(r.status)} />
          <BookedPriceSummary details={r.details} />
        </section>
      </div>
      <ol className="booking-progress" aria-label="Request progress">
        {[
          ["PENDING", "Pending"],
          ["TECHNICIAN_ASSIGNED", "Technician assigned"],
          ["IN_PROGRESS", "In progress"],
          ["COMPLETED", "Completed"],
        ].map(([state, label]) => {
          const event = r.timeline?.find(
              (e) => operationalStatus(e.status) === state,
            ),
            current = operationalStatus(r.status) === state;
          return (
            <li
              key={state}
              className={event ? "recorded" : ""}
              aria-current={current ? "step" : undefined}
            >
              <strong>{label}</strong>
              {event ? (
                <>
                  <time dateTime={event.created_at}>
                    {new Date(event.created_at).toLocaleDateString("en-IN")}
                  </time>
                  {(event.actor_technician_name ||
                    event.actor_staff_name ||
                    event.actor_role) && (
                    <small>
                      Updated by{" "}
                      {event.actor_technician_name ||
                        event.actor_staff_name ||
                        event.actor_role?.toLowerCase()}
                    </small>
                  )}
                </>
              ) : current ? (
                <small>Current stage</small>
              ) : (
                <small>Not recorded</small>
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}
