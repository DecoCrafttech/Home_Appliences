import {
  ConfirmActionDialog,
  useSafeMutation,
  AppButton,
  AppCheckbox,
} from "@home/ui";
import {
  FaLocationDot,
  FaStar,
  FaHeadset,
  FaShieldHalved,
  FaChevronRight,
} from "react-icons/fa6";
import { AsyncActionButton as SafeAsyncButton } from "@home/ui";
import { customerKeys } from "./lib/queryKeys";
import { SupportConversation } from "./SupportConversation";
import { useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type { Customer } from "./lib/types";
import { Avatar, LoadingSkeleton, EmptyState } from "./components/ui";
import { useTranslation } from "./lib/language";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import axios from "axios";
import { GoogleLogin, useGoogleOAuth, googleLogout } from "@react-oauth/google";
import {
  loginDestination,
  useGoogleConfiguration,
  useGoogleScriptStatus,
} from "./lib/googleAuth";
import { api } from "./lib/api";

type Address = {
  id: string;
  label: string;
  recipient_name: string;
  phone: string;
  line1: string;
  area: string;
  landmark?: string;
  city: string;
  state: string;
  pin_code: string;
  is_default: boolean;
};
const message = (error: unknown, fallback: string) => {
  if (!axios.isAxiosError(error)) return fallback;
  const code = error.response?.data?.error?.code;
  if (code === "INVALID_OTP")
    return "Invalid verification code. Please try again.";
  if (code === "OTP_EXPIRED")
    return "Verification code expired. Request a new code.";
  if (code === "SESSION_EXPIRED" || code === "UNAUTHORIZED")
    return "Your session has expired. Please log in again.";
  if (code === "INVALID_GOOGLE_CREDENTIAL")
    return "Google could not verify your sign-in. Please sign in again.";
  if (code === "GOOGLE_AUTH_UNAVAILABLE")
    return "Google sign-in is not configured on the server. Please contact support.";
  if (!error.response)
    return "Unable to connect. Check your internet connection.";
  return error.response.data?.error?.message || fallback;
};

export function LoginPage() {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const next = loginDestination(params.get("next"));
  const config = useGoogleConfiguration();
  const script = useGoogleScriptStatus();
  const { scriptLoadedSuccessfully } = useGoogleOAuth();
  return (
    <Page title={t("Welcome to Home Services")}>
      <div className="workflow-form google-login">
        <p>Sign in securely to book appliance care and track your requests.</p>
        {config.isPending || busy ? (
          <LoadingSkeleton />
        ) : config.isError ? (
          <p role="alert">
            Unable to connect to the sign-in service.{" "}
            <button onClick={() => config.refetch()}>Try again</button>
          </p>
        ) : !config.data.clientId ? (
          <p role="alert">
            Google sign-in is temporarily unavailable. Please contact support.
          </p>
        ) : script.failed ? (
          <p role="alert">
            Unable to load Google sign-in. Check your connection or browser
            extensions, then{" "}
            <button onClick={() => window.location.reload()}>
              reload this page
            </button>
            .
          </p>
        ) : !scriptLoadedSuccessfully ? (
          <LoadingSkeleton />
        ) : (
          <GoogleLogin
            ux_mode="popup"
            onSuccess={async (response) => {
              if (!response.credential) {
                setError(
                  "Google sign-in did not return a credential. Please try again.",
                );
                return;
              }
              setBusy(true);
              setError("");
              try {
                const result = await api.post<{
                  data: { created: boolean; profileComplete: boolean };
                }>("/auth/customer/google", {
                  credential: response.credential,
                });
                let customer: Customer;
                try {
                  customer = (
                    await api.get<{ data: Customer }>("/auth/customer/me")
                  ).data.data;
                } catch {
                  setError(
                    "Your browser could not keep the sign-in session. Allow cookies for this site and try again.",
                  );
                  return;
                }
                const privateKeys = [
                  "profile",
                  "addresses",
                  "requests",
                  "request",
                  "timeline",
                  "tickets",
                  "support-conversation",
                  "customer-estimates",
                  "customer-me",
                  "notifications",
                  "review",
                  "my-reviews",
                ];
                await qc.cancelQueries({
                  predicate: (q) => privateKeys.includes(String(q.queryKey[0])),
                });
                qc.removeQueries({
                  predicate: (q) => privateKeys.includes(String(q.queryKey[0])),
                });
                qc.setQueryData(customerKeys.profile, customer);
                toast.success(
                  result.data.data.created
                    ? "Your account has been created successfully."
                    : "Successfully signed in with Google.",
                );
                navigate(
                  result.data.data.profileComplete
                    ? next
                    : `/profile?next=${encodeURIComponent(next)}`,
                  { replace: true },
                );
              } catch (e) {
                setError(
                  message(
                    e,
                    "Google sign-in could not be completed. Please try again.",
                  ),
                );
              } finally {
                setBusy(false);
              }
            }}
            onError={() =>
              setError(
                "Google sign-in could not be completed. Allow pop-ups for this site and try again.",
              )
            }
          />
        )}
        {error && <p role="alert">{error}</p>}
        <small>Your Google account is used to sign in securely.</small>
      </div>
    </Page>
  );
}

export function ProfilePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: customerKeys.profile,
    queryFn: async () =>
      (await api.get<{ data: Customer }>("/profile")).data.data,
    retry: false,
  });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);
      await api.patch("/profile", { fullName: name, email, phone });
      toast.success("Profile updated successfully.");
      setEditing(false);
      await query.refetch();
      if (params.has("next"))
        navigate(loginDestination(params.get("next")), { replace: true });
    } catch (e) {
      toast.error(
        message(e, "Something went wrong on our side. Please try again."),
      );
    } finally {
      setSaving(false);
    }
  }
  if (query.isPending)
    return (
      <Page title="Profile">
        <LoadingSkeleton variant="profile" />
      </Page>
    );
  if (query.isError)
    return <AuthError error={query.error} retry={() => query.refetch()} />;
  const profile = query.data;
  return (
    <Page title={t("Profile")}>
      {editing ? (
        <form className="workflow-form" onSubmit={save}>
          <label>
            {t("Full name")}
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label>
            {t("Email")}
            <input
              readOnly
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            {t("Mobile number")}
            <input
              type="tel"
              autoComplete="tel-national"
              inputMode="numeric"
              pattern="[6-9][0-9]{9}"
              maxLength={10}
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          <SafeAsyncButton
            className="primary"
            disabled={saving}
            pending={saving}
            pendingLabel="Saving..."
          >
            {saving ? "Saving…" : "Save profile"}
          </SafeAsyncButton>
          <button
            type="button"
            className="secondary"
            onClick={() => setEditing(false)}
          >
            {t("Cancel")}
          </button>
        </form>
      ) : (
        <div className="record-card">
          <div className="profile-identity">
            <Avatar name={profile.full_name} src={profile.profile_photo_url} />
            <div>
              <strong>{profile.full_name || "Profile incomplete"}</strong>
              <small>
                {t("Customer ID")}: {profile.customer_reference || profile.id}
              </small>
            </div>
          </div>
          <p>
            {profile.phone_e164}
            <br />
            {profile.email}
          </p>
          <button
            className="primary"
            onClick={() => {
              setName(profile.full_name || "");
              setPhone((profile.phone_e164 || "").replace(/^\+91/, ""));
              setEmail(profile.email || "");
              setEditing(true);
            }}
          >
            {t("Edit profile")}
          </button>
        </div>
      )}
      <div className="profile-menu">
        {[
          ["/addresses", "Saved addresses", FaLocationDot],
          ["/reviews", "My reviews", FaStar],
          ["/support", "Help & support", FaHeadset],
          ["/privacy", "Privacy & Security", FaShieldHalved],
        ].map(([to, label, Icon]) => (
          <Link key={String(to)} to={String(to)}>
            {typeof Icon !== "string" && Icon && <Icon aria-hidden="true" />}
            <span>{t(String(label))}</span>
            <FaChevronRight aria-hidden="true" />
          </Link>
        ))}
      </div>
      <button
        className="secondary"
        onClick={async () => {
          await api.post("/auth/logout");
          googleLogout();
          qc.clear();
          toast.success("You have been logged out successfully.");
          location.href = "/login";
        }}
      >
        {t("Log out")}
      </button>
    </Page>
  );
}

export function AddressesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const saveGuard = useRef(false);
  const [saving, setSaving] = useState(false),
    [removing, setRemoving] = useState<string | null>(null),
    [removeError, setRemoveError] = useState("");
  const removal = useSafeMutation(async (id: string) => {
    await api.delete(`/addresses/${id}`);
    await qc.invalidateQueries({ queryKey: customerKeys.addresses });
    return true;
  });
  const query = useQuery({
    queryKey: customerKeys.addresses,
    queryFn: async () =>
      (await api.get<{ data: Address[] }>("/addresses")).data.data,
    retry: false,
  });
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saveGuard.current) return;
    saveGuard.current = true;
    setSaving(true);
    const form = e.currentTarget;
    const data = new FormData(form);
    try {
      await api.post("/addresses", {
        label: data.get("label"),
        recipientName: data.get("recipientName"),
        phone: data.get("phone"),
        line1: data.get("line1"),
        area: data.get("area"),
        landmark: data.get("landmark"),
        city: data.get("city"),
        state: data.get("state"),
        pinCode: data.get("pinCode"),
        isDefault: data.get("isDefault") === "on",
      });
      toast.success("Address saved successfully.");
      form.reset();
      qc.invalidateQueries({ queryKey: customerKeys.addresses });
    } catch (e) {
      toast.error(
        message(e, "Something went wrong on our side. Please try again."),
      );
    } finally {
      saveGuard.current = false;
      setSaving(false);
    }
  }
  return (
    <Page title={t("Saved addresses")}>
      <form className="workflow-form" onSubmit={save}>
        <label>
          {t("Label")}
          <input
            name="label"
            minLength={2}
            maxLength={30}
            placeholder="Home"
            required
          />
        </label>
        <label>
          {t("Recipient name")}
          <input name="recipientName" minLength={2} maxLength={100} required />
        </label>
        <label>
          {t("Mobile number")}
          <input
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            pattern="[6-9]\d{9}"
            maxLength={10}
            required
          />
        </label>
        <label>
          {t("House / street")}
          <input name="line1" minLength={3} maxLength={150} required />
        </label>
        <label>
          {t("Area")}
          <input name="area" minLength={2} maxLength={100} required />
        </label>
        <label>
          {t("Landmark")}
          <input name="landmark" maxLength={100} />
        </label>
        <label>
          {t("City")}
          <input name="city" minLength={2} maxLength={80} required />
        </label>
        <label>
          {t("State")}
          <input name="state" minLength={2} maxLength={80} required />
        </label>
        <label>
          {t("PIN code")}
          <input
            name="pinCode"
            inputMode="numeric"
            autoComplete="postal-code"
            pattern="\d{6}"
            maxLength={6}
            required
          />
        </label>
        <label className="checkbox">
          <AppCheckbox name="isDefault" /> Set as default
        </label>
        <AppButton
          type="submit"
          pending={saving}
          pendingLabel="Saving address..."
        >
          Save address
        </AppButton>
      </form>
      {query.isPending ? (
        <LoadingSkeleton />
      ) : query.isError ? (
        <AuthError error={query.error} retry={() => query.refetch()} />
      ) : !query.data.length ? (
        <EmptyState title="No saved addresses yet">
          <p>Add an address to make your next booking quicker.</p>
        </EmptyState>
      ) : (
        query.data.map((a) => (
          <div className="record-card" key={a.id}>
            <strong>
              {a.label}
              {a.is_default ? " · Default" : ""}
            </strong>
            <span>
              {a.recipient_name}, {a.line1}, {a.area}, {a.city} {a.pin_code}
            </span>
            <button
              className="secondary"
              onClick={() => {
                setRemoveError("");
                setRemoving(a.id);
              }}
            >
              {t("Remove")}
            </button>
          </div>
        ))
      )}
      {removing && (
        <ConfirmActionDialog
          title="Delete saved address?"
          pending={removal.isPending}
          onClose={() => setRemoving(null)}
        >
          <div className="customer-modal-content">
            <p>
              This removes the saved address. Existing bookings keep their
              address details.
            </p>
            {removeError && (
              <p role="alert" className="safe-error">
                {removeError}
              </p>
            )}
          </div>
          <footer>
            <AppButton
              variant="outline"
              onClick={() => setRemoving(null)}
              disabled={removal.isPending}
            >
              Keep address
            </AppButton>
            <AppButton
              variant="destructive"
              pending={removal.isPending}
              pendingLabel="Deleting..."
              onClick={async () => {
                setRemoveError("");
                try {
                  if (await removal.run(removing)) {
                    toast.success("Address removed successfully.");
                    setRemoving(null);
                  }
                } catch (error) {
                  setRemoveError(
                    message(error, "Unable to remove this address. Try again."),
                  );
                }
              }}
            >
              Delete address
            </AppButton>
          </footer>
        </ConfirmActionDialog>
      )}
    </Page>
  );
}

export function SupportPage() {
  const [params] = useSearchParams();
  const submitGuard = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const { t } = useTranslation();
  const qc = useQueryClient();
  const tickets = useQuery({
    queryKey: customerKeys.tickets,
    refetchInterval: false,
    queryFn: async () =>
      (
        await api.get<{
          data: {
            id: string;
            ticket_number: string;
            subject: string;
            status: string;
          }[];
        }>("/support/tickets")
      ).data.data,
    retry: false,
  });
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitGuard.current) return;
    submitGuard.current = true;
    setSubmitting(true);
    const form = e.currentTarget;
    const data = new FormData(form);
    try {
      await api.post("/support/tickets", {
        ...(params.get("requestId")
          ? { requestId: params.get("requestId") }
          : {}),
        subject: data.get("subject"),
        message: data.get("message"),
      });
      toast.success("Support request submitted successfully.");
      form.reset();
      qc.invalidateQueries({ queryKey: customerKeys.tickets });
    } catch (e) {
      toast.error(
        message(e, "Something went wrong on our side. Please try again."),
      );
    } finally {
      submitGuard.current = false;
      setSubmitting(false);
    }
  }
  return (
    <Page title={t("Help & support")}>
      <SafeAsyncButton
        className="secondary"
        pending={tickets.isFetching}
        onClick={() => tickets.refetch()}
      >
        Refresh tickets
      </SafeAsyncButton>
      <form className="workflow-form" onSubmit={submit}>
        <label>
          {t("Subject")}
          <input
            name="subject"
            minLength={3}
            maxLength={120}
            defaultValue={
              params.get("reference")
                ? `Support for ${params.get("reference")}`
                : ""
            }
            required
          />
        </label>
        <label>
          {t("How can we help?")}
          <textarea name="message" minLength={10} maxLength={2000} required />
        </label>
        <SafeAsyncButton
          className="primary"
          disabled={submitting}
          pending={submitting}
          pendingLabel="Saving..."
        >
          {submitting ? "Submitting..." : "Submit support request"}
        </SafeAsyncButton>
      </form>
      {tickets.isPending ? (
        <LoadingSkeleton />
      ) : tickets.isError ? (
        <AuthError error={tickets.error} retry={() => tickets.refetch()} />
      ) : !tickets.data.length ? (
        <EmptyState title="No support requests yet">
          <p>Need help with a booking? Send your question above.</p>
        </EmptyState>
      ) : (
        tickets.data.map((t) => (
          <div className="record-card" key={t.id}>
            <strong>
              {t.ticket_number} · {t.subject}
            </strong>
            <span>{t.status}</span>
            <SupportConversation
              ticketId={t.id}
              initiallyOpen={params.get("ticket") === t.id}
            />
          </div>
        ))
      )}
    </Page>
  );
}
function Page({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="section page workflow">
      <h1>{title}</h1>
      {children}
    </section>
  );
}

function AuthError({ error, retry }: { error: unknown; retry?: () => void }) {
  const text = message(error, "Unable to load this page.");
  const expired = axios.isAxiosError(error) && error.response?.status === 401;
  return (
    <div className="empty-state" role="alert">
      <h2>{expired ? "Sign in to continue" : "Unable to load"}</h2>
      <p>{text}</p>
      {expired ? (
        <Link className="primary" to="/login">
          Login
        </Link>
      ) : (
        <AppButton
          variant="outline"
          onClick={retry || (() => window.location.reload())}
        >
          Try again
        </AppButton>
      )}
    </div>
  );
}
