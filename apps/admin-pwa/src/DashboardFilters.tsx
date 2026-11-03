import { useState } from "react";
import { FilterDropdown } from "@home/ui";

export type RangeOption = "1" | "3" | "7" | "month" | "custom";
export const rangeLabels: Record<RangeOption, string> = {
  "1": "Today",
  "3": "Last 3 days",
  "7": "Last 7 days",
  month: "This month",
  custom: "Custom dates",
};
export function DashboardFilters({
  value,
  dates,
  today,
  onApply,
}: {
  value: RangeOption;
  dates: { from: string; to: string };
  today: string;
  onApply: (value: RangeOption, dates: { from: string; to: string }) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [range, setRange] = useState(dates);
  const valid =
    /^\d{4}-\d{2}-\d{2}$/.test(range.from) &&
    /^\d{4}-\d{2}-\d{2}$/.test(range.to) &&
    range.from <= range.to &&
    range.to <= today;
  return (
    <FilterDropdown
      summary={rangeLabels[value]}
      activeCount={value === "7" ? 0 : 1}
      onOpen={() => {
        setDraft(value);
        setRange(dates);
      }}
    >
      {(close) => (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (draft !== "custom" || valid) {
              onApply(draft, range);
              close();
            }
          }}
        >
          <label>
            Date range
            <select
              aria-label="Dashboard date range"
              value={draft}
              onChange={(event) => setDraft(event.target.value as RangeOption)}
            >
              <option value="1">1 Day</option>
              <option value="3">3 Days</option>
              <option value="7">7 Days</option>
              <option value="month">Month</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          {draft === "custom" && (
            <div className="staff-filter-dates">
              <label>
                Start date
                <input
                  type="date"
                  value={range.from}
                  max={range.to || today}
                  required
                  onChange={(event) =>
                    setRange({ ...range, from: event.target.value })
                  }
                />
              </label>
              <label>
                End date
                <input
                  type="date"
                  value={range.to}
                  min={range.from}
                  max={today}
                  required
                  onChange={(event) =>
                    setRange({ ...range, to: event.target.value })
                  }
                />
              </label>
              {!valid && (
                <p className="staff-filter-error" role="alert">
                  Choose a valid range ending today or earlier.
                </p>
              )}
            </div>
          )}
          <p className="staff-filter-note">
            Applies to dashboard totals, request activity and team allocation.
          </p>
          <footer className="staff-filter-actions">
            <button
              type="button"
              className="secondary"
              onClick={() => {
                onApply("7", { from: today, to: today });
                close();
              }}
            >
              Reset
            </button>
            <button
              className="primary"
              type="submit"
              disabled={draft === "custom" && !valid}
            >
              Apply filters
            </button>
          </footer>
        </form>
      )}
    </FilterDropdown>
  );
}
