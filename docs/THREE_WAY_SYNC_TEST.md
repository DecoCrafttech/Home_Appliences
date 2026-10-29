# Three-way synchronization verification

Updated 22 October 2026.

## API integration

`npm test` passed all 58 tests across 12 files against the configured development environment. The technician integration suite exercises service and installation jobs: invitation activation, session isolation, CSRF, strict profile validation, exclusive offers, ownership, appointment-dependent progress, customer estimate decisions, report revisions, operations approval and customer ratings. It also tests competing offers, access withdrawal on reassignment, suspension, single-use recovery, authenticator enrollment and actual private object upload/retrieval with unsigned access denied.

## Browser verification

The final combined run of `npx playwright test tests/browser/technician-workflow.spec.ts --reporter=line` passed both service and installation tests in 4.5 minutes. Progress checks now wait for enabled controls before starting API-response timers and assert successful responses. Responsive checks wait for loaded content and reject error views before checking overflow and taking screenshots. Earlier runs had intermittent failures, so this records a passing final run rather than a guarantee of timing stability.

The journeys use three isolated browser contexts for operations, technician and customer identities. They cover secure activation, sign-in, an offered assignment with hidden contact details, acceptance, appointment confirmation, en route/arrived/start transitions, a customer-approved INR 250 estimate, a private completion photo, a checklist/report, operations completion review and a real customer rating. Layout checks cover home, jobs, schedule, profile and notifications at 360, 390, 768 and 1440 pixels.

Twenty loaded technician screenshots are saved under `docs/screenshots/technician-*.png`.

## Built PWA verification

`node scripts/check-pwa.mjs` passed against local production previews at ports 5184 and 5183. Both applications passed manifest, Chrome installability, service worker and offline shell checks. No private API responses were found in caches; private fetches were unavailable offline. This verifies browser behavior, not installation on a physical device.

## Limits

No production migration or deployment was performed. Production Google origins, external invitation delivery, production MFA configuration and physical-device native installation remain unverified. Test fixtures use the guarded development Neon branch; synthetic records and uploaded objects are cleaned up by the workflow tests.
