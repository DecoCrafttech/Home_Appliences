# Admin completion test report

Date: 2026-10-21. Existing local monorepo, customer PWA, admin PWA and Express API.

## Result

The shared completion workflow works for SERVICE and INSTALLATION requests. Admin staff confirm a required work summary and optional notes through `CompleteRequestModal`. The server owns status and timestamps, saves a structured report atomically with history/audit/notification, and safely accepts duplicate completion attempts. Customers see the saved summary and completion date and can submit one review.

The development database was the existing isolated `codex-customer-dev` branch (`br-gentle-wind-b4tsvt43`). Migration `0010_completion_reports.sql` was applied there. Production was not migrated. Integration/browser fixtures are temporary and cleaned up by their test suites; the browser suite and completion integration suite check the branch before seeding.

## Executed checks

| Check | Result | Evidence |
| --- | --- | --- |
| Backend/shared suite | PASS | 45 tests across 10 files; final 12-test completion integration rerun also passes with date/rating filtering and audit assertions |
| Full Chrome browser suite | PASS | 28 tests; includes both real database lifecycle journeys |
| Final completion/admin regression run | PASS | 9 tests after cache updates, role visibility and PWA registration changes |
| Final responsive/customer regression run | PASS | 18 tests after header styling and shared Completed/Tamil labels |
| TypeScript | PASS | Workspace checks and production builds |
| ESLint | PASS | Root `npm run lint` |
| Production builds | PASS | Admin, customer, API and shared package |
| Service completion | PASS | Browser booking, real status progression/assignment, modal, API, customer summary, notification and review |
| Installation completion | PASS | Same end-to-end browser flow with INSTALLATION data |
| Concurrent installation completion | PASS | Two authenticated calls return success; exactly one report, completion event and notification |
| Repeated service completion | PASS | Safe 200 response; original report retained |
| UUID/body validation | PASS | Invalid UUID, empty summary and unsupported attachments rejected |
| Authorization | PASS | Anonymous 401; support role 403; allowed operations/admin roles enforced server-side |
| Lifecycle prerequisites | PASS | Requested, unassigned, pending-estimate and stale-version completion rejected |
| Generic status bypass | PASS | `/status` cannot set COMPLETED without the completion workflow |
| Completion report/history | PASS | Unique report; server timestamp; previous/new status; staff actor; audit entry |
| Customer data ownership | PASS | Other customer cannot access the request or submit its review |
| Review integrity | PASS | Completed-only; 1–5 rating; concurrent duplicate review rejected; staff cannot alter customer rating/comment |
| Feedback handling | PASS | Internal note and handling status saved through real APIs; customer rating remains unchanged |
| Completed request list | PASS | Real customer search, request type, technician, date/rating filters; report/customer/review links; no completion action on closed rows |
| Modal cancel/error/success | PASS | Cancel sends no request; errors preserve text; success requires an API success response |
| Admin pages at 360/390/768/1440px | PASS | Dashboard, requests, separate type lists, completed, appointments, reports, inbox, settings, customers and feedback; no page-wide horizontal overflow |
| Mobile drawer | PASS | Open, navigate and close; background content inert while open; Escape/Tab handling implemented |
| Session network failure | PASS | Retry state, without incorrectly presenting an expired-login form |
| Admin/customer PWA manifests | PASS | Standalone display and application icons in production builds |
| Chrome installability criteria | PASS | `Page.getInstallabilityErrors` returns no errors in a fresh persistent Chrome profile |
| Service workers | PASS | Both production builds register before login; admin registration moved out of the authenticated shell |
| Offline shell/private data | PASS | Both apps render their shell offline; API fetch fails offline; no `/api/` entries in Cache Storage |
| Native OS installation / installed window | NOT TESTED | Chrome installability checked; no OS installation was performed |
| Live Google OAuth consent | BLOCKED | Existing Google Cloud authorized-origin configuration requires account-side setup; this pass tests app session/error behavior and existing mocked Google token flows |
| Production MFA delivery | BLOCKED | Provider setup remains required; existing development MFA retained |
| Completion photos | NOT IMPLEMENTED | Optional feature; nonempty attachment IDs are explicitly rejected until authenticated upload ownership/storage is implemented |

## Functional scope and limits

- Service and installation pages use TanStack Table with server pagination/search/filtering and TanStack Query. Admin styling retains existing components with Tailwind utilities scoped to avoid legacy class collisions.
- Completed requests include customer reference, technician, completion date and review status. Request details show the work summary, notes and completing staff name where recorded. Historical completions without a structured report remain visible without invented summaries.
- Reports show database request counts by type/status. Notifications show the latest 100 audited request updates, with a device-local read position. Settings persist the compact-table preference on that device and link to real service/form administration. These are not push delivery or financial reports.
- Pending estimates cannot be completed directly. There is no separate estimate/payment ledger in the existing application; payments remain separate from completion.
- General API rate limits now accommodate normal portal navigation/polling. Sign-in attempts have a separate stricter limit. Temporary session API failures show retry instead of a false logout.
- Vite reports bundle-size advisories for the customer/admin bundles; builds succeed. Route splitting is a remaining performance improvement.

## Reproduce

Run the existing three development platforms with `npm run dev`, then:

```text
npm run typecheck
npm run lint
npm test
npm run test:browser
npm run build
```

For production PWA verification, serve built admin on `http://127.0.0.1:5184` and customer on `http://localhost:5183` using Vite preview, then run `node scripts/check-pwa.mjs`. The script uses a temporary persistent Chrome profile, checks installability/manifests/cache behavior/offline rendering, closes Chrome and removes its own temporary profile.

Representative screenshots are in `docs/screenshots`; the complete responsive set is generated under ignored `test-results/screenshots`. The final admin screenshot/interaction rerun passed all 7 checks. The completion-modal screenshot demonstrates input retained after a rejected stale update.

Final smoke check: customer `http://localhost:5173`, admin `http://127.0.0.1:5174` and API `/api/v1/health` all returned HTTP 200. Development platforms remain running. Temporary production-preview servers were stopped after PWA verification. Final fixture check found zero temporary lifecycle/aftercare customer records.
