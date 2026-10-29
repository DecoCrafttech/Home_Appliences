import { AsyncActionButton as SafeAsyncButton } from "@home/ui";
import { TechnicianAccount } from "./TechnicianAccount";
import { TechnicianDocuments } from "./TechnicianOperations";
import { temporaryPasswordSchema } from "@home/shared";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import axios from "axios";
import { api } from "./api";
import { icons, adminKeys } from "./design";
import {
  PageHeader,
  SearchField,
  PageToolbar,
  DataTable,
  StatusBadge,
  ActionMenu,
  DetailsDrawer,
  ConfirmModal,
  EmptyState,
  LoadingSkeleton,
  ErrorState,
} from "./components";
type Technician = {
  id: string;
  username?: string;
  account_status?: string;
  full_name: string;
  phone: string;
  service_area: string;
  verification_status: string;
  assigned_requests: number;
};
export function Technicians({ canManage }: { canManage: boolean }) {
  const query = useQuery({
    queryKey: adminKeys.technicians,
    queryFn: async () =>
      (await api.get<{ data: Technician[] }>("/technicians")).data.data,
    staleTime: 30000,
  });
  const [editing, setEditing] = useState<Technician | "new" | null>(null);
  const [archiving, setArchiving] = useState<Technician | null>(null);
  const [accountChange, setAccountChange] = useState<Technician | null>(null);
  const [busy, setBusy] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [username, setUsername] = useState("");
  const [usernameEdited, setUsernameEdited] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [search, setSearch] = useState("");
  const qc = useQueryClient();
  const error = (e: unknown) =>
    toast.error(
      axios.isAxiosError(e)
        ? e.response?.data?.error?.message ||
            "Unable to connect. Please try again."
        : "Unable to save technician.",
    );
  const rows =
    query.data?.filter((t) =>
      `${t.full_name} ${t.phone} ${t.service_area || ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    ) || [];
  return (
    <section>
      <PageHeader
        title="Technicians"
        description="Manage technician accounts and assigned work."
        actions={
          canManage && (
            <button
              className="primary"
              onClick={() => {
                setUsername("");
                setUsernameEdited(false);
                setShowPassword(false);
                setEditing("new");
              }}
            >
              <icons.add /> Add technician
            </button>
          )
        }
      />
      <PageToolbar>
        <SearchField
          onClear={() => {
            setSearch("");
          }}
          busy={query.isFetching}
          aria-label="Search technicians"
          placeholder="Name, mobile or service area"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button onClick={() => query.refetch()} disabled={query.isFetching}>
          <icons.refresh /> Refresh
        </button>
      </PageToolbar>
      {query.isPending ? (
        <LoadingSkeleton title="Loading technicians…" variant="table" />
      ) : query.isError ? (
        <ErrorState
          title="Unable to load technicians"
          retry={() => query.refetch()}
        />
      ) : !rows.length ? (
        <EmptyState
          title="No technicians found"
          description="Add a team member before assigning work."
        />
      ) : (
        <DataTable>
          <table>
            <thead>
              <tr>
                {[
                  "Technician",
                  "Contact",
                  "Service area",
                  "Verification",
                  "Assigned",
                  "Actions",
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td>
                    {t.full_name}
                    <small title={t.id}>{t.id}</small>
                  </td>
                  <td>
                    <a href={`tel:${t.phone}`}>{t.phone}</a>
                  </td>
                  <td>{t.service_area || "Not specified"}</td>
                  <td>
                    <StatusBadge
                      status={t.verification_status || "UNVERIFIED"}
                    />
                  </td>
                  <td>{t.assigned_requests ?? 0}</td>
                  <td>
                    <ActionMenu>
                      {canManage && (
                        <button onClick={() => setEditing(t)}>
                          <icons.edit /> Edit / verify
                        </button>
                      )}
                      {canManage &&
                        ["ACTIVE", "SUSPENDED"].includes(
                          t.account_status || "",
                        ) && (
                          <button onClick={() => setAccountChange(t)}>
                            {t.account_status === "SUSPENDED"
                              ? "Unfreeze account"
                              : "Freeze account"}
                          </button>
                        )}
                      <Link to={`/requests?technicianId=${t.id}`}>
                        <icons.view /> View assigned requests
                      </Link>
                      {canManage && (
                        <button onClick={() => setArchiving(t)}>
                          <icons.delete /> Remove technician
                        </button>
                      )}
                    </ActionMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>
      )}
      {editing && (
        <DetailsDrawer
          title={editing === "new" ? "Add technician" : "Edit technician"}
          onClose={() => !busy && setEditing(null)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              const data = new FormData(e.currentTarget);
              setBusy(true);
              try {
                const body = {
                  fullName: String(data.get("name")).trim(),
                  phone: data.get("phone"),
                  serviceArea: data.get("serviceArea"),
                  verificationStatus: data.get("verificationStatus"),
                };
                if (editing === "new") {
                  if (
                    data.get("temporaryPassword") !==
                    data.get("confirmPassword")
                  )
                    throw new Error("Temporary passwords must match.");
                  const password = temporaryPasswordSchema.safeParse(
                    data.get("temporaryPassword"),
                  );
                  if (!password.success) {
                    toast.error(
                      password.error.issues[0]?.message ||
                        "Check password strength.",
                    );
                    return;
                  }
                  await api.post("/technicians", {
                    ...body,
                    username,
                    temporaryPassword: password.data,
                    ...(data.get("email") ? { email: data.get("email") } : {}),
                  });
                } else await api.patch(`/technicians/${editing.id}`, body);
                await qc.invalidateQueries({ queryKey: adminKeys.technicians });
                setEditing(null);
                toast.success("Technician saved.");
              } catch (e) {
                if (e instanceof Error && !axios.isAxiosError(e))
                  toast.error(e.message);
                else error(e);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Full name
              <input
                name="name"
                required
                minLength={2}
                maxLength={100}
                defaultValue={editing === "new" ? "" : editing.full_name}
                onChange={(e) => {
                  if (editing === "new" && !usernameEdited)
                    setUsername(
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9]/g, "")
                        .slice(0, 32),
                    );
                }}
              />
            </label>
            {editing === "new" && (
              <fieldset disabled={busy} className="technician-credentials">
                <legend>Technician login</legend>
                <label>
                  Login username
                  <input
                    name="username"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value.toLowerCase());
                      setUsernameEdited(true);
                    }}
                    minLength={3}
                    maxLength={40}
                    pattern="[a-z][a-z0-9._-]{2,39}"
                    autoComplete="off"
                    required
                  />
                </label>
                <small>
                  Unique and permanent. Add a readable suffix if this username
                  is in use.
                </small>
                <label>
                  Email (optional)
                  <input
                    name="email"
                    type="email"
                    maxLength={254}
                    autoComplete="off"
                  />
                </label>
                <label>
                  Temporary password
                  <input
                    name="temporaryPassword"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    minLength={14}
                    maxLength={128}
                    required
                  />
                </label>
                <label>
                  Confirm temporary password
                  <input
                    name="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    minLength={14}
                    maxLength={128}
                    required
                  />
                </label>
                <button
                  type="button"
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? "Hide passwords" : "Show passwords"}
                </button>
                <small>
                  At least 14 characters with upper/lowercase letters, a number
                  and a symbol. The technician must change it before opening
                  jobs.
                </small>
              </fieldset>
            )}
            <label>
              Mobile number
              <input
                name="phone"
                type="tel"
                inputMode="numeric"
                pattern="[6-9][0-9]{9}"
                maxLength={10}
                required
                defaultValue={editing === "new" ? "" : editing.phone}
              />
            </label>
            <label>
              Service area
              <input
                name="serviceArea"
                maxLength={300}
                defaultValue={editing === "new" ? "" : editing.service_area}
              />
            </label>
            <label>
              Verification
              <select
                aria-label="Verification"
                name="verificationStatus"
                defaultValue={
                  editing === "new"
                    ? "UNVERIFIED"
                    : editing.verification_status || "UNVERIFIED"
                }
              >
                <option>UNVERIFIED</option>
                <option>VERIFIED</option>
              </select>
            </label>
            <p className="muted">
              Mark verified only after your team has checked this technician's
              credentials.
            </p>
            <SafeAsyncButton
              disabled={busy}
              pending={busy}
              pendingLabel="Saving..."
            >
              <icons.save />
              {busy ? "Saving…" : "Save technician"}
            </SafeAsyncButton>
          </form>
          {editing !== "new" && (
            <>
              <TechnicianAccount id={editing.id} />
              <details>
                <summary>Identity and verification documents</summary>
                <TechnicianDocuments technicians={[editing]} />
              </details>
            </>
          )}
        </DetailsDrawer>
      )}
      {archiving && (
        <ConfirmModal
          title="Remove technician?"
          busy={busy}
          onClose={() => setArchiving(null)}
        >
          <p>
            {archiving.full_name} will no longer be available for new
            assignments. Resolve or reassign active jobs before removal.
            Historical records are preserved.
          </p>
          <div className="admin-dialog-actions">
            <button disabled={busy} onClick={() => setArchiving(null)}>
              Cancel
            </button>
            <SafeAsyncButton
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api.delete(`/technicians/${archiving.id}`);
                  await qc.invalidateQueries({
                    queryKey: adminKeys.technicians,
                  });
                  setArchiving(null);
                  toast.success("Technician archived.");
                } catch (e) {
                  error(e);
                } finally {
                  setBusy(false);
                }
              }}
              pending={busy}
              pendingLabel="Saving..."
            >
              <icons.delete /> Remove technician
            </SafeAsyncButton>
          </div>
        </ConfirmModal>
      )}
      {accountChange && (
        <ConfirmModal
          title={
            accountChange.account_status === "SUSPENDED"
              ? "Unfreeze technician account?"
              : "Freeze technician account?"
          }
          busy={accountBusy}
          onClose={() => !accountBusy && setAccountChange(null)}
        >
          <p>
            {accountChange.account_status === "SUSPENDED"
              ? `${accountChange.full_name} will be able to sign in and use the technician app again.`
              : `${accountChange.full_name} will immediately lose access to the technician app and all active sessions will be revoked. They will be told to contact an administrator.`}
          </p>
          <div className="admin-dialog-actions">
            <button
              disabled={accountBusy}
              onClick={() => setAccountChange(null)}
            >
              Cancel
            </button>
            <SafeAsyncButton
              disabled={accountBusy}
              pending={accountBusy}
              pendingLabel="Updating..."
              onClick={async () => {
                setAccountBusy(true);
                try {
                  const status =
                    accountChange.account_status === "SUSPENDED"
                      ? "ACTIVE"
                      : "SUSPENDED";
                  await api.patch(`/technicians/${accountChange.id}/account`, {
                    status,
                  });
                  await qc.invalidateQueries({
                    queryKey: adminKeys.technicians,
                  });
                  setAccountChange(null);
                  toast.success(
                    status === "SUSPENDED"
                      ? "Technician account frozen and sessions revoked."
                      : "Technician account unfrozen.",
                  );
                } catch (e) {
                  error(e);
                } finally {
                  setAccountBusy(false);
                }
              }}
            >
              {accountChange.account_status === "SUSPENDED"
                ? "Unfreeze account"
                : "Freeze account"}
            </SafeAsyncButton>
          </div>
        </ConfirmModal>
      )}
    </section>
  );
}
