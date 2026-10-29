# Admin UI/UX audit

2026-10-21. Existing application retained; authenticated Express/Neon APIs remain the source of truth.

| Page / component | Current problems | Retain | Consolidate / improve | Required backend interactions |
| --- | --- | --- | --- | --- |
| Layout/header/sidebar | Mixed Feather/text-only icons, flat navigation, duplicate combined/type request links, logout detached from profile | Responsive drawer, session protection, collapse preference | Shared grouped Font Awesome navigation, single header/profile menu; keep combined search as a route, not another sidebar item | Session restore/logout, request search |
| Dashboard | Generic iteration over every metric, welcome panel repeats purpose, no actionable recent work | Actual summary API | Six uniform KPI cards, real trend/distribution and recent/action lists | Summary, database aggregates and requests |
| Service / installation | Duplicate combined request table, all filters always expanded, actions form a vertical stack, repeated type column | TanStack Table/query, server filters, completion modal | One workspace/table, filter panel, compact action menu, mobile request cards | Search/pagination, assignment/status/version, completion |
| Completed / appointments | Shared data model already good; visual density and long action text | Filtered request query | Shared toolbar/status/pagination and distinct completed review status | Completion report, customer/review links, confirmed schedule |
| Request detail | Completion reachable twice; customer identity and work details lack section hierarchy; generic select includes completion | Versioned mutation and report/timeline | Single completion action, labeled status form, address/customer/schedule sections and linked support history | Detail, status, technician, report, events, tickets |
| Customers / customer detail | Missing image/count in list, verbose sign-in columns, ungrouped request types | Customer reference search, saved addresses and history | Avatar fallback, request count, concise contacts, split service/installation sections | Customer aggregate and owned data |
| Technicians | Add form permanently dominates list; missing metadata/edit/verification; schedule conflicts not enforced | Real technician IDs, archive and assignment | Consistent table/editor, persisted skills/area/availability/verification, assignment count; atomic scheduling safeguard | Technician CRUD, assignment, confirmed appointments |
| Catalogue/forms | Useful existing editor, delete has no confirmation, no pricing field | Dynamic form validation and archive preserving history | Shared actions/confirmation, optional real indicative pricing in existing module | Catalogue CRUD and customer catalogue |
| Feedback/detail | Six auto-generated metrics, unicode star/actions, review text too long in list | Immutable review, notes/handling/history/follow-up | Four purposeful KPIs, FA stars, truncated summaries, shared toolbar/actions | Reviews, metrics, notes, handling, support follow-up |
| Support | Full messages repeated in list; no conversation/reply/internal-note model | Owned tickets, staff status management | One management table + detail drawer, persistent public replies/private notes; customer thread | Ticket list/detail/messages/status, ownership/role checks |
| Inbox/reports/settings | Basic functional pages, inconsistent cards and no profile/security context | Database activity/totals and local display setting | Shared page components; real account/session details, functional profile menu; no placeholder pricing/report pages | Operations feed, auth/me, logout |
| Customer sync/PWA | Active and completed details poll identically; query keys repeated; support lacks thread | Shared API/DB/status transitions, focus refresh, static-only PWA cache | Central keys/status labels, terminal-state polling stop, ticket conversation sync | Owned requests/reviews/tickets and live database lifecycle |

Implementation follows this audit. No live API is replaced by mocks; browser fixtures are confined to tests. No new pricing navigation is added because service pricing belongs to the existing catalogue editor.

## Implemented resolution ? 2026-10-22

The planned consolidations are implemented in the actual application. Navigation has 13 unique icon-bearing links and one active state. Request lists share one workspace, a filter drawer, a row action disclosure and mobile cards; the old combined-table implementation was removed while its search route remains functional. Completion uses the shared confirmation shell and has a single eligible action in request details. Closed requests show history/report without editable lifecycle controls.

All new writes retain authenticated Express/Neon endpoints, role/ownership checks and truthful loading/error/success behavior. Technician overlap protection is a database constraint, customer/internal support visibility is filtered server-side, and staff profile/password changes are real persisted operations. Support lists use server search/pagination, and specific ticket links do not depend on the current list page. Shared status presentation and query-key definitions keep both apps aligned.

Visual checks cover all requested modules at 360/390/768/1024/1440px. Final evidence, test counts, separate app/PWA verification and external launch limits are recorded in [CUSTOMER_ADMIN_SYNC_TEST.md](CUSTOMER_ADMIN_SYNC_TEST.md). No replacement API or live mock data was introduced.
