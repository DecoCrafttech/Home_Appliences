# UX audit and implemented changes

Updated 22 October 2026. Scope: existing customer, operations and technician workflows; no replacement booking system.

## Findings and repairs

| Finding                                                                       | Implemented repair                                                                                                                                                                                                                                               |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Technician UI was mounted inside admin; only two builds existed               | Independent `apps/technician-pwa` workspace, entry point, routing, manifest, service worker and port 5175. Admin keeps a compatibility redirect for old technician links.                                                                                        |
| Two assignment mechanisms in request details                                  | One `AssignTechnicianDrawer`, shared by service and installation listings and details. The old inline form and manual managed-account assignment dropdown were removed.                                                                                          |
| No search in eligible technician selection                                    | Search by actual name, full Technician ID or skill; verified eligible accounts only; mandatory availability, skill and area constraints remain visible.                                                                                                          |
| Eligibility failures were opaque                                              | Read-only explanations for excluded verified technicians, including account access, skills, service area, leave, working hours and conflicts.                                                                                                                    |
| Assignment cards lacked operational context                                   | Request/customer/appliance/visit/area summary, initials avatar, skills, area, actual scheduled open workload and genuine review average when present. Sort is open scheduled workload ascending, then name. No fabricated distance, ETA or recommendation label. |
| Mutations could repeat before React rerendered                                | Capture-phase event locks, synchronous safe mutation guard, shared API in-flight coalescing and server transactions/idempotency.                                                                                                                                 |
| Loading behavior differed across forms                                        | Shared `AsyncActionButton`, inline spinner, pending labels, preserved button width, conflicting-control blocking and native modal focus handling. See `mutation-button-coverage.json`.                                                                           |
| Global search duplicated listing search                                       | Removed the header search; each listing retains its own search and filter toolbar.                                                                                                                                                                               |
| Service table repeated appliance/problem information                          | Combined appliance and work into one column; primary row action is View Details, secondary actions are in one menu.                                                                                                                                              |
| Raw system-status dropdown obscured next steps                                | Shared `WorkflowActions`: review, customer contact, assignment, appointment confirmation, rescheduling, hold and cancellation according to canonical transitions. Technician progress remains technician-owned in the normal UI.                                 |
| Detail pages repeated customer/address data and competing assignment controls | One summary, one customer/address section, one appointment/technician section, expandable appliance requirements, contextual next actions, timeline and completion/feedback.                                                                                     |
| Managed-technician completion could bypass explicit report review             | Technician reports stay separate from booking status. Managed assignments must use work-report review to complete. The existing audited manual completion form remains for contact-only technicians with no technician-app assignment.                           |
| Admin notifications were a device-local view of audit logs                    | A persisted, staff-scoped inbox with ownership-checked read state and related-record links. Reports remain a separate screen.                                                                                                                                    |
| Notification polling and duplicate observers                                  | No notification polling in any PWA. User-scoped caches, explicit refresh, fresh page-open fetch and bell fetch; local business mutations invalidate notification data.                                                                                           |

## Design and architecture

`@home/ui` owns shared action controls, confirmation dialogs, icons, operations design primitives and styles. The customer app retains its existing presentation and Google Sign-In. Shared Zod workflow contracts keep booking, assignment, report and notification states distinct. React Hook Form/Zod validates technician selection. Sonner remains the feedback system.

The admin navigation uses unique grouped links for requests, people, customer experience and system settings. Existing catalogue and reports functionality is preserved. No Email Logs or email preference workflow was present to remove.

## Visual verification

Required widths: 360, 390, 768 and 1440 pixels. Browser coverage includes customer routes, admin navigation/listings/details, assignment drawer overflow and focus return, technician views, and loaded-state screenshots. Final results are recorded in `FINAL_TEST_REPORT.md`; screenshots are copied to `docs/screenshots` after the final browser run.


## New restructuring audit ? 22 October 2026

These decisions supersede the previous screen layout; the earlier repairs above describe the preceding revision.

| Existing screen/routes | Decision | Current gap / intended outcome |
| --- | --- | --- |
| Customer Home | REDESIGN | Oversized hero and repeated entry cards; compact greeting, published services and active request preview |
| Customer Services | REDESIGN | Appliance cards instead of selectable published catalogue; searchable type/category discovery with indicative prices |
| Booking wizard, service + installation | KEEP / REDESIGN | Preserve real four stages and backend validation; improve selected option prices and explicit leave/save/discard behavior |
| My Requests and Request Details | KEEP / REDESIGN | Preserve independent fetching, actual timeline/review; consistent back/location/reference controls |
| Customer Profile | REDESIGN | Move support here; retain Google identity, addresses, reviews and security |
| Customer Addresses, Reviews, Support and Login | KEEP / RELOCATE | Existing working flows retained under Profile; consistent nested Back |
| Admin Dashboard | REDESIGN | Compact KPIs; replace request distribution with real allocation; one attention queue |
| Service Requests + Installation Requests + general requests | MERGE | One Requests route with server filters/sorting/pagination and exact compact columns; legacy route redirects |
| Completed Requests | KEEP / REDESIGN | Shared data and filters; historical completion and feedback actions |
| Appointments | REDESIGN | Current table is not a calendar; functional day/week/month/list with validated rescheduling |
| Admin Customers list | KEEP | Small spacing/search improvements only |
| Customer Details | REDESIGN | Structured identity, metrics, addresses, linked request/review/support history |
| Technicians list/editor | KEEP / REDESIGN | Add stable username and temporary credential setup; safe account lifecycle inside details |
| Technician accounts/completion workflow section | RELOCATE | Account controls into technician details; report approval into Request Details; remove mixed global section |
| Catalogue | REDESIGN | One service/installation editor with publish state, options, paise prices and sanitized media |
| Feedback and Support | KEEP | Preserve authorized moderation/conversations; shared visual controls |
| Reports | RELOCATE | Retain useful report export as a Settings secondary link |
| Settings, staff Login and MFA | KEEP | Preserve security and working forms |
| All three Notifications pages | MERGE / REMOVE | Replace list pages with the same accessible header dialog; keep persisted scoped records and bookmark compatibility |
| Technician Home | REDESIGN | Compact workday summary and one next actionable job |
| Technician Jobs / history filters | MERGE | One My Jobs view with compact grouping/filter rather than redundant subnavigation |
| Technician Job Details | REDESIGN | Essential customer requirement/contact/location/schedule and one current action; advanced reporting only when needed |
| Technician Schedule | REDESIGN | Actual responsive calendar; proposals require admin decision |
| Technician Profile, login/activation/reset | KEEP / REDESIGN | Preserve identity/uploads/MFA; add username and mandatory temporary-password change |
| Technician earnings/support placeholder routes | REMOVE / RELOCATE | No empty primary destinations; job-linked help remains contextual |

The source audit found separate icon packs, inconsistent badges, duplicate notification-page observers, redundant legacy navigation, and missing calendar, option-pricing and temporary-credential workflows. These gaps are addressed in the current revision. Existing transactional idempotency, actor scoping and independent request/job queries are retained. Current verification is recorded in FINAL_TEST_REPORT.md.
