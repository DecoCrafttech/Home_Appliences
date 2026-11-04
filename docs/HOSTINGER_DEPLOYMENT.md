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

Internal packages use explicit `file:` dependencies, not npm-registry versions: the backend resolves `@home/shared` from `../packages/shared`, and the PWAs resolve shared/UI packages from `../../packages`. The backend also has a standalone `package-lock.json` and `install-links=true` in `.npmrc`, so an install from the selected `backend` root can copy the local package with its dependencies without workspace auto-detection. Keep the sibling package directories in the GitHub checkout. No npm account, scoped registry or npm authentication token is needed for these local packages. If shared package contents/dependencies change, refresh the standalone lock with `npm install --package-lock-only --ignore-scripts --workspaces=false --install-links --prefix backend`, then update the root lock with `npm install --ignore-scripts` and commit both.

The entry loads compiled `dist/server.js`. The build bundles backend code and `@home/shared` together, so production startup does not need `tsx`, `get-tsconfig`, the TypeScript sources or a workspace link to `@home/shared`. It then copies the standalone manifest and lockfile from `backend/runtime` into `dist` and runs a production-only `npm ci` there. This places Express and all transitive runtime dependencies in `dist/node_modules`, rather than relying on workspace dependencies hoisted outside the selected Hostinger root. Keep `start.mjs` and the entire `dist` directory, including its `node_modules`, in the deployed application. Install native dependencies on Hostinger's Linux build environment; do not upload Windows `node_modules`. The `tsx` dependency remains available for existing migration and account-management commands, but is not imported during API startup.

The build checks that all external imports in the bundled API have matching dependencies in `backend/runtime/package.json`. When changing runtime dependency versions, update this manifest and run `npm install --package-lock-only --ignore-scripts --workspaces=false --prefix backend/runtime` to refresh its lockfile. Commit both files. The standalone runtime must be tested from a directory outside this repository so workspace dependencies cannot mask missing packages.

Password hashing uses Argon2id via [hash-wasm](https://github.com/Daninet/hash-wasm), avoiding platform-specific native Argon2 binaries and their GLIBC requirements. New hashes retain the previous memory/time/parallelism settings and PHC encoding. Verification supports the application's existing native Argon2id v19 hashes and legacy scrypt hashes. Hashes are compared in constant time. Work runs in at most two worker threads per API process; `dist/passwordWorker.mjs` and `dist/security/passwordWorker.mjs` must be retained along with the runtime's `hash-wasm` package. No password reset or database migration is required for this change.

The backend build invokes its explicitly declared TypeScript dependency through Node (`node build.mjs`) instead of executing a `.bin/tsc` shim. TypeScript and required type declarations are production dependencies because Hostinger may omit development packages. The production compiler configuration excludes test files; the separate typecheck still checks tests with a full development installation. If an older deployment fails with `tsc: Permission denied`, first publish the removal of tracked `node_modules`, then perform a fresh dependency install/rebuild in Hostinger. Preserve `package-lock.json` and use a clean `npm ci`; changing executable bits on uploaded Windows dependencies is not a reliable deployment fix.

Set backend environment variables in hPanel using `deploy/backend.env.example`. Fill in the production Neon connection string and Google Web application client ID. Set all four origin values exactly as shown. Preserve the existing technician MFA encryption key if the database already has enrolled accounts. Configure S3 storage and its browser upload CORS for the three HTTPS PWA origins; preserve existing VAPID keys when push subscriptions already exist. Never put these secrets in `VITE_*` variables or public uploads. Leave `PORT` to Hostinger. Confirm the trusted proxy hop count with Hostinger before overriding `TRUST_PROXY_HOPS`; trusting an incorrect count can undermine IP-based limits.

Restart/redeploy, then verify:

- `https://api.fixbeez.in/api/v1/health`: HTTP 200 and JSON.
- `https://api.fixbeez.in/api/v1/ready`: HTTP 200 with database connected.

A hosting HTML 503 on `/health` indicates the app is unavailable before the health route runs: check the deployment/startup logs, entry file, Node version and dependency installation. A JSON 503 on `/ready` indicates the process runs but database access fails. The API does not define a homepage at `/`.

The package does not migrate or seed production automatically. Verify the production schema against the migrations before enabling traffic. Do not point development-only workflow migration/audit commands at production. Review the migration plan and backup separately before modifying an existing production database.

## Upload the three PWAs

### GitHub deployment

Create three Vite applications from `DecoCrafttech/Home_Appliences`, branch `main`. Select roots `apps/customer-pwa`, `apps/admin-pwa` and `apps/technician-pwa` respectively. For each, use Node 24, npm, build command `npm run build`, output `dist`, and no server entry file. The repository's shared packages and `scripts/build-pwa.mjs` must remain available during the workspace build.

Each PWA explicitly declares TypeScript, Vite and its build plugins as production dependencies so production-only hosting installs can build it. The shared build runner invokes compiler/Vite JavaScript entry files through Node rather than relying on shell `.bin` executables. It also includes `.htaccess` in the static output for HTML/PHP hosting. There is no frontend Node server to start after the build.

Set `VITE_API_ORIGIN=https://api.fixbeez.in` for all three and `VITE_TECHNICIAN_ORIGIN=https://technician.fixbeez.in` for Admin. These public values also live in the committed `.env.production` files. No backend secrets belong in PWA build settings. For GitHub hosting, verify the platform's SPA fallback by refreshing a nested route; `.htaccess` is used only when the serving web server supports it.

### Static ZIP upload

Create/configure each domain as a static/PHP website. In each domain's own document root shown by hPanel, extract the matching PWA zip so `index.html`, `.htaccess`, `sw.js`, `manifest.webmanifest` and `assets/` sit directly in that root. Do not upload the outer staging folder or mix app archives. Ensure `.htaccess` was extracted, including SPA route fallback and service-worker revalidation. Enable SSL and HTTPS for all four domains.

The apps call `https://api.fixbeez.in` directly with credentials; no frontend `/api` proxy is required. Cookies remain host-only on the API and use the existing secure and SameSite settings. All four origins use the same HTTPS site. API CORS explicitly permits the three configured app origins, and catalogue media allows same-site embedding.

In Google Cloud, add `https://fixbeez.in` to the OAuth Web client's authorized JavaScript origins. Use the same client ID in the backend. Add any additional origin only if it is intentionally supported; `www.fixbeez.in` should redirect to `fixbeez.in`.

## Connect the Neon development branch

In the Neon Console, open the project and click **Connect**. Select the development branch you intend to use, its database, and the application role. Copy the full PostgreSQL connection string without editing the hostname or removing its SSL parameters. In Hostinger, open the **api.fixbeez.in** backend's environment settings and add or replace **DATABASE_URL** with that connection string (no surrounding quotes in the value field). Keep **NODE_ENV=production**: selecting a development database branch does not change how the public server should handle secure cookies. Save and restart/redeploy the backend.

Check `https://api.fixbeez.in/api/v1/ready`. HTTP 200 with `database: connected` confirms a successful database query; a JSON 503 means the connection is still missing, invalid or unavailable. Do not put this connection string in the PWA environments or commit it to GitHub. The hosted apps will read and write the same development-branch data used locally; this does not create a separate copy. No migration or database reset is performed by these instructions.

See [Neon's connection instructions](https://neon.com/docs/get-started/connect-neon).

## Live verification

The shared UI declares React, React DOM, React Router and React Query as peer dependencies; each PWA's Vite configuration deduplicates these context providers. This prevents a shared component's router hooks from reading a different context instance than the app's router. After building all three PWAs, run `npm run test:pwa-render` for production Chrome rendering and nested-route checks with mocked API responses. The checker also accepts a separate build root: `node scripts/check-pwa-render.mjs PATH_TO_BUILD_ROOT`. This checks UI rendering independently of database connectivity; it does not verify real sign-in or database-backed workflows.

Open all three apps, refresh a nested route (including `/technician`), and check that API requests target `api.fixbeez.in` and return JSON. Verify customer Google sign-in and sign-out, admin login, technician login and CSRF-protected writes, catalogue images, file uploads and push registration where configured. Check no browser CORS, mixed-content or blocked-cookie errors occur. Verify each manifest and service worker and run the existing PWA checker with:

```powershell
$env:PWA_CUSTOMER_ORIGIN='https://fixbeez.in'
$env:PWA_ADMIN_ORIGIN='https://admin.fixbeez.in'
$env:PWA_TECHNICIAN_ORIGIN='https://technician.fixbeez.in'
node scripts/check-pwa.mjs
```

Hostinger references: [Node.js app deployment](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/) and [monorepo settings](https://www.hostinger.com/support/how-to-deploy-monorepos-with-npm-yarn-or-pnpm-on-hostinger/).
