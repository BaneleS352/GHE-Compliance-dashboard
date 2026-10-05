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
JWT_SECRET=<generate-a-strong-random-secret>
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
JWT_SECRET="<generate-a-strong-random-secret>"
CORS_ORIGIN="https://your-frontend-domain.com"
```

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

**Before going live, fix these vulnerabilities** (see `docs/SECURITY.md`):

| Priority | Issue |
|----------|-------|
| P0 | Mass assignment — add field whitelist on PUT |
| P0 | Restrict status to "Draft" on create |
| P0 | Add role guard on PATCH /:id/status |
| P1 | Add self-approval guard |
| P1 | Enforce workflow step order |
| P1 | Add ownership check on GET /:id for team members |
| P1 | Validate JWT role against DB on each request |
| P2 | Add cascade delete for files on declaration delete |
| P2 | ~~Add try/catch on JSON.parse(instance.steps)~~ — resolved: workflow steps are relational rows, nothing parses step JSON (migration `0005_phase5_retirement` dropped the columns) |
| P2 | Validate lineManager before submit |

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

```bash
cd "Enterprise Compliance Platform"
VITE_API_URL="https://api.your-domain.com" npx vite build
# Output in dist/
```

### 2. Serve

Deploy `dist/` to any static host:

- **Nginx:** Copy to `/var/www/html`
- **Cloudflare Pages / Vercel / Netlify:** Connect repo, set build command to `npx vite build`, output dir to `dist`
- **AWS S3 + CloudFront:** Upload `dist/` to S3 bucket, serve via CloudFront

### 3. SPA Routing

Configure your static server to serve `index.html` for all routes (for React Router):

**Nginx:**
```nginx
location / {
  try_files $uri $uri/ /index.html;
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
- **JWT tokens are not revocable** — use short expiry (15min) + refresh tokens, or maintain a denylist
