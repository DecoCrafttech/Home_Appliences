# Customer and admin API additions

All private routes enforce existing HttpOnly sessions. UUIDs, ownership, status and body validation are enforced server-side. Existing routes remain in place.

## Customer

| Method / path (under `/api/v1`)                    | Behavior                                                                                                                      |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| GET `/profile`                                     | Includes Google avatar and sequence-based customer reference                                                                  |
| PATCH `/profile`                                   | Saves name/phone; preserves the verified Google email identity                                                                |
| GET `/appointment-windows`                         | Configurable preferred windows; does not claim capacity availability                                                          |
| POST `/locations/reverse-geocode`                  | Authenticated approximate address lookup with server-only Google Maps key and bounded timeout; manual fallback if unavailable |
| POST `/requests/service`, `/requests/installation` | Atomic request/history creation and safe concurrent idempotency retries                                                       |
| GET `/requests`                                    | Includes saved review ID for aftercare state                                                                                  |
| GET `/requests/:id`                                | Includes actual assigned technician and confirmed appointment when recorded                                                   |
| POST `/requests/:id/cancel`                        | Owned eligible request only, required reason and version                                                                      |
| GET/POST `/requests/:id/review`                    | Owned completed request only; one immutable review per request                                                                |
| PATCH `/requests/:id/review-reminder`              | Durable dismissal without preventing a later voluntary review                                                                 |
| GET `/profile/reviews`                             | Customer's saved reviews only                                                                                                 |
| GET `/notifications`                               | Customer's latest 100 persisted notifications                                                                                 |
| PATCH `/notifications/:id/read`                    | Owned notification acknowledgement                                                                                            |
| POST `/support/tickets`                            | Optional owned request link                                                                                                   |

## Admin (under `/api/v1/admin`)

| Method / path                                            | Behavior                                                                                                                                              |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET `/customers?q=...`                                   | Search customer reference, UUID, name, email, phone or request number                                                                                 |
| GET `/customers/:id`                                     | Includes addresses, requests, tickets and feedback                                                                                                    |
| GET `/requests?q=...&status=...&type=...`                | Paginated request search/filters                                                                                                                      |
| POST `/requests/:id/status`                              | Role/version/transition checks, real technician assignment and confirmed appointment inputs; completion requires the dedicated completion endpoint |
| POST `/requests/:id/contacted`, `/requests/:id/complete` | Contacted updates status; complete uses the structured completion workflow described below                                                                                    |
| GET/POST `/technicians`                                  | View real active technicians; authorized creation                                                                                                     |
| DELETE `/technicians/:id`                                | Archive; preserve historical assignments                                                                                                              |
| GET `/feedback/summary`                                  | Database-derived rating/handling aggregates                                                                                                           |
| GET `/feedback`                                          | Server-side search, rating/status/type/attention filters and pagination                                                                               |
| GET `/feedback/:id`                                      | Feedback, request/customer links, internal notes and handling history                                                                                 |
| PATCH `/feedback/:id/handling`                           | Separate staff handling status and reason; rejects attempts to modify rating/comment                                                                  |
| POST `/feedback/:id/notes`                               | Staff-only internal note                                                                                                                              |
| POST `/feedback/:id/support`                             | Idempotent follow-up support ticket                                                                                                                   |
| GET `/support/tickets`                                   | Server-searchable customer tickets with status/page/limit filters and customer/request references                                                                                          |
| PATCH `/support/tickets/:id`                             | Authorized support handling state                                                                                                                     |

Legacy staff-key status mutation is retired outside tests so live completion cannot bypass the audited admin lifecycle.

## Storage / dates

New tables: `customer_notifications`, `request_reviews`, `review_internal_notes`, `review_handling_events`, `technicians`. Existing requests, customers and support tickets gain additive columns. Structured completion reports are stored in `completion_reports`; status events preserve the lifecycle history. PostgreSQL DATE values remain calendar strings; timestamp fields remain timestamps.

Local drafts contain form data, step and request idempotency key, scoped by customer UUID and request type. No session cookie, password, Google token or API secret is stored in drafts. Private API responses are excluded from PWA caches.

## Structured completion (admin update)

`POST /api/v1/admin/requests/:id/complete` accepts:

```json
{"workSummary":"Installation completed and tested","completionNotes":"Customer confirmed operation","attachmentIds":[],"version":8}
```

`version` is optional; the server always performs an optimistic atomic update against the version it reads. `workSummary` is trimmed and required (3?2000 characters); notes are optional (up to 4000 characters). Nonempty attachment IDs are rejected until secure completion uploads are implemented. No client status or completion timestamp is accepted.

Only SUPER_ADMIN, ADMIN and OPERATIONS_MANAGER may complete an assigned SERVICE or INSTALLATION request in IN_PROGRESS. Pending estimates must be resolved first. The single database statement saves report, completion timestamp, previous/new status history, actor, audit and one customer notification. Repeated/concurrent completion returns success with `alreadyCompleted: true` without rewriting the original report. Competing non-completion updates return 409. Generic `/status` cannot bypass this endpoint.

Owned customer request details and authenticated admin details include `work_summary`, `completion_notes` and `completed_at`. Existing customer review eligibility/uniqueness and immutable staff handling rules remain enforced.

Admin `GET /requests` additionally supports `from`, `to` (YYYY-MM-DD), `technicianId`, `rating` (1?5), and `appointments=true`. The completed page uses `status=COMPLETED`, optionally filtered by request type. The response includes customer reference, technician, review ID/rating and work summary. `GET /operations` returns live type/status totals and the latest 100 request audit entries. The admin inbox is an activity feed with a device-local read position, not a push delivery service.

## Admin refinement (2026-10-22)

- `GET /api/v1/admin/dashboard/activity`: real seven-day India-timezone request trends, distribution, recent/awaiting-action work and operational alerts.
- `GET /api/v1/admin/dashboard/summary`: adds separate REQUESTED service/installation counts. Customer list adds actual total request counts.
- Technician create/edit accepts `skills`, `serviceArea`, `availability` and `verificationStatus`; `PATCH /technicians/:id` edits the record. Unavailable technicians cannot be assigned. Generated appointment minute ranges plus a PostgreSQL exclusion constraint reject overlapping active appointments atomically with HTTP 409 `APPOINTMENT_CONFLICT`.
- Catalogue create/edit supports optional nullable `basePrice` as an indicative INR price. Customer services/installations endpoints return `base_price`. Omitting the field in an edit preserves an existing price.
- `GET /api/v1/admin/support/tickets?q=&status=&page=1&limit=20`: server search and pagination; response keeps `data` and adds `meta`. The default limit remains compatible with the existing API.
- Admin `GET/POST /support/tickets/:id/messages`: staff conversation details, public replies and private internal notes. POST takes `{message, visibility: PUBLIC | INTERNAL}`.
- Customer `GET/POST /api/v1/support/tickets/:id/messages`: owned ticket only; GET excludes all internal notes; POST only accepts `{message}` and always writes PUBLIC customer content. Public staff replies generate an in-app notification.
- `PATCH /api/v1/admin/auth/profile`: `{fullName}` updates the signed-in staff profile.
- `POST /api/v1/admin/auth/password`: `{currentPassword,newPassword}` verifies the old password, requires 14-128 characters for the replacement, hashes it and revokes other sessions. The active session is retained.

Migration `0011_admin_refinement.sql` was applied only on the verified development branch. It adds technician metadata, catalogue prices, support message storage and scheduling safeguards. No production migration was performed.
