# Google customer authentication setup

The customer PWA uses Google Identity Services through `@react-oauth/google`. The browser receives a Google ID credential and sends it to `POST /api/v1/auth/customer/google`. The backend verifies signature, issuer, audience, expiry, and verified email with `google-auth-library`, then keys the identity by Google's immutable `sub` claim.

## Google Cloud configuration

In Google Auth Platform:

1. Select the OAuth project and configure branding, support email, audience, and consent details.
2. Use a Web application OAuth client.
3. Add both `http://localhost` and `http://localhost:5173` as authorized JavaScript origins for local development. Run the customer PWA at `http://localhost:5173` (`npm run dev -w @home/customer`). Customer and admin ports are fixed at 5173 and 5174 respectively; occupied ports cause a clear startup error instead of silently changing the sign-in origin.
4. Add the exact HTTPS production customer origin before deployment.
5. Add test users while the consent configuration remains in testing mode.
6. This credential-button flow does not require a redirect URI or the OAuth client secret.
7. Set `GOOGLE_CLIENT_ID` in `backend/.env.local` and restart the API. The PWA reads this public ID from `GET /api/v1/auth/customer/config`, ensuring the browser and verifier use the same client. `VITE_GOOGLE_CLIENT_ID` is no longer needed.
8. Keep backend/database/storage secrets out of every `VITE_*` variable.

## Troubleshooting `401: invalid_client` / “no registered origin”

This error is returned by Google before the customer PWA can send a credential
to the backend. In the OAuth client's **Authorized JavaScript origins**, add the
exact origin from the customer PWA address bar, including its scheme and any
non-default port (for example, `https://customers.example.com`). Origins do not
include a path or trailing slash; `www` and non-`www` hostnames are separate
origins. For local development, open `http://localhost:5173` (the PWA redirects `127.0.0.1` to `localhost`).
The local customer server binds to `localhost` so the browser origin stays
consistent with this setting. If the app is deployed or opened at a different
address, authorize that exact origin instead.

The backend supplies the same `GOOGLE_CLIENT_ID` to the PWA at runtime. Restart
the API and reload the PWA after changing that ID. Adding a redirect URI
does not resolve this error; this sign-in flow uses an authorized JavaScript
origin instead. If the correct origin is already configured, verify that the
browser is loading the expected OAuth client ID and that the origin change has
been saved to the same Google Cloud project.

The OAuth client secret is not used by this flow and must not be added to frontend variables.

## Verification

`npm test` covers Google identity linking, application sessions and concurrent first sign-ins against the test database. `npm run test:browser` uses installed Google Chrome and a simulated Google provider to check redirects, cache clearing, missing configuration, blocked scripts, rejected tokens and cookie failures. These tests do not authorize an origin in Google Cloud or complete an interactive Google account sign-in.

Chrome was also checked against the real Google script on 2026-10-21. Google returned HTTP 403 for `/gsi/button` with "The given origin is not allowed for the given client ID" at `http://localhost:5173`. The OAuth client owner must add the origins above in Google Auth Platform → Clients → Web application → Authorized JavaScript origins. This setting cannot be changed through application source code.

## Migration behavior

Existing phone-authenticated customers and their records remain untouched. New Google identities are linked only by verified Google `sub`; matching email or name never triggers an automatic merge. Legacy OTP endpoints return HTTP 410 outside tests unless `LEGACY_OTP_ENABLED=true` is deliberately configured for a controlled migration window.
