# Implementation progress

25 October 2026. This file records this redesign run; older reports are historical.

| Phase | Status / evidence |
| --- | --- |
| 1. Screen/API audit | Source inventory completed; UX_REDUNDANCY_AUDIT.md, API_REQUEST_AUDIT.md and baseline network measurement added |
| 2. Request optimization | Implemented. Deterministic 61-second home idle measurements show zero repeat requests for every role; baseline admin had 4 and technician 4. Inboxes fetch once on opening. Active-record polling is 30s, visible-only, and stops on error/final states. Permanent 4xx retries are disabled. |
| 3. Shared design | Implemented shared requested colour tokens, consistent icon library, focus states, reduced-motion dialog/form transitions and role-specific card density. |
| 4. Customer Home | Implemented real published appliance/service search, actual profile identity, compact category-specific icons, no marketing footer, and one active request preview after discovery. |
| 5–6. Discovery and booking | Retained server catalogue/price data and prefilled four-stage booking. Added sticky service action above mobile navigation, selected option treatment, scoped catalogue freshness and abortable service reads. |
| 7. Tracking/Profile/Support | Kept real request history and guarded decisions. Profile now uses one settings list with icons; support and conversations use explicit refresh without timers. |
| 8. Admin | Compact six-metric overview with explicit refresh; unified Requests retained; duplicate status menu action removed. Catalogue uses directly selectable sections with Publish available without a five-step sequence. Added guarded draft appliance creation with name locking and audit history. |
| 9. Technician | Removed workday/list polling; retained next-job priority and field-sized actions. Work report appears only at the relevant job stage or when a report already exists. Calendar approval/version checks preserved. |
| 10. Content cleanup | Removed repeated Home marketing/footer, redundant profile link, repeated feedback subtitle/eyebrow and duplicate row status action; retained pricing, cancellation, contact and service terms. |
| 11. Three-PWA persistence | Complete: real service/installation lifecycles and corrective SERVICE/catalogue/reschedule runs passed against the verified isolated development branch. |
| 12. Responsive visual QA | Complete: Home/search/service checks at 360/390/768/1440; final admin/measurement run 14 passed; five localization/responsive corrections passed. Representative screenshots preserved under docs/screenshots/redesign-*.png. |
| 13. Functional/security checks | Complete: full API 104 passed; targeted API/policies 13 passed. Initial browser 90/100, with all ten failures corrected or verified in clean reruns (5 localization, 3 notifications, 1 catalogue selector, 1 technician lifecycle). Five new marketplace/editor cases passed. |
| 14. Builds/report | Complete: all workspace typechecks, lint and builds passed; admin rebuilt after final publication guard. Final built-PWA checks passed for all three apps. See REDESIGN_COMPLETION_REPORT.md for command results and limits. |

Limitations: the text attachment includes no reference image files. No external production deployment was requested. Production Google OAuth/MFA delivery and physical-device installation cannot be inferred from local automated checks.

Marketplace polish follow-up completed: compact phone service cards, readable booking dates, mobile dashboard navigation, debounced request search, populated technician cards/header and responsive loading-button widths. See [verification and screenshots](MARKETPLACE_POLISH_REPORT.md).

Technician flow simplification completed: removed dead destinations, duplicate card decisions and location controls; stage-specific report/estimate forms and progressive profile settings; estimate-aware completion gating; guarded decline/retry; URL-based list navigation. Both real service/installation lifecycles and real reschedule approval passed on the verified development branch. See [flow audit and verification](TECHNICIAN_FLOW_SIMPLIFICATION.md).
