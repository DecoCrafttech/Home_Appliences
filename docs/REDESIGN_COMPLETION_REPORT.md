# Three-PWA redesign completion report

The current purple-and-peach design system and interaction essentials supersede the older visual baseline below. See [Purple UI and interaction essentials](PURPLE_UI_ESSENTIALS_REPORT.md).

Current request cards, visible assignment/completion actions and simplified technician screens are documented in [Request actions and simple technician UI](REQUEST_ACTIONS_AND_SIMPLE_TECH_UI.md).

The subsequent compact-card, booking-control, dashboard-shortcut and technician-header refinements are recorded in the [marketplace polish report](MARKETPLACE_POLISH_REPORT.md), including final regression and PWA checks.

The latest [technician flow simplification](TECHNICIAN_FLOW_SIMPLIFICATION.md) removes duplicate/dead controls and shows work forms at the relevant stage while retaining existing backend rules.

25 October 2026. Implemented in the existing repository and running locally. The backend booking/assignment/report/security model and historical price snapshots were retained.

## Delivered experience

- Customer Home uses actual account identity, a working published-catalogue search, compact appliance tiles with uploaded icons or category-specific fallbacks, and one active request preview. Repeated marketing/footer content was removed. Services remain appliance-first; a sticky booking action stays above mobile navigation. Four-stage booking, contact validation, recoverable drafts, the persisted success confirmation and request tracking remain functional.
- Profile uses one identity card and a clear settings list. Support remains under Profile, with explicit ticket/message refresh. Pricing, exclusions, cancellation terms and important workflow explanations remain visible at the relevant decisions.
- Admin has a compact overview, real database totals, explicit refresh, an attention queue and optional reporting. The unified request workspace, assignment drawer, authorized overrides and calendars remain. Duplicate status actions were removed. The catalogue editor now has directly selectable sections and can save/publish without a forced five-step sequence. Administrators can create draft appliances; publication of services under a draft appliance is explained and blocked in the editor until the appliance is published.
- Technician workday and job lists no longer poll continuously. Field-sized controls, next-job priority, permitted call/directions access and the next backend action remain. Work reports appear at the relevant work stage or when an existing report is present. Confirmed appointments still require an authorized approval flow to change.
- All apps use the requested shared blue/white palette, consistent Font Awesome 6 icons, focus treatment and reduced-motion-aware transitions. Separate PWA identities and authentication remain intact.

## API behaviour

The deterministic browser measurements show **zero repeated home-screen API requests over 61 idle seconds for all three roles**. Before changes, admin made four additional summary/activity requests and technician made four additional dashboard requests. Notifications now make no initial fetch and one fetch on bell opening. Active admin/technician record detail monitoring is deliberately limited to 30-second refresh while visible, and stops on error or final status. Permanent 4xx failures are not automatically retried.

Customer tracking continues to fetch on page opening and explicit Refresh. This design does not claim real-time pushes to a static customer screen. Identity-specific inbox keys and existing logout/account-switch cache clearing remain. See [request audit](API_REQUEST_AUDIT.md), [before counts](request-audit/before.json) and [after counts](request-audit/after.json).

## Verification performed

The connected database identity was checked before integration work: isolated development project `snowy-hill-87120042`, branch `br-gentle-wind-b4tsvt43`. Tests use uniquely identified fixtures and their existing cleanup hooks. No production migration or destructive production test was run.

| Check | Actual result |
| --- | --- |
| Full unit/API run, `npm test` | 104 passed across 19 files |
| Added/updated catalogue and refresh-policy checks | 13 passed across 2 files, including real SVG storage, idempotent category creation and hidden/error/final-state refresh rules |
| Initial complete Playwright run | 90 passed, 10 failed; failures were investigated rather than reported as successful |
| Five customer responsive/localization cases after new heading translation and expectation update | 5 passed |
| Three notification cases after updating eager-fetch expectations and scoping Refresh to the dialog | 3 passed |
| Real SERVICE technician lifecycle clean rerun | 1 passed; prior acceptance-display timeout did not recur; persisted assignment/acceptance assertions passed |
| Real catalogue/booking/provisioning/reschedule lifecycle after updating the renamed pricing-section selector | 1 passed |
| New Home search/selected-booking and direct catalogue draft/publication checks | 5 passed |
| Final admin layout and complete request measurements | 14 passed |
| All-workspace TypeScript checks and lint | Passed |
| Customer, admin, technician and backend production builds | Passed; admin rebuilt after final editor guard |
| Built-PWA manifest, service worker, Chrome installability, offline shell and private API cache checks | Passed for all three; no API responses cached |

All ten failures from the initial full browser run passed their corrective reruns. Real browser workflows cover service/installation booking, admin completion and reviews, assignment/acceptance, technician progress/report/completion, pricing snapshot retention, catalogue/media publication, first-login password gates and schedule proposal approval. API tests additionally cover unauthorized access and duplicate/concurrent writes. Mocked-response layout and network tests are distinguished from actual database/object-storage lifecycle tests.

## Visual artifacts

Responsive layouts were exercised at 360×800, 390×844, 768×1024 and 1440×900, with additional existing 1024px checks. Screenshots use controlled test accounts/catalogue data rendered through the actual application.

- [Customer Home at 360px](screenshots/redesign-home-360.png)
- [Customer Home at 390px](screenshots/redesign-home-390.png)
- [Customer Home at 768px](screenshots/redesign-home-768.png)
- [Customer Home at 1440px](screenshots/redesign-home-1440.png)
- [Mobile catalogue editor](screenshots/redesign-catalogue-editor-390.png)

## Practical limits

No reference image files accompanied the text brief; the supplied palette and visual characteristics were used. Local validation does not verify physical-device installation or production Google OAuth/MFA-provider delivery. Existing Vite bundle-size advisories remain; calendar code is already separated, and no specific Lighthouse score is claimed. No external production deployment was requested or performed.
