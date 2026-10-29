# Authentication test report

Automated Google verification is mocked at the provider boundary as required; all account, identity, session, and authorization persistence uses the real isolated Neon branch.

Covered cases include missing Google credential, new Google customer, returning immutable subject, failed provider verification, session restoration, and logout revocation. Existing customer and admin integration suites provide regression coverage for bookings, profiles, timelines, support, staff sessions, permissions, and audit events.

Real Google provider login is BLOCKED pending authorized-origin configuration and interactive test-account consent. Playwright authentication tests are NOT TESTED.

Actual results: `npm test` PASS (5 files, 19 tests); `npm run typecheck` PASS; `npm run lint` PASS; `npm run build` PASS for admin, customer, and API. Running customer login and API health returned HTTP 200; legacy OTP returned HTTP 410.
