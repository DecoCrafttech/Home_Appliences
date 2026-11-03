import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { FaChevronDown, FaFilter } from "react-icons/fa6";

export function FilterDropdown({
  label = "Global filters",
  summary = "Filters",
  activeCount = 0,
  onOpen,
  children,
}: {
  label?: string;
  summary?: string;
  activeCount?: number;
  onOpen?: () => void;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div className="staff-filter" ref={root}>
      <button
        type="button"
        ref={trigger}
        className={`staff-filter-trigger ${open ? "is-open" : ""}`}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => {
          if (!open) onOpen?.();
          setOpen(!open);
        }}
      >
        <FaFilter aria-hidden="true" />
        <span className="staff-filter-summary">{summary}</span>
        <span className="staff-filter-label">Filters</span>
        {activeCount > 0 && (
          <span className="staff-filter-count">{activeCount}</span>
        )}
        <FaChevronDown className="staff-filter-chevron" aria-hidden="true" />
      </button>
      {open && (
        <div
          id={id}
          role="dialog"
          aria-label={label}
          className="staff-filter-popover"
        >
          <div className="staff-filter-heading">
            <span>Refine your view</span>
            <small>Apply filters to update results</small>
          </div>
          {children(close)}
        </div>
      )}
    </div>
  );
}
