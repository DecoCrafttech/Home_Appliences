# Duplicate action audit

Updated 22 October 2026.

## Shared protections

All three clients use the shared API protection layer. A capture-phase synchronous lock blocks repeated click/submit events while an operation starts, including Enter submissions. `useSafeMutation` adds a ref guard and TanStack mutation state for the new assignment and status flows. Existing busy controls were upgraded to shared spinner buttons. Concurrent identical API calls are coalesced in memory.

Operation identifiers are persisted by a SHA-256 fingerprint scoped to role and authenticated identity. Storage contains only the digest, random operation key and expiry, not form contents. Unknown/failed outcomes retain a retry key for seven days; confirmed successes retain it for two minutes to cover accidental resubmission. Denied browser storage falls back to synchronous/in-memory protection. Booking keys also persist in the existing customer-scoped draft.

Authenticated business writes run through `idempotentMutations`. The middleware authenticates the current session (and technician CSRF) before replay. Staff scope includes role. It begins a PostgreSQL transaction, takes transaction-scoped advisory locks, checks the key and canonical payload fingerprint, runs the existing route in that transaction, creates relevant in-app notifications, stores the response and commits before sending it. Disconnects do not cancel a committed operation. JSON and 204 responses both wait for commit.

Identical key/payload retries return the saved status and response. Changed payloads return 409. Concurrent separate-tab keys with identical payloads are deduplicated within a ten-second accidental-submission window. Explicit keys support durable retries beyond that window. Response records expire after seven days and expired records are removed on subsequent business writes. Booking payload hashes remain on the booking, so reusing a booking key with changed details is rejected even after replay-record expiry.

Login/MFA, single-use activation/recovery links and presigned uploads keep their dedicated security lifecycle. They are not stored as general replay responses. This avoids persisting raw invitation/recovery secrets or reusing an upload reservation for a different image of equal size. Their frontend controls still use synchronous locking; upload confirmations and session/token constraints remain server-validated.

## Domain checks

| Operation                                                | Additional server protection                                                                                                                                |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Service/installation request                             | Existing unique customer/idempotency key; canonical payload validation; atomic initial history event                                                        |
| Address, technician, support ticket/reply, handling note | Actor-scoped replay transaction and short accidental-submission fingerprint window                                                                          |
| Profile/settings                                         | Safe frontend controls; authenticated validated updates; business profile writes use the transaction layer; account-security routes retain their own checks |
| Assignment                                               | Request version CAS, verified skill/area/availability checks, scheduling validation, unique live assignment, atomic offer/history/audit/notification        |
| Accept/reject                                            | Assignment ownership, CSRF, offer version/state checks, atomic booking and assignment updates; same target state is idempotent                              |
| Progress/status/reschedule                               | Owner/role checks, request version CAS, valid transitions, appointment exclusion constraint; identical target state creates no extra history                |
| Estimate and decision                                    | Versioned owned estimates, immutable decision rules and transactional replay                                                                                |
| Work report                                              | Version CAS and existing submitted-report guard; immutable report versions; replayed response on retry                                                      |
| Completion                                               | Existing unique completion report and atomic completion flow; managed assignments require report review                                                     |
| Review                                                   | One review per request, completed/owned request eligibility, transaction/replay and unique constraint                                                       |
| Notifications                                            | Recipient ownership, unique event keys and read state updated with COALESCE                                                                                 |

## Database audit

`workflow-db-audit.json` is a read-only audit of the guarded development branch. The initial and final post-test audits found no potential duplicate bookings, duplicate active assignments, duplicate reviews/completion reports/technician notification keys, stale assignment references or repeated identical status/note events in one minute. No historical business data was deleted or merged. A matching booking tuple or repeated status is only a remediation candidate, not proof of duplication; any future finding requires ownership and business review.

## Regression coverage

API tests cover triple concurrent submission, same-key replay after a discarded result, changed-payload conflict, separate-tab keys, validation rollback, session revocation, booking replay expiry, competing offers, stale versions and duplicate progress/completion/reviews. Browser tests cover rapid assignment triple-click, pending spinner, blocked Escape, preserved failed selection, Enter retry with the same key, duplicate acceptance/report/review submissions, and one persisted result. See `THREE_PWA_SYNC_TEST.md` and final results.
