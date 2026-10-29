import { AppErrorBoundary, AsyncActionButton, useSafeMutation } from "@home/ui";
import { NotificationCenter } from "@home/ui";
import { useAdminNotifications } from "./Notifications";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { icons, navigation } from "./design";
import { CustomerAvatar } from "./components";
export type Staff = {
  id: string;
  username: string;
  full_name?: string;
  fullName?: string;
  role: string;
};

export function AdminSidebar({
  collapsed,
  open,
  onClose,
  menuRef,
}: {
  collapsed: boolean;
  open: boolean;
  onClose: () => void;
  menuRef: React.RefObject<HTMLElement | null>;
}) {
  return (
    <aside
      ref={menuRef}
      className={`sidebar ${open ? "open" : ""}`}
      aria-label="Admin navigation"
    >
      <Link
        className="brand"
        aria-label="Home Services dashboard"
        to="/"
        onClick={onClose}
      >
        <span className="brand-mark">
          <icons.service />
        </span>
        {!collapsed && (
          <span>
            Home Services<small>ADMIN WORKSPACE</small>
          </span>
        )}
      </Link>
      <button
        className="mobile-drawer-close ui-icon-button"
        title="Close navigation"
        aria-label="Close navigation"
        onClick={onClose}
      >
        <icons.close />
      </button>
      <nav id="admin-navigation">
        {navigation.map((group) => (
          <div className="nav-group" key={group.group}>
            {!collapsed && (
              <span className="nav-group-label">{group.group}</span>
            )}
            {group.items.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                onClick={onClose}
                title={collapsed ? label : undefined}
              >
                <Icon aria-hidden="true" />
                <span className={collapsed ? "sr-only" : ""}>{label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
export function AdminHeader({
  staff,
  open,
  setOpen,
  collapsed,
  setCollapsed,
}: {
  staff: Staff;
  open: boolean;
  setOpen: (v: boolean) => void;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}) {
  const notices = useAdminNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const [error, setError] = useState("");
  const profileMenu = useRef<HTMLDetailsElement>(null);
  const logout = useSafeMutation(async () => {
    await api.post("/auth/logout");
    qc.clear();
    window.location.assign("/");
  });
  useEffect(() => {
    const dismiss = (event: PointerEvent | FocusEvent) => {
      if (
        profileMenu.current?.open &&
        !profileMenu.current.contains(event.target as Node)
      ) {
        profileMenu.current.open = false;
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && profileMenu.current?.open) {
        profileMenu.current.open = false;
        profileMenu.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("focusin", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("focusin", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  const section = navigation
    .flatMap((g) => g.items)
    .find((n) =>
      n.to === "/"
        ? location.pathname === "/"
        : location.pathname.startsWith(n.to),
    );
  return (
    <header className="admin-header">
      <div className="header-context">
        <button
          className="mobile-menu-toggle ui-icon-button"
          aria-label="Menu"
          aria-controls="admin-navigation"
          aria-expanded={open}
          title="Open navigation"
          onClick={() => setOpen(!open)}
        >
          <icons.menu />
          <span>Menu</span>
        </button>
        <button
          className="collapse-sidebar ui-icon-button"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => {
            setCollapsed(!collapsed);
            localStorage.setItem("admin-sidebar-collapsed", String(!collapsed));
          }}
        >
          <icons.menu />
        </button>
        <span className="header-breadcrumb">
          Workspace <span>/</span> {section?.label || "Request details"}
        </span>
      </div>
      <div className="header-tools">
        <NotificationCenter
          query={notices}
          queryKey={[
            "admin-notifications",
            qc.getQueryData<Staff>(["admin-me"])?.id,
          ]}
          read={(id) => api.patch(`/notifications/${id}/read`)}
          readAll={() =>
            api.patch("/notifications/read-all", {
              before: notices.data?.fetchedAt,
            })
          }
          destination={(n) =>
            n.related_path || (n.request_id ? `/requests/${n.request_id}` : "/")
          }
          navigate={navigate}
          initiallyOpen={location.pathname === "/notifications"}
          onLegacyClose={() => navigate("/", { replace: true })}
        />
        <details ref={profileMenu} className="profile-menu">
          <summary aria-label="Admin profile menu" title="Profile and settings">
            <CustomerAvatar
              name={staff.full_name || staff.fullName || staff.username}
            />
            <span>
              <strong>
                {staff.full_name || staff.fullName || staff.username}
              </strong>
              <small>{staff.role.replaceAll("_", " ")}</small>
            </span>
          </summary>
          <div
            className="profile-popover"
            onClick={(event) => {
              if ((event.target as HTMLElement).closest("a"))
                event.currentTarget.closest("details")?.removeAttribute("open");
            }}
          >
            <Link to="/settings#profile">
              <icons.customers /> My Profile
            </Link>
            <Link to="/settings#security">
              <icons.security /> Security Settings
            </Link>
            <AsyncActionButton
              pending={logout.isPending}
              pendingLabel="Signing out..."
              onClick={async () => {
                setError("");
                try {
                  await logout.run(undefined);
                } catch {
                  setError("Unable to sign out. Please try again.");
                }
              }}
            >
              <icons.logout /> Logout
            </AsyncActionButton>
            {error && <p role="alert">{error}</p>}
          </div>
        </details>
      </div>
    </header>
  );
}
export function AdminLayout({
  staff,
  children,
}: {
  staff: Staff;
  children: ReactNode;
}) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("admin-sidebar-collapsed") === "true",
  );
  const ref = useRef<HTMLElement>(null);
  const buttonRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 760px)");
    const resetDrawer = () => {
      if (!mobile.matches) setOpen(false);
    };
    mobile.addEventListener("change", resetDrawer);
    return () => mobile.removeEventListener("change", resetDrawer);
  }, []);
  useEffect(() => {
    document.body.classList.toggle(
      "compact",
      localStorage.getItem("admin-compact") === "true",
    );
  }, []);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    buttonRef.current = document.activeElement as HTMLElement;
    const first = ref.current?.querySelector<HTMLElement>("a,button");
    first?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "Tab") {
        const items = ref.current?.querySelectorAll<HTMLElement>("a,button");
        if (!items?.length) return;
        if (e.shiftKey && document.activeElement === items[0]) {
          e.preventDefault();
          items[items.length - 1]?.focus();
        } else if (
          !e.shiftKey &&
          document.activeElement === items[items.length - 1]
        ) {
          e.preventDefault();
          items[0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handler);
      buttonRef.current?.focus();
    };
  }, [open]);
  return (
    <div className={`app admin-layout ${collapsed ? "nav-collapsed" : ""}`}>
      <AdminSidebar
        collapsed={collapsed && !open}
        open={open}
        onClose={() => setOpen(false)}
        menuRef={ref}
      />
      {open && (
        <button
          className="drawer-backdrop"
          aria-label="Close navigation backdrop"
          onClick={() => setOpen(false)}
        />
      )}
      <div className="content" inert={open}>
        <AdminHeader
          staff={staff}
          open={open}
          setOpen={setOpen}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
        />
        <main>
          <AppErrorBoundary key={location.pathname}>
            {children}
          </AppErrorBoundary>
        </main>
      </div>
    </div>
  );
}
