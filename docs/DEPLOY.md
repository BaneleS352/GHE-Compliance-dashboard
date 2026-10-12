# Deployment Guide

This guide covers both Docker-based deployment (recommended) and manual deployment.

## Docker Deployment

### Build & Run

```bash
# Build and start all services
docker compose up -d --build

# Seed database (first time only)
docker compose exec backend npm run db:seed
```

The stack starts 3 containers:
- **Frontend** (Nginx, port 3000) — serves the built SPA
- **Backend** (Node, port 3001) — Express API + Prisma
- **Database** (PostgreSQL 16, port 5432)

The Prisma schema is PostgreSQL-native (single provider, no rewrite step).

### Environment Variables

For production, create a `.env` file in the project root with:

```bash
DATABASE_URL=postgresql://user:password@postgres:5432/ghe_db
OIDC_AUTHORITY=https://login.microsoftonline.com/<tenant-id>/v2.0
OIDC_CLIENT_ID=<api-application-client-id>
OIDC_AUDIENCE=api://<api-application-client-id>
OIDC_ISSUER=https://login.microsoftonline.com/<tenant-id>/v2.0
CORS_ORIGIN=https://your-frontend-domain.com
```

These are passed to the backend container via the `env_file` directive in `docker-compose.yml`.

### Document protection (Phase 5)

Password-protected exports (`POST /api/reports/protect-document`) encrypt
server-side with pure-Python sidecars (`pypdf` AES-256 for PDFs,
`msoffcrypto` ECMA-376 for `.xlsx`):

- **Docker:** already installed in the backend image (`python3`, `py3-pip`,
  pinned `pypdf`/`msoffcrypto-tool`).
- **Manual deploys / CI:** install an interpreter plus both libraries, e.g.
  `pip install pypdf==6.19.0 msoffcrypto-tool==6.0.0` (CI does this before
  `npm test`). Override the interpreter with `GHE_PYTHON_BIN` if `python3`
  is not on `PATH`.
- Without working tooling the endpoint answers `503` and no unprotected
  copy is ever produced — install the sidecars rather than bypassing it.
- The export password is downloader-set per file, travels in the POST body
  only (TLS in production), and is never stored or logged.

### File Storage

Files are stored in a named Docker volume (`uploads`). For production, replace local disk storage with S3:

- Modify `NodejsBackend/routes/files.ts` to use `@aws-sdk/client-s3`
- Update `UPLOAD_DIR` to use signed URLs
- Add S3 bucket env vars: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET`

## Manual Deployment

### 1. Database — PostgreSQL

The schema provider is already `postgresql`; no datasource edits are needed.
Run migrations:

```bash
npx prisma migrate deploy
npm run db:seed    # first deploy of an empty database only; never re-run against operational data
# (Phase 5: db:backfill/db:verify were retired with the legacy columns.)
```

### 2. Environment Variables

```bash
NODE_ENV=production
PORT=3001
DATABASE_URL="postgresql://user:password@host:5432/ghe_db"
OIDC_AUTHORITY="https://login.microsoftonline.com/<tenant-id>/v2.0"
OIDC_CLIENT_ID="<api-application-client-id>"
OIDC_AUDIENCE="api://<api-application-client-id>"
OIDC_ISSUER="https://login.microsoftonline.com/<tenant-id>/v2.0"
CORS_ORIGIN="https://your-frontend-domain.com"
```

Keep the previous working values for every variable above where you can
retrieve them in an incident — the rollback below restores them verbatim.

### 2b. Identity-configuration rollback

Identity misconfiguration fails closed (401/403 on every API call, users
stuck on sign-in), so the rollback path must not require the app to be
healthy. Diagnose first, then revert:

1. **Identify the bad knob from the symptom.**
   - All users 401, including previously working sessions → `OIDC_ISSUER`
     or `OIDC_AUDIENCE` changed (token `iss`/`aud` no longer match), or
     the JWKS endpoint moved (`OIDC_AUTHORITY` wrong).
   - Sign-in button loops back to the app unsigned-in → SPA config:
     `VITE_ENTRA_CLIENT_ID` / `VITE_ENTRA_AUTHORITY` mismatch, or the
     page origin is not a registered Entra redirect URI (rebuild + redeploy
     the frontend after fixing; these values are baked in at build time).
   - One user 403 "unprovisioned or subject mismatch" while others work →
     not a config incident: their Entra object ID changed (recreated
     account) or their local row was never provisioned. Provision the row
     or re-link deliberately — do not touch global config for one user.
2. **Revert backend config** to the previous working values and restart
   the API (`docker compose up -d backend`, or `pm2 restart ghe-api`).
   For a bad release rather than bad config, redeploy the previous image
   / `dist/` build instead — migrations only ever add (never rewrite
   history), so rolling back code never requires rolling back the schema.
3. **Verify, in order:** `GET /api/health` → sign in as a known admin in a
   fresh browser session → `GET /api/auth/me` returns the local row →
   one declaration submit + one approval through the UI.
4. **Never "fix" auth by seeding, editing `providerSubject` by hand, or
   loosening middleware checks.** `providerSubject` mismatch fails closed
   by design; hand-editing identity links creates account-takeover risk.
   If a subject must be reset, do it through a reviewed database change
   with the affected user's verified new object ID, never by disabling
   the check.

### 3. Build & Start

```bash
# Build TypeScript
npx tsc

# Start with process manager
npm install -g pm2
pm2 start dist/index.js --name ghe-api
pm2 save
pm2 startup
```

### 4. File Storage

For production, replace local disk storage with S3-compatible storage:

- Modify `routes/files.ts` to use `@aws-sdk/client-s3` instead of `multer.diskStorage`
- Update `UPLOAD_DIR` to use signed URLs
- Add S3 bucket env vars: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET`

### 5. Security Hardening

Authentication is OpenID Connect/Entra (see `docs/IDENTITY-CONTRACT.md`):
tokens carry no role — the middleware resolves user, role, and
organization from the database on every request, so local role changes
apply immediately and disabling a local user fails closed (`403`) on the
next request. There are no application-issued JWTs: token lifetime,
refresh, and revocation are owned by the provider. The pre-OIDC
hardening backlog below was triaged 2026-10-08; every item is resolved
in code and pinned by tests:

| Priority | Issue | Status (pinning test) |
|----------|-------|------------------------|
| P0 | Mass assignment — field whitelist on PUT | Resolved: Zod `createSchema.partial()` whitelist; `employeeId` immutable (`logical-flaws.test.ts`) |
| P0 | Restrict status to "Draft" on create | Resolved: server owns status, hardcoded `"Draft"` (`declarations.ts`) |
| P0 | Role guard on PATCH /:id/status | Resolved: admin-only `403`, with no-divergence guards (`declarations.ts`, `workflow-regressions.test.ts`) |
| P1 | Self-approval guard | Resolved: `403` (`edge-cases.test.ts` — "FIXED: Self-approval blocked") |
| P1 | Enforce workflow step order | Resolved: `403` (`edge-cases.test.ts` — "FIXED: Step order enforced"; `logical-flaws.test.ts`) |
| P1 | Ownership check on GET /:id for team members | Resolved: `403` for non-owners plus org/department scoping (`declarations.ts`, `logical-flaws.test.ts`) |
| P1 | Validate role against DB on each request | Resolved by OIDC design: role is read from the local row per request, never from the token (`IDENTITY-CONTRACT.md`, `auth.test.ts`) |
| P2 | Cascade delete for files on declaration delete | Resolved (`logical-flaws-2.test.ts` — "file cascade-deleted") |
| P2 | ~~JSON.parse(instance.steps)~~ | Resolved: workflow steps are relational rows, nothing parses step JSON (migration `0005_phase5_retirement` dropped the columns) |
| P2 | Validate lineManager before submit | Resolved: manager-less self-service gets a clear `400` (`profile-locking.test.ts`) |

### 6. Additional Production Config

```bash
# Increase body size limit for file uploads (index.ts)
app.use(express.json({ limit: "50mb" }));

# Add file size limits at reverse proxy level (nginx)
client_max_body_size 50M;

# Enable HTTPS (via nginx or cloud provider)
# Set CSP headers properly for your domain
```

## Frontend Deployment

### 1. Build

The SPA calls the API over same-origin relative `/api` paths (dev uses
the Vite proxy; see `vite.config.ts`) — there is no `VITE_API_URL`.
Serve the built frontend from the same host that proxies `/api` to the
backend (nginx example below). Entra settings are baked in at build time:

```bash
cd "Enterprise Compliance Platform"
VITE_ENTRA_CLIENT_ID="<spa-application-client-id>" \
VITE_ENTRA_AUTHORITY="https://login.microsoftonline.com/<tenant-id>/v2.0" \
VITE_ENTRA_API_SCOPE="api://<api-application-client-id>/access_as_user" \
npx vite build
# Output in dist/
```

`VITE_ENTRA_REDIRECT_URI` is optional (defaults to the page origin — which
must exactly match a registered Entra redirect URI, including scheme).

### 2. Serve

Deploy `dist/` to any static host:

- **Nginx:** Copy to `/var/www/html`
- **Cloudflare Pages / Vercel / Netlify:** Connect repo, set build command to `npx vite build`, output dir to `dist`
- **AWS S3 + CloudFront:** Upload `dist/` to S3 bucket, serve via CloudFront

### 3. SPA Routing and API proxy

Configure your static server to serve `index.html` for all routes (for React Router):

**Nginx:**
```nginx
location / {
  try_files $uri $uri/ /index.html;
}

# Same-origin API: the SPA calls relative /api paths, so proxy them to
# the backend instead of exposing the API on a second origin (which would
# also need CORS entries).
location /api/ {
  proxy_pass http://localhost:3001;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-Proto $scheme;
}
```

## Monitoring

- **Health check:** `GET /api/health` — configure your load balancer to hit this
- **Logging:** Morgan (HTTP request logs) outputs to stdout; capture with PM2 or systemd
- **Error tracking:** Integrate Sentry or similar for unhandled errors

## Database Backups

```bash
# PostgreSQL
pg_dump "postgresql://user:password@host:5432/ghe_db" > backup_$(date +%Y%m%d).sql

# Schedule daily via cron
0 2 * * * pg_dump "postgresql://..." > /backups/ghe_$(date +\%Y\%m\%d).sql
```

## Scaling Considerations

- **API is stateless** — scale horizontally behind a load balancer
- **PostgreSQL is the only supported database** — run versioned migrations (`prisma migrate deploy`), never `db push`, against production
- **File storage on local disk doesn't scale** — use S3 or similar object storage
- **No application-issued tokens exist** — access-token lifetime, refresh,
  and revocation are owned by Entra. To cut off a user immediately, disable
  or delete their local `User` row: the middleware resolves identity from
  the database on every request, so the next call fails closed (`403`)
  even with a technically valid provider token. Prefer short provider
  access-token lifetimes per your tenant policy.
