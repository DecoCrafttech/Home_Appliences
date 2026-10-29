# Redesign QA report — 2026-10-21

## Final results

| Check                                                            | Result                                      |
| ---------------------------------------------------------------- | ------------------------------------------- |
| Workspace TypeScript checks                                      | PASS                                        |
| ESLint                                                           | PASS                                        |
| Backend/shared tests                                             | PASS — 42 tests, 10 files                   |
| Playwright                                                       | PASS — 25 tests                             |
| Admin production build                                           | PASS                                        |
| Customer production build                                        | PASS                                        |
| Backend production build                                         | PASS                                        |
| PWA manifests, icons, static precache and update code generation | PASS                                        |
| Customer mobile/tablet/desktop layout checks                     | PASS — 360×800, 390×844, 768×1024, 1440×900 |
| Admin mobile/tablet/desktop layout checks                        | PASS — same four viewports                  |

The customer build reports a 551 KB minified main bundle (about 170 KB gzip). Route-level code splitting is a future performance improvement; the build succeeds. No lint/type/test failures remain.

## Development database verification

Used the existing isolated branch `codex-customer-dev` (`br-gentle-wind-b4tsvt43`). The browser lifecycle test refuses to seed any other branch. No production schema reset, migration or QA mutation was performed.

Verified with real Express/Neon records and separate customer/staff browser contexts:

1. Create temporary customer, staff, technician, catalogue and saved-address fixtures.
2. Customer selects appliance/service and uses profile/default-address details.
3. Customer picks a date/window, reviews and submits.
4. Exactly one real request is stored and the My Requests confirmation displays.
5. Admin finds it by Customer ID and records the permitted work progression, actual technician assignment and confirmed appointment.
6. Admin confirms completion through the UI; timestamp, audit/history and one notification persist.
7. Customer sees completion, submits a four-star review and sees their saved review.
8. The same review appears in Admin Feedback. An internal note and handling resolution persist without changing the customer's rating.
9. Temporary request/customer/service/technician/staff fixtures are removed in cleanup.

The test simulates work progression on temporary records; it does not claim that any real technician performed a service. Browser test sessions are seeded for isolated development QA. Interactive real Google account authorization remains a separate external gate.

## API/security coverage

- Customer authentication and ownership required for requests, cancellations, reviews, notifications and linked support.
- Staff role checks required for operations, feedback handling and catalogue changes.
- Completed requests only; rating 1–5; one review per request under concurrent submissions.
- Staff cannot replace the customer's rating/comment through handling or notes APIs.
- Completion is versioned, creates one notification and one completion event, and rejects stale mutations.
- Cancellation requires an eligible owned request, current version and reason; concurrent cancellation creates one event.
- Concurrent idempotent booking produces one request and one initial history event.
- PostgreSQL DATE roundtrips exactly, including the preferred visit date selected in the browser.
- Google-keyed login, application sessions and concurrent first-sign-in identity linking remain covered by backend tests.
- No private API response is stored in service-worker caches.

## Browser behavior coverage

Mocked-provider/network tests cover app login handling, cross-customer query-cache clearing, redirect safety, missing configuration, blocked Google scripts, failed credentials and missing session cookies.

Customer tests cover draft restore/discard-after-success, contact defaults, repeat request without the old appointment, successful confirmation, failed submission without false success, denied/current-location fallback, durable reminder dismissal, voluntary rating/review, request-linked support, Tamil preference and horizontal-overflow checks.

Admin tests cover dashboard, request table/detail, customer list and feedback list/detail at all four viewport sizes. A total of 55 screenshots were captured in the final run. Selected screenshots are retained in `docs/screenshots`; complete run output is under ignored `test-results/screenshots`.

## Remaining external or optional scope

- **Google OAuth:** real provider still rejects the unregistered local origin. Register `http://localhost` and `http://localhost:5173` in the existing Web OAuth client.
- **Reverse geocoding:** code and fallback paths are implemented. Supply a restricted server-only Google Maps geocoding key to verify a live successful lookup. Reference: https://developers.google.com/maps/documentation/geocoding/guides-v3/requests-reverse-geocoding
- **Geographic coverage:** configure approved `SERVICE_PIN_PREFIXES`. Empty configuration accepts enquiries subject to executive coverage confirmation, not confirmed geographic serviceability.
- **Scheduling:** real technician assignment and confirmed appointment fields work. Automatic matching, technician capacity inventory and online customer rescheduling are not implemented; customers can contact support to arrange changes.
- **Attachments:** no upload/custom-avatar/review-photo controls are exposed until the private Object Storage upload/access lifecycle is verified. Google avatars and initials are supported.
- **Production:** MFA delivery provider and public HTTPS deployment still need configuration. No deployment is claimed.

## Diagnostic incident

An early connection-URL diagnostic failed while parsing a quoted environment value and included the development connection string in tool output. It was not written into source or reports; subsequent diagnostics omit connection values. Rotate the credential shown by that error before sharing execution logs. Do not paste it into issue trackers or documentation.
