# Fixbeez admin and technician UI refresh

Implemented the customer PWA's premium visual language across the admin and technician applications, with new dashboard compositions and functional right-aligned global filter dropdowns. The original Fixbeez PNG logo is reused unchanged.

## Interface changes

- Shared staff stylesheet: local Inter font, navy text, white surfaces, restrained purple accents, yellow primary actions, soft borders/shadows, rounded cards, and controlled golden honeycomb header decoration.
- Updated shared navigation, headers, tables, forms, dialogs, calendars, empty/loading states and job screens through the existing components. Customer styling remains scoped separately.
- Admin overview: operations hero with the real attention count, six operational metrics, visible request activity and team allocation, and existing attention and assignment actions.
- Technician workday: personalized greeting, completed-today signal, existing daily totals and actionable job cards. Filtered views show the backend's matching total separately from the number of jobs displayed.
- Mobile layouts retain admin's drawer and technician's bottom navigation. Filter controls remain on the right and fit narrow viewports.

## Filters and preserved behavior

- Admin: Today, Last 3 days, Last 7 days, This month and validated custom dates. Apply commits one range to the existing summary, activity and allocation queries. Selection persists using the existing localStorage keys. Reset restores seven days.
- Technician: existing active, assigned, today, upcoming, in-progress, completed, weekly and all-job views; service/installation type; supported visit-date or week-start selection. URL parameters carry the selected filters into My Jobs, and applying changes resets pagination.
- Both dropdowns stage changes until Apply, discard unapplied edits when reopened, close on outside click or Escape, and return focus after Apply/Reset/Escape.
- Technician's default dashboard still uses `/dashboard`. Filtered workday views use the existing `/jobs` endpoint and its `meta.total`; no totals are estimated from a limited page of jobs.
- Existing authentication, authorization, booking, assignment, contact, visit progress, hold restrictions and completion workflows remain in place. No backend endpoints were added or replaced.

## Validation

- Admin and technician TypeScript checks passed.
- Production builds passed for admin, technician and customer, including PWA service-worker generation. Vite still reports large JavaScript chunks; this UI change does not introduce code splitting.
- 30 browser tests passed across admin controls/layout, technician workflows and assignment safeguards. Admin page checks cover 15 routes at 360, 390, 768, 1024 and 1440px. Technician contact/progress/hold checks cover 320, 360, 768 and 1440px.
- The two new filter tests passed again after final visual refinements: staged versus committed queries, synchronized admin ranges, persistence/custom-date validation/reset, technician server totals and navigation, popup fit at 320/360/390/430/1440px, and Escape focus restoration.
- Desktop/mobile screenshots were reviewed. Browser fixtures use mock API responses; this is not a live-data or deployment verification. Existing unrelated backend/lint issues are outside this change.

## Main files

- `packages/ui/src/staff.css`
- `packages/ui/src/FilterDropdown.tsx`
- `apps/admin-pwa/src/Dashboard.tsx`
- `apps/admin-pwa/src/DashboardFilters.tsx`
- `apps/technician-pwa/src/TechnicianApp.tsx`
- `apps/technician-pwa/src/JobFilters.tsx`

Preview captures: `test-results/fixbeez/admin-overview-desktop.png`, `admin-overview-mobile.png`, `admin-filters-mobile.png`, `technician-workday-desktop.png`, `technician-workday-mobile.png`, and `technician-filters-mobile.png`.
