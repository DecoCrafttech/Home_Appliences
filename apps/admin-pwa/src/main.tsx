import { OfflineBanner, NavigationScroll } from "@home/ui";
import { retryTransientRequest } from "@home/ui";
import { PwaUpdate } from "./PwaUpdate";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "./components";
import { App } from "./App";
import "./styles.css";
import "@home/ui/styles.css";
import { AppErrorBoundary } from "@home/ui";
const client = new QueryClient({
  defaultOptions: {
    queries: {
      retry: retryTransientRequest,
      staleTime: 10000,
      refetchOnMount: true,
      refetchOnWindowFocus: "always",
    },
  },
});
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <OfflineBanner />
        <NavigationScroll />
        <PwaUpdate />
        <AppErrorBoundary>
          <App />
        </AppErrorBoundary>
        <ToastProvider />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
