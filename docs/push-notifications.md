# Web Push operations

The API uses standard Web Push with VAPID. Configure the three VAPID variables shown in `backend/.env.example`; generate one long-lived key pair with `npx web-push generate-vapid-keys`. Keep the private key in the deployment secret manager and expose only the public key through the authenticated push endpoint.

Run migration `0025_web_push.sql` before deployment. Each browser endpoint is unique and is reassigned to the currently authenticated account when subscribed. Logout removes the current device subscription. HTTP 404 and 410 responses disable expired subscriptions. Other failures use the `push_deliveries` outbox with bounded exponential retry; the API drains it on startup, every minute, and immediately after enqueueing.

Push requires HTTPS outside localhost. Confirm the service worker, manifest, icon URLs, API cookies/CORS, and deep-link fallback on the production origin. Test permission denied, multiple devices, logout/account switching, expired endpoints, duplicate workflow submissions, and notification clicks while the app is closed and open.

The service worker never prompts for permission. Customers enable push in Profile, administrators in Settings, and technicians in My profile.
