# Catalogue deletion and transparent artwork

## Requested interface changes

- Admin service and installation tiles have a Delete action. A confirmation identifies the selected item and appliance. Cancel makes no API call; pending controls are disabled; failures retain the item and allow retry. The existing guarded `DELETE /admin/catalogue/services/:id` endpoint deactivates catalogue entries and preserves existing request snapshots.
- Replaced the customer image rectangles with genuine transparent cutouts. Category cards use lavender for Services, warm yellow for Installation and soft mint for Maintenance. Appliance image wells have no background fill.
- Recreated `.v6-hero-art` as one purpose-composed, transparent appliance family image instead of layering three separate product photographs.
- Customer and admin use the same mapping in `packages/ui/src/applianceImages.ts`. The asset preparation script writes identical appliance and category image bytes to both apps.
- Mixer Grinder is removed from customer discovery, search and booking choices and from the admin category picker. Other Appliances remains excluded from customer selection.

## Artwork and saved paths

Used the built-in imagegen tool: background-extraction edits for 14 existing product/category assets and a new appliance-family hero. Source foregrounds were preserved while removing studio backdrops and floor shadows. Images are encoded as WebP with their alpha channels intact. Preparation checks actual pixel alpha, transparent area and opaque foreground before saving.

- Customer appliance cutouts: `apps/customer-pwa/public/appliances/v8/` (11 files).
- Matching admin cutouts: `apps/admin-pwa/public/appliances/v8/` (the same 11 files).
- Customer category cutouts: `apps/customer-pwa/public/categories/v8/` (`service.webp`, `installation.webp`, `maintenance.webp`).
- Matching admin category images: `apps/admin-pwa/public/categories/v8/`.
- New customer hero: `apps/customer-pwa/public/banners/v8/appliance-family.webp`.
- Exact prompts, generated PNG source paths and final destinations: `scripts/v8-image-inputs.json`.
- Asset preparation: `scripts/prepare-v8-images.mjs`.

`0028_retire_mixer_grinder.sql` deactivates the Mixer Grinder category and its catalogue options so old links cannot create new Mixer Grinder bookings. Existing request records remain available. The migration is applied only to the verified development branch; production is not migrated. The database deletion tests use temporary development records and remove them afterward.

## Verification

- Final results: **30 browser tests passed**, **5 database integration tests passed**, customer/admin production builds passed and focused lint checks passed. All 15 generated images passed transparency validation; the matching customer/admin files are byte-identical.
- Browser deletion tests cover Services and Installation, cancellation, triple-click protection, failure/retry with the same operation key, and role restrictions at 360/390/430/1440px.
- Database tests cover catalogue deletion/public filtering and preservation of existing requests, alongside the existing address, ticket, maintenance sync and appointment contracts.
- Image checks cover real transparency, identical customer/admin bytes, category colors, the new hero, correct appliance service routes, Mixer Grinder removal and mobile/desktop layout.
- Final logs: `fixbeez-v8-browser.log`, `fixbeez-v8-integration.log`, `fixbeez-v8-build-customer.log`, `fixbeez-v8-build-admin.log`, `fixbeez-v8-lint.log` and `fixbeez-v8-assets.log`.
- Reviewed screenshots: `test-results/customer-images/home-390.png`, `test-results/v8/admin-images.png`, `test-results/v8/admin-service-actions.png`, `test-results/v8/admin-delete-mobile.png` and `test-results/v8/transparent-assets.png`.
