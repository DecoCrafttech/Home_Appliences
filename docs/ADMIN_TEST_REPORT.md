# Admin test report

Environment: Neon project `snowy-hill-87120042`, isolated branch `codex-customer-dev` (`br-gentle-wind-b4tsvt43`). Production was not modified.

`npm test` passed 14 tests in 4 files. The admin integration suite created temporary staff, customer, request, session, challenge, timeline, and audit records and removed them afterward.

Verified against Neon:

- unauthenticated admin access returns 401;
- valid scrypt password plus development MFA creates a staff session;
- `/admin/auth/me` restores the authenticated session;
- dashboard counts query actual tables;
- admin request listing returns the customer-created request row;
- `REQUESTED` to `UNDER_REVIEW` persists with actor attribution;
- the status event is written to the same timeline used by the customer application;
- an audit record is created;
- logout revokes the session.

Build verification passed for all workspaces. Playwright is not configured, so browser end-to-end tests are NOT TESTED.

Running-app smoke check: admin frontend HTTP 200, customer frontend HTTP 200, API health HTTP 200, and unauthenticated admin dashboard HTTP 401.
