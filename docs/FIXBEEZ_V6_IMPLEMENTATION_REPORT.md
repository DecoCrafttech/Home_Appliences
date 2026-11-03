# Fixbeez Customer PWA: Premium Minimal V6

## Result

Implemented V6 directly in the existing customer application. Home now uses a compact personalized greeting, working catalogue search, a light promotional hero with the requested headline and CTA, consistent quick actions, and four initial photo-led appliance cards. View All opens the full catalogue. The mobile catalogue uses two columns with 16px gutters, 12px gaps, white footers, neutral borders and image regions occupying approximately two-thirds of each card.

The five destinations remain **Home | Services | + Book | My Requests | Profile**. Existing Google authentication, profile data, request endpoints, service/installation workflows, drafts, preferred scheduling, feedback and support remain in use. No backend or database contracts were changed.

## Implementation map

| Area | Files and behavior |
| --- | --- |
| Customer theme | `apps/customer-pwa/src/v6.css`: predominantly white surfaces, restrained header honeycomb, light hero, local Inter, solid neutral skeletons, accessible semantic foregrounds, responsive cards, selected states, safe-area spacing and reduced motion. |
| Home and search | `App.tsx`, `CatalogueSearch.tsx`: real identity/avatar, exact hero headline, functional clearable appliance/service search, no scanner, no fake offers, no carousel controls or unverified trust claims. The full service catalogue is requested only when a search query is entered. |
| Appliance catalogue | `appliancePresentation.ts`, `PublishedServices.tsx`: 11 category presentations, actual backend category IDs, local optimized images and appliance-specific service routes. Home initially shows four categories; search can reveal further matches. |
| Service rows | `servicePresentation.ts`, `PublishedServices.tsx`: compact horizontal white rows with service-specific icons, actual descriptions, chevrons and one clickable surface. Booking links retain both category and service IDs and enter the existing booking-details form. |
| Authenticated startup | `lib/profile.ts`, `main.tsx`, shared `LaunchExperience.tsx`: shared cached profile query resolves before app reveal; no signed-out flash, no extra profile request and no repeated splash on client-side navigation. Network failures expose recovery rather than a false signed-out state. |
| Splash | Shared `LaunchExperience.tsx`, customer `v6.css`: white background, light yellow glow, original PNG, 0.92-to-1 fade/scale, one subtle float, staggered corner honeycomb and fading tagline. Visual sequence is about 1.2 seconds, gated only by genuine session loading; reduced motion skips the sequence. Existing optional onboarding remains available. |
| Skeletons | Shared `skeletons.tsx`, `essentials.css`, `brand.css`: HomeHeaderSkeleton, HeroBannerSkeleton, ApplianceCardSkeleton, ApplianceGridSkeleton, ServiceCardSkeleton, RequestCardSkeleton, RequestDetailsSkeleton, ProfileSkeleton and FeedbackSkeleton. All blocks use solid `#F1F2F4`, no gradients, no moving overlay and gentle opacity pulsing. Static hero content does not acquire an artificial loading delay. |
| Empty/error states | Shared `emptyStates.tsx`, `widgets.tsx`, customer `components/ui.tsx`, `Aftercare.tsx`, `WorkflowPages.tsx`, shared notifications: one reusable component accepts an icon/illustration, title, description and optional actions. Relevant request, service, search, notification, feedback, network, booking, completed and auth states replace repeated generic search icons. Errors remain distinct from successful empty responses. |
| Booking and confirmation | `BookingWizard.tsx`, `Aftercare.tsx`: preserved validation, back navigation, location fallback, scheduling, review, duplicate prevention and real returned request IDs. Failed submissions retain entered details and offer retry. Success shows **Request Submitted!**, **Our executive will contact you soon.**, View My Requests and Book Another Service. |
| Draft selection fix | `BookingWizard.tsx`: an explicitly selected different category/service takes precedence over an unrelated stored draft. Matching drafts and normal Continue Draft behavior remain intact. |
| Offline assets | Customer `vite.config.ts`: WebP/AVIF included in image precaching; unused earlier product PNGs excluded from precaching. `index.html` preloads the locally hosted Inter font. Existing service worker/update behavior, app scope and authentication APIs are retained. |

## Assets and branding

Generated **11 matching unbranded studio appliance cutouts** with the built-in `image_gen` tool, one call per asset, then converted them to local 640x640 WebP files with alpha preserved. The complete image set is approximately 438 KiB.

Saved project assets:

```text
apps/customer-pwa/public/appliances/v6/
  air-conditioner.webp
  refrigerator.webp
  washing-machine.webp
  television.webp
  water-heater.webp
  microwave.webp
  mixer-grinder.webp
  water-purifier.webp
  kitchen-chimney.webp
  dishwasher.webp
  other.webp
```

The exact common generation prompt and all 11 subject prompts are recorded in `docs/FIXBEEZ_V6_ASSET_PROMPTS.md`. `scripts/prepare-v6-appliances.mjs` records deterministic format conversion; optimized files are already in the repository and neither generation nor conversion is required to run/build the application. An image-set review is saved at `docs/screenshots/fixbeez-v6-assets.png`.

The original Fixbeez logo was not generated, edited, traced or cropped. Its SHA-256 still matches the supplied design-kit PNG: `D63CF3B4125E4FEFCB033E07085A8CE497D49DDA431F58533CFB3F781080BF9F`. The complete original logo remains in the header, splash and onboarding. No separate approved mascot-only image was supplied; the hero uses the coordinated appliance cutouts rather than a recreated mascot.

Inter is hosted at `public/fonts/inter-latin-variable.woff2`; its OFL license is included alongside it. Existing Tamil/system font fallback is retained.
The font is genuine WOFF2 (approximately 47 KiB), preloaded locally and checked as loaded in the final responsive browser run.

## Catalogue and capability limits

- The inspected live catalogue has Air Conditioner, Refrigerator, Washing Machine, Television, Geyser, Microwave, Water Purifier, Kitchen Chimney, Dishwasher and Other Appliances. Geyser and Microwave map to the requested Water Heater and Microwave Oven display labels without changing their IDs.
- Mixer Grinder is not configured in the live backend. Its full-catalogue tile is marked **Not listed yet** and opens an honest empty service page; no counterfeit backend ID, service or price is sent to an API. It will map to the real category once configured through the existing admin catalogue flow.
- No image asset is missing: all 11 requested appliance images are available locally.
- Unavailable services remain unavailable; the interface does not substitute the same generic service list for different appliances.
- Real Google consent/origin configuration is outside simulated provider tests. No production booking or database mutation was fabricated to demonstrate the UI.

## Validation

Production builds and TypeScript checks passed for customer, admin and technician PWAs after shared component changes. Customer build includes all 11 WebP files and the local font in its service-worker precache. Vite continues to emit advisory JavaScript chunk-size warnings.

Focused ESLint passed on the changed customer/shared components and V6 browser tests. The earlier repository-wide lint/generated-cache and backend integration failures documented in the main implementation report were not suppressed or claimed resolved by this UI task.

The combined regression run passed **57 browser tests**. A separate final V6/notification selection passed **15 tests**, and the targeted draft/booking regression selection passed **4 tests**. These selections overlap; the counts are not added together.
The final font/image/layout review also passed **7 tests** across all required mobile widths plus tablet/desktop, with fresh previews saved under `test-results/fixbeez-v6/`.

The browser regression runs cover:

- 320, 360, 375, 390, 430, 768 and 1440px layouts without horizontal overflow.
- Correct 11-appliance catalogue, four Home cards, WebP loading and appliance-specific service/booking IDs.
- Relevant service icons, white service rows and direct booking details.
- Clearable service search with no idle full-catalogue request.
- Solid-grey skeletons with no shimmer and appliance-grid height matching within 16px.
- Relevant request, completed, feedback and notification empty states.
- Genuine catalogue/auth network failures, successful retry and no false empty/signed-out states.
- Normal and reduced-motion cold launch, session restoration and no repeated splash on navigation.
- Existing Google-provider simulation, requests, full booking, feedback, location fallback, month-boundary scheduling, draft/back navigation and failed submission behavior.
- An unrelated saved draft cannot override a newly selected appliance/service.
- Shared technician workflow regression and on-demand customer notifications.

Logs: `fixbeez-v6-build.log`, `fixbeez-v6-admin-build.log`, `fixbeez-v6-technician-build.log`, `fixbeez-v6-lint.log`, `fixbeez-v6-browser.log`, `fixbeez-v6-final-browser.log`, `fixbeez-v6-draft-checks.log`.

Previews are saved under `test-results/fixbeez-v6/`: Home, catalogue and service-list images at each tested width, plus splash and skeleton screenshots. No deployment was requested or performed.
