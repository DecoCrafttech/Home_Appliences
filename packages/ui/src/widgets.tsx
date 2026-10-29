import { ConfirmActionDialog } from "./index";
import { requestStatusPresentation } from "@home/shared";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type InputHTMLAttributes,
} from "react";
import { Toaster } from "sonner";
import type { IconType } from "react-icons";
import { icons } from "./icons";
import { Link } from "react-router-dom";
export {
  LoadingSkeleton,
  AppSkeleton,
  SkeletonCard,
  SkeletonTable,
  SkeletonProfile,
} from "./skeletons";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-title ui-page-header tw:flex tw:justify-between tw:gap-4">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="ui-actions">{actions}</div>}
    </div>
  );
}
export function PageToolbar({ children }: { children: ReactNode }) {
  return <div className="ui-toolbar">{children}</div>;
}
export function SearchField({
  onClear,
  busy = false,
  onKeyDown,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  onClear?: () => void;
  busy?: boolean;
}) {
  const field = useRef<HTMLInputElement>(null);
  function clear() {
    onClear?.();
    field.current?.focus();
  }
  return (
    <div className="ui-search">
      <icons.search aria-hidden="true" />
      <input
        aria-label="Search"
        type="search"
        {...props}
        ref={field}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (!event.defaultPrevented && event.key === "Escape" && onClear && props.value) {
            event.preventDefault();
            event.stopPropagation();
            clear();
          }
        }}
      />
      {busy && (
        <span
          className="search-progress action-spinner"
          aria-label="Searching"
          role="status"
        />
      )}
      {onClear && !!props.value && (
        <button
          type="button"
          className="search-clear"
          aria-label="Clear search"
          onClick={clear}
        >
          <icons.close aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
export function StatCard({
  label,
  value,
  icon: Icon = icons.dashboard,
  to,
}: {
  label: string;
  value: number | string;
  icon?: IconType;
  to?: string;
}) {
  return (
    <article className="ui-stat tw:rounded-xl tw:border tw:bg-white">
      <div className="ui-stat-icon">
        <Icon aria-hidden="true" />
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {to && (
          <Link
            to={to}
            className="ui-stat-link"
            aria-label={`View ${label.toLowerCase()}`}
          >
            View details <icons.next aria-hidden="true" />
          </Link>
        )}
      </div>
    </article>
  );
}
export function StatusBadge({ status }: { status: string }) {
  const tone =
    requestStatusPresentation[status]?.tone ||
    (status === "COMPLETED" || status === "RESOLVED" || status === "VERIFIED"
      ? "success"
      : status === "CANCELLED" || status === "SUSPENDED"
        ? "danger"
        : status === "ON_HOLD" || status === "ESTIMATE_PENDING_APPROVAL"
          ? "warning"
          : "info");
  return (
    <span className={`badge status-${tone}`}>
      {(status === "PENDING"
        ? "Pending"
        : status === "TECHNICIAN_ASSIGNED"
          ? "Technician assigned"
          : requestStatusPresentation[status]?.label) ||
        status.replaceAll("_", " ")}
    </span>
  );
}
export function EmptyState({
  title = "No records found",
  description,
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="ui-empty">
      <icons.search aria-hidden="true" />
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
  );
}
export function ErrorState({
  title = "Unable to load data",
  retry,
}: {
  title?: string;
  retry: () => void;
}) {
  return (
    <div role="alert" className="ui-empty">
      <h2>{title}</h2>
      <button onClick={retry}>
        <icons.refresh /> Try again
      </button>
    </div>
  );
}
export function CustomerAvatar({
  name,
  src,
}: {
  name: string;
  src?: string | null;
}) {
  const [failed, setFailed] = useState<string>();
  return src && failed !== src ? (
    <img
      className="ui-avatar"
      src={src}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setFailed(src)}
    />
  ) : (
    <span className="ui-avatar" aria-hidden="true">
      {name
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0])
        .join("")
        .toUpperCase() || "?"}
    </span>
  );
}
export function Pagination({
  page,
  total,
  limit = 20,
  onChange,
}: {
  page: number;
  total: number;
  limit?: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="table-pagination">
      <span>
        {total} records · Page {page}
      </span>
      <div>
        <button disabled={page === 1} onClick={() => onChange(page - 1)}>
          <icons.back /> Previous
        </button>
        <button
          disabled={page * limit >= total}
          onClick={() => onChange(page + 1)}
        >
          Next <icons.next />
        </button>
      </div>
    </div>
  );
}
export function FormField({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="ui-field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function DateRangeFilter({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (key: "from" | "to", value: string) => void;
}) {
  return (
    <div className="ui-date-range">
      <FormField label="From">
        <input
          type="date"
          value={from}
          onChange={(e) => onChange("from", e.target.value)}
        />
      </FormField>
      <FormField label="To">
        <input
          type="date"
          value={to}
          min={from || undefined}
          onChange={(e) => onChange("to", e.target.value)}
        />
      </FormField>
    </div>
  );
}
export function ConfirmModal({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  return (
    <ConfirmActionDialog title={title} pending={busy} onClose={onClose}>
      {children}
    </ConfirmActionDialog>
  );
}
export function DetailsDrawer(props: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  return (
    <ConfirmActionDialog
      title={props.title}
      pending={props.busy}
      onClose={props.onClose}
      drawer
    >
      {props.children}
    </ConfirmActionDialog>
  );
}

export function FilterPanel({
  children,
  count = 0,
}: {
  children: ReactNode;
  count?: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>
        <icons.filter /> Filters
        {count > 0 && <span className="ui-filter-count">{count}</span>}
      </button>
      {open && (
        <DetailsDrawer title="Filter requests" onClose={() => setOpen(false)}>
          <div className="ui-filter-fields">{children}</div>
          <button className="primary" onClick={() => setOpen(false)}>
            <icons.success /> Apply filters
          </button>
        </DetailsDrawer>
      )}
    </>
  );
}
export function ActionMenu({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  useEffect(() => {
    const close = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        ref.current.open = false;
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  return (
    <details
      className="ui-action-menu"
      ref={ref}
      onToggle={() => {
        if (ref.current?.open) {
          const box = ref.current.getBoundingClientRect();
          setPosition({
            top: Math.max(
              8,
              Math.min(box.bottom + 6, window.innerHeight - 250),
            ),
            left: Math.max(
              12,
              Math.min(box.right - 210, window.innerWidth - 222),
            ),
          });
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          if (ref.current) ref.current.open = false;
          ref.current?.querySelector("summary")?.focus();
        }
      }}
    >
      <summary aria-label="More actions" title="More actions">
        <icons.more />
      </summary>
      <div
        style={{ position: "fixed", ...position }}
        className="ui-action-popover"
        onClick={() => {
          if (ref.current) ref.current.open = false;
        }}
      >
        {children}
      </div>
    </details>
  );
}
export function DataTable({ children }: { children: ReactNode }) {
  return <div className="table ui-data-table">{children}</div>;
}
export function ToastProvider() {
  return (
    <Toaster
      richColors
      position="top-center"
      closeButton
      toastOptions={{ className: "app-toast" }}
      icons={{
        success: <icons.success />,
        error: <icons.error />,
        info: <icons.info />,
        warning: <icons.warning />,
      }}
    />
  );
}
