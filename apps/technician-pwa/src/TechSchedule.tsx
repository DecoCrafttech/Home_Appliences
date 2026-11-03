import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AsyncActionButton, LocationActions } from "@home/ui";
import { contactPhone, requestReference } from "@home/shared";
import { FaCalendarDay, FaLocationDot, FaPhone, FaUser } from "react-icons/fa6";
import type { CalendarBooking } from "@home/ui/calendar";
import {
  PageHeader,
  LoadingSkeleton,
  ErrorState,
  EmptyState,
  StatusBadge,
} from "./components";
import { api } from "./api";

const dayKey = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
const addDays = (value: string, amount: number) => {
  const date = new Date(`${value}T12:00:00+05:30`);
  date.setDate(date.getDate() + amount);
  return dayKey(date);
};
const label = (value: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-IN", {
    ...options,
    timeZone: "Asia/Kolkata",
  }).format(new Date(`${value}T12:00:00+05:30`));

export function TechSchedule() {
  const today = dayKey(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const range = useMemo(
    () => ({ from: selectedDate, to: addDays(selectedDate, 14) }),
    [selectedDate],
  );
  const q = useQuery({
    queryKey: ["technician", "schedule", range],
    queryFn: async () =>
      (
        await api.get<{
          data: CalendarBooking[];
          meta: { truncated: boolean };
        }>("/schedule", { params: range })
      ).data,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const days = Array.from({ length: 7 }, (_, index) =>
    addDays(selectedDate, index),
  );
  const grouped = useMemo(() => {
    const map = new Map<string, CalendarBooking[]>();
    for (const booking of q.data?.data || []) {
      const key = booking.confirmed_date.slice(0, 10);
      map.set(key, [...(map.get(key) || []), booking]);
    }
    return map;
  }, [q.data]);
  const jobs = grouped.get(selectedDate) || [];
  return (
    <section>
      <PageHeader
        title="Schedule"
        description="Confirmed visits in India Standard Time."
        actions={
          <AsyncActionButton pending={q.isFetching} onClick={() => q.refetch()}>
            Refresh
          </AsyncActionButton>
        }
      />
      <div className="schedule-toolbar">
        <button onClick={() => setSelectedDate(addDays(selectedDate, -7))}>
          Previous week
        </button>
        <strong>
          {label(selectedDate, { month: "long", year: "numeric" })}
        </strong>
        <button
          onClick={() => setSelectedDate(today)}
          disabled={selectedDate === today}
        >
          Today
        </button>
        <button onClick={() => setSelectedDate(addDays(selectedDate, 7))}>
          Next week
        </button>
      </div>
      <div className="schedule-strip" aria-label="Choose schedule date">
        {days.map((day) => (
          <button
            key={day}
            className={day === selectedDate ? "is-selected" : ""}
            aria-pressed={day === selectedDate}
            onClick={() => setSelectedDate(day)}
          >
            <span>
              {day === today ? "Today" : label(day, { weekday: "short" })}
            </span>
            <strong>{label(day, { day: "2-digit" })}</strong>
            <small>{grouped.get(day)?.length || 0} jobs</small>
          </button>
        ))}
      </div>
      {q.isPending ? (
        <LoadingSkeleton title="Loading schedule..." variant="calendar" />
      ) : q.isError ? (
        <ErrorState title="Unable to load schedule" retry={() => q.refetch()} />
      ) : !jobs.length ? (
        <EmptyState
          title="No jobs scheduled"
          description={`You have no confirmed visits on ${label(selectedDate, { day: "numeric", month: "long" })}.`}
        />
      ) : (
        <div className="schedule-day-group">
          <header>
            <div>
              <span>
                {selectedDate === today
                  ? "Today"
                  : label(selectedDate, { weekday: "long" })}
              </span>
              <h2>
                {label(selectedDate, {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </h2>
            </div>
            <strong>
              {jobs.length} {jobs.length === 1 ? "job" : "jobs"}
            </strong>
          </header>
          <div className="schedule-job-list">
            {jobs.map((job) => {
              const phone = contactPhone(job.customer_phone);
              const address = job.address_snapshot;
              return (
                <article
                  className={`schedule-job-card status-${job.status.toLowerCase()}`}
                  key={job.id}
                >
                  <div className="schedule-job-time">
                    <FaCalendarDay aria-hidden="true" />
                    <strong>{job.confirmed_time_window}</strong>
                  </div>
                  <div className="schedule-job-main">
                    <div className="tech-job-heading">
                      <span className="request-reference">
                        {requestReference(job)}
                      </span>
                      <StatusBadge status={job.status} />
                    </div>
                    <h3>{job.appliance}</h3>
                    <p>
                      {job.service_name} ·{" "}
                      {job.request_type === "INSTALLATION"
                        ? "Installation"
                        : "Service"}
                    </p>
                    <p>
                      <FaUser aria-hidden="true" /> {job.customer_name}
                    </p>
                    <p>
                      <FaLocationDot aria-hidden="true" />{" "}
                      {[address?.area, address?.city]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  </div>
                  <div className="schedule-job-actions">
                    {phone && (
                      <a className="secondary" href={`tel:${phone}`}>
                        <FaPhone /> Call
                      </a>
                    )}
                    <LocationActions address={address} directions compact />
                    <Link className="primary" to={`/technician/jobs/${job.id}`}>
                      View job
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
