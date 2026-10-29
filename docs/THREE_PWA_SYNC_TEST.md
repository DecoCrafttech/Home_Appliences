# Three-PWA synchronization verification

## Latest master-prompt revision

The administrative override policy supersedes the earlier final-state restriction: authorized admins can select Pending, Technician Assigned, In Progress, Completed, On Hold or Cancelled directly, with an internal reason, optimistic version and explicit final-state confirmation. Customer/technician notices are version-deduplicated. Manual status is identified separately from actual technician acceptance. Pending offers are withdrawn with history; cancellation revokes accepted contact access; reopening never restores a withdrawn assignment. See STATUS_OVERRIDE_REPORT.md for the completion/review policy.

Customer navigation is now Appliance Grid -> Appliance Services -> Service Details -> Prefilled Booking -> My Requests. Admin-controlled appliance icons/publication and service prices come from Neon. Multiple selected options retain individual server-generated price snapshots. Booking contact is normalized to E.164 and is visible in authorized admin lists/details and accepted technician job cards/details/calendars. Pending offers and unrelated technicians cannot read the phone or full address. See CUSTOMER_SERVICE_FLOW.md.

New API tests exercise manual overrides and reopening, preserved completion/review records, same-key triple submissions, competing versions, multi-option snapshots, category publication and phone revocation. Browser tests exercise the reusable popup and new customer navigation at all five widths. The real catalogue workflow now uploads an appliance icon as well as a service icon, books multiple options, and checks call links in Admin, accepted Technician Details and Schedule. The complete API run passed 92/92. The full browser run passed 83/86, followed by corrections to test selectors; the corrected three-role notification reruns passed 3/3 and both live technician flows passed 2/2 in 4.2 minutes. The final read-only audit has no findings. Details are recorded in FINAL_TEST_REPORT.md. Notification/request/job routes now bypass the shared IP quota while authentication limits remain active (RATE_LIMIT_CHANGE.md). Earlier counts below describe the preceding revision.

Updated 22 October 2026. Database branch: `codex-customer-dev` (tests also accept its configured branch ID). Production is not seeded or migrated.

## Canonical lifecycle

Customer request → admin review → assignment OFFERED → technician ACCEPTED → appointment confirmed → en route/arrived/in progress → optional customer-approved estimate → work report SUBMITTED_FOR_REVIEW → admin approval → booking COMPLETED → one customer review → admin Feedback.

Assignment acceptance and report review remain separate from booking status. Technician report submission does not complete a booking. The customer, admin and technician read the same backend booking and assignment records. No local fake status is used.

## Browser coverage

`technician-workflow.spec.ts` runs both SERVICE and INSTALLATION with three isolated browser contexts, three distinct PWA origins, real development API mutations and a dedicated synthetic service. It creates a request through the customer API, reviews it in admin, uses the shared assignment drawer, triple-clicks Confirm Assignment, checks closure/one toast/one assignment, retries the committed assignment with the same key, double-clicks acceptance, and verifies assignment visibility in admin/customer views.

It confirms an appointment, exercises duplicate progress clicks, submits a real estimate and customer decision, uploads a private test photo, checks appliance-specific checklist/report behavior, approves completion inside admin Request Details, submits one customer review and checks one report/completion/review record. The technician views are checked at 360, 390, 768, 1024 and 1440 pixels after loaded content is present.

`development-lifecycle.spec.ts` retains the existing customer booking wizard and contact-only-technician manual completion regression, plus customer feedback and private/public support conversation behavior. This is explicitly separate from the normal technician-app report-review lifecycle.

`workflow-safety.spec.ts` tests pending/disabled assignment controls, spinner, blocked Escape, preserved selected technician on error, Enter retry/key reuse, drawer focus return/overflow at four widths, and notification open/idle/manual refresh for all three roles.

Existing browser tests retain Google login behavior, draft restoration, booking failure handling, location fallback, responsive customer/admin layouts, catalogue/technician editing, profile security forms and feedback controls.

`redesign-lifecycle.spec.ts` uses the actual admin catalogue wizard to create two priced options, upload an approved SVG and publish. It checks public discovery and image loading, customer booking with a preserved price snapshot after a catalogue price edit, username/temporary-password provisioning and forced first-login change, assignment acceptance, and technician proposal/admin approval of a new appointment. Confirmed times are checked in the customer request and both calendars.

`redesign-ui.spec.ts`, `calendar-controls.spec.ts`, `booking-navigation.spec.ts` and `estimate-refresh.spec.ts` add responsive inbox/dialog navigation, Day/Week/Month/Agenda controls, drag confirmation/conflict handling, browser Back/save/discard behavior, and selective estimate refresh without unrelated profile refetches. These intercepted tests validate UI/network behavior; they are separate from the live database workflows.

## API integration coverage

The integration suites exercise ownership, staff roles, technician CSRF, single-use activation/recovery, authenticator enrollment, availability, schedule conflicts, competing assignment offers, reassignment access withdrawal, stale booking versions, repeated status transitions, rescheduling, report corrections, completion prerequisites, review uniqueness and private storage retrieval.

The new idempotency suite tests triple concurrent creates, replay of a committed result, key/payload mismatch, actor isolation, separate-tab keys, rollback of invalid input and revoked-session replay denial. Booking tests expire a replay entry and confirm that changed details still cannot reuse its durable booking key.

## Notifications and email

Notifications remain in-app and persisted. Current recipient/role/read state is checked by backend authorization. Inbox queries have no periodic polling; browser clock advancement verifies no short-interval refetch, and explicit Refresh retrieves current data. No active email sender, worker or email dependency was found; no email audit/history table was removed. Recovery continues through existing secure, manual-link workflows.

## Results

The current revision passed 80 API/unit/integration tests across 16 files. The complete final browser run passed 70/70 in 11.4 minutes. See `FINAL_TEST_REPORT.md` for final pass/fail counts, commands, screenshots and environment limitations. Earlier passing subsets do not certify the final full suite.
