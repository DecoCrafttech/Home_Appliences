import { OfflineBanner, NavigationScroll } from "@home/ui";
import { customerKeys } from "./lib/queryKeys";
import { retryTransientRequest } from "@home/ui";
import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import "./styles.css";
import "@home/ui/styles.css";
import { AppErrorBoundary } from "@home/ui";
import { ToastProvider } from "@home/ui/widgets";
import { CustomerGoogleProvider } from "./lib/googleAuth";
const client = new QueryClient({
  defaultOptions: {
    queries: { retry: retryTransientRequest, refetchOnWindowFocus: true },
  },
});
client.setQueryDefaults(customerKeys.profile, {
  staleTime: 300_000,
  retry: false,
});
const router = createBrowserRouter([
  {
    path: "*",
    element: (
      <>
        <OfflineBanner />
        <NavigationScroll />
        <AppErrorBoundary>
          <App />
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
