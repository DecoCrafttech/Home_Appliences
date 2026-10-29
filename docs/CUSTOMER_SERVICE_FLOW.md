# Customer appliance-first service flow

22 October 2026. This replaces the earlier grouped service-card presentation.

1. Services opens a searchable grid of active, published appliance categories from Neon, using the category icon configured in Admin Manage Appliances. Empty categories have an honest availability state. Mobile uses two columns; larger screens use three/four.
2. Selecting a category opens `/services/appliances/:applianceId`. Its scoped API returns only published services/installations for that active published category. Service type/search filters operate within that category.
3. Service details show appliance, service name, description, problems/options, individual indicative INR prices, inclusions and extra-charge notices. Customers can check multiple applicable options and choose Book Now.
4. The existing four-stage wizard receives the selected appliance, service, actual SERVICE/INSTALLATION type and option IDs. It shows the selected service instead of asking the customer to select the same appliance again. The optional short description asks for brand and brief details. Existing drafts, browser Back and discard protections remain.
5. Contact/address accepts a valid Indian mobile number. Booking contact is normalized to E.164. An optional checkbox saves that number to the customer's profile; no independent verification claim is made. A failure to save the profile does not erase a committed booking.
6. Server validation confirms category publication, service ownership/type and every active selected option. Server-generated price snapshots preserve each selected option's original price; browser-supplied prices are not trusted. Existing references, idempotency and durable booking hashes are retained.
7. Successful submission redirects to My Requests with the existing success and executive-follow-up messages. The customer's and admin's request views display the saved options and booking-time prices.

## Catalogue source of truth

Admin Services & Installations and Manage Appliances control service and appliance publication, icons and prices. Category icons use the existing sanitized SVG/raster upload and object-storage pipeline. Draft appliances/services cannot be booked through direct API calls. Public queries refresh on opening/focus; there is no hardcoded customer catalogue. Existing bookings retain their historical details after catalogue edits.

## Contact access

Admin Requests shows booking contact (falling back to profile contact) below the customer name, with a valid call link/icon. Request Details includes customer ID, visible number, Call Customer and Copy Number. Missing/invalid numbers show Phone number not provided.

Accepted, current technician assignments expose the booking contact near the top of Job Details and a job-card call shortcut. Pending offers expose only permitted service/area/schedule data, without customer phone or full address. Unrelated technicians cannot retrieve contact; cancelled/rejected/reassigned assignments lose access. The same contact fallback is used by authorized calendars.

## Verification

Five appliance-flow browser checks passed at 360, 390, 768, 1024 and 1440 pixels. The real development catalogue workflow passed appliance/service icon upload and publication, multi-option booking, immutable price snapshots after catalogue edits, technician credential onboarding, rescheduling and authorized phone links. The complete API run passed 92/92, including unpublished-category rejection and accepted-owner contact isolation. Full browser and corrected targeted rerun results are recorded in FINAL_TEST_REPORT.md.
