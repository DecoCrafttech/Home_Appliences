# FixBeez release audit — 5 November 2026

This audit improves the existing application; it does not certify a production release as fully tested or secure. Browser regression failures and the operational items below remain launch blockers. No application redesign was performed.

## A. Files and improvements

- `backend/src/adminRoutes.ts`, `customerRoutes.ts`, `technicianRoutes.ts`: enforce temporary staff password changes on the server, cache authenticated identity within one HTTP request, combine customer/session authorization into one query, and strengthen staff login/MFA/session handling.
- `backend/src/security/{browserOrigin,jsonComplexity,pushEndpoint,safeError}.ts`, `app.ts`: trusted browser write origins, bounded JSON validation work, browser push endpoint restrictions, and private error logging. Existing ownership checks, parameterized SQL, role checks, and technician CSRF checks remain active.
- `backend/src/pushService.ts`, `technicianStorage.ts`, `server.ts`, `databasePool.ts`, `db.ts`: atomic notification claims with recoverable leases, bounded outbound requests, reused storage client, handled background/pool failures, and graceful pool shutdown.
- `backend/src/completion.ts`: capture the real previous request status under a row lock. Direct admin completion cannot bypass the technician-account workflow; contact-only technician completion remains supported.
- Customer `Aftercare.tsx`, `PublishedServices.tsx`, `lib/googleAuth.tsx`: remove unnecessary focus/reconnect/navigation refetches while preserving explicit refresh and mutation invalidation.
- Request detail Refresh now refreshes the associated estimate as well, fixing stale estimate state without adding unused timeline calls.
- Customer `main.tsx`/`App.tsx`: register the service worker before first-use onboarding finishes.
- `backend/src/ops/*`: read-only encrypted backups, explicitly targeted owner-terminal admin reset/MFA, guarded one-time approved cleanup, and isolated database test tooling.
- `tests/setup.ts`, `tests/browser/globalSetup.ts`, test configs: refuse implicit use of the shared database. Integration/browser suites use two separately created audit databases and verify their actual identity.
- Expanded security/password tests; updated a small set of browser assertions to the existing booking/category/calendar UI. Other browser failures remain visible.

## B. Verified removals and dependency maintenance

Removed unused `drizzle-orm`/`drizzle-kit` dependencies: the backend uses parameterized Neon SQL and checked-in SQL migrations. Removed unused technician `react-hook-form` and `@hookform/resolvers`; other apps still use their form dependencies. Removed the unreferenced generic customer `icon.svg`; retained approved brand images, application features, migrations, historical documentation, and operational scripts.

Updated compatible dependency resolutions, router peer requirements and all three lockfiles (root, backend, runtime). No forced major dependency upgrade was used. Private audit outputs/backups are ignored by Git and ESLint. Build artifacts, installed dependencies, local environment files, browser reports and caches remain excluded.

## C. API measurements

Measured in headless Chrome against production bundles with deterministic API mocks; these are browser request counts, not production traffic or latency benchmarks. The same scenario reloads the app, performs three focus/visibility cycles, three Home/Services navigation cycles, then opens My Requests and repeats focus cycles.

| Customer request            | Before | After |
| --------------------------- | -----: | ----: |
| Profile                     |      2 |     2 |
| Google/public configuration |      8 |     2 |
| Appliance catalogue         |     10 |     1 |
| Request list                |      7 |     1 |
| Total                       |     27 |     6 |

That is 21 fewer requests (77.8%). Initial focus calls fell from six to zero; request-page focus calls fell from seven to zero. Customer lists have a 15-second freshness window, no polling/reconnect/focus retries, and explicit Refresh. Catalogue/configuration use five-minute freshness windows. Admin/technician session checks intentionally remain at five each in this scenario: two loads plus three focus checks. Active-job polling remains bounded and conditional; it was not removed blindly.

Cross-app state is stored in the same backend database. A change made in another PWA appears in an already-open customer view on explicit Refresh; these changes do not introduce instant push-driven UI synchronization.

Auth guard tests verify one customer authorization lookup per request, including overlapping middleware; the previous code could perform four lookups. Existing server-side filters/pagination and migration indexes were reviewed. No speculative index or production query-latency improvement is claimed for this small dataset.

## D. Security results and remaining risks

Implemented: exact trusted browser origins for writes (including hostile sibling-subdomain checks), request-scoped authenticated identity reuse, forced staff password-change restrictions, bounded password hashing queue, generic credential failures/dummy-hash verification, five-failure account lockout, invalidation of other sessions after password changes, push SSRF restrictions, bounded JSON structure checks, and sanitized application/background/pool errors. API responses remain `no-store`; private API responses are not service-worker cached.

Remaining risks/actions:

1. Rotate the database/storage/push credentials previously exposed in chat or old Git history, coordinating local/Hostinger environment updates. This audit does not rewrite history or silently rotate deployed credentials. An idle database-driver failure also demonstrated why rich error objects must not be logged; current handling emits only error type/code and local captured logs were redacted.
2. Zod 3 remains affected by [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5). API body-size and structure limits mitigate oversized-input validation work; this is not a patched-library claim. Migration to the patched major version needs contract/form regression testing. Build-chain advisories also remain; forcing audit's breaking recommendations was avoided.

   Final root `npm audit --omit=dev`: 7 affected package entries (2 low, 4 moderate, 1 high), compared with 13 initially (3 low, 5 moderate, 5 high). The standalone runtime audit has one remaining high Zod finding. Root production-mode dependencies include frontend build tooling, so these counts are not all backend-runtime exposures.

3. Technician MFA remains separately configurable through the technician account flow.
4. Real Google-provider account login requires interactive owner verification. The hosted API currently returns a configured public client ID; that alone does not prove OAuth success.
5. Five other legacy staff profiles remain active because the approved deletion scope preserved all six. Review ownership and disable unauthorized accounts before launch.
6. Remaining browser-suite failures prevent a clean release sign-off. See H. No claim of complete XSS/IDOR/upload/SQL-injection coverage or 100% security is made.
7. Upload routes enforce role/ownership, declared type/size, object metadata and short-lived signed URLs. Image-content malware scanning is not introduced by this audit.
8. The configured Neon owner role can create databases. Use a separate least-privilege runtime role for the deployed API and keep schema/migration privileges separate; changing the live connection credential requires coordinated Hostinger configuration.

## E. Branding and PWA status

All three apps retain their existing official FixBeez 192/512 PNG manifest icons. Added matching multi-size `favicon.ico`, 16/32/48 PNG favicons and 180px Apple touch icons, plus HTML links. Technician viewport syntax was corrected. The generator derives assets from the approved brand PNG rather than a generic icon.

Chrome checks passed for all three production builds: valid manifest, service-worker registration, installability, offline application shell, and no cached private API responses. Production rendering and nested-route refresh passed with mocked APIs. These checks do not certify every nested route as usable offline with live business data.

## F. Primary admin access

Username: `admin`. The existing SUPER_ADMIN was reset with a unique temporary password, hashed with Argon2id, and marked for first-login password change. Plaintext was displayed only in the owner's interactive local PowerShell window; no password is in this report, API response, source or saved receipt. Authentication tests passed for wrong password, correct password, MFA, secure cookie flags, unauthenticated denial, restricted access before password change, and MFA replay denial. Cleanup preserved the staff row byte-for-byte.

If that local terminal is unavailable, run this in a local interactive terminal (not redirected):

```powershell
cd D:\HA\backend
npm run admin:reset -- --username admin --expect-branch br-broad-breeze-b41iqgjz --expect-database neondb --apply
```

After submitting username/password in the Admin PWA, issue its current five-minute MFA challenge using:

```powershell

```

The tools refuse redirected output, check the actual target, and manage only a SUPER_ADMIN. Reset revokes prior sessions and challenges. Change the temporary password immediately after signing in.

## G. Database backup and approved cleanup

Actual shared target: project `snowy-hill-87120042`, branch `br-broad-breeze-b41iqgjz`, database `neondb`. The local development label did not indicate a separate database. No destructive integration suite ran against it.

The owner explicitly approved [the exact 33-table deletion scope](DATABASE_CLEANUP_APPROVAL.md). A fresh encrypted backup was verified before execution:

`D:\HA\backups\2026-11-04T23-34-32-192Z-6b14f5f0.json.enc`

Backup: 41 tables, 786 records; AES-256-GCM, decrypted checksum/count verification, key protected with Windows DPAPI for the current Windows user outside the repository. This is an application logical data snapshot with schema metadata, not a `pg_dump` archive or a tested full restore. Protect both the encrypted backup and access to the owner's Windows profile.

Cleanup committed at `2026-11-04T23:36:33.471Z`: **626 rows deleted from 33 tables; 160 rows preserved in 8 tables**. Actual row fingerprints matched both approved and fresh backups before deletion under table locks. Identity, exact table set, foreign keys, empty cleared tables and unchanged preserved data were verified transactionally. No `CASCADE`, schema/table drop, sequence reset or storage-object deletion was performed.

Preserved: schema migrations, app settings, appliance categories, service catalogue, catalogue media, technician checklist templates, all six staff profiles and audit history. Both temporary audit databases were removed after their test runs, using their creation receipts and verified owner/branch/name checks. They were separate from `neondb` and contained only generated fixtures.

## H. Validation

**Final full backend result: all 135 tests passed across 23 files, with no skipped tests, in 1,316.56 seconds against the isolated audit database.**

| Check                                                              | Result                                                                    |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Root ESLint                                                        | Pass                                                                      |
| All workspace TypeScript checks                                    | Pass                                                                      |
| All three PWA production builds and backend build                  | Pass; existing large-chunk warnings remain                                |
| Isolated default unit run                                          | 65 passed, 70 database-dependent tests skipped                            |
| Initial full isolated database run                                 | 115 passed, 9 failed, 5 skipped; failures investigated                    |
| Affected admin/aftercare/status integration recheck                | 24 passed; a hardcoded branch assertion still failed and was corrected    |
| Subsequent catalogue/onboarding and technician integration recheck | 13 passed                                                                 |
| Full browser run                                                   | 127 passed, 81 failed (208 total); not a clean release gate               |
| First focused browser recheck                                      | 15 passed, 6 failed; additional current-UI assertions corrected afterward |
| Production browser render/nested refresh                           | All three pass with mocked APIs                                           |
| Chrome installability/offline/private-cache checks                 | All three pass                                                            |
| Hosted API health/readiness                                        | Healthy; `database: connected`                                            |
| Hosted Google public configuration                                 | Client ID present; real account login unverified                          |

Final focused browser regressions passed 17/17 (booking, draft privacy, estimates, refresh, support and responsive screens). The separate appliance/category recheck passed all eight scenarios. A clean standalone backend install with `--omit=dev` and production build passed outside the monorepo, using only the backend, local shared package and root TypeScript configuration. Local test logs and non-secret receipts are under ignored `audit-private/`. Many browser failures refer to older navigation/card/calendar designs; others include workflow expectations and context teardown. They were not removed or marked skipped to obtain a green run. A focused assertion update is not a claim that the full 208-test suite passes.

## I. Git and deployment

Existing branch `main`; origin `https://github.com/DecoCrafttech/Home_Appliences.git`. Changes are limited to this checkout; no force push or history rewrite. Current local credential values were checked against tracked/staged files without printing them. Backup/key/env/test-output files are excluded. The release commit hash and verified push outcome are supplied in the final completion message, since a commit cannot contain its own hash.

## J. Before production launch

Resolve remaining browser regression failures; complete the Zod migration; rotate exposed credentials; review the five legacy staff accounts; perform real Google sign-in and owner acceptance on Customer/Admin/Technician domains. In Hostinger verify `NODE_ENV=production`, the four exact app origins and the correct proxy-hop setting. Redeploy from the verified GitHub commit and inspect deployment/runtime logs. Backend root remains `backend`, build `npm run build`, output `.`, entry `start.mjs`; PWA roots remain their respective `apps/*-pwa` folders with `dist` output. Keep `DATABASE_URL` on the backend only. Validate `/api/v1/ready`, cross-domain cookie/CORS behavior, customer booking, admin assignment, technician progress and customer feedback after deployment. GitHub push alone does not prove Hostinger completed a redeployment.
