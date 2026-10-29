import { FaXmark } from "react-icons/fa6";
import {
  Component,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import axios, { type AxiosInstance, type AxiosResponse } from "axios";
import { useMutation } from "@tanstack/react-query";
export { retryTransientRequest, activeRecordRefresh } from "./queryPolicy";
export {
  NotificationCenter,
  notificationInbox,
  type InboxNotice,
  type InboxData,
} from "./notifications";
export { LocationActions, serviceLocation } from "./location";
export { NavigationScroll } from "./navigation";
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}
export {
  AppButton,
  AppCard,
  AppInput,
  AppSelect,
  AppTextarea,
  AppCheckbox,
  AppRadio,
  AppTabs,
  PasswordInput,
  OfflineBanner,
  ImageWithFallback,
  AppModal,
  AppDrawer,
  AppBottomSheet,
} from "./primitives";
export {
  AppSkeleton,
  SkeletonCard,
  SkeletonTable,
  SkeletonProfile,
} from "./skeletons";
export { AppBackButton } from "./navigation";
// Public design-system names reuse the existing implementations.
export {
  StatusBadge as AppBadge,
  DataTable as AppTable,
  ToastProvider as AppToast,
  EmptyState as AppEmptyState,
  SearchField as AppSearch,
  PageHeader as AppPageHeader,
} from "./widgets";
export { NotificationCenter as AppNotificationBell } from "./notifications";

let writes = 0;
let installed = false;
const locks = new Set<HTMLElement>();
function clearLocks() {
  if (writes) return;
  for (const element of locks) {
    element.removeAttribute("data-pending");
    element.removeAttribute("aria-busy");
  }
  locks.clear();
}
/** Capture-phase locks also cover legacy forms while shared components are adopted. */
export function installMutationSafety() {
  if (installed) return;
  installed = true;
  for (const name of ["click", "submit"] as const)
    document.addEventListener(
      name,
      (event) => {
        const target = event.target instanceof Element ? event.target : null;
        const element =
          name === "submit"
            ? target?.closest("form")
            : target?.closest("button");
        if (!(element instanceof HTMLElement)) return;
        if (writes || locks.has(element)) {
          event.preventDefault();
          event.stopImmediatePropagation();
          return;
        }
        locks.add(element);
        queueMicrotask(() => {
          if (writes) {
            element.setAttribute("aria-busy", "true");
            if (element instanceof HTMLButtonElement)
              element.setAttribute("data-pending", "true");
            else
              element
                .querySelectorAll('button:not([type="button"])')
                .forEach((button) =>
                  button.setAttribute("data-pending", "true"),
                );
          } else clearLocks();
        });
      },
      true,
    );
}

export function protectApi(client: AxiosInstance, role: string) {
  installMutationSafety();
  let actor = "anonymous";
  const inflight = new Map<string, Promise<AxiosResponse>>();
  const adapter = axios.getAdapter(client.defaults.adapter);
  client.interceptors.response.use((response) => {
    if (
      /\/(auth\/me|profile)$/.test(response.config.url || "") &&
      response.data?.data?.id
    )
      actor = response.data.data.id;
    if (
      /\/auth\/(login|logout|customer\/google|mfa)$/.test(
        response.config.url || "",
      )
    ) {
      actor = "anonymous";
      window.dispatchEvent(new Event("session-changed"));
    }
    return response;
  });
  client.defaults.adapter = (config) => {
    if (!["post", "patch", "put", "delete"].includes(config.method || ""))
      return adapter(config);
    const fingerprint =
      role +
      ":" +
      actor +
      ":" +
      config.method +
      ":" +
      config.url +
      ":" +
      (config.data || "");
    const previous = inflight.get(fingerprint);
    if (previous) return previous;
    writes++;
    const operation = (async () => {
      let storageKey: string | undefined;
      // Authentication and presigned upload operations have their own single-use tokens.
      const protectedOperation =
        !/\/(auth|locations)\/|\/(photos|documents|photo)(\/|$)/.test(
          config.url || "",
        );
      if (protectedOperation && !config.headers.has("Idempotency-Key")) {
        const digest = await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(fingerprint),
        );
        storageKey =
          "operation:" +
          Array.from(new Uint8Array(digest), (b) =>
            b.toString(16).padStart(2, "0"),
          ).join("");
        let operationKey = crypto.randomUUID();
        try {
          const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
          if (saved && saved.expires > Date.now()) operationKey = saved.key;
          localStorage.setItem(
            storageKey,
            JSON.stringify({
              key: operationKey,
              expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
            }),
          );
          for (const key of Object.keys(localStorage).filter((key) =>
            key.startsWith("operation:"),
          )) {
            try {
              if (
                JSON.parse(localStorage.getItem(key) || "null")?.expires <
                Date.now()
              )
                localStorage.removeItem(key);
            } catch {
              localStorage.removeItem(key);
            }
          }
        } catch {
          /* Storage denial does not disable the in-memory guard. */
        }
        let bookingKey: string | undefined;
        try {
          bookingKey = JSON.parse(config.data || "{}").idempotencyKey;
        } catch {
          /* Non-JSON uploads are excluded above. */
        }
        config.headers.set("Idempotency-Key", bookingKey || operationKey);
      }
      const response = await adapter(config);
      if (storageKey)
        try {
          localStorage.setItem(
            storageKey,
            JSON.stringify({
              key: config.headers.get("Idempotency-Key"),
              expires: Date.now() + 120000,
            }),
          );
        } catch {
          /* Storage may be denied. */
        }
      return response;
    })().finally(() => {
      inflight.delete(fingerprint);
      writes--;
      // Release after React's completion handlers have had a chance to update controls.
      setTimeout(() => {
        if (!writes) {
          clearLocks();
          document
            .querySelectorAll("[data-pending]")
            .forEach((node) => node.removeAttribute("data-pending"));
        }
      }, 0);
    });
    inflight.set(fingerprint, operation);
    return operation;
  };
}

export function useSafeMutation<TInput, TOutput>(
  mutationFn: (input: TInput) => Promise<TOutput>,
) {
  const guard = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const mutation = useMutation({ mutationFn, retry: false });
  async function run(input: TInput) {
    if (guard.current) return undefined;
    guard.current = true;
    try {
      return await mutation.mutateAsync(input);
    } finally {
      guard.current = false;
    }
  }
  return { ...mutation, run, isMounted: () => mounted.current };
}
export function AsyncActionButton({
  pending,
  pendingLabel = "Saving...",
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  pending?: boolean;
  pendingLabel?: string;
}) {
  const button = useRef<HTMLButtonElement>(null);
  const idleWidth = useRef<number>(undefined);
  useEffect(() => {
    const node = button.current;
    if (!node) return;
    if (pending) {
      const previousMinimum = node.style.minWidth;
      if (idleWidth.current) node.style.minWidth = `${idleWidth.current}px`;
      return () => {
        node.style.minWidth = previousMinimum;
      };
    }
    // Measure the responsive idle size without freezing flex/grid layout.
    const observer = new ResizeObserver(() => {
      idleWidth.current = node.getBoundingClientRect().width;
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [pending]);
  return (
    <button
      ref={button}
      {...props}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
    >
      {pending && <span className="action-spinner" aria-hidden="true" />}
      {pending ? pendingLabel : children}
    </button>
  );
}
export function ConfirmActionDialog({
  title,
  children,
  onClose,
  pending = false,
  drawer = false,
  bottomSheet = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  pending?: boolean;
  drawer?: boolean;
  bottomSheet?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    id = useId();
  useEffect(() => {
    const node = ref.current,
      previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    node?.showModal();
    return () => {
      node?.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`safe-dialog${drawer ? " assignment-drawer" : ""}${bottomSheet ? " app-bottom-sheet" : ""}`}
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        if (!pending) onClose();
      }}
    >
      <header>
        <h2 id={id}>{title}</h2>
        <button
          type="button"
          aria-label="Close"
          disabled={pending}
          onClick={onClose}
        >
          <FaXmark aria-hidden="true" />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function AppErrorBoundaryFallback() {
  return (
    <div role="alert" className="ui-empty">
      <h1>Unable to display this page</h1>
      <button onClick={() => location.reload()}>Reload</button>
    </div>
  );
}
export class AppErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <AppErrorBoundaryFallback />
    ) : (
      this.props.children
    );
  }
}
export function useOperationKey() {
  const [key] = useState(() => crypto.randomUUID());
  return key;
}
export { CustomerContact } from "./contact";
export { BookedPriceSummary } from "./bookedPrices";
