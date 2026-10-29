# Technician flow simplification

Current card completion actions and removal of the three job-page sections are documented in [Request actions and simple technician UI](REQUEST_ACTIONS_AND_SIMPLE_TECH_UI.md).

Implemented directly in the existing technician PWA on 25 October 2026.

## What was removed

- Broken Earnings and Support links from Profile. Operations assistance remains available inside the relevant job.
- Duplicate decline and completion controls/dialogs on list cards. Cards now have one primary link: Review assignment or View job. Acceptance, decline and completion happen in the job context.
- Repeated View Location, Copy address and Share Location controls from technician screens. Call Customer and Get Directions remain available after acceptance.
- Pagination when the result fits on one page, repeated page guidance, empty appliance-note panels and empty estimate panels before work begins.
- Internal implementation text about server price calculation and tax configuration.

## Working flow

1. Review the offer's appliance, area and preferred visit. Accept it, or open Decline job to choose a reason. Contact details remain private until acceptance.
2. Wait for operations to confirm the appointment. Only then are On the way, I have arrived and Start work offered in order.
3. Complete the work summary, checklist and outcome. Parts/notes are optional and collapsed; unresolved-issue fields appear for unresolved outcomes. Optional completion photos remain supported.
4. Submit the work report, then confirm completion after reviewing it. The existing backend transitions and separate completion confirmation are retained.

Additional work estimates remain an optional branch during work. A pending or declined estimate blocks report submission/completion consistently with the backend. Revising an existing estimate requires opening Revise estimate. Customer approval returns the job to normal work.

Profile retains availability, hours, leave, personal editing, photo upload, password changes and authenticator security. Personal editing and account security open on demand. History remains available through the completed-jobs filter and its existing route.

## Reliability

- A synchronous guard protects job mutations and uploads from repeated clicks while pending.
- Existing version checks, API idempotency and retry keys remain. Decline failures preserve the chosen reason; a successful decline returns to the job list.
- Job mutations invalidate the relevant job, lists, dashboard and schedule instead of every technician query. Declining does not refetch a job that is no longer assigned.
- Opening a different job resets local report, photo and estimate form state.
- List view, type and pagination follow the URL. Returning to My jobs from history resets the visible filters correctly.
- Dashboard/list polling remains disabled. Active job detail refresh remains bounded and visible-only.

## Verification

- Focused flow coverage: six tests passed, including phone/desktop acceptance-to-completion, estimate gating/revision, decline failure/retry, blocked completion and profile/history navigation.
- Final follow-up after URL/filter synchronization: all 14 populated-card, flow/profile and workday checks passed. Technician production build and lint passed again.
- Populated cards at 360/390/768/1440 px, dashboard shortcuts, three-role network measurements and workday navigation passed. The initial combined run had three failures in new select locators; using accessible combobox locators corrected them, and the complete six-test flow file passed its clean rerun.
- TypeScript, lint and all four production builds passed.
- All three production PWAs passed manifest, service worker, Chrome installability and offline shell checks. No private API responses were cached.
- Database identity was verified before persistence tests: development project `snowy-hill-87120042`, branch `br-gentle-wind-b4tsvt43`.
- Both real SERVICE and INSTALLATION lifecycles passed, including assignment/acceptance, progress, estimate approval, photo upload, report, completion and customer review (two tests, 7.0 minutes).
- Real catalogue/booking/provisioning/reschedule lifecycle passed; the old visit stayed confirmed until operations approved the technician's proposal.

The backend routes, authentication and schema were unchanged. Existing bundle-size advisories remain; physical calling/maps apps and physical-device installation require device checks.

## Screenshots

- [Phone job list](screenshots/technician-flow/jobs-390.png)
- [Desktop job list](screenshots/technician-flow/jobs-1440.png)
- [Phone work report](screenshots/technician-flow/report-360.png)
- [Desktop work report](screenshots/technician-flow/report-1440.png)
