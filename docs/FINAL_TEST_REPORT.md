# Final test report

Updated 23 October 2026. The existing Customer, Admin and separate Technician PWAs were updated in place. This report supersedes earlier status-control and appliance-layout verification counts.

Admin dashboard/identity follow-up: GET summary, activity, allocation and auth/me are also exempt from the shared quota; notifications were already exempt. The expanded rate-limit suite passed 13/13, backend build and affected-file ESLint passed, and all five live Admin endpoints retain authentication without quota headers. Broader results below predate this small follow-up; see RATE_LIMIT_CHANGE.md.

Customer request-fetch follow-up: request summaries/lists, details, timelines and estimates now fetch on opening/reload or explicit actions, with no interval/focus/reconnect fetching or automatic retries. Added manual Refresh controls. Customer build, affected-file lint, 24 targeted browser tests and all three PWA checks passed. See CUSTOMER_REQUEST_FETCH.md; the broader suite results below predate this frontend-only change.

## Delivered behavior

- Customer discovery starts with an Admin-managed appliance grid, followed by that appliance's services, service details and a prefilled four-stage booking wizard. Multiple selected options retain individual server-generated booking-time price snapshots. The short description asks for brand and brief details.
- One reusable Admin Change Request Status modal supports all six requested statuses from rows, Actions menus and details. Authorized overrides require a reason and request version; completion also requires a completion note; reopening a final request requires explicit confirmation. Audit, original completion and customer feedback history remain preserved.
- Manual Technician Assigned selection uses verified technicians with active accounts without skill matching. It creates a pending job offer. Technician acceptance remains explicit, and pending offers never reveal private customer phone/address details.
- Booking phone is normalized and shown with call/copy actions in authorized Admin views and accepted Technician job views/calendars. Cancellation revokes access. Reopening old cancelled records clears stale technician/visit pointers.
- Technician completion records the technician actor and synchronizes the canonical request, customer view and Admin timeline. Completion/report/estimate checks remain enforced.
- Notifications remain on demand. The shared API rate limiter now excludes Customer/Admin notifications and requests, Technician notifications/jobs/assignments, nested actions and booking aliases. Sign-in protections, authorization, ownership and mutation deduplication remain active. No active email sender is used.

## Verification

| Check | Latest result |
| --- | --- |
| All three PWA production builds and backend build | Passed |
| TypeScript across all workspaces | Passed |
| ESLint | Passed |
| Dedicated Express rate-limit tests | 7/7 passed |
| Complete API/unit/integration suite | 92/92 across 18 files, 507.69 seconds |
| Complete Playwright suite | 83/86 passed in 10.2 minutes; three test-selector failures corrected, targeted reruns below |
| Notification network rerun | All three roles passed, 3/3 in 5.1 seconds |
| Technician live lifecycle rerun | Service and installation both passed, 2/2 in 4.2 minutes |
| PWA manifests, service workers, Chrome installability and offline shells | All three passed |
| Private API caching | None in all three PWAs |
| Live local HTTP checks | Three PWA entry pages and API health return 200 |
| Live scoped rate-limit headers | All six unauthenticated notification/request endpoints retain 401 with neither quota header; health retains quota headers |
| Post-fixture read-only Neon audit | Passed after all fixtures were cleaned up; all seven finding categories empty |

Five browser workflows use the actual development API, Neon and object storage: service and installation customer booking/completion/review flows, service and installation managed-technician flows, and catalogue publication through multi-option booking, technician onboarding and reschedule approval. The remaining browser tests intercept API responses to verify UI behavior, responsive layouts, errors/retries, duplicate clicks, navigation and notification network activity. Responsive widths are 360, 390, 768, 1024 and 1440 pixels.

Earlier runs exposed a missing mandatory test-fixture booking key and ambiguous accessible-label assertions. The fixture and labels were corrected. The final focused polish run initially passed 25/26 because a partial Technician label also matched the filled internal-note field; its test now selects the exact accessible label. The full browser run then reported three test-selector failures: both technician flows matched every technician timeline event instead of the completion event, and the legacy Admin Notifications test tried to click behind an already-open dialog. The corrected notification test closes that dialog, supplies valid dashboard fixture responses, and scopes the related-record link to the inbox. Its final three-role rerun passed. The lifecycle rerun scopes the actor check to the Completed timeline event. An intermediate lifecycle rerun also exposed an exact-text assertion against an attribution embedded in a longer report line; the assertion now checks that attribution within the line. Both complete live technician flows then passed, including customer review and final responsive navigation. All 86 browser cases are covered by the original 83 passing cases and the corrected targeted reruns. Results above distinguish those runs; no clean 86/86 full-run result is claimed.

## Commands and artifacts

```text
npm run build
npm run typecheck
npm run lint
npm test
npx vitest run backend/src/apiRateLimit.test.ts
npx playwright test --workers=2 --reporter=line --output=test-results/on-demand-final
npx playwright test tests/browser/workflow-safety.spec.ts --grep 'notifications load on demand' --workers=2 --reporter=line --output=test-results/notifications-final
npx playwright test tests/browser/technician-workflow.spec.ts --fully-parallel --workers=2 --reporter=line --output=test-results/technician-completion-final
node scripts/check-pwa.mjs
npx tsx src/workflowAudit.ts  # from backend
```

The PWA checker uses PWA_CUSTOMER_ORIGIN=http://localhost:5173, PWA_ADMIN_ORIGIN=http://127.0.0.1:5174 and PWA_TECHNICIAN_ORIGIN=http://127.0.0.1:5175. Current screenshots are retained in docs/screenshots/manual-status; the database audit is docs/workflow-db-audit.json. Rate-limit scope and middleware evidence are documented in RATE_LIMIT_CHANGE.md.

## Environment

The verified Neon development branch is codex-customer-dev (br-gentle-wind-b4tsvt43) in project snowy-hill-87120042. Tests remove their own synthetic fixtures. Existing business records are preserved. Production was not migrated or deployed; the rate-limit change must be deployed to a hosted backend before it affects that environment.

Local previews remain running at the three origins above; Technician starts at /technician. API health is http://localhost:3001/api/v1/health. Physical-device installation and production Google/MFA/storage configuration were not verified. Vite's non-fatal chunk-size warnings do not prevent builds. No successful live dependency-security audit is claimed.
