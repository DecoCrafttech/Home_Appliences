import { CategoryItems, useHomeBanner } from "./PublishedServices";
import { AccountAccessState } from "./components/AccountAccessState";
import { useGoogleConfiguration } from "./lib/googleAuth";
import { contactPhone } from "@home/shared";
import { CatalogueSearch } from "./CatalogueSearch";
import { useCustomerProfile as useProfile } from "./lib/profile";
import { AppErrorBoundary, BrandLogo } from "@home/ui";
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
  FaPhone,
  FaShieldHalved,
  FaBolt,
  FaTag,
  FaAward,
  FaHeadset,
  FaToolbox,
} from "react-icons/fa6";
import { api, catalogueImageUrl } from "./lib/api";
import axios from "axios";
import { useTranslation } from "./lib/language";
import type { Notification } from "./lib/types";
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
  { to: "/book", label: "Book", icon: FaCalendarDays },
  { to: "/bookings", label: "My Requests", icon: FaCalendarDays },
  { to: "/profile", label: "Profile", icon: FaUser },
];
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
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="app-header">
        <div className="header-inner">
          <Link to="/" className="brand" aria-label="Fixbeez home">
            <BrandLogo />
          </Link>
          {location.pathname !== "/login" && (
            <nav aria-label="Main navigation">
              {navigation.map(({ to, label }) => (
                <NavLink to={to} key={to} end={to === "/"}>
                  {t(label)}
                </NavLink>
              ))}
            </nav>
          )}
          <div className="header-actions">
            <LanguageSelector />
            {profile.isPending ? (
              <span className="v6-auth-loading" role="status">
                Restoring session...
              </span>
            ) : profile.isError &&
              !(
                axios.isAxiosError(profile.error) &&
                profile.error.response?.status === 401
              ) ? (
              <button className="secondary" onClick={() => profile.refetch()}>
                Retry connection
              </button>
            ) : profile.data ? (
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
                <Link
                  className="profile-shortcut"
                  to="/profile"
                  aria-label="Your profile"
                >
                  <Avatar
                    name={profile.data.full_name}
                    src={profile.data.profile_photo_url}
                  />
                  <span>
                    {profile.data.full_name?.split(" ")[0] || t("Profile")}
                  </span>
                </Link>
              </>
            ) : location.pathname !== "/login" ? (
              <Link className="secondary" to="/login">
                {t("Sign in")}
              </Link>
            ) : null}
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
              path="/services/categories/:categoryId"
              element={<CategoryItems />}
            />
            <Route path="/book" element={<BookingEntry />} />
            <Route
              path="/services/appliances/:applianceId"
              element={<ApplianceServices />}
            />
            <Route
              path="/services/:id"
              element={<Navigate to="/services" replace />}
            />
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
      {location.pathname !== "/login" && (
        <nav className="bottom-nav" aria-label="Mobile navigation">
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink
              to={to}
              key={to}
              end={to === "/"}
              className={({ isActive }) =>
                `${isActive || (to === "/book" && location.pathname.startsWith("/request/")) || (to === "/bookings" && location.pathname.startsWith("/requests")) ? "active" : ""} ${to === "/book" ? "nav-book" : ""}`
              }
            >
              <span className={to === "/book" ? "nav-book-circle" : "nav-icon"}>
                <Icon aria-hidden="true" />
              </span>
              <span>{t(label)}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </>
  );
}
function Home() {
  const banner = useHomeBanner();
  const config = useGoogleConfiguration();
  const adminPhone = contactPhone(config.data?.adminOfficePhone);
  const profile = useProfile(),
    requests = useRequests(!!profile.data),
    [, setDraftVersion] = useState(0);
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
    <div className="home-page section" aria-label="Home">
      <CatalogueSearch />
      <div className="home-showcase">
        <section className="home-promo" aria-label="Appliance care at home">
          <div className="home-promo-copy">
            <p className="home-promo-eyebrow">We fit it. We fix it.</p>
            <h1 className="home-promo-title">
              {banner.data?.headline || "Your Home, Our Expertise"}
            </h1>
            <p className="home-promo-description">
              {banner.data?.description ||
                "Appliance repairs, installations & home maintenance made simple."}
            </p>
            <Link className="home-promo-cta" to="/services">
              {banner.data?.cta || "Explore Services"}{" "}
              <FaArrowRight aria-hidden="true" />
            </Link>
          </div>
          <div className="v6-hero-art" aria-hidden="true">
            <img
              className="home-hero-composition"
              src={
                catalogueImageUrl(banner.data?.icon_url) ||
                "/banners/v8/appliance-family.webp"
              }
              alt=""
              width={800}
              height={900}
              decoding="async"
              fetchPriority="high"
            />
          </div>
        </section>
        <p className="home-banner-secondary">
          {banner.data?.secondary ||
            "Trusted Professionals • Easy Booking • Quick Response"}
        </p>
        <div className="home-benefits" aria-label="Our service promise">
          {[
            ["Verified Technicians", FaShieldHalved],
            ["Quick Response", FaBolt],
            ["Transparent Process", FaTag],
            ["Quality Services", FaAward],
          ].map(([label, Icon]) => (
            <div key={String(label)}>
              <span className="home-benefit-icon">
                {typeof Icon !== "string" && Icon && (
                  <Icon aria-hidden="true" />
                )}
              </span>
              <span>{String(label)}</span>
            </div>
          ))}
        </div>
      </div>
      <ServiceDiscovery compact />
      {adminPhone && (
        <a className="secondary home-call-admin" href={`tel:${adminPhone}`}>
          <FaPhone aria-hidden="true" /> Call Admin
        </a>
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
      <Link className="home-support-note" to="/support">
        <span className="home-support-note-icon">
          <FaHeadset aria-hidden="true" />
        </span>
        <span>
          <strong>A little help goes a long way.</strong>
          <small>Questions about your appliance or request? We're here.</small>
        </span>
        <FaArrowRight aria-hidden="true" />
      </Link>
    </div>
  );
}
function Protected({ children }: { children: ReactNode }) {
  const location = useLocation();
  const query = useProfile();
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
    const requestsPage = /^\/(bookings|requests)(\/|$)/.test(location.pathname);
    return (
      <AccountAccessState
        label={requestsPage ? "My Requests" : "Your account"}
        title={
          requestsPage
            ? "Your requests, all together"
            : "Sign in to your account"
        }
        description={
          requestsPage
            ? "Sign in to view your bookings, track visits and get updates."
            : "Sign in to manage your profile and saved details."
        }
        unauthorized={unauthorized}
        retry={() => query.refetch()}
        pending={query.isFetching}
      />
    );
  }
  return children;
}
function Services() {
  return <ServiceDiscovery />;
}
function BookingEntry() {
  return (
    <section className="section page booking-entry">
      <div className="page-heading">
        <div>
          <span className="eyebrow">LET’S GET IT SORTED</span>
          <h1>Book a visit</h1>
          <p>What can we help with?</p>
        </div>
      </div>
      <div className="booking-entry-grid">
        {[
          {
            to: "/request/service",
            title: "Service Request",
            description: "Service or repair an appliance in your home.",
            icon: FaScrewdriverWrench,
          },
          {
            to: "/request/installation",
            title: "Installation Request",
            description: "Request help setting up your appliance.",
            icon: FaToolbox,
          },
        ].map(({ to, title, description, icon: Icon }) => (
          <Link className="record-card booking-entry-card" key={to} to={to}>
            <span className="home-quick-icon">
              <Icon aria-hidden="true" />
            </span>
            <h2>{title}</h2>
            <p>{description}</p>
            <span className="text-button">
              Choose appliance <FaArrowRight aria-hidden="true" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
