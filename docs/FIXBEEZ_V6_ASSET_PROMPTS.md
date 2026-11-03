# Fixbeez V6 appliance image prompts

Generated with the built-in `image_gen` tool, using one generation call per asset and `transparent_background: true`. This was not the fallback CLI mode.

Final project assets are in `apps/customer-pwa/public/appliances/v6/`: 640x640 WebP files, quality 0.86, with alpha preserved. Original generated PNGs remain in the generation cache; application builds use only the local WebP files.

## Exact common prompt

Replace `{subject}` with the corresponding subject below:

Use case: product-mockup. Project asset: a cohesive Fixbeez appliance catalogue. Create a square photorealistic studio product cutout of {subject}. One main appliance, entire product visible, centered and generously fills 82 percent of the canvas. Consistent slightly elevated front three-quarter camera, neutral soft studio lighting from upper left, realistic white/silver materials, natural subtle contact shadow. Transparent background. Premium clean consumer product photography, recognizable at small mobile card size. No manufacturer logos, no letters, numbers, labels, stickers, text, watermarks, hands, people, honeycomb or surrounding room. Keep the product visually simple and elegant. Match a coordinated catalogue photo set. Do not create or alter any Fixbeez brand artwork.

## Subject prompts and saved files

- `air-conditioner.webp`: a modern white wall-mounted split air conditioner, front three-quarter view, air louvers slightly open.
- `refrigerator.webp`: a tall brushed silver refrigerator with a top freezer and a lower fridge door, front three-quarter view.
- `washing-machine.webp`: a modern white front-loading washing machine with a dark circular glass door and subtle blue reflections.
- `television.webp`: a thin flat-screen television on two small feet, displaying a calm lavender and blue mountain landscape with no UI or text.
- `water-heater.webp`: a compact white vertical cylindrical wall-mounted storage water heater with a tiny unlabelled round control and copper pipe connectors.
- `microwave.webp`: a compact stainless steel countertop microwave oven with black glass door and simple unlabelled control knobs.
- `mixer-grinder.webp`: an Indian countertop mixer grinder: elegant white motor base with a stainless-steel mixing jar attached and one small matching steel jar alongside.
- `water-purifier.webp`: a modern wall-mounted white reverse-osmosis drinking-water purifier with a translucent water tank and a small dispensing tap.
- `kitchen-chimney.webp`: a modern stainless-steel wall-mounted kitchen chimney extractor hood with a black curved glass canopy.
- `dishwasher.webp`: a modern silver freestanding dishwasher with the door closed, clean simple handle, unlabelled controls.
- `other.webp`: a compact premium white and muted-lavender canister vacuum cleaner with its hose and floor attachment neatly arranged.

The original Fixbeez logo was never submitted for generation or editing and remains unchanged. `scripts/prepare-v6-appliances.mjs` documents the deterministic resize/format-conversion step; it is not a runtime or build dependency.
