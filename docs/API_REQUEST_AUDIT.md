# API request audit

26 October follow-up: the purple UI adds no initial Home requests. Admin customer, support and feedback text searches now share a 300ms debounce; admin request filters use URL state and retain their existing debounce. Notifications remain on demand. The refreshed raw measurements are in `request-audit/after.json`.

25 October 2026. Baseline and final endpoint counts are captured in `docs/request-audit/before.json` and `after.json`. The reproducible browser test uses real application components and intercepted API responses to isolate caller behaviour from network latency. It advances 61 seconds using Playwright's browser clock; these are deterministic virtual-time measurements, not a real-user production traffic sample. Actual Neon persistence and three-role synchronization are verified separately by integration/browser lifecycle tests.

| Caller / key | Existing trigger | Decision |
| --- | --- | --- |
| Customer profile / profile | Header, Home, protection and forms with staleTime 0 | Shared 5-minute freshness; abort obsolete reads; explicit refetch after edits |
| Published catalogue / published-catalogue | Every mount, every focus | Five-minute freshness; refetch on return to page for cross-app publication changes |
| Appliances / published-appliances | Forced mount, staleTime 0 | Five-minute cache; fetch on page entry; compact Home shares same key |
| Appliance services / appliance-services,id | Forced mount | Stable appliance key, five-minute cache, page entry/focus refresh |
| Customer requests / requests, request,id, timeline,id | Open or explicit refresh | Keep no idle polling; preserve explicit refresh and remount fetching |
| Notifications / identity-scoped role key | Initial auth plus opening | Only bell/modal open and explicit refresh; no mount/focus/reconnect polling |
| Admin summary/activity | 30s timer | Remove; page opening/focus and explicit refresh |
| Admin requests / admin-requests,mode,filters,page | 15s active / 30s completed | Remove list timers; preserve page opening, focus and mutation invalidation |
| Admin feedback and summary | Two independent 15s timers | Remove both; targeted refresh after handling |
| Admin support, technician operations | 15s timer | Remove; fetch on open/focus/local mutation |
| Technician dashboard/jobs | 15s timer | Remove; page opening/focus and local mutation invalidation |
| Admin request detail | 15s timer | Visible active detail only, 30s, stop at final states or errors |
| Technician job detail | 10s timer | Visible active detail only, 30s, stop at final states or errors |
| Customer support/messages | 15s timer, conversation open | Remove; opening, focus and explicit refresh |
| Auth errors | Various default retries | No automatic retries for 401/403/404 or other permanent 4xx; at most one transient retry |
| Booking draft debounce | 500ms timeout | KEEP: local draft storage, not API polling |
| PWA update timers | Service-worker lifecycle | KEEP: not application API churn |

Mutation measurements are covered by assignment/status/workflow-safety tests: pending synchronous guards, idempotency keys, version checks and targeted invalidation must remain. Do not replace them with optimistic fake status data. Shared API protection coalesces identical writes and scopes retry keys to role/identity. Authentication sessions and private query caches are cleared on logout/account switch.

Polling exceptions: an open active request/job detail may refresh every 30 seconds while visible; polling stops when hidden or on error/final status. This monitors a single actively viewed record rather than polling every dashboard/list. Notifications are always on demand.

## Recorded results

| Home screen | Initial calls before / after | Repeated calls in 61 idle seconds before / after | Bell open after |
| --- | --- | --- | --- |
| Customer | 5 / 4 | 0 / 0 | 1 inbox request |
| Admin | 5 / 4 | 4 / 0 | 1 inbox request |
| Technician | 4 / 3 | 4 / 0 | 1 inbox request |

Opening Services makes one published-appliance request. Opening a customer request makes one request each for detail, timeline and estimates, plus the page's identity/configuration requests. Opening an admin record or technician job makes one record request. The captured admin list opening records two attempts, with one explicitly aborted: React StrictMode cancels the obsolete signal-aware read during development remount. There is one completed list read. StrictMode was retained; cancellation was not disabled for obsolete filtered request reads.

Navigation measurements use full page openings, so identity/configuration calls are counted again; client-side navigation reuses its query cache. Customer tracking intentionally retains fetch-on-entry and explicit Refresh instead of background polling; customer request, timeline and estimate focus/reconnect behaviour is unchanged. Admin/technician active records additionally support bounded monitoring and focus refresh.

Mutation proof: `workflow-safety.spec.ts` verifies one offer POST despite three immediate clicks, then one explicit retry with the same key after a simulated 503; no automatic resubmission occurs after an unknown committed response. The real technician browser lifecycle verifies one assignment row and one acceptance event despite duplicate clicks/retries. The catalogue integration test verifies draft category creation replays the same row, rejects duplicate names and never exposes a draft to the public catalogue. No baseline mutation production logs were fabricated.

Final measurement command: `npx playwright test tests/browser/request-measurement.spec.ts`. Raw endpoint counts and aborted reads are preserved in `docs/request-audit/after.json`. No cookies, passwords or private record payloads are recorded in these artifacts.

Marketplace follow-up: request search now debounces text by 300 ms. The populated dashboard/search browser checks verify that typing `Priya` at 35 ms per character produces one filtered list read, at both phone and desktop widths. The final three-role measurements again show zero home-screen idle repeats.
