# Admin redesign progress

2026-10-21. Refinement of the existing application; no replacement backend or live mock data.

- Audited all routes, shell, forms, tables, modals and synchronization. Findings: [ADMIN_UI_UX_AUDIT.md](ADMIN_UI_UX_AUDIT.md).
- Consolidated navigation into one FA6 icon configuration and grouped sidebar. Combined request search remains available without a duplicate sidebar entry.
- Extracted shared layout/header/sidebar, page header/toolbar, search/filter/date controls, cards, table wrapper, status badges, action menu, pagination, avatar, modal/drawer, feedback/loading/error states and toast provider.
- Replaced duplicated request tables with one service/installation/completed/appointment/global workspace. Added responsive mobile request cards and a filter drawer. Preserved real server filters and completion endpoint.
- Unified typography, controls, spacing and card/table/modal rules; removed the accumulated duplicate stylesheet overrides. Tailwind utilities remain scoped to prevent legacy class conflicts.
- Dashboard now shows six selected live KPIs, seven-day database trends, distribution, recent requests, awaiting-action work and actual alerts.
- Customer lists now show saved photos/fallback avatars and real request counts. Customer history separates service and installation requests. Request details group customer/contact/address/work/schedule/timeline/report and linked support history.
- Technician editor persists skills, service area, availability and verification. Assignment rejects unavailable technicians. A database exclusion constraint protects overlapping confirmed appointments, including concurrent mutations; adjacent visits remain allowed.
- Support uses one management table/detail conversation. Public replies and private staff notes persist separately; customer-owned conversation responses exclude all private notes. Customer replies and staff replies survive refresh.
- Added optional indicative service prices to the existing catalogue editor/API/customer choices. No duplicate pricing page and no invented final charges.
- Settings/profile menu now provides real profile update and password rotation. Rotation verifies the current password, hashes the replacement and revokes other staff sessions.
- Centralized major query keys in both PWAs and shared request status presentation. Mutations refresh related lists, details, KPIs and activity. Customer terminal request polling stops; focus refetch remains enabled.
- Additive migration `0011_admin_refinement.sql` applied only to verified `codex-customer-dev` / `br-gentle-wind-b4tsvt43`. There were no active scheduled requests before the new scheduling constraint was installed.
- Final verification (2026-10-22): all 51 backend/shared tests passed. The complete 31-test browser run and three additional control tests passed (34 unique tests total). Both real service/installation journeys include customer-visible status/technician/report/review and two-way support after refresh, with private notes excluded from customer responses. Root lint and all production builds passed. Both production PWAs passed Chrome installability, service-worker/offline and no-private-API-cache checks. Details: [CUSTOMER_ADMIN_SYNC_TEST.md](CUSTOMER_ADMIN_SYNC_TEST.md).
- Support search/status/pagination runs on the server; older tickets remain searchable and direct ticket history links load their conversation by ID.
- Added explicit accessible message-visibility labeling, guarded customer ticket submission, and account-change cleanup for conversation caches. The current layout has no duplicate request sidebar links, and all navigation uses the central FA6 mapping.

Known external launch setup remains Google Cloud authorized origins and production MFA delivery. Secure completion attachments remain optional and unavailable; unsupported attachment IDs continue to be rejected.
