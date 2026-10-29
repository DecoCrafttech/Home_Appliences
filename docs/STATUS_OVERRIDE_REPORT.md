# Administrative status overrides

22 October 2026. This policy supersedes the earlier three-choice status control and its final-state restriction, following the user's new master prompt.

## Audit and implementation

The existing POST status endpoint enforces technician workflow transitions and report-based completion. It remains available for ordinary operations. The new `PATCH /api/v1/admin/requests/:id/status` is a separate administrative override, using the existing authentication and transactional idempotency middleware.

`ChangeRequestStatusModal` is reused in unified request rows, their Actions menus, and Request Details, including completed/cancelled records. Existing service/installation URLs redirect to the unified workspace. The modal shows the six-digit reference, customer, appliance and current status, and supports Pending, Technician Assigned, In Progress, Completed, On Hold and Cancelled. No next-status restriction is applied to authorized overrides.

SUPER_ADMIN, ADMIN and OPERATIONS_MANAGER may override. Other roles cannot. Every change requires an internal reason and expected request version. Completion additionally requires a verified completion note. Leaving a completed/cancelled state requires an explicit reopening checkbox and backend `confirmReopen` confirmation.

## Data policy

- Pending maps to REQUESTED; On Hold remains the distinct ON_HOLD status.
- Setting Technician Assigned manually selects a verified, active-account technician without appliance-skill matching and creates a pending offer. The technician must explicitly accept or reject it in My Jobs; acceptance is never fabricated, and private customer contact/address details remain hidden until acceptance. The administrative status override and offer/acceptance remain separately audited.
- Replaced pending offers are explicitly withdrawn when a manual override is saved, with assignment history and a technician notice. Accepted assignments remain real until cancellation; a different technician cannot replace an accepted owner through a status override.
- Administrative completion is recorded in the override ledger and audit. The first completion summary is inserted only if absent. An original completion summary and all work-report/feedback history are preserved on reopening and recompletion.
- Reopening clears the current `completed_at`; original timestamps remain in history/completion records. A new review is allowed only while the canonical booking is COMPLETED. Existing feedback remains readable, and the one-review-per-booking uniqueness rule remains in force.
- Cancellation cancels active offers/assignments with assignment history, supersedes pending reschedule proposals, clears current technician/appointment pointers, and revokes technician contact access. Completion also supersedes pending reschedule proposals. Reopening never resurrects a cancelled assignment. Previous technician and visit details remain in the administrative audit.
- Ordinary workflow changes reset status_source to WORKFLOW. Existing database scheduling constraints still reject resource conflicts.

## Atomicity and notifications

The existing idempotency transaction surrounds the whole PATCH. A request row lock plus expectedVersion prevents competing updates from both committing. Override entries are unique by request/version. A same-status no-op adds no history. Status event, administrative ledger, actor/timestamp audit, cancellation effects, completion record and notices commit together.

Customer and technician notice keys contain the booking/version; staff notices use recipient/event uniqueness. Manual assignment offers also create a technician notice keyed to the offer. Customer/technician messages do not expose the internal reason. The public timeline uses a neutral administrative update message. Notifications load once for the unread badge and refresh when the bell or in-panel Refresh control is clicked; focus, visibility changes, polling, and unrelated mutations do not trigger reloads. No email workflow is configured.

Migrations 0021-0022 were applied only after verifying Neon project snowy-hill-87120042 and development branch br-gentle-wind-b4tsvt43. Production was not migrated or deployed.

## Verification

The complete API/unit/integration run passed 92/92 across 18 files in 507.69 seconds, including five live status-override cases and seven rate-limit cases. Coverage includes manual technician offers and explicit acceptance, completion/reopening with preserved feedback, old-cancellation pointer cleanup, contact/address privacy, version concurrency and option-price snapshots.

The complete browser run passed 83/86 in 10.2 minutes. Its three failures were ambiguous test selectors in the new technician completion checks and the legacy Admin Notifications flow. Corrected three-role notification checks passed 3/3. Both complete live technician lifecycle reruns passed, 2/2 in 4.2 minutes, including completion attribution and customer review. The failure explanations are recorded in FINAL_TEST_REPORT.md. Responsive status/appliance checks passed at all five widths.

The shared API rate limiter no longer applies to notification/request/job routes or their nested actions. Authentication protections remain enabled; see RATE_LIMIT_CHANGE.md. Initial verification failures caused by a missing mandatory synthetic booking key and ambiguous select labels were corrected before the runs above.
