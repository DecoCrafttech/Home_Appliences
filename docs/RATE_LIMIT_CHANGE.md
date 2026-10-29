# Notification and request rate limits

Updated 23 October 2026.

The shared Express API limiter now skips Customer and Admin notification/request routes, Technician notification/job/assignment routes, booking aliases and the legacy staff request-status endpoint. Nested actions such as read-all, mark-as-read, booking, status changes, reviews and assignment acceptance receive the same exemption. Matching respects route boundaries and Express's case-insensitive routing.

These endpoints no longer consume the shared IP quota, return its `RateLimit`/`RateLimit-Policy` headers, or receive its 429 response. Authentication, ownership, CSRF, version checks, database uniqueness and idempotency remain enforced. Login/password/MFA/OTP protections and the general limiter on other API endpoints remain active. There is no notification polling change in this follow-up.

Implementation: `backend/src/apiRateLimit.ts`, registered by `backend/src/app.ts`.

Verification:

- Seven real Express middleware tests passed. They exhaust a small shared quota, then prove all three roles' excluded routes remain available; verify nested mutations and booking aliases; check that excluded calls do not consume the quota; and retain unrelated-route and authentication limits.
- The local API was restarted with the change. All six Customer/Admin/Technician notification/request-list endpoints return the expected unauthenticated 401 with neither rate-limit header. API health returns 200 and retains the limiter headers, confirming the exemption is scoped.
- All three running PWA entry pages return HTTP 200. API production build, workspace type checks and project ESLint pass. The complete API suite passed 92/92; notification network reruns passed for all three roles (3/3). Both real technician browser workflows also passed (2/2). See FINAL_TEST_REPORT.md for full-run and targeted rerun results.

Production has not been deployed. Deploy the updated backend to apply the same change to a hosted API.

## Admin dashboard and identity follow-up

The user additionally requested exemptions for Admin summary, activity, allocation, notifications and me. GET /api/v1/admin/dashboard/summary, /dashboard/activity, /dashboard/allocation and /auth/me now bypass the shared quota. Admin notifications were already exempt. Dashboard/identity matching is exact (with an optional trailing slash) and limited to GET; sign-in, password and MFA routes retain their protections.

The expanded middleware suite passed 13/13 in 1.29 seconds. Backend build and affected-file ESLint passed. After restarting the local API, all five requested Admin endpoints returned their expected unauthenticated 401 without either quota header; health returned 200 with its existing quota headers. The full application suites above belong to the preceding revision and were not rerun for this small route-exemption follow-up. Production is not deployed.
