import { OfflineBanner, NavigationScroll } from "@home/ui";
import { retryTransientRequest } from "@home/ui";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppErrorBoundary } from "@home/ui";
import { TechnicianApp } from "./TechnicianApp";
import { ToastProvider } from "./components";
import { PwaUpdate } from "./PwaUpdate";
import "./styles.css";
import "@home/ui/platform.css";
import "@home/ui/styles.css";
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
          <Routes>
            <Route path="/technician/*" element={<TechnicianApp />} />
            <Route path="*" element={<Navigate to="/technician" replace />} />
          </Routes>
        </AppErrorBoundary>
        <ToastProvider />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
