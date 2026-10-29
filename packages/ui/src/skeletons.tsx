import type { CSSProperties } from "react";

export function AppSkeleton({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden="true"
      className={`app-skeleton ${className}`}
      style={style}
    />
  );
}
export function SkeletonCard({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`skeleton-card${compact ? " skeleton-card--compact" : ""}`}
      aria-hidden="true"
    >
      <AppSkeleton className="skeleton-icon" />
      <AppSkeleton className="skeleton-line skeleton-line--title" />
      <AppSkeleton className="skeleton-line" />
      {!compact && (
        <>
          <AppSkeleton className="skeleton-line skeleton-line--short" />
          <div className="skeleton-card-footer">
            <AppSkeleton />
            <AppSkeleton />
          </div>
        </>
      )}
    </div>
  );
}
export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="skeleton-table" aria-hidden="true">
      <div className="skeleton-table-heading">
        {[0, 1, 2, 3, 4].map((i) => (
          <AppSkeleton key={i} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div className="skeleton-table-row" key={i}>
          <AppSkeleton className="skeleton-avatar" />
          {[0, 1, 2, 3].map((j) => (
            <AppSkeleton key={j} />
          ))}
        </div>
      ))}
    </div>
  );
}
export function SkeletonProfile() {
  return (
    <div className="skeleton-profile" aria-hidden="true">
      <div className="skeleton-profile-heading">
        <AppSkeleton className="skeleton-avatar" />
        <div>
          <AppSkeleton className="skeleton-line skeleton-line--title" />
          <AppSkeleton className="skeleton-line" />
        </div>
      </div>
      {[0, 1, 2, 3].map((i) => (
        <AppSkeleton className="skeleton-profile-field" key={i} />
      ))}
    </div>
  );
}
export type SkeletonVariant =
  | "cards"
  | "appliances"
  | "table"
  | "profile"
  | "detail"
  | "dashboard"
  | "workday"
  | "kpis"
  | "list"
  | "calendar"
  | "notifications"
  | "summary"
  | "slots";
export function LoadingSkeleton({
  title = "Loading…",
  variant = "cards",
  count = 3,
}: {
  title?: string;
  variant?: SkeletonVariant;
  count?: number;
}) {
  return (
    <div
      role="status"
      aria-label={title}
      className={`app-loading app-loading--${variant}`}
    >
      <span className="skeleton-sr-label">{title}</span>
      {variant === "slots" ? (
        <div className="skeleton-slots">
          {Array.from({ length: count }, (_, i) => (
            <AppSkeleton key={i} />
          ))}
        </div>
      ) : variant === "table" ? (
        <SkeletonTable />
      ) : variant === "profile" ? (
        <SkeletonProfile />
      ) : variant === "calendar" ? (
        <div className="skeleton-calendar" aria-hidden="true">
          <AppSkeleton className="skeleton-line skeleton-line--title" />
          <div>
            {Array.from({ length: 35 }, (_, i) => (
              <AppSkeleton key={i} />
            ))}
          </div>
        </div>
      ) : variant === "notifications" || variant === "list" ? (
        Array.from({ length: count }, (_, i) => (
          <div className="skeleton-notice" key={i}>
            <AppSkeleton className="skeleton-icon" />
            <div>
              <AppSkeleton className="skeleton-line skeleton-line--title" />
              <AppSkeleton className="skeleton-line" />
              <AppSkeleton className="skeleton-line skeleton-line--short" />
            </div>
          </div>
        ))
      ) : variant === "summary" ? (
        <div className="skeleton-greeting">
          <AppSkeleton className="skeleton-avatar" />
          <div>
            <AppSkeleton className="skeleton-line skeleton-line--short" />
            <AppSkeleton className="skeleton-line skeleton-line--title" />
          </div>
        </div>
      ) : variant === "dashboard" ||
        variant === "workday" ||
        variant === "kpis" ? (
        <>
          <div
            className={`skeleton-kpis${variant === "workday" ? " skeleton-kpis--workday" : ""}`}
          >
            {Array.from(
              { length: variant === "dashboard" ? 6 : count },
              (_, i) => (
                <SkeletonCard compact key={i} />
              ),
            )}
          </div>
          {variant === "dashboard" ? (
            <SkeletonTable rows={3} />
          ) : variant === "workday" ? (
            <div className="skeleton-cards">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : null}
        </>
      ) : variant === "detail" ? (
        <>
          <AppSkeleton className="skeleton-line skeleton-line--title" />
          <div className="skeleton-detail">
            <SkeletonCard />
            <SkeletonProfile />
          </div>
        </>
      ) : (
        <div
          className={
            variant === "appliances" ? "skeleton-appliances" : "skeleton-cards"
          }
        >
          {Array.from({ length: count }, (_, i) => (
            <SkeletonCard key={i} compact={variant === "appliances"} />
          ))}
        </div>
      )}
    </div>
  );
}
