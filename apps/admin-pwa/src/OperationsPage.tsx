import { PasswordInput } from "@home/ui";
import { AsyncActionButton as SafeAsyncButton } from "@home/ui";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import axios from "axios";
import { api } from "./api";
import { PushNotificationSettings } from "@home/ui/push";
import { icons, adminKeys } from "./design";
import {
  PageHeader,
  StatCard,
  CustomerAvatar,
  LoadingSkeleton,
  ErrorState,
  EmptyState,
} from "./components";
type Operations = {
  totals: { request_type: string; status: string; count: number }[];
  activity: {
    id: string;
    action: string;
    reason: string;
    created_at: string;
    request_id?: string;
    request_number?: string;
    staff_name?: string;
  }[];
};
export function OperationsPage({ kind }: { kind: "reports" | "settings" }) {
  const q = useQuery({
    queryKey: adminKeys.operations,
    queryFn: async () =>
      (await api.get<{ data: Operations }>("/operations")).data.data,
    refetchInterval: false,
    enabled: kind !== "settings",
  });
  const me = useQuery({
    queryKey: adminKeys.me,
    queryFn: async () =>
      (
        await api.get<{
          data: {
            id: string;
            full_name: string;
            username: string;
            role: string;
            must_change_password: boolean;
          };
        }>("/auth/me")
      ).data.data,
    staleTime: 30000,
  });
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const business = useQuery({
    queryKey: ["admin", "business-settings"],
    queryFn: async () =>
      (
        await api.get<{
          data: {
            adminOfficePhone: string | null;
            workingHours: string;
            serviceAreas: string;
            supportContact: string;
          };
        }>("/settings/business")
      ).data.data,
    enabled: kind === "settings",
  });
  const error = (err: unknown) =>
    toast.error(
      axios.isAxiosError(err)
        ? err.response?.data?.error?.message ||
            "Unable to connect. Please try again."
        : "Unable to save changes.",
    );
  if (kind === "settings")
    return (
      <section>
        <PageHeader
          title="Settings"
          description="Your profile, account security and workspace preferences."
        />
        <p>
          <Link to="/reports">
            <icons.reports /> View reports and export
          </Link>
        </p>
        <article className="ui-panel">
          <PushNotificationSettings api={api} />
        </article>
        <article className="ui-panel" id="business-contact">
          <h2>Business settings</h2>
          <p>
            These public support details appear in customer support views. They
            do not change booking availability or historical appointments.
          </p>
          {business.isPending ? (
            <LoadingSkeleton title="Loading business contact..." />
          ) : business.isError ? (
            <ErrorState
              title="Unable to load business contact"
              retry={() => business.refetch()}
            />
          ) : (
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                if (busy) return;
                setBusy(true);
                try {
                  const phone = String(
                    new FormData(event.currentTarget).get("adminOfficePhone") ||
                      "",
                  ).replace(/[\s()-]/g, "");
                  await api.patch("/settings/business", {
                    adminOfficePhone: phone,
                    workingHours: String(
                      new FormData(event.currentTarget).get("workingHours") ||
                        "",
                    ).trim(),
                    serviceAreas: String(
                      new FormData(event.currentTarget).get("serviceAreas") ||
                        "",
                    ).trim(),
                    supportContact: String(
                      new FormData(event.currentTarget).get("supportContact") ||
                        "",
                    ).trim(),
                  });
                  await Promise.all([
                    business.refetch(),
                    qc.invalidateQueries({
                      queryKey: ["google-configuration"],
                    }),
                  ]);
                  toast.success("Admin Office contact updated.");
                } catch (failure) {
                  error(failure);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Official phone number
                <input
                  name="adminOfficePhone"
                  type="tel"
                  required
                  pattern="\+91[6-9][0-9]{9}"
                  placeholder="+919876543210"
                  defaultValue={business.data.adminOfficePhone || ""}
                />
              </label>
              <label>
                Working hours
                <input
                  name="workingHours"
                  maxLength={200}
                  placeholder="Mon-Sat, 9:00 AM-6:00 PM"
                  defaultValue={business.data.workingHours}
                />
              </label>
              <label>
                Supported service areas
                <textarea
                  name="serviceAreas"
                  maxLength={2000}
                  placeholder="Chennai, Tambaram, Avadi"
                  defaultValue={business.data.serviceAreas}
                />
              </label>
              <label>
                Support contact
                <input
                  name="supportContact"
                  maxLength={254}
                  placeholder="support@example.com"
                  defaultValue={business.data.supportContact}
                />
              </label>
              <SafeAsyncButton pending={busy} pendingLabel="Saving...">
                Save contact
              </SafeAsyncButton>
            </form>
          )}
        </article>
        <div className="detail">
          <article id="profile">
            <h2>My Profile</h2>
            {me.data && (
              <>
                <div className="customer-identity">
                  <CustomerAvatar name={me.data.full_name} />
                  <div>
                    <strong>{me.data.full_name}</strong>
                    <small>
                      {me.data.username} · {me.data.role.replaceAll("_", " ")}
                    </small>
                  </div>
                </div>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (busy) return;
                    setBusy(true);
                    try {
                      await api.patch("/auth/profile", {
                        fullName: String(
                          new FormData(e.currentTarget).get("fullName"),
                        ).trim(),
                      });
                      await qc.invalidateQueries({ queryKey: adminKeys.me });
                      toast.success("Profile updated.");
                    } catch (e) {
                      error(e);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <label>
                    Full name
                    <input
                      name="fullName"
                      required
                      minLength={2}
                      maxLength={100}
                      defaultValue={me.data.full_name}
                    />
                  </label>
                  <SafeAsyncButton
                    disabled={busy}
                    pending={busy}
                    pendingLabel="Saving..."
                  >
                    <icons.save /> Save profile
                  </SafeAsyncButton>
                </form>
              </>
            )}
          </article>
        </div>
        <article className="ui-panel" id="security">
          <h2>
            <icons.security /> Security Settings
          </h2>
          <p className="muted">
            Changing your password signs out your other sessions. Your current
            session stays active.
          </p>
          {me.data?.must_change_password && (
            <p role="status">Please replace your initial password.</p>
          )}
          <form
            className="security-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              const form = e.currentTarget;
              const data = new FormData(form);
              if (data.get("newPassword") !== data.get("confirmPassword")) {
                toast.error("New passwords do not match.");
                return;
              }
              setBusy(true);
              try {
                await api.post("/auth/password", {
                  currentPassword: data.get("currentPassword"),
                  newPassword: data.get("newPassword"),
                });
                form.reset();
                await qc.invalidateQueries({ queryKey: adminKeys.me });
                toast.success(
                  "Password changed. Other sessions have been signed out.",
                );
              } catch (e) {
                error(e);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Current password
              <PasswordInput
                name="currentPassword"
                autoComplete="current-password"
                required
                maxLength={128}
              />
            </label>
            <label>
              New password
              <PasswordInput
                name="newPassword"
                autoComplete="new-password"
                minLength={14}
                maxLength={128}
                required
              />
            </label>
            <label>
              Confirm new password
              <PasswordInput
                name="confirmPassword"
                autoComplete="new-password"
                minLength={14}
                maxLength={128}
                required
              />
            </label>
            <SafeAsyncButton
              disabled={busy}
              pending={busy}
              pendingLabel="Saving..."
            >
              <icons.save /> Change password
            </SafeAsyncButton>
          </form>
        </article>
      </section>
    );
  return (
    <section>
      <PageHeader
        title="Reports"
        description="Live request totals by type and status."
        actions={
          q.data && (
            <button
              onClick={() => {
                const csv = [
                  "Type,Status,Count",
                  ...q.data.totals.map(
                    (r) => r.request_type + "," + r.status + "," + r.count,
                  ),
                ].join("\r\n");
                const url = URL.createObjectURL(
                  new Blob([csv], { type: "text/csv;charset=utf-8" }),
                );
                const link = document.createElement("a");
                link.href = url;
                link.download = "request-report.csv";
                link.click();
                URL.revokeObjectURL(url);
              }}
            >
              <icons.download /> Export report
            </button>
          )
        }
      />
      {q.isPending ? (
        <LoadingSkeleton variant="dashboard" />
      ) : q.isError ? (
        <ErrorState title="Unable to load reports" retry={() => q.refetch()} />
      ) : q.data.totals.length ? (
        <div className="kpis">
          {q.data.totals.map((r) => (
            <StatCard
              key={r.request_type + r.status}
              label={r.request_type + " · " + r.status.replaceAll("_", " ")}
              value={r.count}
              icon={
                r.request_type === "SERVICE"
                  ? icons.service
                  : icons.installation
              }
            />
          ))}
        </div>
      ) : (
        <EmptyState title="No request totals yet" />
      )}
    </section>
  );
}
