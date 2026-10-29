# Marketplace UI polish

25 October 2026. Implemented directly in the existing Customer, Admin and Technician applications. The existing white-and-blue identity remains; compact marketplace browsing and a clear action hierarchy inform this iteration.

## Changes

- Customer service cards use a compact horizontal layout on phones, with uploaded service imagery, readable descriptions, real catalogue prices and an aligned action footer. Desktop cards retain equal-height footers. Search avoids showing an appliance empty state alongside matching services. Option selection uses a short visible label while preserving the full accessible option name.
- Booking dates show readable month names and full localized screen-reader labels. The horizontal date rail supports swipe scrolling and snapping. A month-boundary browser test verifies the selected date reaches review without changing the four-stage workflow.
- Admin dashboard shortcuts remain visible and clickable on phones. The complete metric card is a keyboard-accessible navigation target and uses client-side routing. Request search waits for a 300 ms typing pause; the new browser check verifies rapid typing produces one filtered request.
- Technician cards share one hierarchy for reference/status, appliance/service, visit, customer and area. Contact and location controls retain acceptance restrictions. Mobile action buttons keep a normal touch-target height. The header now uses the shared home-services identity and a real account avatar, with initials if a photo is absent or fails.
- Shared loading buttons preserve their width only while pending. Idle buttons can resize with their responsive layout; this corrects the clipped booking Back/Continue controls found during screenshot review. Existing submission locks and retry keys remain.

No backend routes, authentication, database schema or booking transitions changed in this iteration. Application screens continue to consume the existing APIs; controlled data appears only in automated test fixtures and review screenshots.

## Verification

| Check | Result |
| --- | --- |
| Marketplace discovery, selected booking, catalogue card alignment and workday shortcuts | 10 browser checks passed |
| Admin controls/layout, appliance booking, draft navigation, populated technician cards, notifications, SVG upload and mutation safety | 54 browser checks passed |
| Customer forms/profile/support/responsiveness, month-boundary selection and three-role request measurements | 16 browser checks passed |
| Header follow-up: populated cards, dashboard shortcuts, technician notifications and workday shortcuts | 12 browser checks passed |
| Shared-button follow-up: customer workflows, populated technician cards and assignment safety | 28 passed; one dialog interaction was interrupted by a development page reload during an edit |
| Clean final follow-up: month-boundary button bounds, all populated-card sizes, dashboard searches and duplicate assignment/retry | 8 passed; the interrupted case passed |
| TypeScript, lint and all four production builds after final code changes | Passed |
| Refresh policy unit checks | 6 passed |
| Production PWA manifest, service worker, Chrome installability and offline shell | All three passed; private API cache empty |
| Live backend readiness | `ready`, database `connected` |

The first three browser groups cover 80 distinct checks. Follow-up runs repeat affected checks after later refinements. Layouts were checked at 360, 390, 768, 1024 and 1440 px. Request measurements again recorded zero home-screen repeats over 61 virtual idle seconds for every role, and one inbox read when opening notifications. See [raw measurements](request-audit/after.json).

This pass did not rerun the full database mutation suite because the backend was unchanged. Previous real database/object-storage lifecycle evidence remains in the [completion report](REDESIGN_COMPLETION_REPORT.md). Existing production bundle-size advisories remain. Physical-device installation, external calling/maps apps and production identity-provider delivery require device/environment checks.

## Review screenshots

- [Customer services, phone](screenshots/marketplace-polish/services-360.png) · [desktop](screenshots/marketplace-polish/services-1440.png)
- [Technician jobs, phone](screenshots/marketplace-polish/technician-jobs-390.png) · [desktop](screenshots/marketplace-polish/technician-jobs-1440.png)
- [Admin overview, phone](screenshots/marketplace-polish/admin-dashboard-390.png)
