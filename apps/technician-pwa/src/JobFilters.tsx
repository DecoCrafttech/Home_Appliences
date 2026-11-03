import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FilterDropdown } from "@home/ui";

export const jobViews = {
  active: "Active jobs",
  pending: "Assigned jobs",
  today: "Today",
  upcoming: "Upcoming",
  "in-progress": "In progress",
  completed: "Completed",
  weekly: "This week",
  all: "All jobs",
};
export type JobView = keyof typeof jobViews;
export type JobFilterValue = { view: JobView; type: string; date: string };
export function useJobFilters() {
  const [params, setParams] = useSearchParams();
  const view = Object.hasOwn(jobViews, params.get("view") || "")
    ? (params.get("view") as JobView)
    : "active";
  const type = ["SERVICE", "INSTALLATION"].includes(params.get("type") || "")
    ? params.get("type")!
    : "";
  const requestedDate = params.get("date") || "";
  const date =
    (view === "all" || view === "weekly") &&
    /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
      ? requestedDate
      : "";
  function apply(value: JobFilterValue) {
    const next = new URLSearchParams(window.location.search);
    for (const [key, entry] of Object.entries(value)) {
      if (entry && !(key === "view" && entry === "active"))
        next.set(key, entry);
      else next.delete(key);
    }
    next.delete("page");
    setParams(next, { replace: true });
  }
  return { filters: { view, type, date }, apply };
}
export function jobFilterQuery(value: JobFilterValue) {
  const query = new URLSearchParams();
  if (value.view !== "active") query.set("view", value.view);
  if (value.type) query.set("type", value.type);
  if (value.date) query.set("date", value.date);
  return query.toString() ? `?${query}` : "";
}
export function jobFilterLabel(value: JobFilterValue) {
  return `${jobViews[value.view]}${value.type ? ` / ${value.type === "SERVICE" ? "Service" : "Installation"}` : ""}${value.date ? ` / ${value.date}` : ""}`;
}
export function JobFilters({
  value,
  onApply,
}: {
  value: JobFilterValue;
  onApply: (value: JobFilterValue) => void;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <FilterDropdown
      summary={jobFilterLabel(value)}
      activeCount={
        Number(value.view !== "active") +
        Number(!!value.type) +
        Number(!!value.date)
      }
      onOpen={() => setDraft(value)}
    >
      {(close) => (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onApply(draft);
            close();
          }}
        >
          <label>
            Work view
            <select
              aria-label="Work view"
              value={draft.view}
              onChange={(event) => {
                const view = event.target.value as JobView;
                setDraft({
                  ...draft,
                  view,
                  date: view === "all" || view === "weekly" ? draft.date : "",
                });
              }}
            >
              {Object.entries(jobViews).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Request type
            <select
              aria-label="Request type"
              value={draft.type}
              onChange={(event) =>
                setDraft({ ...draft, type: event.target.value })
              }
            >
              <option value="">All types</option>
              <option value="SERVICE">Service</option>
              <option value="INSTALLATION">Installation</option>
            </select>
          </label>
          {(draft.view === "all" || draft.view === "weekly") && (
            <label>
              {draft.view === "weekly"
                ? "Week starting"
                : "Visit date (optional)"}
              <input
                type="date"
                value={draft.date}
                onChange={(event) =>
                  setDraft({ ...draft, date: event.target.value })
                }
              />
            </label>
          )}
          <p className="staff-filter-note">
            Filters apply to your assigned jobs. Weekly view starts today unless
            you choose a date.
          </p>
          <footer className="staff-filter-actions">
            <button
              type="button"
              className="secondary"
              onClick={() => {
                onApply({ view: "active", type: "", date: "" });
                close();
              }}
            >
              Reset
            </button>
            <button type="submit" className="primary">
              Apply filters
            </button>
          </footer>
        </form>
      )}
    </FilterDropdown>
  );
}
