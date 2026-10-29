# Redesign plan

1. Record baseline type/lint/build results and inventory routes.
2. Add shared status labels, cancellation/review contracts, translation and design primitives.
3. Add additive development-only migration for customer references, reviews, review handling notes, notifications and completion timestamps.
4. Connect completion, customer ownership, cancellation, request-linked support and feedback APIs; preserve audit/history and version checks.
5. Replace booking with a shared four-step React Hook Form/Zod wizard: requirement, contact/address, preferred visit, review. Add customer-scoped draft storage and repeat requests without reusing appointment dates or idempotency keys.
6. Replace customer home/PIN marketing flow with profile greeting, useful service actions, active/recent requests and draft/recent-appliance shortcuts. Add Tamil navigation and workflow translations.
7. Add request confirmation, tabs, detail polling, copy reference, support shortcuts, completion inbox, persistent review reminders and ratings.
8. Add admin Feedback with real aggregates, server filters/pagination, handling notes/statuses; improve request/customer search and supported transitions.
9. Test ownership, lifecycle and concurrent operations on development data; browser-test mobile/desktop layouts and record screenshots.

Do not pretend that Google Cloud origin authorization, production MFA delivery, object uploads, technician availability or geocoding credentials are configured. Preserve existing stack and backend deployment.
