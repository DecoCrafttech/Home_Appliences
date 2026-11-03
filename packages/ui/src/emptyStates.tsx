import type { ReactNode } from "react";
import type { IconType } from "react-icons";
import {
  FaBellSlash,
  FaCircleCheck,
  FaCircleExclamation,
  FaClipboardList,
  FaCommentDots,
  FaLayerGroup,
  FaLocationDot,
  FaMagnifyingGlass,
  FaScrewdriverWrench,
  FaUserLock,
  FaWifi,
} from "react-icons/fa6";

export type EmptyStateKind =
  | "requests"
  | "services"
  | "search"
  | "notifications"
  | "feedback"
  | "network"
  | "booking"
  | "completed"
  | "auth"
  | "addresses"
  | "catalogue";
const illustrations: Record<EmptyStateKind, IconType> = {
  requests: FaClipboardList,
  services: FaScrewdriverWrench,
  search: FaMagnifyingGlass,
  notifications: FaBellSlash,
  feedback: FaCommentDots,
  network: FaWifi,
  booking: FaCircleExclamation,
  completed: FaCircleCheck,
  auth: FaUserLock,
  addresses: FaLocationDot,
  catalogue: FaLayerGroup,
};
export function emptyStateKind(title: string): EmptyStateKind {
  if (/sign in|login|session|permission|account/i.test(title)) return "auth";
  if (/unable|connection|network|load information/i.test(title))
    return "network";
  if (/submitted|booking error/i.test(title)) return "booking";
  if (/matching|search/i.test(title)) return "search";
  if (/completed/i.test(title)) return "completed";
  if (/notification|caught up/i.test(title)) return "notifications";
  if (/review|feedback/i.test(title)) return "feedback";
  if (/address/i.test(title)) return "addresses";
  if (/service/i.test(title)) return "services";
  if (/request|record/i.test(title)) return "requests";
  return "catalogue";
}
export function EmptyState({
  title = "No records found",
  description,
  kind,
  icon,
  illustration,
  primaryAction,
  secondaryAction,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  kind?: EmptyStateKind;
  icon?: IconType;
  illustration?: ReactNode;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const resolved = kind || emptyStateKind(title);
  const Icon = icon || illustrations[resolved];
  return (
    <div
      className={`empty-state ui-empty fb-empty-state ${className}`}
      data-empty-kind={resolved}
    >
      <div className="fb-empty-art" aria-hidden="true">
        {illustration || <Icon />}
      </div>
      <h2>{title}</h2>
      {description && <p className="fb-empty-description">{description}</p>}
      {children && <div className="fb-empty-content">{children}</div>}
      {(primaryAction || secondaryAction) && (
        <div className="fb-empty-actions">
          {primaryAction}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
