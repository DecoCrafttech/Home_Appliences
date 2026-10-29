# Home Services

Three separate React PWAs share one Express API and one Neon PostgreSQL booking/workflow model. This is a development platform; production provider setup and deployment require separate verification.

The [25 October redesign completion report](docs/REDESIGN_COMPLETION_REPORT.md) records the current UI changes, measured API reductions, real workflow verification, responsive screenshots and remaining deployment limits.

## Run locally

Use Node.js 24 and npm. From this workspace:

```sh
npm install
npm run dev
```

On Windows, use `npm.cmd` if PowerShell script execution is blocked.

| Application | Local URL                           | Workspace             |
| ----------- | ----------------------------------- | --------------------- |
| Customer    | http://localhost:5173               | `apps/customer-pwa`   |
| Admin       | http://127.0.0.1:5174               | `apps/admin-pwa`      |
| Technician  | http://127.0.0.1:5175/technician    | `apps/technician-pwa` |
| API health  | http://localhost:3001/api/v1/health | `backend`             |
| API/database readiness | http://localhost:3001/api/v1/ready | `backend` |

`/health` checks that the API process is responding. `/ready` runs a database query and returns 503 when the database cannot be reached. Check readiness when the app opens but catalogue or account data fails to load. On Windows, backend initialization prefers IPv4 and disables automatic address-family selection to avoid database connection timeouts on the local network.

Old admin `/technician` URLs redirect to the independent technician origin. Copy `apps/admin-pwa/.env.example` when overriding `VITE_TECHNICIAN_ORIGIN`. All three clients use a same-origin `/api` proxy; configure HTTPS proxies separately for production hosting.

Backend configuration is documented in `backend/.env.example`. Keep Neon, storage, signing and MFA secrets server-side. Do not put backend secrets in `VITE_*` variables. Start backend commands from `backend` or use its workspace scripts so environment resolution is correct.

## Workflow

Customers sign in with Google, discover published services/options and indicative INR prices, and submit service/installation requests through the four-stage booking wizard. Operations review requests and send assignment offers through the shared searchable drawer or by selecting a technician in the status override. Manual status assignment does not require skill matching, but still sends an offer that the technician must accept before customer contact details are revealed or owned job work begins. Additional estimates require customer decisions. Technicians submit immutable work reports and can mark a job complete only when the latest report is resolved and no estimate is awaiting a customer decision. Completion records the technician as the status actor and is visible in the admin request timeline and Completed Requests. Operations can request report corrections before completion. Customers can then submit one review, visible in admin Feedback.

Assignments, booking status, work-report sign-off, payments and review state remain separate. Existing contact-only technicians retain their audited manual completion flow. Private object uploads use short-lived ownership-checked access. Email delivery is not active; secure technician activation/recovery links are created by operations for manual delivery. Production staff MFA delivery remains an external setup dependency.

Authorized operations administrators also have an explicit status override modal, including confirmed reopening of final requests. When setting Technician Assigned manually, operations select a verified technician with an active account from the full list without skill matching; this creates a pending offer in My Jobs and does not fabricate technician acceptance or work reports. Overrides require reasons and version checks and record a separate administrative audit. Manual completion requires a verified completion note. Existing completion and review history is preserved. Replaced pending offers are withdrawn with notice; cancellation revokes assignment/contact access.

The Customer Services tab opens an appliance grid, then appliance-specific published services and a prefilled booking. Appliance icons/visibility and service options/prices are managed in Admin. Multiple selected options retain booking-time price snapshots. Admin and accepted technician views use booking contact numbers, with profile fallback; pending offers do not reveal phone numbers or full addresses.

## Current UI structure

Customer has Home, Services, My Requests and Profile. Support, addresses, reviews and security live under Profile. Admin uses one Requests view for service and installation, a separate Completed Requests view, and an Appointments calendar. Technician has Home, My Jobs, Schedule and Profile. Old request/history/notification URLs remain compatible without redundant primary navigation.

Admin publishes selectable problems/installation options with paise-based indicative pricing, preserves existing custom booking questions and can upload validated SVG/raster icons to the existing object storage. Drafts are excluded from public catalogue responses. Bookings retain their price snapshot when the published price changes.

Technician creation can provision a unique username and a hashed temporary password. A temporary session can only read identity, change its password or sign out. Suspension revokes sessions; removal is a soft archive and rejects current jobs/offers. Existing email-based technician sign-in and single-use manual activation/recovery links remain supported.

Admin and Technician calendars support Day, Week, Month and Agenda, with India time and a direct date selector. A technician proposal leaves the confirmed appointment unchanged until authorized approval passes version, availability and overlap checks. Admin drag changes revert visually and open confirmation; only a successful backend write updates the calendar. Calendar code is loaded only on calendar routes.

## Shared code and duplicate protection

`packages/shared` contains Zod contracts and canonical status presentation. `packages/ui` contains shared design primitives, icons, dialogs, async buttons, mutation guards and API protection.

Authenticated business writes use transactional idempotency and payload checks. Clients send `Idempotency-Key`; booking keys also live on the booking. A retry returns its committed result, while changed details cannot reuse a key. Request versions and existing database constraints prevent contradictory assignments, appointments, reports and reviews. See `docs/DUPLICATE_ACTION_AUDIT.md` for retention, retry rules and dedicated auth/upload lifecycles.

All three persisted notification inboxes open in responsive header dialogs and load on demand. Unread badges use complete owner-scoped counts; Mark all as read uses a server snapshot and also covers older records. Customer requests, details, timelines and estimates load on opening/reload or explicit actions, with manual Refresh controls and no polling or focus/reconnect fetching (see docs/CUSTOMER_REQUEST_FETCH.md). Admin/Technician request/job updates keep their independent refresh policies; they do not rely on inbox polling. No private API data is cached by the service workers.

Notification, request and technician job/assignment endpoints bypass the shared API rate limit, including their nested actions. Admin dashboard summary/activity/allocation and GET auth/me also bypass that quota. Authentication limits and authorization remain enforced. See [rate-limit verification](docs/RATE_LIMIT_CHANGE.md).

## Database changes

Development migration and audit commands refuse to run outside the configured isolated development branch:

```sh
cd backend
npx tsx src/workflowMigrate.ts
npx tsx src/workflowAudit.ts
```

Migrations 0015-0017 add replay results, staff notification/read state, related-record links and booking payload hashes. Migrations 0018-0020 add sequence-backed display references, catalogue publication/options/media, stable technician usernames with a first-login password gate, and reviewed appointment reschedule proposals. Migrations 0021-0022 add administrative override history and appliance icons/publication. Migration 0023 records technician completion as a separate auditable actor. No production migration or automatic historical duplicate deletion is performed. Existing migrations and business data are preserved.

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run test:browser
```

Build output is in each application's `dist` and `backend/dist`. The backend uses the shared workspace TypeScript package; use the existing TSX runtime/loader or package the shared code appropriately when deploying compiled backend output.

For built-PWA checks, start local previews on ports 5183, 5184 and 5185 and run `node scripts/check-pwa.mjs`. Alternatively set `PWA_CUSTOMER_ORIGIN`, `PWA_ADMIN_ORIGIN` and `PWA_TECHNICIAN_ORIGIN` to the three preview origins. This checks manifests, Chrome installability, service workers, offline shells and private-cache exclusion, not installation on a physical device.

See [administrative status overrides](docs/STATUS_OVERRIDE_REPORT.md), [appliance-first booking and contact access](docs/CUSTOMER_SERVICE_FLOW.md), [UI redesign progress](docs/UI_REDESIGN_PROGRESS.md), [navigation structure](docs/FINAL_NAVIGATION_STRUCTURE.md), [workflow redesign](docs/WORKFLOW_REDESIGN.md), [workflow progress](docs/WORKFLOW_PROGRESS.md), [three-PWA verification](docs/THREE_PWA_SYNC_TEST.md) and [final test report](docs/FINAL_TEST_REPORT.md) for actual results and remaining environment limits. Older reports describe earlier development stages.
#   h a _ A p p l i c a t i o n  
 