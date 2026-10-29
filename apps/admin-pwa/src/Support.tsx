import { useDebouncedValue } from "@home/ui";
import { AsyncActionButton as SafeAsyncButton } from "@home/ui";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import axios from "axios";
import { api } from "./api";
import {
  PageHeader,
  PageToolbar,
  SearchField,
  DataTable,
  StatusBadge,
  DetailsDrawer,
  LoadingSkeleton,
  ErrorState,
  Pagination,
  EmptyState,
} from "./components";
import { icons, adminKeys } from "./design";
type Ticket = {
  id: string;
  ticket_number: string;
  customer_id: string;
  request_id: string | null;
  request_number: string | null;
  customer_reference: string;
  full_name: string;
  subject: string;
  message: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
};
type Message = {
  id: string;
  author_name: string;
  author_type: string;
  visibility: string;
  message: string;
  created_at: string;
};
export function AdminSupport({ canManage }: { canManage: boolean }) {
  const [params] = useSearchParams();
  const [search, setSearch] = useState(params.get("q") || "");
  const settledSearch = useDebouncedValue(search);
  const [status, setStatus] = useState(params.get("status") || "");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const query = useQuery({
    queryKey: [...adminKeys.tickets, settledSearch, status, page],
    queryFn: async ({ signal }) =>
      (
        await api.get<{ data: Ticket[]; meta?: { total: number } }>(
          "/support/tickets",
          { params: { q: settledSearch, status, page, limit: 20 }, signal },
        )
      ).data,
    refetchInterval: false,
  });
  const selectedId = params.get("ticket");
  const openedId = useRef<string | null>(null);
  const linked = useQuery({
    queryKey: adminKeys.ticket(selectedId || ""),
    queryFn: async () =>
      (
        await api.get<{ data: { ticket: Ticket; messages: Message[] } }>(
          `/support/tickets/${selectedId}/messages`,
        )
      ).data.data,
    enabled: !!selectedId,
    staleTime: 5000,
  });
  useEffect(() => {
    if (selectedId && linked.data && openedId.current !== selectedId) {
      openedId.current = selectedId;
      setSelected(linked.data.ticket);
    }
  }, [selectedId, linked.data]);
  const rows = query.data?.data || [];
  return (
    <section>
      <PageHeader
        title="Help & Support"
        description="Customer conversations, request follow-ups and private team notes."
      />
      {linked.isError && (
        <ErrorState
          title="Unable to load linked support ticket"
          retry={() => linked.refetch()}
        />
      )}
      <PageToolbar>
        <SearchField
          onClear={() => {
            setSearch("");
            setPage(1);
          }}
          busy={query.isFetching}
          aria-label="Search support tickets"
          placeholder="Ticket, Customer ID, name or subject"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          aria-label="Filter support status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All ticket statuses</option>
          {["OPEN", "IN_PROGRESS", "RESOLVED"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button onClick={() => query.refetch()} disabled={query.isFetching}>
          <icons.refresh /> Refresh
        </button>
      </PageToolbar>
      {query.isPending ? (
        <LoadingSkeleton title="Loading tickets…" />
      ) : query.isError ? (
        <ErrorState
          title="Unable to load support tickets"
          retry={() => query.refetch()}
        />
      ) : !rows.length ? (
        <EmptyState title="No tickets match your search" />
      ) : (
        <DataTable>
          <table>
            <thead>
              <tr>
                {[
                  "Ticket",
                  "Customer",
                  "Related request",
                  "Category",
                  "Priority",
                  "Status",
                  "Created",
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
                    <button
                      className="ui-text-button"
                      onClick={() => setSelected(t)}
                    >
                      {t.ticket_number}
                    </button>
                    <small className="ui-truncate">{t.subject}</small>
                  </td>
                  <td>
                    <Link to={`/customers/${t.customer_id}`}>
                      {t.full_name}
                    </Link>
                    <small>{t.customer_reference}</small>
                  </td>
                  <td>
                    {t.request_id ? (
                      <Link to={`/requests/${t.request_id}`}>
                        {t.request_number || "View request"}
                      </Link>
                    ) : (
                      "General enquiry"
                    )}
                  </td>
                  <td>{t.category || "GENERAL"}</td>
                  <td>{t.priority || "NORMAL"}</td>
                  <td>
                    <StatusBadge status={t.status} />
                  </td>
                  <td>{new Date(t.created_at).toLocaleDateString()}</td>
                  <td>
                    <button onClick={() => setSelected(t)}>
                      <icons.view /> View ticket
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>
      )}
      {query.data && (
        <Pagination
          page={page}
          total={query.data.meta?.total ?? rows.length}
          onChange={setPage}
        />
      )}
      {selected && (
        <SupportDetail
          ticket={selected}
          canManage={canManage}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}
function SupportDetail({
  ticket,
  canManage,
  onClose,
}: {
  ticket: Ticket;
  canManage: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [visibility, setVisibility] = useState("PUBLIC");
  const q = useQuery({
    queryKey: adminKeys.ticket(ticket.id),
    staleTime: 5000,
    queryFn: async () =>
      (
        await api.get<{ data: { ticket: Ticket; messages: Message[] } }>(
          `/support/tickets/${ticket.id}/messages`,
        )
      ).data.data,
    refetchInterval: false,
  });
  const error = (e: unknown) =>
    toast.error(
      axios.isAxiosError(e)
        ? e.response?.data?.error?.message ||
            "Unable to connect. Please try again."
        : "Unable to save changes.",
    );
  return (
    <DetailsDrawer title={ticket.ticket_number} onClose={onClose}>
      <h3>{ticket.subject}</h3>
      <Link to={`/customers/${ticket.customer_id}`}>
        {ticket.full_name} · {ticket.customer_reference}
      </Link>
      {ticket.request_id && (
        <p>
          <Link to={`/requests/${ticket.request_id}`}>
            <icons.view /> {ticket.request_number || "View related request"}
          </Link>
        </p>
      )}
      <div className="thread-message">
        <strong>Customer enquiry</strong>
        <p>{ticket.message}</p>
      </div>
      <label className="ui-field">
        Ticket status
        <select
          aria-label="Ticket status"
          disabled={!canManage || busy}
          value={q.data?.ticket.status || ticket.status}
          onChange={async (e) => {
            setBusy(true);
            try {
              await api.patch(`/support/tickets/${ticket.id}`, {
                status: e.target.value,
              });
              await Promise.all([
                qc.invalidateQueries({ queryKey: adminKeys.tickets }),
                qc.invalidateQueries({ queryKey: adminKeys.ticket(ticket.id) }),
                qc.invalidateQueries({ queryKey: adminKeys.summary }),
              ]);
              toast.success("Support status updated.");
            } catch (e) {
              error(e);
            } finally {
              setBusy(false);
            }
          }}
        >
          {["OPEN", "IN_PROGRESS", "RESOLVED"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      {q.isPending ? (
        <LoadingSkeleton title="Loading conversation…" />
      ) : q.isError ? (
        <ErrorState
          title="Unable to load conversation"
          retry={() => q.refetch()}
        />
      ) : (
        <div className="message-thread">
          {q.data.messages.map((m) => (
            <article
              key={m.id}
              className={`thread-message ${m.visibility === "INTERNAL" ? "internal" : ""}`}
            >
              <strong>
                {m.visibility === "INTERNAL"
                  ? "Private internal note"
                  : m.author_type === "STAFF"
                    ? "Support reply"
                    : "Customer reply"}
              </strong>
              <p>{m.message}</p>
              <small>
                {m.author_name} · {new Date(m.created_at).toLocaleString()}
              </small>
            </article>
          ))}
          {!q.data.messages.length && <p className="muted">No replies yet.</p>}
        </div>
      )}
      {canManage && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            const form = e.currentTarget;
            const data = new FormData(form);
            setBusy(true);
            try {
              await api.post(`/support/tickets/${ticket.id}/messages`, {
                message: String(data.get("message")).trim(),
                visibility,
              });
              await Promise.all([
                qc.invalidateQueries({ queryKey: adminKeys.ticket(ticket.id) }),
                qc.invalidateQueries({ queryKey: adminKeys.tickets }),
              ]);
              form.reset();
              toast.success(
                visibility === "INTERNAL"
                  ? "Internal note saved."
                  : "Reply sent to customer.",
              );
            } catch (e) {
              error(e);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Message visibility
            <select
              aria-label="Message visibility"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
            >
              <option value="PUBLIC">Customer-visible reply</option>
              <option value="INTERNAL">Private internal note</option>
            </select>
          </label>
          <label>
            {visibility === "INTERNAL" ? "Internal note" : "Reply to customer"}
            <textarea name="message" required minLength={1} maxLength={4000} />
          </label>
          <p className="muted">
            {visibility === "INTERNAL"
              ? "Only authorized staff can read this note."
              : "The customer can read this reply in their support conversation."}
          </p>
          <SafeAsyncButton
            disabled={busy}
            pending={busy}
            pendingLabel="Saving..."
          >
            <icons.save />
            {busy
              ? "Saving…"
              : visibility === "INTERNAL"
                ? "Save internal note"
                : "Send reply"}
          </SafeAsyncButton>
        </form>
      )}
    </DetailsDrawer>
  );
}
