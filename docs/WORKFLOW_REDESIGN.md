# Workflow redesign

The existing UUID booking, assignment and report records remain authoritative. No parallel booking system or historical deletion is permitted.

The later master prompt adds an authorized administrative override alongside the normal workflow below. It supports any listed status and explicit reopening, while preserving assignments, audit, completion and feedback history according to STATUS_OVERRIDE_REPORT.md. Customer discovery now starts with the appliance grid, as documented in CUSTOMER_SERVICE_FLOW.md.

1. Admin edits a published catalogue service, options, indicative prices and approved media. Public APIs exclude drafts. Bookings retain the selected price snapshot.
2. Customer discovers a published service, enters requirement, address/contact and preferred schedule, reviews and submits once. Preferred time is distinct from confirmed time.
3. One admin Requests view filters service/installation, operational group, assignment, appliance, date and technician. Completed Requests is a filtered historical view of the same records.
4. Admin reviews, records contact and sends an eligible technician offer using the shared assignment drawer. An offer remains pending until acceptance.
5. Technician accepts or rejects. Admin confirms an appointment. A technician reschedule proposal requires an authorized admin decision; it never silently changes the confirmed schedule.
6. Technician travels, arrives, works and submits an immutable report. Admin reviews inside Request Details and approves completion or requests changes. Customer can review only a completed owned request.
7. Notification dialogs fetch on opening/manual refresh; read actions update local badges. Notification, request and job routes bypass the shared API quota while authentication limits remain active. Request/job/calendar synchronization fetches its own records.

Existing role checks, ownership, CSRF, version checks, transactional idempotency and uniqueness remain in force. Credential provisioning hashes temporary passwords with Argon2id and restricts first-login sessions until password change. SVG uploads are sanitized on the server and delivered as images with restrictive response headers.

Verification covers real development-branch catalogue-to-booking, credential-to-first-login, assignment, calendar/reschedule, progress, completion/review and dialog workflows, plus responsive checks at 360, 390, 768, 1024 and 1440 pixels. See FINAL_TEST_REPORT.md for the current revision's results and environment limits.
