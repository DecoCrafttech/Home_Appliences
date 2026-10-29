import { lazy, Suspense, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AsyncActionButton,
  ConfirmActionDialog,
  LocationActions,
} from "@home/ui";
import { contactPhone, requestReference } from "@home/shared";
import { FaPhone, FaArrowRight } from "react-icons/fa6";
import type { CalendarBooking } from "@home/ui/calendar";
import { PageHeader, LoadingSkeleton, ErrorState } from "./components";
import { api } from "./api";
import { RescheduleRequest } from "./RescheduleRequest";
const ScheduleCalendar = lazy(() =>
  import("@home/ui/calendar").then((module) => ({
    default: module.ScheduleCalendar,
  })),
);
export function TechSchedule() {
  const [range, setRange] = useState({ from: "", to: "" }),
    [selected, setSelected] = useState<CalendarBooking | null>(null);
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
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  return (
    <section>
      <PageHeader
        title="Schedule"
        description="Your confirmed visits, in India Standard Time."
        actions={
          <AsyncActionButton
            pending={q.isFetching}
            onClick={() => q.refetch({ cancelRefetch: false })}
          >
            Refresh
          </AsyncActionButton>
        }
      />
      {q.isError && (
        <ErrorState title="Unable to load schedule" retry={() => q.refetch()} />
      )}

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
            onSelect={setSelected}
          />
        </Suspense>
      </div>
      {q.data?.meta?.truncated && (
        <p>Choose a smaller calendar range to see every appointment.</p>
      )}
      {selected && (
        <ConfirmActionDialog
          title={`Visit ${requestReference(selected)}`}
          onClose={() => setSelected(null)}
          drawer
        >
          <div className="appointment-details tech-schedule-visit">
            <h3>{selected.customer_name}</h3>
            <p>
              {selected.appliance} · {selected.service_name}
            </p>
            <p>
              Confirmed: {selected.confirmed_date.slice(0, 10)} ·{" "}
              {selected.confirmed_time_window}
            </p>
            <p>
              {[
                selected.address_snapshot?.line1,
                selected.address_snapshot?.area,
                selected.address_snapshot?.city,
              ]
                .filter(Boolean)
                .join(", ")}
            </p>
            <div className="tech-job-contact-actions">
              {contactPhone(selected.customer_phone) && (
                <a
                  className="secondary"
                  href={`tel:${contactPhone(selected.customer_phone)}`}
                  aria-label="Call Customer"
                >
                  <FaPhone aria-hidden="true" />
                  <span>
                    Call Customer
                    <span className="tech-contact-number">
                      {contactPhone(selected.customer_phone)}
                    </span>
                  </span>
                </a>
              )}
              <LocationActions
                address={selected.address_snapshot}
                directions
                compact
              />
            </div>
            <Link
              className="primary tech-schedule-open"
              to={`/technician/jobs/${selected.id}`}
            >
              View job <FaArrowRight aria-hidden="true" />
            </Link>
            {["TECHNICIAN_ASSIGNED", "APPOINTMENT_CONFIRMED"].includes(
              selected.status,
            ) && (
              <RescheduleRequest
                id={selected.id}
                version={selected.version}
                date={selected.confirmed_date}
                timeWindow={selected.confirmed_time_window}
              />
            )}
          </div>
        </ConfirmActionDialog>
      )}
    </section>
  );
}
