# Workflow implementation progress

Updated 22 October 2026.

## Implemented

1. Audited source, migrations, email dependencies, polling, mutation controls and existing workflow rules.
2. Preserved the existing Neon data model and canonical booking lifecycle. No production branch migration or historical cleanup was performed.
3. Added guarded development migrations 0015-0017: actor-scoped replay results, staff inbox/read state, notification links and durable booking payload hashes.
4. Added transactional idempotency, request fingerprints, replay/retention rules and separate-tab duplicate protection around existing business routes.
5. Added shared safe mutations, async/spinner buttons, confirmation dialogs, error boundaries and event-based notification invalidation.
6. Replaced the competing assignment forms with one reusable searchable drawer for both request types.
7. Simplified request listing/details, removed the duplicate header search and replaced raw status selection with contextual workflow actions.
8. Added version-checked appointment rescheduling through the existing status endpoint.
9. Split technician code into its own PWA/build/manifest at port 5175; retained only a redirect at old admin technician URLs.
10. Preserved technician ownership/CSRF, acceptance, progress, estimates, private uploads, immutable reports and admin review.
11. Required managed technicians to complete through report review. Existing contact-only technicians retain the existing manual completion form, with its role/version/prerequisite checks.
12. Replaced the admin audit-log inbox with persisted per-staff notifications and disabled notification polling in all clients.
13. Kept Google Sign-In, in-app events, manual secure recovery links, catalogue, support, feedback and payment limitations intact.
14. Added concurrency/retry/retention tests, drawer interaction tests, on-demand inbox tests and responsive screenshots.

## Verification status

The October UI restructuring adds migrations 0018-0020, unified Requests and catalogue workflows, temporary technician credentials, real calendars and reviewed rescheduling, and shared header notification dialogs. Production builds, strict type checks and lint pass. All three built PWAs pass manifest, Chrome installability, service-worker, offline-shell and private-cache checks. The current API suite passed 80 tests across 16 files; the complete browser run passed 70/70. The final read-only audit returned no findings. See `UI_REDESIGN_PROGRESS.md` and `FINAL_TEST_REPORT.md` for current results rather than the preceding 64/45 revision.

## Runtime

- Customer: `http://localhost:5173`
- Admin: `http://127.0.0.1:5174`
- Technician: `http://127.0.0.1:5175/technician`
- API: `http://localhost:3001/api/v1`

`npm run dev` starts all four processes. During final verification, the three apps run from stable local production previews and the API runs without a file watcher, avoiding restarts during live transactions. All four stable local preview/API processes remain running after verification.

## Remaining environment limits

Production deployment, physical-device installation, production Google origins, production MFA delivery and production storage configuration are not claimed verified. No email provider is needed for business operations. Admin invitation links require an appropriate `VITE_TECHNICIAN_ORIGIN` when deployed. Same-origin `/api` proxies must be configured for all three production origins. Vite reports frontend chunk-size warnings for admin/customer; builds still succeed.
