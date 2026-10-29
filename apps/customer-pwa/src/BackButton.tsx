import { useLocation } from "react-router-dom";
import { AppBackButton } from "@home/ui";
export function BackButton() {
  const location = useLocation();
  if (
    [
      "/",
      "/services",
      "/bookings",
      "/requests",
      "/profile",
      "/login",
      "/notifications",
    ].includes(location.pathname)
  )
    return null;
  const fallback =
    location.pathname.startsWith("/services/") ||
    location.pathname.startsWith("/request/")
      ? "/services"
      : location.pathname.startsWith("/requests/")
        ? "/bookings"
        : "/profile";
  return (
    <div className="customer-back">
      <AppBackButton fallback={fallback}>
        {location.pathname.startsWith("/request/")
          ? "Back to services"
          : "Back"}
      </AppBackButton>
    </div>
  );
}
