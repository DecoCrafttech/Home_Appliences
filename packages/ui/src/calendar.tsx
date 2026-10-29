import "temporal-polyfill/global";
import { useRef, useState } from "react";
import FullCalendar, { type CalendarRef } from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import listPlugin from "@fullcalendar/react/list";
import interactionPlugin from "@fullcalendar/react/interaction";
import classicThemePlugin from "@fullcalendar/react/themes/classic";
import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/classic/theme.css";
import "@fullcalendar/react/themes/classic/palette.css";
import { requestReference } from "@home/shared";
export type CalendarBooking = {
  id: string;
  display_number?: number | string;
  request_number: string;
  request_type: string;
  appliance: string;
  service_name: string;
  status: string;
  version: number;
  confirmed_date: string;
  confirmed_time_window: string;
  customer_name: string;
  customer_phone?: string;
  technician_name?: string;
  address_snapshot?: Record<string, string>;
  assigned_technician_id?: string;
};
export function ScheduleCalendar({
  bookings,
  onRange,
  onSelect,
  onMove,
}: {
  bookings: CalendarBooking[];
  onRange: (from: string, to: string) => void;
  onSelect: (booking: CalendarBooking) => void;
  onMove?: (booking: CalendarBooking, date: string, timeWindow: string) => void;
}) {
  const [mobile] = useState(
    () => window.matchMedia("(max-width:760px)").matches,
  );
  const ref = useRef<CalendarRef>(null);
  const initialDate =
    new URLSearchParams(window.location.search).get("date") || undefined;
  return (
    <div className="appointment-calendar">
      <label className="calendar-date-jump">
        Go to date
        <input
          type="date"
          defaultValue={initialDate}
          onChange={(event) => {
            if (event.target.value)
              ref.current?.getApi().gotoDate(event.target.value);
          }}
        />
      </label>
      <FullCalendar
        ref={ref}
        initialDate={initialDate}
        plugins={[
          dayGridPlugin,
          timeGridPlugin,
          listPlugin,
          interactionPlugin,
          classicThemePlugin,
        ]}
        initialView={mobile ? "listWeek" : "timeGridWeek"}
        timeZone="Asia/Kolkata"
        firstDay={1}
        height="auto"
        nowIndicator
        headerToolbar={{
          start: "prev,next today",
          center: "title",
          end: "timeGridDay,timeGridWeek,dayGridMonth,listWeek",
        }}
        buttons={{
          today: { text: "Today" },
          timeGridDay: { text: "Day" },
          timeGridWeek: { text: "Week" },
          dayGridMonth: { text: "Month" },
          listWeek: { text: "Agenda" },
        }}
        slotMinTime="06:00:00"
        slotMaxTime="22:00:00"
        allDaySlot={false}
        dayMaxEvents={3}
        editable={!!onMove && !mobile}
        eventDurationEditable={false}
        datesSet={(info) =>
          onRange(info.startStr.slice(0, 10), info.endStr.slice(0, 10))
        }
        events={bookings.map((booking) => ({
          id: booking.id,
          title: `${booking.customer_name} · ${booking.appliance}`,
          start: `${booking.confirmed_date.slice(0, 10)}T${booking.confirmed_time_window.slice(0, 5)}:00+05:30`,
          end: `${booking.confirmed_date.slice(0, 10)}T${booking.confirmed_time_window.slice(6)}:00+05:30`,
          color:
            booking.status === "COMPLETED"
              ? "var(--color-success)"
              : booking.status === "ON_HOLD"
                ? "var(--color-warning)"
                : "var(--color-primary)",
          startEditable: !!onMove && booking.status === "APPOINTMENT_CONFIRMED",
          extendedProps: { booking },
        }))}
        eventClick={(info) => {
          const booking = bookings.find((b) => b.id === info.event.id);
          if (booking) onSelect(booking);
        }}
        eventDrop={(info) => {
          const booking = bookings.find((b) => b.id === info.event.id);
          const date = info.event.startStr.slice(0, 10),
            start = info.event.startStr.slice(11, 16),
            end = info.event.endStr.slice(11, 16);
          info.revert();
          if (booking && onMove && start && end)
            onMove(booking, date, `${start}-${end}`);
        }}
        eventContent={(info) => {
          const booking = info.event.extendedProps.booking as CalendarBooking;
          return (
            <div className="calendar-event">
              <strong>
                {info.timeText} · {booking.customer_name}
              </strong>
              <span>
                {booking.appliance} ·{" "}
                {booking.request_type === "SERVICE"
                  ? "Service"
                  : "Installation"}
              </span>
              <small>
                {booking.status === "APPOINTMENT_CONFIRMED"
                  ? "Confirmed"
                  : booking.status.replaceAll("_", " ").toLowerCase()}{" "}
                ·{" "}
                {booking.technician_name ||
                  booking.address_snapshot?.area ||
                  "Confirmed visit"}{" "}
                · {requestReference(booking)}
              </small>
            </div>
          );
        }}
        noEventsContent={() => (
          <p className="calendar-empty">
            No confirmed appointments in this period.
          </p>
        )}
      />
    </div>
  );
}
