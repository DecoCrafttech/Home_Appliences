# Request actions and simple technician UI

Implemented in the existing applications on 25 October 2026.

## Admin requests

- Request rows group appliance/service under the request reference, with customer, schedule/area, technician, status and actions in six columns.
- Phones and tablets use aligned cards with service icons, customer contact, visit and assignment details. Pagination appears only when needed.
- Assign/Reassign Technician is a visible primary action. New requests can be assigned without a separate review screen: confirming the technician records the existing review transition, then sends the offer using the returned request version.
- Complete is an icon-labelled green action on work in progress. Managed assignments load the actual work report for confirmation and use the existing report approval endpoint. Legacy assignments retain the existing completion form. Status changes and secondary actions remain in More actions.
- Assignment selection omits repeated eligibility badges and raw technician UUID rows. The backend still verifies skills, area, availability and account eligibility.

## Technician

- Home has a compact three-column workday summary, accessible refresh icon, actual completed-today count and upcoming jobs with Continue and Complete actions.
- My jobs also exposes the icon-labelled Complete job action during accepted work in progress.
- Card completion loads the current job. If needed, it collects the required work summary and checklist, saves the report, reads the new request version, then completes the job. A failure after the report is saved preserves it; explicit retry does not create another report. Completion requires resolved work and a clear estimate decision.
- The opened job contains visit/contact controls and the work report. **Appliance details and customer notes**, **Diagnosis and additional work estimate**, and **Contact operations** sections were removed. The estimate creation editor is no longer exposed there. Existing pending/declined estimate records continue to block completion until their decision is resolved.
- Call and Directions share a compact action row. Desktop places the visit card alongside the report; mobile uses one column.
- Profile shows one identity card, concise skills/area information and disclosures for personal editing, availability and security. Desktop technician navigation uses the white-and-blue identity.

Authentication, API paths and the database schema remain compatible. No fixture data was added to application screens.

## Verification

| Check | Result |
| --- | --- |
| Initial card actions, technician flow, status menus, assignment safety and responsive checks | 37 passed |
| Final admin layouts, card actions, technician workflows and three-role request measurements | 28 passed |
| Compact-contact/desktop-layout follow-up | All 11 technician flow checks passed |
| Real booking, direct request-list assignment, technician acceptance and approved rescheduling | Passed, 2.5 minutes |
| Real SERVICE lifecycle through photo upload, report, technician card completion, admin/customer state and customer review | Passed, 2.9 minutes |
| All-workspace TypeScript checks, lint and production builds | Passed; technician rebuilt and lint rerun after final contact layout |
| Built PWA manifests, service workers, Chrome installability and offline shells | All three passed; private API cache empty |

Browser checks cover duplicate clicks, decline/retry, partial completion failure/retry, fresh versions between report and completion, required checklists, legacy estimate blocking, personal settings and history navigation. Network measurements show no repeated home requests over 61 virtual idle seconds. Responsive checks include 360, 390, 768, 1024 and 1440 px. Follow-up runs repeat relevant cases after later refinements.

Real persistence tests used the verified development project `snowy-hill-87120042`, branch `br-gentle-wind-b4tsvt43`, with fixture cleanup hooks. Layout/action fixtures are confined to tests and screenshots. Existing Vite bundle advisories remain; physical calling/maps applications and device installation need physical-device checks.

## Screenshots

- [Admin phone requests](screenshots/request-simple/admin-requests-360.png) · [tablet](screenshots/request-simple/admin-requests-768.png) · [desktop](screenshots/request-simple/admin-requests-1440.png)
- [Technician Home](screenshots/request-simple/tech-home-390.png) · [desktop](screenshots/request-simple/tech-home-1440.png)
- [Technician Profile](screenshots/request-simple/tech-profile-390.png) · [desktop](screenshots/request-simple/tech-profile-1440.png)
- [Simple job page](screenshots/request-simple/tech-job-360.png) · [desktop](screenshots/request-simple/tech-job-1440.png)
