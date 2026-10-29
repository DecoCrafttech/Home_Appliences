# Final navigation structure

Implemented for the October 2026 restructuring. Legacy bookmarked URLs remain safe redirects.

Customer Services now opens the appliance grid; `/services/appliances/:applianceId` shows that appliance's published services and `/services/:id` shows service details. The existing four-stage wizard receives the selection. Admin request rows, Actions menus and details use the same Change Request Status modal, including final-state overrides with confirmation.

| Application | Primary destinations | Secondary destinations |
| --- | --- | --- |
| Customer | Home, Services, My Requests, Profile | Saved Addresses, Reviews, Help & Support, Privacy/Security under Profile; booking and request details have Back controls |
| Admin | Dashboard; Requests, Completed Requests, Appointments; Customers, Technicians; Services & Installations; Help & Support, Feedback & Reviews; Settings | Reports accessible from Settings; account management inside technician details; completion review inside request details |
| Technician | Home, My Jobs, Schedule, Profile | Job details and reporting; security/availability under Profile |

Notifications use a single header bell and accessible responsive dialog in each application. They are absent from primary navigation. Old notification URLs open the same dialog, preserving bookmarks without maintaining a second inbox UI.

Admin mobile navigation uses the existing drawer with route-close, backdrop, Escape, focus trapping and body scroll locking. Customer and technician use four-item bottom navigation on mobile.
