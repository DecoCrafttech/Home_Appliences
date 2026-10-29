# Customer request fetching

Updated 23 October 2026.

Customer Home request summaries and My Requests no longer poll every 15 seconds. Request Details, progress timelines and estimates no longer poll every 10 seconds. All four queries explicitly set refetchInterval, refetchOnWindowFocus and refetchOnReconnect to false and disable automatic retries.

Initial page loads and opening request routes fetch their own data. My Requests has a Refresh button. Request Details has a Refresh button that fetches the current booking, timeline and estimates together. Buttons show a pending state and share in-flight fetches. Errors show Sonner messages and existing retry controls. Explicit booking, cancellation, review and estimate-decision actions retain their targeted cache updates; unrelated notification fetching remains independent.

Implementation: apps/customer-pwa/src/Aftercare.tsx and EstimateApproval.tsx. No backend or database changes were needed. Admin and Technician fetching policies were not changed in this follow-up.

Verification:

- Customer production build, including TypeScript: passed.
- Affected source/test ESLint: passed.
- 24 targeted browser tests: passed in 27.0 seconds. These include four new network tests, estimate approval, booking/draft navigation, appliance flow and customer responsive checks at 360, 390, 768, 1024 and 1440 pixels.
- Network tests advance time by two minutes, dispatch focus/visibility/offline/online events, and assert no additional request-list/detail/timeline/estimate fetches. Refresh, duplicate-click deduplication, reload, failure messaging and explicit retry are exercised against intercepted API responses.
- All three PWA checks pass, including the updated Customer build, offline shell and absence of private API caches.
- The Customer preview serves the updated build locally. Production has not been deployed. Broader API/live browser results in FINAL_TEST_REPORT.md predate this frontend-only follow-up and were not rerun.
