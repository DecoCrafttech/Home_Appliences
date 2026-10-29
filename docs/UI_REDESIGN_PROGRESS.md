# UI redesign progress

Started 22 October 2026 from the existing three-PWA implementation.

Latest master prompt: administrative overrides now supersede the earlier final-state restriction. Reusable modal, secure PATCH API, ledger/audit/reopening policy, appliance-grid navigation, appliance icon settings, multi-option snapshots and authorized phone visibility are implemented. The complete API run passed 92/92; the full browser run passed 83/86 before three test selectors were corrected. Corrected notification reruns passed 3/3, and both complete technician workflows passed 2/2. All builds, type checks, lint, PWA checks and the final read-only database audit pass. See FINAL_TEST_REPORT.md for the separate full-run and rerun results. See STATUS_OVERRIDE_REPORT.md and CUSTOMER_SERVICE_FLOW.md. Earlier results below describe their respective revisions.

Request status follow-up: visible Change Status in Admin Requests, with Pending/Completed/Cancelled choices, existing completion prerequisites, required pause/cancel reasons, and final-state protection as confirmed by the user. Paused requests have a distinct filter. All builds and lint pass; 72 broader browser tests and 15 final Admin/status checks passed. See REQUEST_STATUS_CONTROL.md and FINAL_TEST_REPORT.md.

Appliance-first follow-up: Customer Home, discovery and service details now prioritize the appliance, with services underneath. Admin catalogue/editor follow the same hierarchy. Booking asks for brand and brief details through Short description. Spacing and mobile action overlap were corrected. Both changed app builds, lint, 65 UI regressions and responsive inspection at all five widths passed; see FINAL_TEST_REPORT.md and screenshots/appliance-first.

This revision implements the supplied 40-section restructuring request in the existing applications. Results below apply to the new revision; previous passing subsets are not used as its final verification.

| Phase | Status |
| --- | --- |
| Screen and workflow audit | Source and workflow audit complete; findings recorded in UX_AUDIT.md |
| Navigation, shared icons, responsive notification dialogs | Implemented; dialog checks passed at all five widths for all three roles |
| Unified Requests, columns, statuses and references | Implemented; sequence migration 0018 applied only to verified development branch |
| Dashboard allocation and customer details | Implemented; responsive layout and browser checks passed |
| Technician credential provisioning and account controls | Implemented; real onboarding and mandatory password gate passed API integration |
| Catalogue options, indicative pricing, approved SVG media | Implemented; real object storage, sanitization, publish filtering and price snapshot tests passed |
| Customer discovery, booking and draft navigation | Implemented; privacy-safe draft/back/save/discard browser checks passed |
| Technician daily work and calendars/reschedule | Implemented; real three-way schedule proposal/approval integration passed |
| Real integration, browser, accessibility and responsive checks | Full API suite: 80/80 across 16 files; complete browser suite: 70/70, 11.4 minutes |
| Final builds and report | All builds, strict TypeScript and lint passed; final audit has no findings; report recorded |

Implementation and local verification are complete. Screenshots and final results are retained in docs/screenshots and FINAL_TEST_REPORT.md. Production is not used for destructive tests.

Migrations 0018-0020 are additive. The migration runner verifies the actual Neon project and branch before applying them. No production migration, historical record cleanup or deployment has occurred.

Final frozen builds, strict type checks and lint passed. The final API run passed 80 tests. The complete Playwright run passed 70/70. The post-test read-only audit returned no findings. A final CSS correction improves selected calendar-view contrast; the focused calendar checks verify the rebuilt output. Earlier browser failures were examined and repaired or updated for the new controls before the final run.
