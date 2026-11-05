import { OfflineBanner, NavigationScroll, LaunchExperience } from "@home/ui";
import { customerKeys } from "./lib/queryKeys";
import { retryTransientRequest } from "@home/ui";
import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import { useCustomerProfile } from "./lib/profile";
import "./styles.css";
import "@home/ui/styles.css";
import "./fixbeez.css";
import "./home.css";
import "./v6.css";
import { AppErrorBoundary } from "@home/ui";
import { ToastProvider } from "@home/ui/widgets";
import { CustomerGoogleProvider } from "./lib/googleAuth";
import { PwaUpdate } from "./components/PwaUpdate";
const client = new QueryClient({
  defaultOptions: {
    queries: { retry: retryTransientRequest, refetchOnWindowFocus: true },
  },
});
client.setQueryDefaults(customerKeys.profile, {
  staleTime: 300_000,
  retry: false,
});
function CustomerStartup() {
  const profile = useCustomerProfile();
  const [sessionResolved, setSessionResolved] = React.useState(false);
  React.useEffect(() => {
    if (!profile.isPending) setSessionResolved(true);
  }, [profile.isPending]);
  return (
    <LaunchExperience
      role="customer"
      ready={sessionResolved || !profile.isPending}
    >
      <App />
    </LaunchExperience>
  );
}
const router = createBrowserRouter([
  {
    path: "*",
    element: (
      <>
        <OfflineBanner />
        <PwaUpdate />
        <NavigationScroll />
        <AppErrorBoundary>
          <CustomerStartup />
        </AppErrorBoundary>
        <ToastProvider />
      </>
    ),
  },
]);
if (window.location.hostname === "127.0.0.1") {
  const canonical = new URL(window.location.href);
  canonical.hostname = "localhost";
  window.location.replace(canonical);
} else {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <QueryClientProvider client={client}>
        <CustomerGoogleProvider>
          <RouterProvider router={router} />
        </CustomerGoogleProvider>
      </QueryClientProvider>
    </React.StrictMode>,
  );
}

import "@home/ui/refinements.css";
import "./refinements.css";
import "./mobile-layout.css";
import "./catalogue.css";
