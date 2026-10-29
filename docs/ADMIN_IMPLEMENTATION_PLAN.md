# Admin implementation plan

1. Secure staff identities, password verification, MFA challenges, sessions, roles, audit records, and integration tests.
2. Responsive admin shell, real KPI summary, paginated shared request listing, request detail, lifecycle validation, customer timeline synchronization.
3. Verified technician records, skills, service areas, availability, conflict-safe assignment, assignment history.
4. Customer, catalogue, service-area, pricing, and scheduling administration with audit history.
5. Persisted support conversations and support-agent workflows visible in the customer PWA.
6. Payment/read-only finance surfaces until a verified payment provider exists; add refund flows only with provider integration.
7. Reports, settings, notifications, private Object Storage documents, full error pages, accessibility, Playwright, and deployment verification.

Each phase uses the isolated Neon branch, additive migrations, backend permission checks, live integration tests, and an updated status report. Production is not migrated without a reviewed deployment decision.
