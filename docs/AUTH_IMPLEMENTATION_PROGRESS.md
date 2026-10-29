# Authentication implementation progress

## WORKING

- Customer login UI uses the official Google Identity Services button; phone OTP fields are removed.
- Backend validates Google ID tokens with Google's official Node library and configured audience.
- Google identities use provider plus immutable subject uniqueness in Neon.
- New Google users receive a customer record and server-managed HttpOnly session; returning subjects reuse the same customer.
- Verified email, optional photo, last login, account status, and phone verification state are persisted.
- Existing OTP customers/bookings remain intact and are not merged by email.
- Public legacy OTP is disabled by default outside automated tests.
- Customer and staff session cookies remain separate.

## FAILED / INCOMPLETE

- Controlled linking of legacy phone accounts to Google identities is not implemented.
- Account deletion request UI/API is not implemented.
- Admin credentials still use scrypt rather than the requested Argon2id; mandatory TOTP enrollment, password rotation, username changes, and session management remain incomplete.

## BLOCKED

- A real Google browser sign-in requires the local and production origins to be authorized in Google Cloud and a test Google account to complete consent.
- Production origin/domain values are not available.

## NOT TESTED

- Real Google-issued browser credential and consent UI.
- Google cancellation/FedCM behavior across supported browsers.
- Production deployment, account linking, and production session cookies.
