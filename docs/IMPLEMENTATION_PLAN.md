# Implementation plan

## Architecture

An npm workspace holds `apps/customer-pwa` (React/Vite), `backend` (Express), and `packages/shared` (Zod contracts). Strict TypeScript is enabled throughout. The customer app uses React Router, TanStack Query for remote state, Zustand for temporary UI preferences, and Tailwind with a responsive CSS design layer. The API will own all pricing, access decisions, appointment capacity and payment state. PostgreSQL/Drizzle will be the persistence layer, with Neon configured through environment variables. Admin and technician clients are deferred; authorized operations endpoints will serve their future roles.

No credentials or external accounts are required for Phase 1. No deployment or migrations run during this phase. Presentation fixtures are explicitly marked and must be removed when catalogue APIs are connected. Customer/private data must never enter service-worker runtime caches.

## Delivery sequence

1. Foundation: workspace, tooling, customer shell, API health, environment examples, initial verification.
2. UI: reusable components, service detail and booking step layouts, form validation, accessibility and browser journeys.
3. Persistence: complete relational schema, reviewed non-destructive migrations, seed categories/services/areas, database test harness.
4. API integration: live catalogue/search/filtering, addresses, serviceability and customer profile.
5. Authentication: hashed OTP challenges, secure generation, expiry/attempt/cooldown limits, provider interface, HttpOnly rotating sessions, CSRF and role/ownership middleware. Mock provider disabled in production.
6. Bookings: slot capacity transactions, price snapshots, idempotency, cancellation/rescheduling, immutable history and protected assignment/status operations.
7. Aftercare: versioned estimate decisions, notifications, push subscription ownership, support, warranty claims and eligible reviews.
8. Payments: Razorpay test orders, server verification, signed raw-body webhooks, durable event deduplication, refunds and receipts. Coupon calculation belongs on the server.
9. PWA: icons, manifest, static-only precaching, offline fallback, update/install UI and push lifecycle.
10. Quality and deployment: integration/security tests, Playwright journeys, accessibility/performance review, HTTPS deployment and provider setup documentation.
11. Android: TWA/Bubblewrap instructions, real domain/signing placeholders, Digital Asset Links, AAB and Play data-safety checklist.

## Verification gates

Each phase must pass lint, strict type checks, builds and relevant tests before completion. Future database tests must run against isolated seeded PostgreSQL, including two-customer ownership and concurrent slot/idempotency cases. Payment tests must validate signatures, amount/currency and duplicate/out-of-order events. Browser tests must cover 320px layouts, keyboard/modal focus, offline fallback and customer booking journeys. External integrations remain unverified until credentials and sandbox callbacks are available.
