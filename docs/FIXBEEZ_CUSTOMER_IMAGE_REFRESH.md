# Customer home and appliance image refresh

- Removed the electrical, plumbing and painting service list from Home. Selecting the Maintenance category opens the maintenance catalogue with those services and the existing booking links.
- Services, Installation and Maintenance category cards now use matching AI-generated product artwork.
- Added individual appliance images for AC, refrigerator, washing machine, television, geyser, microwave, mixer grinder, water purifier, chimney and dishwasher. CCTV and AirFiber/Internet also have suitable dedicated images.
- Removed Other Appliances from customer discovery, search results and new-booking appliance choices.
- Appliance cards continue to open their own catalogue services and the existing booking workflow.

## Assets and prompts

Generated **15 separate images using the built-in imagegen tool**. No CLI/API fallback was used. Each image was visually reviewed, resized to 640 × 640 and encoded as WebP at quality 0.88. Total new assets are approximately 347 KiB, with individual files approximately 10–52 KiB.

Saved assets:

- `apps/customer-pwa/public/categories/v7/service.webp`
- `apps/customer-pwa/public/categories/v7/installation.webp`
- `apps/customer-pwa/public/categories/v7/maintenance.webp`
- `apps/customer-pwa/public/appliances/v7/air-conditioner.webp`
- `apps/customer-pwa/public/appliances/v7/refrigerator.webp`
- `apps/customer-pwa/public/appliances/v7/washing-machine.webp`
- `apps/customer-pwa/public/appliances/v7/television.webp`
- `apps/customer-pwa/public/appliances/v7/water-heater.webp`
- `apps/customer-pwa/public/appliances/v7/microwave.webp`
- `apps/customer-pwa/public/appliances/v7/mixer-grinder.webp`
- `apps/customer-pwa/public/appliances/v7/water-purifier.webp`
- `apps/customer-pwa/public/appliances/v7/kitchen-chimney.webp`
- `apps/customer-pwa/public/appliances/v7/dishwasher.webp`
- `apps/customer-pwa/public/appliances/v7/cctv.webp`
- `apps/customer-pwa/public/appliances/v7/internet.webp`

The exact final prompt for each image and its generated PNG source path are recorded in `scripts/v7-image-inputs.json`. Prompt style: photorealistic product catalogue images, a fully visible recognizable subject, warm-white studio backdrop, soft shadows, neutral appliance finishes and restrained purple/yellow tool accents; no logos, people, captions or watermarks. Preparation uses `scripts/prepare-v7-images.mjs`; the app serves only the local optimized assets.

## Verification

Customer TypeScript and focused ESLint checks pass. Browser checks verify all image files load, all 12 known appliance categories route to their own services, maintenance services appear after selecting Maintenance, Other Appliances is absent, and layouts fit 360/390/430/1440px. Existing booking and draft-navigation checks are included.

Final validation: **24 browser tests passed** and the customer production build passed, with all 15 new images included in the PWA precache.

Screenshots: `test-results/customer-images/home-390.png`, `appliances-1440.png` and `asset-review.png`. The existing customer PWA precache includes WebP assets.
