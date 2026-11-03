# Fixbeez — Complete Codex Implementation Prompt (Customer, Admin & Technician PWAs)

## Mission
You are a senior full-stack frontend engineer, UI architect and accessibility specialist. Improve the **existing** Fixbeez home-appliance service and installation platform into a coherent production-grade multi-PWA product. This is a UI upgrade to running software, **not a rewrite**. Implement the provided design system across `apps/customer-pwa`, `apps/admin-pwa`, and `apps/technician-pwa` while keeping `apps/backend` contracts, authentication, database, business logic, and routes working.

**Important brand constraint:** Use the supplied **real logo PNG** `assets/fixbeez-original-logo-transparent.png` (or `assets/fixbeez-original-logo-white-bg.png` when needed). This is the actual original illustrated bee + Fixbeez wordmark. **DO NOT draw, auto-trace, regenerate, approximate, replace, or recreate the logo using SVG, emojis, text, icon libraries, or AI. DO NOT use the incorrect SVG logo from older files.** Maintain original proportions and aspect ratio, use `object-fit:contain`, avoid cropping the mascot or lettering. All three PWAs must use this same logo.

## Before changing code
1. Inspect repo structure, routing, style approach, PWA manifests, app entrypoints, existing shared packages, auth implementations, API services, form validation, and current route-by-route capabilities.
2. Inspect `references/customer-ui-approved.png` and `references/customer-full-flow.png` for visual direction; screenshots are references, not sources of sample data or new backend functionality.
3. Read `design-system/tokens.json`, `design-system/theme.css`, and `design-system/honeycomb-pattern.svg`. Reuse them as the **single source of truth**, or adapt them into the existing theme framework rather than starting a competing design system.
4. Make a checklist of all current screens, relevant components, and regressions to prevent. Then implement changes directly. Avoid unnecessary dependencies.

## Brand identity and design language
Brand: **Fixbeez**. Tagline: **We fit it. We fix it.**. Service categories: home appliance service, installation, repair and maintenance. Persona: helpful, modern, trustworthy, polished, friendly and task-oriented; not childish or overloaded. Keep the detailed cheerful bee as the brand artwork, but do not repeat a huge mascot on every screen.

**Color tokens (use EXACT values):**
- Purple primary/selected navigation: `#512DA8`; purple hover `#44238D`; subtle lilac `#F2EBFF`.
- Brand yellow `#FFC928`; light yellow `#FFF3BD`; gradient orange `#FF9500`.
- Dark navy content text `#1F2638`; secondary text `#626C7D`; muted `#89909E`.
- Main canvas `#FFFCF7`; white card `#FFFFFF`; warm raised area `#FFF9ED`; borders `#EDE8E0`.
- Success `#179B57`, warning `#AD6800`, progress blue `#2563EB`, error `#D94141` with corresponding light backgrounds in `tokens.json`.
- Header BG gradient: `linear-gradient(180deg, #FFE58A 0%, #FFF2C4 52%, #FFFCF7 100%)`.
- Primary CTA gradient: `linear-gradient(120deg, #FFDD35 0%, #FFC928 52%, #FF9500 100%)`.
- Promo/hero purple: `linear-gradient(120deg, #47228F 0%, #6337BE 57%, #7848C8 100%)`.

Use yellow gradient on the page header/hero backdrop and key booking CTAs. **Do not make the whole app saturated yellow.** Most content should remain an off-white/white canvas with white cards. Purple denotes selected tabs, active navigation, links and secondary CTAs. Important CTA text on yellow must be dark navy, never white with insufficient contrast.

**Honeycomb background:** Use ONLY the decorative pattern supplied at `design-system/honeycomb-pattern.svg`, not a background full of bees. Render small light outlines/fills near the **top-right of header, empty-state corners, sign-in hero, and occasional promo sections**, at 0.1–0.3 effective opacity. Never obstruct card titles, labels, buttons, or forms. Use `.fb-header-gradient` / `.fb-honeycomb-corner` from `theme.css`; if theme architecture differs, port the styles with responsive clipping, `pointer-events:none` and gradient masking. Do not place high-contrast repeated honeycomb across table or form surfaces.

Typography: Inter or Plus Jakarta Sans if already available; fallback system font. Use page heading 24–28px on mobile / 28–34px on desktop, section headings 18–20px, card titles 15–16px, body 14px–16px, labels 12–13px. Compact but not tiny. Use 4/8/12/16/20/24/32/40/48px spacing rhythm. Cards 18px radius, large hero 22–24px, inputs 14px, buttons 14px, chips pill radius. Visible focus ring, touch targets >=44px, responsive gutters 16px mobile/24px desktop. Soft shadows, simple line icons (Lucide if existing). Use all icons consistently and do not use emojis as production icons.

## Shared UI architecture
Prefer existing app architecture; if a stable workspace package exists, share tokens and components there, otherwise keep `theme.css` synced through one shared source without breaking bundlers. Build or normalize reusable components: `AppShell`, `BrandLogo`, `PageHeader`, `GradientHeader`, `HoneycombAccent`, `SectionHeader`, `ApplianceCard`, `ServiceCard`, `RequestCard`, `JobCard`, `EmptyState`, `Skeleton`, `StatusBadge`, `PrimaryButton`, `SecondaryButton`, `FormField`, `TextArea`, `DateSelector`, `TimeSlotSelector`, `ConfirmationModal`, `Toast`, `ResponsiveTable`, `BottomNavigation`, and `SidebarNav`. One consistent radius/spacing/shadow/typography strategy for all roles. Don't refactor unrelated backend files.

## Customer PWA — mobile first, entire production journey
**Customer tab bar EXACTLY:** `Home | Services | + Book | My Requests | Profile`. Five items always in that order. The central `+ Book` action is an elevated circular yellow-to-orange action with a clear label. Current route highlights purple. Avoid a separate Support bottom tab; support belongs in Home and Profile. Keep safe-area spacing for Android and iPhone; display persistent nav only where appropriate, not on auth page or when keyboard/modal UX requires different layout.

**1 Splash / Auth:** Clean brand PNG on warm gradient background, subtle honeycomb accent, text `Home appliance service & installation`, optional real tagline, Google Sign-In only. Use the **existing Customer Google authentication**. DO NOT introduce full-name/password/mobile-number signup unless backend already requires profile completion. Provide loading, error and signed-out states.

**2 Home:** Compact yellow gradient top with greeting / authenticated customer display name and avatar, helpful subtitle, optional actual notification feature only if it exists; small purple hero card: `Appliance Service & Installation at Your Home` with the supplied mascot/logo PNG in correct proportions, no fake claims. Quick entry cards for Service Request, Installation Request, Help & Support. Then `Browse Appliances` horizontally with AC, Refrigerator, Washing Machine, TV, Water Heater, Microwave, Mixer Grinder, Other **as configured in actual catalog**, plus `View All`. Include `Popular Services` / `Listed Services` preview with `View All` linking to the Services page. Provide My Requests quick action, a short trust/info strip without unverified promises, and skeletons for loading. Keep hero height concise and the main booking options visible without excessive scrolling.

**3 Services (dedicated full service listing):** This must be a real page showing listed services, not just appliance categories. It must support tabs `Service & Repair` and `Installation` with clear appliance/service cards; show category/appliance illustration or consistent outlined icon, name and brief grounded description. Search/filter only when actual catalog supports it. Item tap opens appliance-specific service options or the correct booking flow. Typical existing service types can include General Service, Repair, Installation, Uninstallation, and AMC/Maintenance **only if configured**. Do not promise fixed prices; pricing is quoted after inspection.

**4 + Book:** Unified booking entry flow to choose `Service Request` or `Installation Request`, then select an appliance from actual data, select valid service type from actual data, complete service request form, select schedule, review and submit. Preserve separate backend request types where they already exist. Display progress if multi-step, with back-navigation preserving input state.

**5 Booking details:** Show selected appliance/service, problem description (required if current API requires), service address with existing inputs, optional browser current-location capability (permission only on user gesture; proper fallback), contact phone if available from profile, and pre-existing service details. Preserve client and server validation. No invented geolocation/address details.

**6 Schedule:** Accessible calendar and exactly THREE preferred time slots: `08:00–12:00`, `13:00–17:00`, `18:00–21:00`. Highlight selected date/slot in purple. Validate against existing business rules; don't make backend promises of instant technician availability.

**7 Review & Submit:** Summary of selected appliance, service, issue, address, preferred date and time; edit actions. Yellow gradient `Submit Request` CTA, disable on submit with a spinner and idempotency protection as existing backend supports; handle network failures gracefully. On success use the actual returned 6-digit request ID when available. Show message **`Our executive will contact you soon`**, then redirect to `My Requests` with a clear success state. No client-generated fake ID.

**8 My Requests:** Filter chips `All`, `Pending`, `In Progress`, `Completed`, mapping to real API statuses. Cards show request ID, appliance, service, preferred date/slot, status, and short address/area only if known. Highlight status by meaning, not brand color alone. Pull existing data on opening; avoid excessive polling or duplicate fetches.

**9 Request details:** Clear minimal summary. Show original submitted fields, assigned technician contact (only when available), admin office contact (only when configured), address with map link if possible, correct status and an optional timeline only if supported by real status events. No fabricated ETA, technician tracking, chat, payments or unavailable statuses. Show appropriate call/support actions and feedback entry only when completed.

**10 Feedback:** For completed requests, show 1–5 stars and optional comment, post through existing endpoint, disable repeat submissions, show existing review when appropriate. Not a fake independent feature.

**11 Help & Support:** Reachable from Home/Profile. Show the actual configured phone/WhatsApp/FAQ methods only when existing support channels are configured. If no actual channel exists, show a concise fallback rather than inventing contact information or a chatbot.

**12 Profile:** Google avatar/name/email using live auth identity, My Requests shortcut, Help & Support, optional feedback and saved addresses only if already implemented, and Logout. Keep it simple and friendly.

## Admin PWA — desktop-first operations UI, same brand
Use the exact original PNG, same theme tokens, button styles, status chips, skeletons and honeycomb as **subtle decoration only in login/header**, not behind the operations table. Use responsive desktop sidebar + topbar; mobile-friendly nav if already supported. Preserve existing username/password auth (not Google). Pages: Login, Dashboard, Operations, Completed, Request Details, Technician management/assign modal, Feedback, Settings and other existing routes.

Dashboard: smaller KPI tiles, global date filter (`1 day`, `3 days`, `7 days`, `Month`, `Custom`) **only if existing**, trends that distinguish created vs open requests, Technician Allocation, overdue/assignment indicators when data allows. Avoid redundant charts. Operations: one unified Service + Installation queue with filters and table; Completed separate where already supported. Columns: 6-digit request ID, customer, phone, appliance/service, issue, schedule/date/time, address/open maps, assigned tech, status, actions. Modal: clear available technician selection, assign/reassign, loading/disabled duplicate action, error states. Details with existing 4 tabs and customer input. Change status using authorized server rules; never bypass permissions. Render feedback from API. Use responsive mobile card fallback for wide tables.

## Technician PWA — mobile-first productivity UI, same brand
Use exact PNG, same visual tokens, subtle header honeycomb, white task cards, purple active nav/filters, yellow CTA. Preserve username/password auth and role restriction. Screens: Login, Dashboard, My Jobs, Job Details, Active Job / Update Status, Completion/Remarks, Profile and any existing pages. Job cards must display appliance/service, customer name, schedule, location and status; keep Call Customer and Open Maps one tap if real data exists. Status action path `Assigned → In Progress → Completed`, and respect any existing admin-set `On Hold` disabling progress while keeping details visible. No invented capabilities or extra API calls. Show real errors and positive confirmation states; no duplicate status updates.

## PWA installability / technical guardrails
- Keep React + Vite + TypeScript, current router, auth providers, existing backend and Neon/Drizzle data shapes untouched unless a minimum frontend integration fix is absolutely necessary.
- Audit backend endpoint usage and preserve request/response types and error handling. No new endpoints, fake contact numbers, mock production records, placeholder pricing, or simulated notifications.
- Existing customer Google OAuth callbacks must remain functional; admin/technician session rules unchanged.
- Preserve working PWA manifests, icons, cache behavior and installability. Generate PWA icons from the supplied PNG via a normal image processing utility if missing; avoid SVG recreation and preserve legibility in square crops. Ensure no cropped wordmark on launcher icons; prefer bee mascot crop if suitable.
- Mobile browser: 320px minimum support; focus/keyboard/accessible labels and reduced-motion; fixed bottom nav never covers CTA or form controls. Desktop and tablet layouts should look intentionally designed rather than stretched mobile screens.
- Use loading skeletons, graceful empty states, permission errors, network errors, toast feedback, and proper button disabled/loading for every mutation. Avoid noisy polling and duplicate API calls.

## Deliverables / definition of done
1. Implement shared CSS variables, honeycomb SVG backdrop, and original PNG branding throughout all three PWAs.
2. Update every existing screen (not only Home), preserving functional routes and full service/installation workflows.
3. Ensure the CUSTOMER five-tab structure exactly matches `Home | Services | + Book | My Requests | Profile`; `/services` is a full listing.
4. Compile/typecheck/build all three PWAs using the repo's scripts. Run existing tests and lint where available. Check Customer Google Sign-In, request creation, request tracking/feedback, Admin login/assignment, Technician login/job status, and layout at 360px/768px/desktop.
5. Create `FIXBEEZ_UI_IMPLEMENTATION_REPORT.md` detailing changes, routes, test results, assets, component reuse and any blockers. If a backend capability does not exist, leave it out or mark it as unavailable — **do not fabricate implementations or claim tests passed**.

**Implement now; don't stop at planning, avoid needless confirmation. Respect the exact reference PNG and tokens.**
