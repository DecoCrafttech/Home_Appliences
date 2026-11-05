# Authentication security audit

- The Google client secret is not stored or used. Rotate the secret that was shared in chat.
- Backend verification uses `google-auth-library`; frontend email/name/role values are ignored.
- Identity linkage uses Google `sub`, not email.
- Sessions are random, stored only as SHA-256 hashes, HttpOnly, and Secure in production.
- Customer ownership checks and admin middleware remain active.
- Automatic legacy-account merging is intentionally absent.
- Legacy OTP endpoints are retired by default outside tests.

The November 2026 release audit adds portable Argon2id hashing, browser-origin checks on writes, technician CSRF checks, server-side temporary-password restrictions, bounded password work, and expanded authorization tests. See [the release audit](FINAL_RELEASE_AUDIT_2026-11-05.md) for current verification results and launch blockers.

Open findings include production staff MFA delivery, exposed-credential rotation, the remaining Zod dependency advisory, real Google-provider login verification, and unresolved browser-suite failures. Development MFA codes must never be enabled in production. Customer account linking remains intentionally unavailable.
