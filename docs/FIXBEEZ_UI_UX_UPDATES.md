# Fixbeez UI/UX and feature updates — 4 November 2026

Implemented the supplied UI/UX improvement request in the existing three React PWAs and Express API. Existing authentication, permissions, request types, booking idempotency, assignment, reports, estimates, completion and notification delivery remain in use.

## Customer

- Home search now floats over the page, closes on Escape/outside focus and does not shift the promotional section. Removed its typing outline/glow.
- Added Home Maintenance below the promotion, the Services/Installation/Maintenance category cards, four service-benefit icons, and Call Admin using the configured office number. Moved the help link below active requests.
- Services has Services & Installation and Maintenance tabs. Published maintenance services use the existing service booking flow. Appliance names come from the same published categories used by admin; desktop listings fill the available width.
- Removed internal manual-status labels and repeated request-card explanations. Request filters stay on one horizontal row with scrollable mobile tabs. Details show the customer's booking contact and assigned technician's contact.
- Booking has shorter step labels and relevant headings, appliance images, selectable service cards, no nested Book Now/details/change-service buttons, and automatic selection when a service has one booking option.
- Existing saved addresses appear as selectable cards with contact details and Edit/Add new controls. Editing uses the booking's existing contact/address fields. Saved Addresses also supports editing and setting a default through ownership-checked APIs.
- Replaced the date strip and secondary date input with a full month calendar, previous/next navigation, disabled past dates and time selection after choosing a day.
- Preview retains all entered details with scoped Edit links, Back and one submission action. Only the submission button displays submission loading. Draft autosave and the navigation guard remain; the leave popup has a red outlined Discard Changes action.
- Simplified the submitted confirmation and profile, removed the profile request shortcut/push settings, softened Log out, and replaced the booking plus with a calendar icon and Book label.

## Admin

- Removed the Operations at a Glance hero and assignment/appointment shortcuts. Dashboard refresh is an icon beside the date filter.
- Needs Assignment displays reference, customer, appliance, exact requested work, status and aligned actions; Contact Customer is an icon with an accessible label. The queue excludes assigned records.
- Requests use the existing responsive card presentation at desktop and mobile widths. Removed internal manual-status copy and the Start Review pipeline. Request management keeps Assign Technician and Change Status. Work reports remain available when present, the timeline is collapsible, and the redundant support section is removed.
- Appointments has a paginated list of incoming requests and clear statuses. The calendar includes preferred visits before confirmation, completed visits and cancellations; preferred dates are labelled accurately in details. Existing confirmed-appointment rescheduling and approvals remain intact.
- View Assigned opens a responsive technician jobs modal with pagination. Technician/category/support modals have consistent spacing; desktop dialogs are centered.
- Customer phone numbers occupy a separate line. Support conversations have clearer spacing and an actual persisted Ignore status, distinct from Resolved.
- Catalogue is organized into category cards and Kanban-style Services/Installation or Maintenance lanes. Add offers Service, Installation, Maintenance and New Category. Existing service pricing/options/questions/icon/publishing editors are reused. Category editing supports its name, image and publication status.
- Reused the customer appliance image files in admin and included them in the admin PWA precache.
- Removed device display preferences, compact-table controls and the redundant catalogue shortcut from Settings. Kept account security and the office contact used by customers.

## Technician and shared UI

- Job cards expose the existing guarded Complete Job dialog directly; hold/assignment/estimate/report restrictions and single-mutation guards remain enforced.
- Removed internal status copy and the Profile Job History shortcut. Existing contact, progress, directions, profile editing and security remain available.
- All dialogs use a 10% black backdrop. Desktop dialogs are centered; narrow layouts keep responsive dimensions. Notification items and bottom actions have additional spacing and safe-area padding.

## Data updates

- `0026_catalogue_maintenance.sql` adds maintenance category classification, the requested appliance service options, CCTV, AirFiber/Internet and Electrical/Plumbing/Painting. It adds missing records without deleting existing catalogue entries or overwriting authored pricing. New options use quote pricing because the request supplied no prices.
- `0027_installation_descriptions.sql` fills empty installation descriptions with relevant setup, wall/table installation, reinstallation and uninstallation copy.
- Applied both migrations only to the verified isolated `development` branch, `br-broad-breeze-b41iqgjz`, in project `snowy-hill-87120042`. The original seven-day branch had expired; verified the current branch through Neon CLI and database metadata before updating the migration guard. Production was not migrated or deployed.
- New default-address endpoint changes only the authenticated customer's addresses and does not clear a default when given another customer's ID.

## Verification

- Final regression run: **49 browser tests passed** (2.7 minutes), **4 database integration tests passed**; all four production builds passed.
- Customer, admin, technician and API production builds, including TypeScript and PWA service-worker generation.
- Database integration tests: default address ownership/exactly one default, ticket Ignore persistence/filtering, admin-to-customer maintenance publication, and new/cancelled calendar visits.
- Browser checks cover customer home/search, maintenance tabs, saved address editing/defaults, booking calendar/preview/submission, contact details, ticket Ignore, catalogue lanes, technician job modal/completion, admin settings, request completion error recovery, draft privacy/navigation and assignment safeguards.
- Responsive checks include 320, 360, 390, 430, 768, 1024 and 1440px across relevant suites. Visual captures are under `test-results/ui-updates` and `test-results/screenshots`.
- Browser fixtures isolate UI checks from real customer data. Database tests create and remove synthetic records. Existing large-bundle Vite warnings remain; this task does not add code splitting.

Final run results are recorded in `fixbeez-update-final-browser.log`, `fixbeez-update-integration.log` and the four `fixbeez-update-build-*.log` files.
