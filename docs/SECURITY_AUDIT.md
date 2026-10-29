# Authentication security audit

- The Google client secret is not stored or used. Rotate the secret that was shared in chat.
- Backend verification uses `google-auth-library`; frontend email/name/role values are ignored.
- Identity linkage uses Google `sub`, not email.
- Sessions are random, stored only as SHA-256 hashes, HttpOnly, and Secure in production.
- Customer ownership checks and admin middleware remain active.
- Automatic legacy-account merging is intentionally absent.
- Legacy OTP endpoints are retired by default outside tests.

Open findings: admin passwords require Argon2id migration; development MFA is not TOTP; CSRF tokens, customer account linking, full login rate-limit tests, dedicated auth error pages, and Playwright coverage remain incomplete.
