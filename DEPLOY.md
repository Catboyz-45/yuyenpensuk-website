# Production deployment — Yuyenpensuk

Architecture: Hostinger VPS + Docker + Cloudflare. The app uses local JSON storage and a persistent uploads directory.

## Persistent paths on VPS

- `/opt/yuyenpensuk/data` → `/app/data`
- `/opt/yuyenpensuk/uploads` → `/app/uploads`

Do not expose port 3000 directly to the Internet. The reverse proxy should be the only public entry point on ports 80/443. The application rejects unknown Host headers with HTTP 421.

## First-time server setup

> ก่อน deploy ตรวจระบบด้วย `npm run audit` ให้ผ่านทั้งหมด

```bash
mkdir -p /opt/yuyenpensuk/{app,data,uploads,backup}
```

Copy the project into `/opt/yuyenpensuk/app`, then create `/opt/yuyenpensuk/app/.env` from `.env.example`.

Generate a strong session secret:

```bash
openssl rand -hex 32
```

Set:

```text
NODE_ENV=production
PORT=3000
TRUST_PROXY=1
ADMIN_SUBDOMAIN=admin
SITE_URL=https://yuyenpensuk.com
DATA_DIR=/app/data
UPLOAD_DIR=/app/uploads
SESSION_SECRET=<long-random-value>
INITIAL_ADMIN_USERNAME=admin
INITIAL_ADMIN_PASSWORD=<12+ character initial password>
```

Production dependencies are exact-pinned in `package.json`. Express is 4.22.2, express-session is 1.19.0, Multer is 2.4.0, and qrcode is 1.5.4 with yargs overridden to 17.7.2. A package-lock.json should be generated in networked CI before the final release and then the Dockerfile can use `npm ci`.

The application uses a bounded in-process session store (maximum 2,000 live sessions, 8-hour TTL) to prevent unbounded MemoryStore growth. Sessions are intentionally invalidated when the container restarts. For multi-instance deployment, use a shared external session store before scaling horizontally.

The initial admin password is used only when `data/db.json` does not exist yet. If an existing database still uses the old default `admin123`, production startup will stop and require the password to be changed first.

## Build and run

```bash
cd /opt/yuyenpensuk/app
docker compose up -d --build
```

Check:

```bash
docker compose ps
docker compose logs --tail=100 web
```

Health check from the VPS:

```bash
curl http://127.0.0.1:3000/healthz
```

Expected:

```json
{"ok":true}
```

## Product images

Final production uses only local product images. The project contains 111 verified JPG files for 30 catalog models under `uploads/products/`. The running application does not download product images from manufacturer or retailer websites.

Copy the packaged `uploads/` directory to the persistent VPS path `/opt/yuyenpensuk/uploads` before the first production start.

## Cloudflare

Create DNS records pointing to the VPS IP:

- `A @` → VPS IPv4
- `A www` → VPS IPv4
- `A admin` → VPS IPv4

Use the reverse proxy to route:

- `yuyenpensuk.com` and `www.yuyenpensuk.com` → `web:3000`
- `admin.yuyenpensuk.com` → `web:3000`

Use HTTPS end-to-end. Do not publish port 3000 through UFW.

## Backup

Back up both persistent paths:

```text
/opt/yuyenpensuk/data/db.json
/opt/yuyenpensuk/uploads/
```

A source-code backup alone is not a complete CMS backup.

## Deploying a new code version

Replace/update only `/opt/yuyenpensuk/app`. Do not delete or replace the persistent `data/` or `uploads/` directories. Then run:

```bash
cd /opt/yuyenpensuk/app
docker compose up -d --build
```

Admin password changes require the current password; disabling 2FA requires both the current password and current OTP, and the session is regenerated after sensitive authentication changes.

The application database treats an existing `data/db.json` as the authoritative CMS data. It does not rebuild products from `catalog.js` during startup, so Admin changes survive container recreation, VPS reboot, and code redeploy.
