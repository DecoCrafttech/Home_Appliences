# Notification optimization

Updated 23 October 2026. See RATE_LIMIT_CHANGE.md for the shared API quota exemption on notification/request/job routes.

## Before

Admin notifications reused `/operations` and refreshed every `30000` milliseconds (30 seconds), with device-local read position. Customer header/list observers used `2000000` and `1500000` milliseconds (about 33 and 25 minutes); the technician list also used `1500000` milliseconds. These values were milliseconds, not seconds. No one-second notification loop was found. Other occurrences of `1000` include rate-limit capacity or units, not a notification refresh policy.

## Now

All notification queries explicitly use `refetchInterval: false` and disable automatic background/reconnect refetching. There is no optional ten-hour timer. Consequently no hidden-app notification timer needs to remain active.

- Each authenticated layout can load an initial unread count into an identity/role-scoped cache.
- One shared notification dialog replaces the three list pages. Opening the bell explicitly fetches current data; legacy notification URLs open the same dialog.
- The bell opens the inbox and refreshes it. Refresh remains available inside the dialog. Both share the layout query and an in-flight request.
- Refresh explicitly refetches even while cached data is fresh.
- Marking a notification read persists ownership-checked state and updates the shared inbox/badge locally. Unread totals include records older than the 100-record visible list. Mark all as read uses the fetched server timestamp, so new arrivals after the snapshot stay unread; individual-ID bulk reads remain ownership checked.
- Unrelated mutations do not automatically reload the notification inbox. Request/job views invalidate their own current data.
- Notification queries disable focus/reconnect/mount refetching. Opening the bell or a legacy Notifications URL and manual Refresh explicitly fetch current data.
- Manual Refresh has a spinner; initial lists show skeletons, empty lists have a clear state, and fetch failures show Sonner messages with retry controls.
- Remote-session changes become visible when opening the inbox or using Refresh. No remote push delivery is claimed.

Customer, staff and technician notifications are persisted in Neon. New customer requests, technician acceptance/decline, work reports, reviews and support messages create staff notifications transactionally. Existing offer, estimate, progress, cancellation, correction and completion notifications remain enabled. Appointment confirmation also creates a customer notice. Staff notification uniqueness is `(staff_id,event_key)`; technician event keys and customer request/kind uniqueness are preserved.

Related-record links navigate within the correct PWA. Staff support notices reference the ticket with a cascading foreign key, so removing synthetic test tickets does not leave dangling inbox entries. Customer support reply links can open the actual conversation. Notification reads never authorize unrelated request access.

## Progress remains independent

Customer Home/My Requests, request details, timelines and estimates now fetch on opening/reload or explicit actions, with no polling, focus/reconnect refetching or automatic retries. My Requests and Request Details include manual Refresh controls; see CUSTOMER_REQUEST_FETCH.md. Technician jobs/dashboard and Admin request queues retain their own independent refresh policies. They do not depend on inbox polling and are not delayed for ten hours. Reports and closed/history screens remain separate from notifications.

## Email

Source, dependency, navigation and worker audit found no active Resend/email sender or email worker in this repository. No required business transaction calls an email provider. No historical email/audit/customer records were deleted. Google Sign-In stays enabled. Technician invitations/recovery use short-lived, single-use secure links created by operations for manual delivery; staff development MFA behavior remains unchanged. Production staff MFA delivery is still an external setup dependency, not silently replaced with email.

## Verification

Browser tests open all three inboxes, advance the browser clock by one minute, assert no additional notification fetch, dispatch repeated focus events to verify no background refresh, explicitly refresh, and verify authorized destination links. Built-PWA checks confirm private API responses are absent from caches and unavailable offline. See `FINAL_TEST_REPORT.md` for actual final results.
