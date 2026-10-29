# Functional checklist

Status is updated after code and tests, not merely after rendering.

- [x] Profile greeting/photo/initials and customer reference
- [x] Four-step service/installation wizard and per-step validation
- [x] Customer-scoped resumable draft, explicit discard, clear after success
- [x] Repeat request with fresh date/key and catalogue revalidation
- [x] Smart contact/default-address values without overwriting user edits
- [x] Request confirmation on My Requests, filters and polling
- [x] Owned request-linked support and copy reference with error fallback
- [x] Versioned cancellation with visible eligibility and reason
- [x] Atomic staff completion, timestamp/history/audit and one notification
- [x] Completion inbox and acknowledgement
- [x] Completed-owned-only unique review and durable reminder dismissal
- [x] Admin feedback aggregates, filters, notes and handling history
- [x] Tamil customer navigation and booking/aftercare language option
- [x] Recent appliances derived from real customer requests
- [x] Customer/admin search, supported transitions and responsive layouts
- [x] API/integration tests, browser tests and viewport screenshots
- [x] Final type checks, lint and production builds

External verification gates: Google OAuth origin remains blocked in provider settings; production MFA, secure attachment storage, actual technician capacity and geographic service policy require configured integrations. These gates must stay explicit in the final report.

Verified by 42 backend/shared tests and 25 browser tests, including the real development database lifecycle. Screenshots cover 360?800, 390?844, 768?1024 and 1440?900. See REDESIGN_QA_REPORT.md for exact limits.
