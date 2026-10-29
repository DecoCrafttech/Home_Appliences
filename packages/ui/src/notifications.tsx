import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AsyncActionButton, ConfirmActionDialog } from "./index";
import { icons } from "./icons";
import { LoadingSkeleton } from "./skeletons";

export type InboxNotice = {
  id: string;
  title: string;
  message: string;
  created_at: string;
  read_at: string | null;
  request_id?: string | null;
  related_path?: string | null;
};
export type InboxData = {
  items: InboxNotice[];
  unreadCount: number;
  fetchedAt: string;
};
export function notificationInbox(response: {
  data: InboxNotice[];
  meta?: { unreadCount: number; fetchedAt: string };
}): InboxData {
  return {
    items: response.data,
    unreadCount:
      response.meta?.unreadCount ??
      response.data.filter((n) => !n.read_at).length,
    fetchedAt: response.meta?.fetchedAt || new Date().toISOString(),
  };
}
export function NotificationCenter({
  query,
  queryKey,
  read,
  readAll,
  destination,
  navigate,
  initiallyOpen = false,
  onLegacyClose,
}: {
  query: {
    data?: InboxData;
    dataUpdatedAt: number;
    isPending: boolean;
    isFetching: boolean;
    isError: boolean;
    refetch: (options?: { cancelRefetch?: boolean }) => Promise<unknown>;
  };
  queryKey: readonly unknown[];
  read: (id: string) => Promise<unknown>;
  readAll: () => Promise<unknown>;
  destination: (notice: InboxNotice) => string;
  navigate: (path: string) => void;
  initiallyOpen?: boolean;
  onLegacyClose?: () => void;
}) {
  const [open, setOpen] = useState(false),
    qc = useQueryClient();
  const unread = query.data?.unreadCount || 0;
  async function refresh() {
    await query.refetch({ cancelRefetch: false });
  }
  useEffect(() => {
    if (initiallyOpen) {
      setOpen(true);
      void query.refetch({ cancelRefetch: false });
    }
  }, [initiallyOpen]); // refetch is stable per observer
  function close() {
    setOpen(false);
    if (initiallyOpen) onLegacyClose?.();
  }
  async function mark(id?: string) {
    try {
      if (id) await read(id);
      else await readAll();
      qc.setQueryData<InboxData>(queryKey, (old) =>
        old
          ? {
              ...old,
              unreadCount: id
                ? Math.max(
                    0,
                    old.unreadCount -
                      (old.items.some((n) => n.id === id && !n.read_at)
                        ? 1
                        : 0),
                  )
                : 0,
              items: old.items.map((n) =>
                !id || n.id === id
                  ? { ...n, read_at: n.read_at || new Date().toISOString() }
                  : n,
              ),
            }
          : old,
      );
    } catch {
      toast.error("Unable to mark notifications as read. Please try again.");
    }
  }
  return (
    <>
      <button
        type="button"
        className="notification-bell"
        aria-label={`Notifications${unread ? ` (${unread > 99 ? "99+" : unread} unread)` : ""}`}
        title="Notifications"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setOpen(true);
          void refresh();
        }}
      >
        <icons.bell aria-hidden="true" />
        {unread > 0 && (
          <span className="notification-badge" aria-hidden="true">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <ConfirmActionDialog title="Notifications" onClose={close}>
          <div className="notification-center">
            <div className="notification-tools">
              <AsyncActionButton
                pending={query.isFetching}
                pendingLabel="Refreshing..."
                onClick={refresh}
              >
                <icons.refresh /> Refresh
              </AsyncActionButton>
              <AsyncActionButton
                disabled={!unread}
                pendingLabel="Marking..."
                onClick={() => mark()}
              >
                <icons.success /> Mark all as read
              </AsyncActionButton>
            </div>
            {query.isPending ? (
              <LoadingSkeleton
                title="Loading notifications…"
                variant="notifications"
              />
            ) : query.isError ? (
              <div role="alert">
                <p>Unable to load notifications.</p>
                <AsyncActionButton onClick={refresh}>
                  Try again
                </AsyncActionButton>
              </div>
            ) : !query.data?.items.length ? (
              <div className="notification-empty">
                <icons.bell />
                <h3>No notifications yet</h3>
                <p>Your booking and account updates will appear here.</p>
              </div>
            ) : (
              <div className="notification-list">
                {query.data.items.map((n) => (
                  <article
                    key={n.id}
                    className={`notification-entry ${n.read_at ? "" : "unread"}`}
                  >
                    <div>
                      <h3>
                        {!n.read_at && (
                          <span className="unread-dot" aria-label="Unread" />
                        )}
                        {n.title}
                      </h3>
                      <p>{n.message}</p>
                      <time dateTime={n.created_at}>
                        {new Date(n.created_at).toLocaleString("en-IN")}
                      </time>
                    </div>
                    <div className="notification-entry-actions">
                      <a
                        href={destination(n)}
                        onClick={(e) => {
                          e.preventDefault();
                          close();
                          navigate(destination(n));
                        }}
                      >
                        View details <icons.next />
                      </a>
                      {!n.read_at && (
                        <AsyncActionButton
                          onClick={() => mark(n.id)}
                          pendingLabel="Marking..."
                        >
                          Mark as read
                        </AsyncActionButton>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </ConfirmActionDialog>
      )}
    </>
  );
}
