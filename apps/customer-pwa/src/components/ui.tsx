import {
  ConfirmActionDialog,
  EmptyState as SharedEmptyState,
  emptyStateKind,
} from "@home/ui";
import {
  LoadingSkeleton as SharedSkeleton,
  type SkeletonVariant,
} from "@home/ui/skeletons";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation, statusLabel } from "../lib/language";
import { StateIllustration } from "./StateIllustration";
export function Avatar({
  name,
  src,
}: {
  name?: string | null;
  src?: string | null;
}) {
  const [broken, setBroken] = useState<string>();
  return src && broken !== src ? (
    <img
      className="avatar"
      src={src}
      alt={name || "Profile"}
      referrerPolicy="no-referrer"
      onError={() => setBroken(src)}
    />
  ) : (
    <span className="avatar initials" aria-label={name || "Profile"}>
      {(name || "HS")
        .split(" ")
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase()}
    </span>
  );
}
export function LanguageSelector() {
  const { locale, setLocale } = useTranslation();
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return (
    <select
      className="language-selector"
      aria-label="Language / மொழி"
      value={locale}
      onChange={(event) => setLocale(event.target.value as "en" | "ta")}
    >
      <option value="en">English</option>
      <option value="ta">தமிழ்</option>
    </select>
  );
}
export function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  return (
    <span className={`status-badge status-${status.toLowerCase()}`}>
      {t(statusLabel(status))}
    </span>
  );
}
export function LoadingSkeleton({
  variant = "cards",
  count = 3,
}: {
  variant?: SkeletonVariant;
  count?: number;
}) {
  const { t } = useTranslation();
  return (
    <SharedSkeleton
      title={t("Loading\u2026")}
      variant={variant}
      count={count}
    />
  );
}
export function EmptyState({
  title,
  children,
  ...props
}: React.ComponentProps<typeof SharedEmptyState>) {
  const { t } = useTranslation();
  const kind = props.kind || emptyStateKind(title || "No records found");
  return (
    <SharedEmptyState
      {...props}
      kind={kind}
      illustration={props.illustration || <StateIllustration kind={kind} />}
      className={`customer-empty-state ${props.className || ""}`}
      title={t(title || "No records found")}
    >
      {children}
    </SharedEmptyState>
  );
}
export function AppModal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <ConfirmActionDialog title={title} onClose={onClose}>
      <div className="customer-modal-content">{children}</div>
    </ConfirmActionDialog>
  );
}
export function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange?: (value: number) => void;
}) {
  return (
    <div
      className="star-rating"
      role={onChange ? "group" : "img"}
      aria-label={`${value} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((star) =>
        onChange ? (
          <button
            type="button"
            key={star}
            aria-label={`${star} ${star === 1 ? "star" : "stars"}`}
            aria-pressed={star === value}
            onClick={() => onChange(star)}
            className={star <= value ? "filled" : ""}
          >
            ★
          </button>
        ) : (
          <span key={star} className={star <= value ? "filled" : ""}>
            ★
          </span>
        ),
      )}
    </div>
  );
}
