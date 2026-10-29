import { icons } from "@home/ui/icons";
export { icons };
export const navigation = [
  {
    group: "Daily work",
    items: [
      { to: "/", label: "Dashboard", icon: icons.dashboard },
      { to: "/requests", label: "Requests", icon: icons.service },
      { to: "/appointments", label: "Appointments", icon: icons.calendar },
      { to: "/technicians", label: "Technicians", icon: icons.technicians },
    ],
  },
  {
    group: "Customer care",
    items: [
      { to: "/customers", label: "Customers", icon: icons.customers },
      { to: "/support", label: "Support", icon: icons.support },
      { to: "/feedback", label: "Feedback", icon: icons.star },
    ],
  },
  {
    group: "Manage",
    items: [
      {
        to: "/completed-requests",
        label: "Completed Requests",
        icon: icons.success,
      },
      {
        to: "/catalogue",
        label: "Services & Installations",
        icon: icons.catalogue,
      },
      { to: "/settings", label: "Settings", icon: icons.settings },
    ],
  },
];
export const adminKeys = {
  me: ["admin-me"] as const,
  requests: ["admin-requests"] as const,
  request: (id: string | undefined) => ["admin-request", id] as const,
  summary: ["summary"] as const,
  operations: ["operations"] as const,
  technicians: ["technicians"] as const,
  customers: ["admin-customers"] as const,
  customer: (id: string | undefined) => ["admin-customer", id] as const,
  customerDetails: ["admin-customer"] as const,
  catalogue: ["admin-catalogue"] as const,
  dashboardActivity: ["dashboard-activity"] as const,
  feedbackDetail: (id: string | undefined) => ["feedback-detail", id] as const,
  ticket: (id: string) => ["admin-ticket", id] as const,
  feedback: ["feedback"] as const,
  feedbackSummary: ["feedback-summary"] as const,
  tickets: ["admin-tickets"] as const,
};
