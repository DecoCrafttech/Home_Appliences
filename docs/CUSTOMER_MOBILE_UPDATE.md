# Customer mobile layout update — 7 November 2026

Customer-only changes:

- Consistent mobile text sizes, line height and word wrapping; reduced spacing after Back and page headings.
- Book entry uses two compact cards with aligned actions. Mobile Services uses a three-column appliance grid; the large introductory heading is hidden on mobile. Removed duplicate “All categories” links on appliance/category detail pages.
- Booking steps 1–4 and Back/Continue/Submit remain above the bottom navigation. The offset follows the navigation's measured height. Earlier steps can be revisited; future steps remain disabled until validation passes. Reserved scroll space keeps the last form fields reachable.
- Location opens the editable address form even after a saved address was selected, retries GPS after network-position failures, fills only non-empty returned address fields, and provides persistent permission/lookup error guidance. It does not overwrite the house/street or contact details.
- My Requests status tabs scroll horizontally without collapsing their labels. Refresh controls use accessible icon buttons and retain a loading spinner.
- Request details show a compact top Call Admin card using `adminOfficePhone` from the existing Business Settings-backed configuration endpoint. No number is hardcoded and no backend/settings/database changes were made. The production configuration returned a populated office number during this work.

## Verification

```powershell
npm run build -w @home/customer
npx playwright test -c playwright.customer-mobile.config.ts
```

The Customer build passed. Six browser regression scenarios passed, covering layouts at 320/360/412px, no horizontal overflow, grids, tabs, admin contact, all four booking steps, the fixed controls, GPS success, permission denial, GPS retry and unavailable address lookup. API/GPS behavior is mocked in these tests; no real bookings are submitted. Screenshots are in `test-results/customer-android`.

## Deployment and phone check

### Request-details follow-up

Home no longer has a Call Admin action. Request details now use a compact summary header, aligned overview/visit cards and a separate service-address card. Active requests retain Business Settings-backed admin contact and assigned technician actions. Once the request status is `COMPLETED`, structured admin, technician, customer telephone and address sections are no longer rendered; stored records are not deleted. The rating form or saved review is the first card, above the request summary. Review submission and refresh continue to use the existing API. Additional browser checks cover Home, completed requests at 320/360/1024px, review-card ordering/width and successful rating submission.

Deploy the Customer build or create the upload ZIP with `powershell -File scripts/package-customer-hostinger.ps1`. Keep `.well-known` and `.htaccess` in the upload. The hosted PWA supplies these UI changes to the existing TWA; this update does not rebuild Android or change its signing key/package.

On the actual Android phone, allow location for FixBeez/Chrome and enable device Location, then test “Use My Current Location.” A real authenticated production geocoding request could not be exercised here. The existing backend lookup requires a configured `GOOGLE_GEOCODING_API_KEY`; if the page reports “Address lookup is not configured,” that production server setting must be supplied by the operator. No public/client geocoding key or external fallback service was introduced. Manual address entry remains available when permission, positioning or lookup fails.
