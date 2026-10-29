# Admin PWA requirements

The admin application must share the existing Express API and Neon database with the customer PWA. Its highest-priority workflow is authenticated staff access to real customer requests, guarded operational status changes, persisted customer-visible timeline events, and immutable audit evidence.

Initial roles are `SUPER_ADMIN`, `ADMIN`, `OPERATIONS_MANAGER`, `SUPPORT_AGENT`, and `FINANCE_MANAGER`. Backend authorization is mandatory. There is no public staff registration. Administrative metrics, requests, customers, support records, catalogue data, and future financial data must come from Neon; unavailable integrations must show honest empty states.

The complete requested scope also includes technician assignment, customer/catalogue management, support replies, scheduling, pricing, payments, reports, staff management, PWA behavior, Object Storage, and browser end-to-end coverage. Progress and limitations are tracked in `ADMIN_PROGRESS.md`.
