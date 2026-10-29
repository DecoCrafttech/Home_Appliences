# Home Services design system

26 October 2026. The purple-and-peach identity supersedes the earlier blue palette. All three PWAs use `packages/ui/src/tokens.css`, imported by the shared UI stylesheet. Existing `--brand-*` and role aliases resolve to those tokens.

| Purpose                            | Token / value                                 |
| ---------------------------------- | --------------------------------------------- |
| Primary / hover / pressed          | `--color-primary` #512DA8 / #43248F / #361B78 |
| Primary tint                       | `--color-primary-light` #EEE7FA               |
| Accent / accent tint               | `--color-accent` #FFB6A3 / #FFF0EB            |
| Page / surface / subtle surface    | #F7F2FF / #FFFFFF / #FAF7FF                   |
| Heading / body / secondary / muted | #252039 / #443B56 / #655B76 / #756A83         |
| Border / input border / focus      | #E4DCED / #B8ACC9 / #7855BC                   |
| Success / warning / danger         | #167044 / #925600 / #B42335                   |

Purple identifies primary actions and selected navigation. Peach supports quiet highlights and connectivity feedback with dark text. Never pair peach with white body text. Status chips retain descriptive text and semantic green, amber and red. Administrator artwork keeps its original colours.

Use the shared Inter/system sans-serif stack, with system fonts ahead of language fallbacks. No remote font request is needed. Page headings start at 24px on phones, sections use 18px, cards 16px, body 14-16px and captions at least 12px. Core controls use 44-48px touch targets; primary field actions use 48px. Customer names, prices and actions remain prominent.

The spacing scale is 4, 8, 12, 16, 20, 24, 32, 40 and 48px. Radii are 8, 12, 16 and 20px. Prefer thin borders and `--shadow-sm`; interactive cards can use `--shadow-card` on hover. Mobile pages use approximately 16px gutters, with broader desktop workspaces. Cards allow long real service names and translated labels to wrap.

## Shared interaction contracts

- `AppButton` delegates to the existing `AsyncActionButton` and provides primary, secondary, outline, ghost and destructive variants. API coalescing, idempotency keys and synchronous mutation guards remain authoritative.
- `AppInput`, `AppSelect`, `AppTextarea` and `PasswordInput` are used in booking, assignment and technician forms. Password visibility never submits or clears the field. Existing Zod schemas and native constraints remain.
- `AppCard` standardizes technician job surfaces. Shared page headers, badges, search, pagination, empty/error states and Sonner provider remain the existing implementations.
- Customer and shared modals, drawers and bottom sheets reuse `ConfirmActionDialog`: native focus containment, Escape handling, pending protection and focus restoration. Catalogue cancellation protects unsaved edits inside the same dialog. Major mutations announce success only after backend confirmation.
- Notifications are on demand. Offline banners report connectivity without claiming a write succeeded. PWAs precache static assets; sensitive API records remain excluded from shared service-worker caching.

## Loading and media

`AppSkeleton`, `SkeletonCard`, `SkeletonTable` and `SkeletonProfile` are shared. `LoadingSkeleton` explicitly selects appliance grids, service/job cards, table rows, profiles, details, dashboard KPIs, technician workday summaries, calendars, list rows, greeting and date/time slots. Initial loads show placeholders; ordinary refreshes keep loaded content and indicate pending actions locally.

Shimmer and transitions respect reduced motion. Skeleton shapes are decorative; their enclosing region announces loading once. Empty and failure states provide appropriate actions. Customer data failures offer Retry; expired sessions offer sign in.

`ImageWithFallback` preserves the image slot when media cannot load. Catalogue uploads retain server-side SVG sanitization, type/size validation, preview, replacement/removal and explicit failure retry. Upload progress uses real events where available. Technician profile uploads validate before requesting storage access and reset the file input so the same file can be retried.

Installed PNGs are rasterized from the existing home SVG using `scripts/generate-app-icons.mjs`. Manifests, browser theme colours and icons share the identity.
