import {
  useEffect,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  type ImgHTMLAttributes,
  type ReactNode,
} from "react";
import { FaEye, FaEyeSlash, FaWifi, FaImage } from "react-icons/fa6";
import { AsyncActionButton, ConfirmActionDialog } from "./index";

export function AppButton({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive";
  pending?: boolean;
  pendingLabel?: string;
}) {
  return (
    <AsyncActionButton
      className={`app-button app-button--${variant} ${className}`}
      {...props}
    />
  );
}
export function AppCard({
  variant = "standard",
  className = "",
  ...props
}: HTMLAttributes<HTMLElement> & {
  variant?:
    | "standard"
    | "compact"
    | "interactive"
    | "summary"
    | "service"
    | "job";
}) {
  return (
    <article
      className={`app-card app-card--${variant} ${className}`}
      {...props}
    />
  );
}
export function AppInput({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`app-input ${className}`} {...props} />;
}
export function AppSelect({
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`app-input ${className}`} {...props} />;
}
export function AppTextarea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`app-input ${className}`} {...props} />;
}
type ChoiceProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;
export function AppCheckbox({ className = "", ...props }: ChoiceProps) {
  return (
    <AppInput {...props} type="checkbox" className={`app-choice ${className}`} />
  );
}
export function AppRadio({ className = "", ...props }: ChoiceProps) {
  return (
    <AppInput {...props} type="radio" className={`app-choice ${className}`} />
  );
}
/** Local content tabs; filters and route links retain their own native semantics. */
export function AppTabs({
  label,
  value,
  onChange,
  items,
  children,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  items: { value: string; label: ReactNode; disabled?: boolean }[];
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  const active = items.findIndex((item) => item.value === value);
  return (
    <div className={`app-tabs ${className}`}>
      <div className="app-tab-list" role="tablist" aria-label={label}>
        {items.map((item, index) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            id={`${id}-tab-${index}`}
            aria-controls={`${id}-panel`}
            aria-selected={value === item.value}
            disabled={item.disabled}
            tabIndex={value === item.value ? 0 : -1}
            onClick={() => onChange(item.value)}
            onKeyDown={(event) => {
              const enabled = items.flatMap((entry, i) => entry.disabled ? [] : [i]);
              const position = enabled.indexOf(index);
              let next: number | undefined;
              if (event.key === "ArrowRight") next = enabled[(position + 1) % enabled.length];
              else if (event.key === "ArrowLeft") next = enabled[(position - 1 + enabled.length) % enabled.length];
              else if (event.key === "Home") next = enabled[0];
              else if (event.key === "End") next = enabled.at(-1);
              if (next === undefined) return;
              event.preventDefault();
              const target = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next];
              target?.focus();
              target?.scrollIntoView({ block: "nearest", inline: "nearest" });
              onChange(items[next]!.value);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${active}`} tabIndex={0}>
        {children}
      </div>
    </div>
  );
}
export function PasswordInput({
  id,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false),
    generated = useId(),
    inputId = id || generated;
  return (
    <span className="password-input">
      <AppInput
        {...props}
        id={inputId}
        className={className}
        type={visible ? "text" : "password"}
      />
      <button
        type="button"
        className="password-toggle"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-controls={inputId}
        aria-pressed={visible}
        onClick={() => setVisible(!visible)}
      >
        {visible ? (
          <FaEyeSlash aria-hidden="true" />
        ) : (
          <FaEye aria-hidden="true" />
        )}
      </button>
    </span>
  );
}
export function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return offline ? (
    <div className="app-offline-banner" role="status">
      <FaWifi aria-hidden="true" />
      <span>You're offline. Check your connection.</span>
    </div>
  ) : null;
}
export function ImageWithFallback({
  src,
  alt = "",
  fallback,
  className = "",
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & { fallback?: React.ReactNode }) {
  const [failedSrc, setFailedSrc] = useState<string>();
  return src && failedSrc !== src ? (
    <img
      {...props}
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailedSrc(src)}
    />
  ) : (
    <span
      className={`image-fallback ${className}`}
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
    >
      {fallback || <FaImage aria-hidden="true" />}
    </span>
  );
}
export const AppModal = ConfirmActionDialog;
export function AppDrawer(
  props: React.ComponentProps<typeof ConfirmActionDialog>,
) {
  return <ConfirmActionDialog {...props} drawer />;
}
export function AppBottomSheet(
  props: React.ComponentProps<typeof ConfirmActionDialog>,
) {
  return <ConfirmActionDialog {...props} bottomSheet />;
}
