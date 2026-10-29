import { LoadingSkeleton } from "@home/ui/skeletons";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AsyncActionButton } from "@home/ui";
import { temporaryPasswordSchema } from "@home/shared";
import { toast } from "sonner";
import axios from "axios";
import { api } from "./api";
export function TechnicianAccount({ id }: { id: string }) {
  const [link, setLink] = useState(""),
    [resetting, setResetting] = useState(false);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin", "technician-account", id],
    queryFn: async () =>
      (
        await api.get<{
          data: {
            username: string | null;
            email: string | null;
            status: string;
            must_change_password: boolean;
          } | null;
        }>(`/technicians/${id}/account`)
      ).data.data,
  });
  return (
    <section className="ui-panel">
      <h3>Login and account access</h3>
      {q.isPending ? (
        <LoadingSkeleton title="Loading account…" variant="profile" />
      ) : q.isError ? (
        <p role="alert">
          Unable to load account.{" "}
          <button onClick={() => q.refetch()}>Retry</button>
        </p>
      ) : q.data ? (
        <>
          <p>
            Username: <strong>{q.data.username || q.data.email}</strong>
          </p>
          <p>
            {q.data.status}
            {q.data.must_change_password
              ? " · Password change required at next sign in"
              : ""}
          </p>
          {["ACTIVE", "SUSPENDED"].includes(q.data.status) ? (
            <>
              <AsyncActionButton
                onClick={async () => {
                  try {
                    await api.patch(`/technicians/${id}/account`, {
                      status:
                        q.data!.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED",
                    });
                    await Promise.all([
                      q.refetch(),
                      qc.invalidateQueries({ queryKey: ["technicians"] }),
                    ]);
                    toast.success("Account access updated. Sessions revoked.");
                  } catch {
                    toast.error("Unable to update account access.");
                  }
                }}
              >
                {q.data.status === "SUSPENDED"
                  ? "Unfreeze technician"
                  : "Freeze technician"}
              </AsyncActionButton>
              <form
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (resetting) return;
                  const form = event.currentTarget;
                  const values = new FormData(form);
                  if (
                    values.get("password") !== values.get("confirmPassword")
                  ) {
                    toast.error("Passwords must match.");
                    return;
                  }
                  const password = temporaryPasswordSchema.safeParse(
                    values.get("password"),
                  );
                  if (!password.success) {
                    toast.error(
                      password.error.issues[0]?.message ||
                        "Check temporary password strength.",
                    );
                    return;
                  }
                  setResetting(true);
                  try {
                    await api.post(`/technicians/${id}/password`, {
                      temporaryPassword: password.data,
                    });
                    form.reset();
                    await q.refetch();
                    toast.success(
                      "Password reset. The technician must change it at next sign in.",
                    );
                  } catch (error) {
                    toast.error(
                      axios.isAxiosError(error)
                        ? error.response?.data?.error?.message ||
                            "Unable to reset technician password."
                        : "Unable to reset technician password.",
                    );
                  } finally {
                    setResetting(false);
                  }
                }}
              >
                <label>
                  Temporary password
                  <input
                    name="password"
                    type="password"
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
                    type="password"
                    autoComplete="new-password"
                    minLength={14}
                    maxLength={128}
                    required
                  />
                </label>
                <AsyncActionButton
                  type="submit"
                  disabled={resetting}
                  pending={resetting}
                  pendingLabel="Resetting..."
                >
                  Reset technician password
                </AsyncActionButton>
              </form>
            </>
          ) : (
            <p>
              Account activation is pending. Password controls are unavailable.
            </p>
          )}
        </>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            try {
              const r = await api.post(`/technicians/${id}/invite`, {
                email: f.get("email"),
              });
              setLink(
                new URL(
                  r.data.data.activationPath,
                  import.meta.env.VITE_TECHNICIAN_ORIGIN ||
                    "http://127.0.0.1:5175",
                ).href,
              );
              await q.refetch();
              toast.success("Activation link created.");
            } catch {
              toast.error("Unable to create activation link.");
            }
          }}
        >
          <p>This historical team member has no login yet.</p>
          <label>
            Email
            <input name="email" type="email" required />
          </label>
          <AsyncActionButton type="submit">
            Create activation link
          </AsyncActionButton>
        </form>
      )}
      {link && (
        <label>
          Single-use link — share securely
          <input value={link} readOnly onFocus={(e) => e.target.select()} />
          <AsyncActionButton
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                toast.success("Secure link copied.");
              } catch {
                toast.error("Select and copy the secure link.");
              }
            }}
          >
            Copy link
          </AsyncActionButton>
        </label>
      )}
    </section>
  );
}
