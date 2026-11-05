# Dynamic service catalogue

## What changed

The main failures came from customer components overriding API images with fixed local artwork, name-based filters hiding valid entries, the missing parent-category relationship, and separate upload forms with an obsolete 256 KB limit. Those paths now use the shared image workflow and database hierarchy. The Zod 4 upgrade also required a compatible form resolver; both frontend workspaces now use it. Booking waits for saved addresses to finish loading before allowing the address step to continue.

The existing catalogue now has three levels: category, item, and service/installation entry. `catalogue_categories` is the new parent table; existing `appliance_categories` and `service_catalogue` remain the item and entry tables, with their existing IDs and booking relationships. No application or authentication system was replaced.

Admin's **Service Catalogue** workspace supports category and item creation/editing, images, published/draft visibility, enabled/disabled status, archive, search, ordering, item moves between categories, and separate service/installation tabs. Drag handles and Move Up/Down buttons persist order. Filtered lists cannot be reordered accidentally. Entry forms retain configurable pricing/options and booking questions; a new entry without custom options gets a quote-based visit option.

Customer discovery reads active, published categories, items, and entries from the API, in database order. There are no curated item lists or name-based visibility filters in the browsing/booking flow. Empty, unavailable, loading and network states have recovery actions. The original booking wizard receives the chosen IDs and continues through address, date/time and submission. Operations receive the saved category, item and service names.

The home banner uses the requested default text and a link to category browsing. Admin can edit its headline, description, button label, secondary text and image under **Home banner**. Branding, account sign-in, existing operations and technician workflows are preserved.

## Images

Category, item and entry cards use configured image URLs; local seed artwork is only a database-backed fallback. New uploads do not require a frontend deployment. API-relative image URLs resolve against the configured API origin in both PWAs.

The shared uploader accepts PNG, WebP and JPEG up to 10 MB, fits or centre-crops images to 4:3 or square, preserves transparency when fitting, and sends optimized WebP to existing object storage. Static SVG remains supported up to 256 KB. The API validates MIME signatures and limits stored images to 2 MB. PostgreSQL stores object keys, content type, size and SHA-256, never base64 image bodies.

An upload-in-progress guard prevents duplicate clicks; the API deduplicates identical images for the same administrator. Explicit upload operation keys avoid replaying discarded uploads. Referenced images, including images on archived records, cannot be deleted. Background cleanup and **Clean unused images** only remove unreferenced images not selected in the last 24 hours. The grace period protects unsaved forms and switching between editor sections. Cleanup runs separately from interactive UI mutation locks.

## Migrations

- `0029_dynamic_catalogue.sql`: category table, parent relationships, order/archive fields, category snapshots on requests, media hash and 2 MB limit. Seeds the two initial parent categories and assigns existing items to them. Existing generic maintenance entries are moved into matching seeded items where applicable; unmatched entries remain available for admin management. Existing records and request snapshots are retained.
- `0030_catalogue_media_cleanup_grace.sql`: image-selection timestamp and cleanup age index.

The migration runner applies each SQL file in a transaction under an advisory lock, records successful migrations, and skips already-applied files. Failed files roll back. The isolated test runner applies pending migrations before tests.

## API changes

Public:

- `GET /api/v1/catalogue/categories`
- `GET /api/v1/catalogue/categories/:id/items`
- `GET /api/v1/catalogue/home-banner`
- Existing appliance/item, service, installation and booking endpoints remain compatible, with parent visibility checks added.

Admin (writes restricted to ADMIN and SUPER_ADMIN):

- `POST/PATCH/DELETE /api/v1/admin/catalogue/categories[/:id]`
- `POST/PATCH/DELETE /api/v1/admin/catalogue/items[/:id]`
- `PATCH /api/v1/admin/catalogue/entries/:id` for status/order
- `PUT /api/v1/admin/catalogue/order` with entity, complete sibling IDs, parent ID and entry type where applicable
- `PUT /api/v1/admin/catalogue/home-banner`
- Existing entry CRUD and image endpoints retained
- `POST /api/v1/admin/catalogue/media/cleanup` for safe aged-orphan cleanup; optional media IDs
- `DELETE /api/v1/admin/catalogue/media/:id` rejects referenced images

`GET /api/v1/admin/catalogue` additionally returns `groups` and the configured banner. Archived records stay in the database for history. Disabled/unpublished/archived parents are checked on public reads and again when a booking is submitted, so stale browser data cannot bypass visibility.

## Verification commands

```powershell
npm run typecheck
npm run build
npm test
npm run audit:test-db -w @home/api -- --create
npm run audit:test-db -w @home/api -- --run --files backend/src/dynamicCatalogue.integration.test.ts backend/src/catalogue.integration.test.ts backend/src/admin.integration.test.ts backend/src/technician.integration.test.ts
npm run test:catalogue-e2e
```

The database runners require and verify an isolated database receipt before creating fixtures. The browser runner starts separate API/Admin/Customer ports and uses real API and object-storage operations. It uses seeded, valid sessions rather than interactive Google sign-in. Storage credentials must be available in the backend environment. Test-created objects and records are cleaned up.

Verified checks include all workspace typechecks and production builds, changed-file ESLint, 66 unit tests, and isolated database/storage suites for catalogue CRUD, image formats and replacement/removal, ordering, parent visibility, booking snapshots, Admin operations, technician assignments and idempotency. The focused dynamic catalogue suite has eight passing integration tests. Browser verification covers Admin creation/uploads/ordering, customer navigation and booking, My Requests, Operations, and responsive widths of 320, 375, 390, 430, 768 and 1440 pixels.

Interactive Google authentication and hosted deployment are outside the browser fixture run. Builds retain existing bundle-size warnings; they complete successfully.

## Deployment

Apply the migrations against the intended backend database **before deploying the new API and PWAs**:

```powershell
npm run db:migrate -w @home/api
```

Keep object-storage credentials server-side, preserve existing API origin/proxy configuration, and deploy the backend and both PWAs from the same commit. A GitHub push does not prove hosting has redeployed. Existing installations may show the PWA update prompt before loading the new assets.

On 5 November 2026, migrations 0029 and 0030 were applied to the configured database after verifying an encrypted backup and database identity. Before/after comparisons confirmed that all three existing requests, three customers, one technician and 70 service records were unchanged, and all 13 existing item IDs were retained. The migration added three maintenance items; it did not remove historical records. Local API smoke checks returned both published categories and the configured home banner successfully.
