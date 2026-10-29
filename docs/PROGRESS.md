# Customer PWA progress

Last verified: 2026-10-21 (Asia/Calcutta)

The project now has its first real Neon-backed customer workflow. It is **not complete**. Verification used isolated branch `codex-customer-dev` (`br-gentle-wind-b4tsvt43`) with a seven-day TTL. Production was not migrated.

## WORKING

- Neon CLI 8.10.1 is linked to the specified organization and project.
- PostgreSQL and private Object Storage are configured on the development branch. Private `customer-attachments` was provisioned and existing `assets` was preserved.
- Additive schema migration runs on the development branch.
- Development OTP verification persists hashed challenges and HttpOnly sessions in Neon; attempts and expiry are enforced.
- Profile changes persist and reload from Neon.
- Service and installation requests persist with unique request numbers, ownership checks, and idempotency keys.
- My Requests returns the authenticated customer's records.
- Authorized staff status changes persist and appear in the customer timeline.
- Support ticket creation/listing persist and are customer-scoped.
- Appliance categories and service/installation options now load from Neon; request creation validates the selected catalogue IDs server-side.
- Saved address create/list/update/delete APIs are customer-scoped. The customer UI supports saving, listing, setting a default, and removing addresses.
- Sonner toasts reflect confirmed API outcomes for implemented workflows.
- Loading/empty states cover profile, requests, tracking, and support. Unknown routes show a 404 state.
- Type checks, ESLint, automated tests, and production builds pass.

## Actual results

| Check | Result |
| --- | --- |
| `npm run db:migrate -w @home/api` | PASS on `codex-customer-dev` |
| `npm test` | PASS: 3 files, 9 tests, including 4 live Neon workflow tests |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS: customer Vite build and backend TypeScript build |
| Running-app smoke test | PASS: API health 200, Neon catalogue returned 10 appliances, Vite frontend returned 200 |
| Test cleanup | PASS: temporary Neon rows removed |

The live suite verified OTP login, saved profile, Neon catalogue reads, saved address persistence, both request inserts using validated catalogue IDs, My Requests retrieval, initial/staff timeline events, and support ticket insert/list without mock persistence.

## FAILED

- Dedicated 401, 403, 500, network, session-expired, maintenance, and offline pages are incomplete.
- Support ticket detail, messages, and staff replies are absent.
- PWA service worker, manifest, installability, and offline fallback are not enabled.

## BLOCKED

- Production OTP delivery needs SMS or WhatsApp provider credentials/templates.
- Object upload/download authorization tests need the backend upload API. Buckets exist, but no test object was uploaded.
- Production deployment/migration was intentionally withheld pending schema review.

## NOT TESTED

- Playwright/browser flows, responsive visual behavior, and session restoration through browser refresh.
- Cross-customer isolation with two customers, address update/delete through the UI, and concurrent duplicate submissions.
- Cancel/reschedule, notifications, account deletion, payments, serviceability, fees, and catalogue ID validation.
- Object upload/download/signed access/cleanup and production OTP delivery.

Next: make request creation transactional, implement support replies and secure Object Storage routes, then add Playwright and remaining error/PWA pages.
