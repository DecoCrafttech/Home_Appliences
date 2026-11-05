import { lazy, Suspense, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AsyncActionButton,
  ConfirmActionDialog,
  LocationActions,
} from "@home/ui";
import { contactPhone, requestReference } from "@home/shared";
import { FaPhone } from "react-icons/fa6";
import type { CalendarBooking } from "@home/ui/calendar";
import {
  PageHeader,
  LoadingSkeleton,
  ErrorState,
  StatusBadge,
} from "./components";
import { api } from "./api";

const ScheduleCalendar = lazy(() =>
  import("@home/ui/calendar").then((module) => ({
    default: module.ScheduleCalendar,
  })),
);

export function TechSchedule() {
  const [range, setRange] = useState({ from: "", to: "" });
  const [selected, setSelected] = useState<CalendarBooking | null>(null);
  const q = useQuery({
    queryKey: ["technician", "schedule", range],
    queryFn: async () =>
      (
        await api.get<{
          data: CalendarBooking[];
          meta: { truncated: boolean };
        }>("/schedule", { params: range })
      ).data,
    enabled: !!range.from,
    staleTime: 15000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
  return (
    <section className="tech-appointments">
      <PageHeader
        title="Appointments"
        description="Your confirmed visits, all in one place."
        actions={
          <AsyncActionButton
            pending={q.isFetching}
            onClick={() => q.refetch({ cancelRefetch: false })}
            disabled={!range.from}
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
                title="Loading appointments…"
              />
            </div>
          )}
          <Suspense
            fallback={
              <LoadingSkeleton variant="calendar" title="Loading calendar…" />
            }
          >
            <ScheduleCalendar
              bookings={q.data?.data || []}
              onRange={(from, to) =>
                setRange((old) =>
                  old.from === from && old.to === to ? old : { from, to },
                )
              }
              onSelect={setSelected}
            />
          </Suspense>
        </div>
      </div>
      {q.data?.meta?.truncated && (
        <p role="status">
          There are more than 1,000 visits in this range. Switch to Day or Week
          to see all appointments.
        </p>
      )}
      {selected && (
        <AppointmentDetails
          booking={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}

function AppointmentDetails({
  booking,
  onClose,
}: {
  booking: CalendarBooking;
  onClose: () => void;
}) {
  const phone = contactPhone(booking.customer_phone);
  const date = booking.confirmed_date.slice(0, 10);
  const dateLabel = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(`${date}T12:00:00+05:30`));
  return (
    <ConfirmActionDialog
      title={`Appointment ${requestReference(booking)}`}
      onClose={onClose}
      drawer
    >
      <div className="appointment-details tech-appointment-details">
        <StatusBadge status={booking.status} />
        <h3>{booking.customer_name}</h3>
        <p>
          {booking.appliance} ·{" "}
          {booking.service_name ||
            (booking.request_type === "INSTALLATION"
              ? "Installation"
              : "Service")}
        </p>
        <div className="tech-appointment-time">
          <strong>{dateLabel}</strong>
          <span>{booking.confirmed_time_window} · IST</span>
        </div>
        <p>
          {[
            booking.address_snapshot?.line1,
            booking.address_snapshot?.area,
            booking.address_snapshot?.city,
          ]
            .filter(Boolean)
            .join(", ")}
        </p>
        <div className="tech-appointment-contact">
          {phone && (
            <a className="secondary" href={`tel:${phone}`}>
              <FaPhone aria-hidden="true" /> Call customer
            </a>
          )}
          <LocationActions
            address={booking.address_snapshot}
            directions
            compact
          />
        </div>
        <Link
          className="primary tech-appointment-open"
          to={`/technician/jobs/${booking.id}`}
          onClick={onClose}
        >
          View job
        </Link>
      </div>
    </ConfirmActionDialog>
  );
}
