# Technician requirements

The operations PWA hosts a dedicated /technician workspace backed by the existing Neon bookings. Technician identity is isolated from staff identity: a technician session never authorizes an admin endpoint. Admin-created invitations expire and are consumed once; approved, active technicians alone can sign in.

Assignment offers are independent of booking status. Acceptance is exclusive, versioned and owned; contact details are released only for the current accepted assignment. Progress follows confirmed appointment, en route, arrived and in progress. Reports are immutable versions awaiting operations review; only the existing completion flow closes a booking. Additional charges require customer approval. Installation checklists depend on the appliance. Photos remain private with ownership-checked retrieval. Availability never cancels an existing appointment.

Use real database data, persisted notifications, server validation, accessible mobile navigation, bounded polling and no private API caching. Never claim external invitation delivery, production MFA, native install or storage validation without testing it.
