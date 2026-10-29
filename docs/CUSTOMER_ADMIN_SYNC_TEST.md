# Customer/admin synchronization verification

Validation date: 2026-10-22 (Asia/Calcutta). Implementation began 2026-10-21.

Design findings: [ADMIN_UI_UX_AUDIT.md](ADMIN_UI_UX_AUDIT.md). Implementation log: [ADMIN_REDESIGN_PROGRESS.md](ADMIN_REDESIGN_PROGRESS.md).

Both PWAs use the existing Express API and the same isolated Neon development branch: `codex-customer-dev` (`br-gentle-wind-b4tsvt43`). No production migration or destructive production test was performed. The new integration/browser fixtures check this branch before creating temporary records.

## Current verification

| Check | Result | Evidence |
| --- | --- | --- |
| Backend/shared tests | PASS | 51 tests across 11 files, including the new refinement integration suite |
| Browser suite | PASS | Full 31-test run passed; 3 additional admin control tests passed separately (34 unique tests total) |
| Export/profile/editor controls | PASS | Downloaded CSV matches fetched counts; profile update refreshes identity; password mismatch sends no mutation; rejected password retains input; technician metadata/editor/archive confirmation tested |
| TypeScript/build | PASS | Admin/customer type checks and Vite builds; backend TypeScript build |
| ESLint | PASS | Root lint command |
| Admin responsive checks | PASS | 360, 390, 768, 1024 and 1440px; dashboard, both request types, completed, appointments, customers, technicians, catalogue, feedback/detail, support, reports, inbox and settings |
| Navigation/actions | PASS | 13 unique sidebar links with FA6 icons, one active state, collapse/expand, mobile close-on-navigation, working profile/settings links, filter requests and refresh |
| Completion interaction | PASS | Cancel sends no mutation; failed server response preserves summary; success requires a real success response |
| Customer booking regression | PASS | Draft/default address, failed submission, repeat request, location fallback, reminder/review, support reference, responsive/Tamil screens |
| Full real SERVICE journey | PASS | Real request status/assignment, completion/review and two-way support after refresh |
| Full real INSTALLATION journey | PASS | Same complete journey using installation records |
| Concurrent appointment conflicts | PASS | One of two overlapping confirmations returns 409; adjacent time slots remain valid; losing update does not consume its version |
| Technician availability/metadata | PASS | Real create/edit; unavailable assignment rejected; assigned details appear in owned customer request API |
| Pricing/catalogue | PASS | Indicative price persisted and returned by the customer catalogue endpoint; final charges remain separate |
| Support ownership/private notes | PASS | Real DB replies and notes; other customer receives 404; customer cannot create/read internal notes; only public staff replies notify customer |
| Support search/pagination | PASS | Server search by ticket/customer/request, validated pagination and status filter; customer history can open a specific ticket directly |
| Staff profile/password | PASS | Profile persists; current password verified; replacement hashed; other sessions revoked while current session remains usable |
| Review integrity | PASS | Completed/owned requests only, unique review, rating 1-5, immutable customer rating/comment in staff handling |
| Production PWA checks | PASS | Both manifests, service workers, Chrome installability criteria and offline shell; no private API cache; API unavailable offline |
| Native OS installation | NOT TESTED | Chrome installability checked in a fresh persistent profile; no OS installation performed |
| Live Google consent | BLOCKED | Existing Google Cloud authorized-origin setup is account-side work; application Google/session failure paths are browser-tested with isolated fixtures |
| Production MFA delivery | BLOCKED | Provider setup remains required; existing development MFA behavior retained |
| Completion attachment upload | NOT IMPLEMENTED | Optional feature; no fake upload control; nonempty completion attachment IDs are explicitly rejected |

## What the real browser journeys verify

A temporary customer and staff session are created on the verified development branch. The customer books through the actual four-step form. Admin search finds the same human-readable customer reference and request number. Real API transitions move the request through review, technician assignment and appointment/work progress. Customer request details display Under review and the actual assigned technician. The admin uses the shared completion modal; the saved work summary and timestamp appear in the customer request. The customer submits one rating/review. Admin completed requests and feedback show that same record. Staff notes and handling changes persist without changing the customer rating.

The same journey creates a customer support ticket linked to the request. Staff send a public reply and a private internal note. After reload, the customer sees the public reply and never sees the private note. The customer replies, and the admin reads that reply after a separate browser refresh. Both service and installation journeys use real HTTP endpoints/database records. Session identities are test fixtures; they do not bypass production Google verification code.

## State and synchronization behavior

- Both PWAs use shared request transitions/status presentation and centralized query keys for their own caches.
- An admin cache invalidation does not update another browser. Customer request pages refetch on opening/focus and poll active work; terminal request polling stops. Lists/support conversations/inboxes refresh at appropriate intervals.
- Completion updates are persisted before any success toast. Report, completion timestamp, previous/new status event, actor/audit and customer notification remain atomic and duplicate-safe.
- Admin request mutations invalidate details, lists, technician counts, customer aggregates, dashboard and activity. Feedback handling also refreshes affected summaries/customer history.
- Support conversations are owned on customer endpoints, staff-authorized on admin endpoints, and filtered for PUBLIC visibility on the server. Customer private caches, including conversation keys, are cleared on account change/logout.
- Catalogue indicative pricing is shared through the existing catalogue API. No payment/revenue data is invented.
- Admin inbox read position and compact-table/sidebar preferences are device-local settings, explicitly described in the UI. They are not cross-device notification acknowledgements or push delivery.

## Controls audited

| Module | Functional controls and persistence |
| --- | --- |
| Shared layout | Router links, desktop collapse/mobile drawer, global request search, notifications link, profile/security navigation, authenticated logout |
| Dashboard | Actual KPI/detail links, database trend/distribution, recent/awaiting-action request links, operational alert navigation |
| Requests | One search/filter/refresh toolbar, server pagination/type/status/appliance/date/technician/rating filters; eligible assignment/status actions and one shared completion modal |
| Request detail | Owned customer/contact/address/schedule, real technician selection, versioned status form, terminal-state protection, completion report, timeline and linked support history |
| Customers | Reference/name/email/phone search, real photo or initials, request counts, profile/addresses/type-specific request/review/support histories |
| Technicians | Add/edit/verify/availability fields; assignment count; archive confirmation preserves past assignments; role checks and server validation |
| Catalogue | Service/form create/edit/archive, custom-field validation and saved indicative pricing; historical requests preserved |
| Feedback | Four selected live metrics, server search/filter/pagination, linked details/customer/request; private notes, handling history and idempotent support follow-up |
| Support | Server search/status/pagination, linked customer/request, status mutation, public reply/private note distinction, customer-visible conversation and reply |
| Reports/inbox | Database counts, CSV export from fetched totals, actual audit feed and explicit device-local read marker |
| Settings | Current account display, persisted name update, verified password rotation and local compact display preference |
| PWA | Separate app names/origins, standalone manifests/icons, service workers, update action, static offline shell without authenticated API caching |

## Commands and artifacts

```text
npm run typecheck
npm run lint
npm test
npm run test:browser
npm run build
node scripts/check-pwa.mjs
```

PWA verification requires built admin preview on `127.0.0.1:5184` and customer preview on `localhost:5183`. Temporary previews are stopped after verification; requested development platforms remain running on 5173/5174/3001.

Screenshots: the full generated set is under ignored `test-results/screenshots`; selected final evidence is copied to `docs/screenshots`. Production builds pass with Vite bundle-size advisories; route splitting remains a performance improvement.

## Final implementation notes

The support table now searches/paginates on the server instead of filtering only the latest cached tickets. Direct ticket links fetch their actual conversation even when the record is outside the current list page. Completion remains one action per eligible request, and terminal requests expose history/report rather than an empty editable status form. Staff/customer conversation visibility is enforced by the API, not only hidden by the interface.

The three extra control tests use isolated browser transport fixtures to inspect actual UI actions. Their server persistence/security paths are separately tested against the development Neon database. No production/live API was replaced by fixtures.

## Screenshots and final smoke check

The final admin visual pass generates 81 screenshots across the five requested widths and the completion modal. Twenty-three selected screenshots are saved in `docs/screenshots/admin-refinement`, including [desktop dashboard](screenshots/admin-refinement/admin-dashboard-1440.png), [service requests](screenshots/admin-refinement/admin-service-requests-1440.png), [mobile installation](screenshots/admin-refinement/admin-installation-requests-390.png), [mobile completed work](screenshots/admin-refinement/admin-completed-requests-360.png) and [mobile settings](screenshots/admin-refinement/admin-settings-390.png). Screens were visually inspected for alignment, navigation, icon consistency, controls and overflow. A final mobile Settings icon/title alignment issue was corrected.

The final fixture check found zero temporary lifecycle/aftercare/refinement/admin-test customer records. Customer (5173), admin (5174) and API health (3001) returned HTTP 200. Development platforms remain running. Temporary production previews are stopped after verification. Existing Google Cloud origin setup, production MFA delivery, optional completion uploads and native OS installation remain the limits described above.
