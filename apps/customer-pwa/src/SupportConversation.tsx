import { LoadingSkeleton } from "@home/ui/skeletons";
import { AsyncActionButton as SafeAsyncButton } from "@home/ui";
import { customerKeys } from "./lib/queryKeys";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "./lib/api";
export function SupportConversation({
  ticketId,
  initiallyOpen = false,
}: {
  ticketId: string;
  initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: customerKeys.conversation(ticketId),
    queryFn: async () =>
      (
        await api.get<{
          data: {
            messages: {
              id: string;
              author_type: string;
              message: string;
              created_at: string;
            }[];
          };
        }>(`/support/tickets/${ticketId}/messages`)
      ).data.data,
    enabled: open,
    refetchInterval: false,
  });
  return (
    <>
      <button
        className="secondary"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        {open ? "Close conversation" : "View conversation"}
      </button>
      {open && (
        <div className="support-conversation">
          <SafeAsyncButton
            className="secondary"
            pending={q.isFetching}
            onClick={() => q.refetch()}
          >
            Refresh messages
          </SafeAsyncButton>
          {q.isPending ? (
            <LoadingSkeleton
              variant="notifications"
              title="Loading conversation..."
            />
          ) : q.isError ? (
            <p role="alert">
              Unable to load messages.{" "}
              <button onClick={() => q.refetch()}>Try again</button>
            </p>
          ) : (
            q.data.messages.map((m) => (
              <article className="record-card" key={m.id}>
                <strong>
                  {m.author_type === "STAFF" ? "Support team" : "You"}
                </strong>
                <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                  {m.message}
                </p>
                <small>{new Date(m.created_at).toLocaleString()}</small>
              </article>
            ))
          )}
          <form
            className="workflow-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              const form = e.currentTarget;
              const message = String(
                new FormData(form).get("message") || "",
              ).trim();
              if (!message) return;
              setBusy(true);
              try {
                await api.post(`/support/tickets/${ticketId}/messages`, {
                  message,
                });
                form.reset();
                await qc.invalidateQueries({
                  queryKey: customerKeys.conversation(ticketId),
                });
                toast.success("Message sent to support.");
              } catch {
                toast.error("Unable to send your message. Please try again.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Your reply
              <textarea
                name="message"
                minLength={1}
                maxLength={4000}
                required
              />
            </label>
            <SafeAsyncButton
              className="primary"
              disabled={busy}
              pending={busy}
              pendingLabel="Saving..."
            >
              {busy ? "Sending…" : "Send message"}
            </SafeAsyncButton>
          </form>
        </div>
      )}
    </>
  );
}
