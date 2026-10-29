import { lazy, Suspense, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AsyncActionButton,
  ConfirmActionDialog,
  LocationActions,
  useSafeMutation,
} from "@home/ui";
import { requestReference } from "@home/shared";
import type { CalendarBooking } from "@home/ui/calendar";
import { toast } from "sonner";
import axios from "axios";
import { api } from "./api";
import { PageHeader, LoadingSkeleton, ErrorState } from "./components";
const ScheduleCalendar = lazy(() =>
  import("@home/ui/calendar").then((module) => ({
    default: module.ScheduleCalendar,
  })),
);
const errorText = (error: unknown) =>
  axios.isAxiosError(error)
    ? error.response?.data?.error?.message || "Unable to update appointment."
    : "Unable to update appointment.";
type Proposal = {
  id: string;
  request_id: string;
  display_number?: string | number;
  request_number: string;
  technician_name: string;
  customer_name: string;
  appliance: string;
  proposed_date: string;
  proposed_time_window: string;
  reason: string;
  version: number;
  request_version: number;
};
export function Appointments({ canManage }: { canManage: boolean }) {
  const [range, setRange] = useState({ from: "", to: "" }),
    [selected, setSelected] = useState<{
      booking: CalendarBooking;
      date?: string;
      timeWindow?: string;
    } | null>(null);
  const q = useQuery({
    queryKey: ["admin", "appointments", range],
    queryFn: async () =>
      (
        await api.get<{
          data: CalendarBooking[];
          meta: { truncated: boolean };
        }>("/appointments", { params: range })
      ).data,
    enabled: !!range.from,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const proposals = useQuery({
    queryKey: ["admin", "reschedules"],
    queryFn: async () =>
      (await api.get<{ data: Proposal[] }>("/appointment-reschedules")).data
        .data,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const qc = useQueryClient(),
    decision = useSafeMutation(
      async ({
        p,
        value,
        reason,
      }: {
        p: Proposal;
        value: string;
        reason: string;
      }) => {
        await api.post(`/appointment-reschedules/${p.id}/decision`, {
          decision: value,
          version: p.version,
          requestVersion: p.request_version,
          reason,
        });
        await Promise.all([
          qc.invalidateQueries({ queryKey: ["admin", "reschedules"] }),
          qc.invalidateQueries({ queryKey: ["admin", "appointments"] }),
          qc.invalidateQueries({ queryKey: ["admin-requests"] }),
          qc.invalidateQueries({ queryKey: ["admin-request", p.request_id] }),
        ]);
        return true;
      },
    );
  return (
    <section>
      <PageHeader
        title="Appointments"
        description="Confirmed visits in India Standard Time. Proposed changes require approval."
        actions={
          <AsyncActionButton
            pending={q.isFetching || proposals.isFetching}
            onClick={async () => {
              await Promise.all([
                q.refetch({ cancelRefetch: false }),
                proposals.refetch({ cancelRefetch: false }),
              ]);
            }}
          >
            Refresh
          </AsyncActionButton>
        }
      />
      {q.isError && (
        <ErrorState
          title="Unable to load appointments"
          retry={() => q.refetch()}
        />
      )}
      <div aria-busy={q.isFetching}>
        <div className="calendar-loading-region">
          {q.isPending && !!range.from && (
            <div className="calendar-loading-overlay">
              <LoadingSkeleton
                variant="calendar"
                title="Loading appointments..."
              />
            </div>
          )}
          <Suspense
            fallback={
              <LoadingSkeleton title="Loading calendar..." variant="calendar" />
            }
          >
            <ScheduleCalendar
              bookings={q.data?.data || []}
              onRange={(from, to) =>
                setRange((old) =>
                  old.from === from && old.to === to ? old : { from, to },
                )
              }
              onSelect={(booking) => setSelected({ booking })}
              onMove={
                canManage
                  ? (booking, date, timeWindow) =>
                      setSelected({ booking, date, timeWindow })
                  : undefined
              }
            />
          </Suspense>
        </div>
      </div>
      {q.data?.meta?.truncated && (
        <p role="status">
          There are more than 1,000 visits in this range. Switch to Day or Week
          to see every appointment.
        </p>
      )}
      <section className="ui-panel reschedule-queue">
        <h2>Schedule change requests</h2>
        {proposals.isPending ? (
          <LoadingSkeleton />
        ) : proposals.isError ? (
          <ErrorState
            title="Unable to load schedule proposals"
            retry={() => proposals.refetch()}
          />
        ) : !proposals.data.length ? (
          <p>No pending schedule changes.</p>
        ) : (
          proposals.data.map((p) => (
            <article key={p.id} id={`proposal-${p.id}`}>
              <h3>
                <Link to={`/requests/${p.request_id}`}>
                  {requestReference(p)}
                </Link>{" "}
                · {p.customer_name}
              </h3>
              <p>
                {p.technician_name} proposed{" "}
                <strong>
                  {p.proposed_date.slice(0, 10)} · {p.proposed_time_window}
                </strong>
              </p>
              {p.reason && <p>{p.reason}</p>}
              {canManage && (
                <form onSubmit={(e) => e.preventDefault()}>
                  <label>
                    Decision note
                    <input
                      name="reason"
                      maxLength={1000}
                      disabled={decision.isPending}
                    />
                  </label>
                  <div className="workflow-actions">
                    {[
                      ["APPROVED", "Approve reschedule"],
                      ["REJECTED", "Decline request"],
                    ].map(([value, label]) => (
                      <AsyncActionButton
                        key={value}
                        pending={decision.isPending}
                        pendingLabel="Saving..."
                        onClick={async (e) => {
                          const form = e.currentTarget.closest("form")!;
                          try {
                            if (
                              await decision.run({
                                p,
                                value: value!,
                                reason: String(
                                  new FormData(form).get("reason") || "",
                                ),
                              })
                            )
                              toast.success(
                                value === "APPROVED"
                                  ? "Appointment rescheduled."
                                  : "Schedule request declined.",
                              );
                          } catch (error) {
                            toast.error(errorText(error));
                          }
                        }}
                      >
                        {label}
                      </AsyncActionButton>
                    ))}
                  </div>
                </form>
              )}
            </article>
          ))
        )}
      </section>
      {selected && (
        <AppointmentDetails
          key={selected.booking.id + selected.date + selected.timeWindow}
          {...selected}
          canManage={canManage}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}
function AppointmentDetails({
  booking,
  date,
  timeWindow,
  canManage,
  onClose,
}: {
  booking: CalendarBooking;
  date?: string;
  timeWindow?: string;
  canManage: boolean;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(!!date),
    [failure, setFailure] = useState("");
  const qc = useQueryClient();
  const mutation = useSafeMutation(async (form: FormData) => {
    await api.post(`/requests/${booking.id}/status`, {
      status: "APPOINTMENT_CONFIRMED",
      version: booking.version,
      confirmedDate: form.get("date"),
      confirmedTimeWindow: `${form.get("start")}-${form.get("end")}`,
      note: "Appointment rescheduled through calendar",
    });
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["admin", "appointments"] }),
      qc.invalidateQueries({ queryKey: ["admin-requests"] }),
      qc.invalidateQueries({ queryKey: ["admin-request", booking.id] }),
    ]);
    return true;
  });
  return (
    <ConfirmActionDialog
      title={`Appointment ${requestReference(booking)}`}
      onClose={onClose}
      pending={mutation.isPending}
      drawer
    >
      <div className="appointment-details">
        <h3>{booking.customer_name}</h3>
        <p>
          {booking.service_name} · {booking.appliance}
        </p>
        {booking.customer_phone && (
          <a href={`tel:${booking.customer_phone}`}>
            Call {booking.customer_phone}
          </a>
        )}
        <p>
          {[
            booking.address_snapshot?.line1,
            booking.address_snapshot?.area,
            booking.address_snapshot?.city,
          ]
            .filter(Boolean)
            .join(", ")}
        </p>
        <LocationActions address={booking.address_snapshot} />
        <p>Technician: {booking.technician_name || "Unassigned"}</p>
        <p>
          Confirmed: {booking.confirmed_date.slice(0, 10)} ·{" "}
          {booking.confirmed_time_window}
        </p>
        <p>{booking.status.replaceAll("_", " ")}</p>
        <Link className="secondary" to={`/requests/${booking.id}`}>
          View Request
        </Link>
        {canManage &&
          booking.status === "APPOINTMENT_CONFIRMED" &&
          !editing && (
            <button onClick={() => setEditing(true)}>Reschedule</button>
          )}
        {editing && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setFailure("");
              try {
                if (await mutation.run(new FormData(e.currentTarget))) {
                  toast.success("Appointment rescheduled.");
                  onClose();
                }
              } catch (error) {
                setFailure(errorText(error));
                toast.error(errorText(error));
              }
            }}
          >
            <h3>Confirm new appointment</h3>
            <p>
              The visit changes only after technician and schedule-conflict
              validation succeeds.
            </p>
            <fieldset disabled={mutation.isPending}>
              <label>
                Date
                <input
                  name="date"
                  type="date"
                  defaultValue={date || booking.confirmed_date.slice(0, 10)}
                  required
                />
              </label>
              <label>
                Start time
                <input
                  name="start"
                  type="time"
                  defaultValue={(
                    timeWindow || booking.confirmed_time_window
                  ).slice(0, 5)}
                  required
                />
              </label>
              <label>
                End time
                <input
                  name="end"
                  type="time"
                  defaultValue={(
                    timeWindow || booking.confirmed_time_window
                  ).slice(6)}
                  required
                />
              </label>
            </fieldset>
            {failure && <p role="alert">{failure}</p>}
            <AsyncActionButton
              className="primary"
              pending={mutation.isPending}
              pendingLabel="Rescheduling..."
              type="submit"
            >
              Confirm reschedule
            </AsyncActionButton>
          </form>
        )}
      </div>
    </ConfirmActionDialog>
  );
}
