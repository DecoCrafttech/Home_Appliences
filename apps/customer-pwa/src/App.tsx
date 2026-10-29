import { AppErrorBoundary } from "@home/ui";
import { ApplianceServices } from "./PublishedServices";
import { BackButton } from "./BackButton";
import { ServiceDiscovery } from "./PublishedServices";
import { NotificationCenter, notificationInbox } from "@home/ui";
import { customerKeys } from "./lib/queryKeys";
import { useEffect, useState, type ReactNode } from "react";
import {
  Link,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  FaCalendarDays,
  FaLayerGroup,
  FaHouse,
  FaUser,
  FaArrowRight,
  FaScrewdriverWrench,
} from "react-icons/fa6";
import { api } from "./lib/api";
import axios from "axios";
import { PwaUpdate } from "./components/PwaUpdate";
import { useTranslation } from "./lib/language";
import type { Customer, Notification } from "./lib/types";
import { readDraft } from "./lib/drafts";
import {
  Avatar,
  EmptyState,
  LanguageSelector,
  LoadingSkeleton,
} from "./components/ui";
import {
  AddressesPage,
  LoginPage,
  ProfilePage,
  SupportPage,
} from "./WorkflowPages";
import { BookingWizard } from "./BookingWizard";
import {
  MyRequests,
  MyReviews,
  RequestCard,
  RequestPage,
  useRequests,
} from "./Aftercare";

const navigation = [
  { to: "/", label: "Home", icon: FaHouse },
  { to: "/services", label: "Services", icon: FaLayerGroup },
  { to: "/bookings", label: "My Requests", icon: FaCalendarDays },
  { to: "/profile", label: "Profile", icon: FaUser },
];
function useProfile() {
  return useQuery({
    queryKey: customerKeys.profile,
    queryFn: async () =>
      (await api.get<{ data: Customer }>("/profile")).data.data,
    staleTime: 300_000,
    retry: false,
  });
}
export function App() {
  const { t } = useTranslation();
  const profile = useProfile();
  const notifications = useQuery({
    queryKey: [...customerKeys.notifications, profile.data?.id],
    queryFn: async () =>
      notificationInbox(
        (
          await api.get<{
            data: Notification[];
            meta?: { unreadCount: number; fetchedAt: string };
          }>("/notifications")
        ).data,
      ),
    enabled: false,
    retry: false,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 60000,
  });
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <PwaUpdate />
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header
        className={`app-header ${location.pathname === "/" ? "home-header" : ""}`}
      >
        <div className="header-inner">
          <Link to="/" className="brand">
            <span className="brand-icon">
              <FaHouse />
            </span>
            <span>
              home<span className="brand-light">services</span>
            </span>
          </Link>
          <nav aria-label="Main navigation">
            {navigation.map(({ to, label }) => (
              <NavLink to={to} key={to} end={to === "/"}>
                {t(label)}
              </NavLink>
            ))}
          </nav>
          <div className="header-actions">
            <LanguageSelector />
            {profile.data ? (
              <>
                <NotificationCenter
                  query={notifications}
                  queryKey={[...customerKeys.notifications, profile.data?.id]}
                  read={(id) => api.patch(`/notifications/${id}/read`)}
                  readAll={() =>
                    api.patch("/notifications/read-all", {
                      before: notifications.data?.fetchedAt,
                    })
                  }
                  destination={(n) =>
                    n.related_path ||
                    (n.request_id ? `/requests/${n.request_id}` : "/support")
                  }
                  navigate={navigate}
                  initiallyOpen={location.pathname === "/notifications"}
                  onLegacyClose={() => navigate("/", { replace: true })}
                />
                <Link className="profile-shortcut" to="/profile">
                  <Avatar
                    name={profile.data.full_name}
                    src={profile.data.profile_photo_url}
                  />
                  <span>
                    {profile.data.full_name?.split(" ")[0] || t("Profile")}
                  </span>
                </Link>
              </>
            ) : (
              <Link className="secondary" to="/login">
                {t("Sign in")}
              </Link>
            )}
          </div>
        </div>
      </header>
      <main id="main">
        <BackButton />
        <AppErrorBoundary key={location.pathname}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/services" element={<Services />} />
            <Route
              path="/services/appliances/:applianceId"
              element={<ApplianceServices />}
            />
            <Route path="/services/:id" element={<Navigate to="/services" replace />} />
            <Route
              path="/bookings"
              element={
                <Protected>
                  <MyRequests />
                </Protected>
              }
            />
            <Route
              path="/requests"
              element={
                <Protected>
                  <MyRequests />
                </Protected>
              }
            />
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/privacy"
              element={
                <section className="section page">
                  <h1>Privacy & Security</h1>
                  <p>
                    Your account uses Google Sign-In. Manage your Google
                    password and account security in your Google Account.
                  </p>
                  <p>
                    Request information and uploaded files are available only to
                    authorized participants. Sign out on shared devices when you
                    finish.
                  </p>
                  <a
                    className="secondary"
                    href="https://myaccount.google.com/security"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Google Account security
                  </a>
                  <Link className="secondary" to="/support">
                    Contact support about your data
                  </Link>
                </section>
              }
            />
            <Route
              path="/profile"
              element={
                <Protected>
                  <ProfilePage />
                </Protected>
              }
            />
            <Route
              path="/addresses"
              element={
                <Protected>
                  <AddressesPage />
                </Protected>
              }
            />
            <Route
              path="/request/service"
              element={<BookingWizard type="service" />}
            />
            <Route
              path="/request/installation"
              element={<BookingWizard type="installation" />}
            />
            <Route
              path="/requests/:id"
              element={
                <Protected>
                  <RequestPage />
                </Protected>
              }
            />
            <Route
              path="/support"
              element={
                <Protected>
                  <SupportPage />
                </Protected>
              }
            />
            <Route
              path="/notifications"
              element={<Protected>{null}</Protected>}
            />
            <Route
              path="/reviews"
              element={
                <Protected>
                  <MyReviews />
                </Protected>
              }
            />
            <Route
              path="*"
              element={
                <section className="section page">
                  <EmptyState title="Page not found">
                    <Link className="primary" to="/">
                      {t("Home")}
                    </Link>
                  </EmptyState>
                </section>
              }
            />
          </Routes>
        </AppErrorBoundary>
      </main>
      <nav className="bottom-nav" aria-label="Mobile navigation">
        {navigation.map(({ to, label, icon: Icon }) => (
          <NavLink to={to} key={to} end={to === "/"}>
            <Icon />
            <span>{t(label)}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
function Home() {
  const { t } = useTranslation(),
    profile = useProfile(),
    requests = useRequests(!!profile.data),
    [, setDraftVersion] = useState(0);
  const hour = new Date().getHours();
  const greeting =
    hour < 12
      ? t("Good morning")
      : hour < 17
        ? t("Good afternoon")
        : t("Good evening");
  useEffect(() => {
    const update = () => setDraftVersion((v) => v + 1);
    window.addEventListener("draft-changed", update);
    return () => window.removeEventListener("draft-changed", update);
  }, []);
  const draft =
    profile.data &&
    (readDraft(profile.data.id, "service") ||
      readDraft(profile.data.id, "installation"));
  const activeRequests = (requests.data || []).filter(
    (r) => !["COMPLETED", "CANCELLED"].includes(r.status),
  );
  const active =
    activeRequests.find((r) => r.status === "ESTIMATE_PENDING_APPROVAL") ||
    activeRequests[0];
  return (
    <div className="home-page section">
      {profile.isPending ? (
        <LoadingSkeleton variant="summary" />
      ) : (
        <section className="home-hero">
          <div className="home-hero-copy">
            <div className="home-greeting">
              {profile.data ? (
                <Avatar
                  name={profile.data.full_name}
                  src={profile.data.profile_photo_url}
                />
              ) : (
                <span className="home-greeting-icon">
                  <FaHouse aria-hidden="true" />
                </span>
              )}
              <span>
                {greeting}
                {profile.data?.full_name
                  ? `, ${profile.data.full_name.split(" ")[0]}`
                  : ""}
              </span>
            </div>
            <span className="home-hero-eyebrow">
              {t("Home care, made simple")}
            </span>
            <h1>{t("How can we help today?")}</h1>
            <p>
              {t(
                "From a quick repair to a new installation, find the right help for your home.",
              )}
            </p>
            <div className="home-hero-actions">
              <Link className="primary" to="/services">
                {t("Explore services")}
                <FaArrowRight aria-hidden="true" />
              </Link>
              <Link className="secondary" to="/bookings">
                {t("My Requests")}
              </Link>
            </div>
          </div>
          <div className="home-quick-start">
            <h2>{t("What do you need help with?")}</h2>
            <Link className="home-quick-link" to="/request/service">
              <span className="home-quick-icon">
                <FaScrewdriverWrench aria-hidden="true" />
              </span>
              <span>
                <strong>{t("Repair an appliance")}</strong>
                <small>{t("Get help with an appliance issue")}</small>
              </span>
              <FaArrowRight aria-hidden="true" />
            </Link>
            <Link className="home-quick-link" to="/request/installation">
              <span className="home-quick-icon install">
                <FaHouse aria-hidden="true" />
              </span>
              <span>
                <strong>{t("Install an appliance")}</strong>
                <small>{t("Get a new appliance set up")}</small>
              </span>
              <FaArrowRight aria-hidden="true" />
            </Link>
          </div>
        </section>
      )}
      {draft && (
        <Link className="draft-banner" to={`/request/${draft.type}`}>
          <span>
            <strong>Continue your draft</strong>
            <small>{new Date(draft.savedAt).toLocaleDateString()}</small>
          </span>
          <FaArrowRight />
        </Link>
      )}
      <ServiceDiscovery compact />
      {active && (
        <section className="home-section">
          <div className="section-heading">
            <h2>Your active request</h2>
            <Link to="/bookings">View all ({activeRequests.length})</Link>
          </div>
          <RequestCard request={active} compact />
        </section>
      )}
      {profile.data && requests.isError && (
        <section className="home-section" role="alert">
          <p>Unable to load your requests.</p>
          <button className="secondary" onClick={() => requests.refetch()}>
            Try again
          </button>
        </section>
      )}
    </div>
  );
}
function Protected({ children }: { children: ReactNode }) {
  const location = useLocation();
  const query = useProfile();
  const { t } = useTranslation();
  if (query.isPending)
    return (
      <section className="section page">
        <LoadingSkeleton
          variant={
            location.pathname === "/profile"
              ? "profile"
              : location.pathname.startsWith("/requests/")
                ? "detail"
                : "cards"
          }
        />
      </section>
    );
  if (query.isError) {
    const unauthorized =
      axios.isAxiosError(query.error) && query.error.response?.status === 401;
    return (
      <section className="section page">
        <EmptyState
          title={unauthorized ? "Sign in" : "Unable to load this page"}
        >
          {unauthorized ? (
            <Link
              className="primary"
              to={`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`}
            >
              {t("Sign in")}
            </Link>
          ) : (
            <button className="primary" onClick={() => query.refetch()}>
              {t("Try again")}
            </button>
          )}
        </EmptyState>
      </section>
    );
  }
  return children;
}
function Services() {
  return <ServiceDiscovery />;
}
