# Fixbeez customer Home redesign

## Composition

Replaced the nested yellow hero with a flat composition: a top yellow-to-white wash, compact personalized greeting, one purple promotion, three consistent white quick-action cards and an eight-appliance photo grid. Golden honeycomb is confined to two non-repeating header-corner accents. Existing five-tab navigation and the elevated booking action remain.

The original Fixbeez PNG is unchanged (its SHA-256 matches the supplied design-kit PNG). Both header and promotion use the existing `BrandLogo` component with `object-fit: contain`.

## Implementation

- `apps/customer-pwa/src/home.css`: responsive Home composition and photographic appliance cards; mobile four-column grid and desktop eight-column grid.
- `apps/customer-pwa/src/App.tsx`: greeting, promotion and quick-action markup; existing profile, request, draft, authentication and navigation behavior retained.
- `apps/customer-pwa/src/appliancePresentation.ts`: display names, image mapping and category aliases, including Geyser → Water Heater and Microwave → Microwave Oven.
- `apps/customer-pwa/src/PublishedServices.tsx`: actual catalogue IDs remain the service-list destinations; photo components replace generic appliance icons.
- `apps/customer-pwa/public/appliances/`: locally hosted, consistently sized product photographs. All required images are included by the existing PWA image precache pattern.
- `tests/browser/fixbeez-home.spec.ts`: requested widths, eight destinations, image loading, quick actions, navigation and missing-category behavior.

## Catalogue behavior

Home shows Air Conditioner, Refrigerator, Washing Machine, Television, Water Heater, Microwave Oven, Mixer Grinder and Other Appliances in that order. Selecting a configured appliance opens its existing scoped service endpoint and preserves its real category/service IDs in the booking link. The Services page continues to show all configured categories.

The inspected live catalogue currently has no Mixer Grinder category. Its Home tile opens an explicit empty services page; no backend ID, service record, price or booking capability is fabricated. Once that category is configured, the tile automatically uses its real ID. Other missing required categories receive the same treatment.

## Photograph sources

Photos were downloaded and prepared as 400×300 PNGs by trimming exterior whitespace and resizing while retaining each full appliance. The Fixbeez logo was not processed. Original asset URLs are recorded in `apps/customer-pwa/public/appliances/sources.json`.

| Appliance | Source |
| --- | --- |
| Air Conditioner | LG product gallery, `lg.com` |
| Refrigerator | A-Stage refrigerator support/product photograph, `a-stage-inc.jp` |
| Washing Machine | LG product listing, Fujioka, `fujioka.com.br` |
| Television | Samsung product listing, Power, `power.fi` |
| Water Heater | Bajaj product listing, Reliance Digital, `reliancedigital.in` |
| Microwave Oven | LG product listing, Top-Tehno, `top-tehno.store` |
| Mixer Grinder | Philips product listing, Reliance Digital, `reliancedigital.in` |
| Other Appliances | Appliance group photograph, Astron, `astron.com.ph` |

These are category illustrations. The interface does not assert a manufacturer affiliation or product warranty.

## Verification

- Customer production build passed, including TypeScript and service-worker generation. The existing Vite JavaScript chunk-size advisory remains.
- Focused ESLint passed for changed components, the presentation mapping and browser tests.
- **38 browser checks passed**: new Home layouts at 360/390/430/1440px, all eight scoped destinations and booking IDs, missing-category behavior, existing appliance multi-option booking, draft/back navigation, customer requests/feedback, geolocation fallback and simulated Google sign-in.
- Reviewed final screenshots at the requested widths. Previews: `test-results/fixbeez-home/home-360.png`, `home-390.png`, `home-430.png`, `home-1440.png`.
- No backend, authentication contract, database record or original brand artwork was changed for this Home redesign.
