# Yuyenpensuk Production Secure — Deep Security Audit

Audit target: `yuyenpensuk-production-secure-fixed.zip`
Audit scope: source tree, all Express routes, EJS templates, upload handling, authentication/2FA, session handling, persistence, Docker hardening, client-side JavaScript, and production configuration.

## Inventory

- 59 non-image project files reviewed
- 14 JavaScript files syntax-checked
- 33 EJS templates reviewed
- 2 CSS files reviewed
- 28 admin route declarations reviewed
- 16 public-site route declarations reviewed
- 111 product JPG assets checked
- No `.env`, database, or node_modules shipped in the archive

## Final status

| Area | Status | Result |
|---|---|---|
| Authentication | PASS | Password + session + optional 2FA flow reviewed |
| Session fixation | PASS | Session regenerated after password login/OTP/password change/2FA disable |
| Session store | PASS | Bounded store: 2,000 sessions, 8-hour TTL |
| Session cookie | PASS | HttpOnly, SameSite=Lax, Secure in production, scoped to `/admin` |
| CSRF | PASS | All admin POST forms carry CSRF; multipart forms are checked after Multer parses the body |
| Brute-force protection | PASS | Login/OTP rate limiting with bounded in-memory key count |
| Authorization | PASS | Auth required for CMS; Super Admin required for admin-account management |
| 2FA disable | PASS | Requires current password + current OTP and regenerates session |
| Password policy | PASS | Backend minimum 12 characters |
| Upload extension checks | PASS | JPG/JPEG/PNG/WEBP/GIF/PDF allowlist |
| Upload magic bytes | PASS | Actual file signature checked before persistence |
| Upload resource limits | PASS | File, field, part, field-name and array-index limits |
| Upload cleanup | PASS | Failed saves and replaced/deleted assets are cleaned up |
| Path traversal | PASS | Local upload paths are resolved and confined to upload root |
| Stored XSS | PASS | User content is rendered with escaped EJS output; no unsafe user HTML rendering found |
| Open redirect | PASS | No user-controlled redirect target found |
| Host routing | PASS | Exact admin/site host allowlist; unknown hosts return 421 |
| HTTPS requirement | PASS | Production `SITE_URL` must be HTTPS |
| Security headers | PASS | CSP, HSTS in production, nosniff, frame policy, referrer policy, permissions policy, COOP/CORP |
| JSON database writes | PASS | Atomic temp-file + rename, mode 0600 |
| Docker privilege | PASS | Non-root, read-only root FS, all Linux capabilities dropped, no-new-privileges |
| Network exposure | PASS | Compose uses `expose`, not a public host port |
| Product-image SSRF | PASS | Runtime product images are local-only |
| Temporary admin password leakage | FIXED | No longer placed in query strings/history/referrer; session flash is used |
| External OG fallback | FIXED | Removed from runtime page metadata |
| Company Facebook URL | FIXED | HTTPS Facebook-domain allowlist |
| Proxy trust | FIXED | Explicit `TRUST_PROXY` configuration |
| Production dependency versions | FIXED | Express 4.22.2, express-session 1.19.0, Multer 2.4.0, qrcode 1.5.4 |
| qrcode transitive dependency | FIXED | `yargs` overridden to 17.7.2 |
| package-lock | RELEASE ENGINEERING | Not present because registry resolution was unavailable in this audit environment; direct dependencies are exact-pinned |

## Dependency security review

### Express

The project was upgraded from Express 4.19.2 to 4.22.2. Express 4.19.2 was already patched for the malformed-URL open-redirect advisory, but 4.22.2 is the current 4.x release and includes newer dependency updates.

### express-session

The project was upgraded from 1.18.0 to 1.19.0. The session project's history records a security fix for CVE-2025-7339 in 1.18.2, so 1.18.0 was not suitable as the final Production pin.

### Multer

Multer remains pinned to 2.4.0. The current upstream release notes identify 2.4.0 as the fix for CVE-2026-88932, while 2.3.0 fixed several other 2026 multipart DoS issues. The application also applies strict multipart limits and magic-byte validation.

### qrcode

Upgraded to 1.5.4. Because qrcode 1.5.x historically brings an older yargs dependency tree, the project now overrides `yargs` to 17.7.2. The application uses qrcode only for server-side 2FA QR generation, not its CLI.

### bcryptjs / EJS / otplib

No code-level vulnerability was identified during this audit that justified a major-version migration. They remain exact-pinned to avoid an unreviewed breaking security-sensitive change.

## Route review

### Public site — 16 routes

- `/`
- `/services`
- `/services/:id`
- `/api/product-gallery/:id`
- `/api/product-image/:id/:index`
- `/products`
- `/products/:id`
- `/projects`
- `/projects/:id`
- `/pricing-install`
- `/pricing-clean`
- `/payment`
- `/brands/:brand`
- `/sitemap.xml`
- `/robots.txt`
- `/contact`

Public product image endpoints intentionally expose local catalog images. Admin-only product gallery endpoints are protected by authentication.

### Admin — 28 route declarations

- `/login` GET/POST
- `/otp` GET/POST
- `/logout` POST
- `/` GET
- `/company` GET/POST
- CRUD families for banners, services, products, projects and news
- banner toggle
- product gallery/image APIs
- `/pricing` GET/POST
- `/payment` GET/POST
- `/admins` GET/POST/delete/reset
- `/profile` GET/POST
- `/profile/password` POST
- `/profile/2fa/setup` POST
- `/profile/2fa/confirm` POST
- `/profile/2fa/disable` POST

All state-changing admin endpoints were checked for authentication and CSRF coverage. Account-management routes additionally require Super Admin.

## Bugs fixed in this pass

1. Temporary reset/generated passwords were previously placed in URL query parameters. They now live in a one-time session flash and are removed from the URL.
2. Production `SITE_URL` can no longer silently be configured as HTTP.
3. Reverse-proxy trust is explicit rather than hard-coded.
4. Failed upload/database operations now clean up files that were already written.
5. Replaced/deleted CMS images are cleaned from the upload volume.
6. Facebook URLs are restricted to HTTPS Facebook URLs.
7. The generic external Open Graph image fallback was removed.
8. Password form UI now consistently says and enforces 12+ characters.
9. Express and express-session were upgraded to current 4.x/1.x releases.
10. qrcode was upgraded and its yargs dependency is overridden.

## Remaining items are server/deployment controls

These are intentionally outside the application ZIP:

1. Set a unique `SESSION_SECRET` of at least 32 random characters.
2. Set a strong `INITIAL_ADMIN_PASSWORD` of at least 12 characters for first initialization.
3. Set `TRUST_PROXY=1` only when the application is actually behind the configured reverse proxy.
4. Do not publish TCP/3000 to the Internet.
5. Cloudflare/reverse proxy should be the public HTTPS entry point.
6. Use HTTPS end-to-end and enable Cloudflare SSL mode appropriate to the origin certificate (Full/Strict when the origin has a valid certificate).
7. Restrict VPS firewall/UFW to the required public ports (normally 80/443 and administrative SSH from trusted sources).
8. Keep `/opt/yuyenpensuk/data` and `/opt/yuyenpensuk/uploads` owned by the deployment user and not world-writable.
9. Back up `data/db.json` and `uploads/` regularly and test restoration.
10. Before release, generate and commit a `package-lock.json` from a networked CI/build environment, then change the Docker build to `npm ci --omit=dev`. This is release reproducibility hardening, not a discovered application vulnerability.

## Verification performed

- `node --check` on every JavaScript file: PASS
- Project security audit script: PASS
- EJS include resolution: PASS
- Admin POST form CSRF scan: PASS
- Catalog integrity: PASS
- Local product-image inventory: PASS
- Upload limit/magic-byte checks: PASS
- Host validation check: PASS
- Session hardening check: PASS
- Docker healthcheck consistency: PASS
- ZIP integrity check: performed after packaging

## Important limitation

This is a source/configuration audit. It does not prove that the live VPS, Cloudflare, DNS, TLS certificate, firewall, reverse proxy, Docker runtime, or production database is correctly configured. Those controls must be verified on the real server.
