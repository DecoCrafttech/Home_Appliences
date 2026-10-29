# Purple UI and interaction essentials

26 October 2026. Applied directly to the existing Customer, Admin and Technician apps. The shared [design system](DESIGN_SYSTEM.md) replaces the earlier blue baseline. Routes, authentication, request APIs, historical prices and backend workflow rules remain.

## Delivered changes

| Area                      | Implemented behavior                                                                                                                                                                                                                               |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared presentation       | Purple actions, peach accents, lavender backgrounds, white surfaces, consistent text/borders/focus, rounded controls and cards, readable metadata, coordinated PWA icons and theme colours                                                         |
| Customer                  | Compact published appliance discovery, aligned service cards with real INR prices, image fallbacks, four-stage booking with a mobile sticky action, shared dialogs, greeting/profile/grid/detail skeletons, address/support empty states and retry |
| Admin                     | White sidebar, clear active navigation, compact metrics/tables, visible assignment/completion actions, eligible-technician skeleton rows, catalogue/customer/feedback loading layouts, calendar pending overlays                                   |
| Technician                | Three-column workday summary, simplified job/contact/work-report layout, aligned job actions, profile/job skeletons, protected completion and photo-upload validation                                                                              |
| Forms and actions         | Shared input/button primitives, password visibility, pending states, stable pending button widths, guarded address save/delete and catalogue publication confirmation                                                                              |
| Navigation                | Route error boundaries preserve navigation, new destinations open at the top, URL-backed admin and customer request filters survive detail navigation                                                                                              |
| Connectivity and feedback | Shared offline banner and Sonner provider, notification skeleton/error/retry and focus restoration, safe static-asset PWA caching                                                                                                                  |
| Data efficiency           | Debounced admin customer/support/feedback searches, shared catalogue/query caches, on-demand inboxes and unchanged business-critical refresh policy                                                                                                |

The specifically removed technician appliance-details, estimate-editor and contact-operations sections remain removed. Legacy estimates still enforce backend approval rules. Cards use published data and administrator media, with appliance-specific icon fallbacks. No invented discounts, reviews, popularity rankings, prices, technicians or jobs were introduced.

## Issues found and fixed

- Address/support failures previously rendered a login link even for valid sessions. They now distinguish expired sessions from retryable data failures and preserve entered form data.
- Mobile labels inherited old 9-11px rules. Shared and role styles now use captions of at least 12px, with larger primary labels and controls.
- Admin request filters previously reset on returning from details. Search, sort, dates, assignment filters and pagination now use URL state; text search stays debounced.
- Broken uploaded icons could leave an empty or broken image. Shared fallbacks preserve their slots, and avatars recover when the source URL changes.
- Address deletion and unpublishing were immediate. Both now require confirmation, preserve failures for explicit retry and retain duplicate-write guards.
- Catalogue edits could be lost when closing the drawer. Keep editing / Discard changes now protects those edits without stacked dialogs; browser unload is also guarded.
- Technician profile uploads now validate size/type before storage access and reset the input for retry.
- Empty-state headings inherited the panel's flex layout. They are now centered consistently with their icons.

## Verification

Browser fixtures use actual React components with controlled API responses for deterministic initial/slow/error/empty/offline scenarios. Live API lifecycle tests use isolated records with cleanup in the verified development Neon branch.

| Check | Result |
| --- | --- |
| Workspace TypeScript checks | Passed |
| Root ESLint | Passed |
| All application and backend builds | Passed; existing bundle-size advisory remains |
| Selected browser suites | 107 distinct deterministic checks passed across 16 files |
| Latest correction suite | 30 passed: admin layouts/filter combinations, customer forms/cards and API request counts |
| Latest UI-state suite | 21 passed: initial/slow/error/retry/offline states, contrast, password visibility, guarded confirmations, filter persistence, background refresh and reduced motion |
| Service search reset checks | 3 passed at 360, 768 and 1440px |
| SVG sanitization and request-policy unit tests | 18 passed |
| Real catalogue/customer/admin/technician lifecycle | Passed: upload icons, publish options, book, preserve historical prices, provision a username, accept assignment and approve rescheduling across calendars |
| Real technician SERVICE lifecycle | Passed: customer booking, assignment, progress, actual report/photo and guarded card completion |
| Built PWAs | All three passed manifest, service worker, Chrome installability, offline-shell and private API-cache checks |
| API readiness | Database connected |

Widths tested: **360, 390, 768, 1024 and 1440px**. The admin layout suite visits the major management pages at every width; the shared state suite exercises the principal customer, admin and technician data boundaries at all five widths. Real browser screenshots were inspected for loaded content and loading layouts.

The deterministic 61-second idle measurement remains Customer **4 initial / 0 idle / 1 on inbox open**, Admin **4 / 0 / 1**, Technician **3 / 0 / 1**. These are controlled virtual-time observations, not production telemetry. See [raw measurements](request-audit/after.json).

The first live catalogue run timed out finding the contact input. The traced rerun, with an explicit contact-step assertion, passed. No cause was established for that initial timeout. The mock-backed booking regression suite also passed after the final focus, validation and loading-guard changes. An intermediate admin filter test exposed a dropped URL parameter during fast successive changes; reading the current history parameters fixed it, and the complete admin layout suite then passed.

## Reviewed screenshots

All images below come from the actual application. Deterministic QA screens contain test fixtures; the booking/calendar captures use the isolated live development workflow.

| Screen | Phone | Desktop |
| --- | --- | --- |
| Customer Home | [390px](screenshots/purple-essentials/customer-home-390.png) | [1440px](screenshots/purple-essentials/customer-home-1440.png) |
| Services | [360px](screenshots/purple-essentials/customer-services-360.png) | [1440px](screenshots/purple-essentials/customer-services-1440.png) |
| Admin overview | [390px](screenshots/purple-essentials/admin-dashboard-390.png) | [1440px](screenshots/purple-essentials/admin-dashboard-1440.png) |
| Admin requests | [360px](screenshots/purple-essentials/admin-requests-360.png) | [1440px](screenshots/purple-essentials/admin-requests-1440.png) |
| Admin catalogue | [390px](screenshots/purple-essentials/admin-catalogue-390.png) | [1440px](screenshots/purple-essentials/admin-catalogue-1440.png) |
| Technician workday | [390px](screenshots/purple-essentials/tech-home-390.png) | [1440px](screenshots/purple-essentials/tech-home-1440.png) |
| Technician profile | [390px](screenshots/purple-essentials/tech-profile-390.png) | [1440px](screenshots/purple-essentials/tech-profile-1440.png) |
| Technician job | [360px](screenshots/purple-essentials/tech-job-360.png) | [1440px](screenshots/purple-essentials/tech-job-1440.png) |
| Customer initial loading | [390px](screenshots/purple-essentials/customer-loading-390.png) | [1440px](screenshots/purple-essentials/customer-loading-1440.png) |

Also saved: [live booking form](screenshots/purple-essentials/customer-booking-390.png), [admin calendar](screenshots/purple-essentials/real-admin-calendar.png), [technician calendar](screenshots/purple-essentials/real-technician-calendar.png), and [customer confirmed visit](screenshots/purple-essentials/real-customer-confirmed-request.png).

Database readiness was verified against project `snowy-hill-87120042`, branch `br-gentle-wind-b4tsvt43`. No production schema or authentication changes were made. The existing Vite large-chunk advisory remains; no Lighthouse score or production traffic claim is made.
