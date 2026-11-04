# Fixbeez deployment on Hostinger

## Domains

| App | Domain | Upload |
| --- | --- | --- |
| Customer | https://fixbeez.in | customer-pwa.zip |
| Admin | https://admin.fixbeez.in | admin-pwa.zip |
| Technician | https://technician.fixbeez.in | technician-pwa.zip |
| API | https://api.fixbeez.in | backend-source.zip (Node.js app) |

These packages are prepared locally, not published automatically. Hosting credentials and production database migrations are not included.

## Build and package locally

Use Node.js 24 and npm at the repository root:

```powershell
npm ci
npm run build
powershell -ExecutionPolicy Bypass -File scripts/package-hostinger.ps1
```

The script creates a dated directory under `deployment-artifacts`. The three `.env.production` files contain public domain configuration only; Vite embeds these values during the build. Remove any conflicting `VITE_API_ORIGIN` or `VITE_TECHNICIAN_ORIGIN` overrides from local environment files or hosting settings before building.

## Deploy the API first

In hPanel, open the Node.js application for `api.fixbeez.in`. Upload `backend-source.zip` as a Node.js app, or connect the repository. Do not extract backend sources into a publicly served static document root.

- Node.js: **24.x** (required for the runtime WebSocket used by database transactions).
- Framework: Express, or Other if entry settings must be entered manually.
- Application root for the source ZIP: archive root. For the GitHub monorepo picker, select `backend` while retaining the full repository checkout and npm workspaces. The adjacent `packages/shared` source must remain available during installation and at runtime.
- Install: `npm ci`. A production-only `npm ci --omit=dev` also includes the backend compiler and required type declarations.
- Build at archive/repository root: `npm run build -w @home/api`. When the selected root is `backend`, use `npm run build`.
- Output directory: `.` (retain source, workspace files and installed dependencies).
- Entry file at archive/repository root: `server.mjs`. When the selected root is `backend`, use `start.mjs`.
- Start command, if offered: `npm start`.

The entry loads compiled `dist/server.js`. The build bundles backend code and `@home/shared` together, so production startup does not need `tsx`, `get-tsconfig`, the TypeScript sources or a workspace link to `@home/shared`. Third-party dependencies remain external and must be installed in the runtime. Keep `start.mjs`, `dist`, `package.json` and production dependencies in the deployed application. Install native dependencies on Hostinger's Linux build environment; do not upload Windows `node_modules`. The `tsx` dependency remains available for existing migration and account-management commands, but is not imported during API startup.

The backend build invokes its explicitly declared TypeScript dependency through Node (`node build.mjs`) instead of executing a `.bin/tsc` shim. TypeScript and required type declarations are production dependencies because Hostinger may omit development packages. The production compiler configuration excludes test files; the separate typecheck still checks tests with a full development installation. If an older deployment fails with `tsc: Permission denied`, first publish the removal of tracked `node_modules`, then perform a fresh dependency install/rebuild in Hostinger. Preserve `package-lock.json` and use a clean `npm ci`; changing executable bits on uploaded Windows dependencies is not a reliable deployment fix.

Set backend environment variables in hPanel using `deploy/backend.env.example`. Fill in the production Neon connection string and Google Web application client ID. Set all four origin values exactly as shown. Preserve the existing technician MFA encryption key if the database already has enrolled accounts. Configure S3 storage and its browser upload CORS for the three HTTPS PWA origins; preserve existing VAPID keys when push subscriptions already exist. Never put these secrets in `VITE_*` variables or public uploads. Leave `PORT` to Hostinger. Confirm the trusted proxy hop count with Hostinger before overriding `TRUST_PROXY_HOPS`; trusting an incorrect count can undermine IP-based limits.

Restart/redeploy, then verify:

- `https://api.fixbeez.in/api/v1/health`: HTTP 200 and JSON.
- `https://api.fixbeez.in/api/v1/ready`: HTTP 200 with database connected.

A hosting HTML 503 on `/health` indicates the app is unavailable before the health route runs: check the deployment/startup logs, entry file, Node version and dependency installation. A JSON 503 on `/ready` indicates the process runs but database access fails. The API does not define a homepage at `/`.

The package does not migrate or seed production automatically. Verify the production schema against the migrations before enabling traffic. Do not point development-only workflow migration/audit commands at production. Review the migration plan and backup separately before modifying an existing production database.

## Upload the three PWAs

Create/configure each domain as a static/PHP website. In each domain's own document root shown by hPanel, extract the matching PWA zip so `index.html`, `.htaccess`, `sw.js`, `manifest.webmanifest` and `assets/` sit directly in that root. Do not upload the outer staging folder or mix app archives. Ensure `.htaccess` was extracted, including SPA route fallback and service-worker revalidation. Enable SSL and HTTPS for all four domains.

The apps call `https://api.fixbeez.in` directly with credentials; no frontend `/api` proxy is required. Cookies remain host-only on the API and use the existing secure and SameSite settings. All four origins use the same HTTPS site. API CORS explicitly permits the three configured app origins, and catalogue media allows same-site embedding.

In Google Cloud, add `https://fixbeez.in` to the OAuth Web client's authorized JavaScript origins. Use the same client ID in the backend. Add any additional origin only if it is intentionally supported; `www.fixbeez.in` should redirect to `fixbeez.in`.

## Live verification

Open all three apps, refresh a nested route (including `/technician`), and check that API requests target `api.fixbeez.in` and return JSON. Verify customer Google sign-in and sign-out, admin login, technician login and CSRF-protected writes, catalogue images, file uploads and push registration where configured. Check no browser CORS, mixed-content or blocked-cookie errors occur. Verify each manifest and service worker and run the existing PWA checker with:

```powershell
$env:PWA_CUSTOMER_ORIGIN='https://fixbeez.in'
$env:PWA_ADMIN_ORIGIN='https://admin.fixbeez.in'
$env:PWA_TECHNICIAN_ORIGIN='https://technician.fixbeez.in'
node scripts/check-pwa.mjs
```

Hostinger references: [Node.js app deployment](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/) and [monorepo settings](https://www.hostinger.com/support/how-to-deploy-monorepos-with-npm-yarn-or-pnpm-on-hostinger/).
