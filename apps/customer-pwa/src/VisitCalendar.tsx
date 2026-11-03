import { useState } from "react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa6";

export function VisitCalendar({
  value,
  min,
  onChange,
}: {
  value: string;
  min: string;
  onChange: (date: string) => void;
}) {
  const [month, setMonth] = useState(() => (value || min).slice(0, 7));
  const [year, index] = month.split("-").map(Number);
  const first = new Date(year!, index! - 1, 1);
  const days = new Date(year!, index!, 0).getDate();
  const label = new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
  }).format(first);
  function move(offset: number) {
    const date = new Date(year!, index! - 1 + offset, 1);
    setMonth(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
    );
  }
  return (
    <section className="visit-month" aria-label="Preferred date calendar">
      <header>
        <button
          type="button"
          aria-label="Previous month"
          disabled={month <= min.slice(0, 7)}
          onClick={() => move(-1)}
        >
          <FaChevronLeft />
        </button>
        <h3 aria-live="polite">{label}</h3>
        <button type="button" aria-label="Next month" onClick={() => move(1)}>
          <FaChevronRight />
        </button>
      </header>
      <div className="visit-month-grid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <span className="weekday" key={day}>
            {day}
          </span>
        ))}
        {Array.from({ length: first.getDay() }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const date = `${month}-${String(i + 1).padStart(2, "0")}`;
          return (
            <button
              type="button"
              key={date}
              aria-label={date}
              aria-pressed={date === value}
              className={date === value ? "selected" : ""}
              disabled={date < min}
              onClick={() => onChange(date)}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </section>
  );
}
