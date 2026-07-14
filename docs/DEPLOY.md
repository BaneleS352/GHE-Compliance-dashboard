# Deployment Guide

## Production Architecture

```
                         ┌──────────────┐
                         │   CDN / Nginx │  Static files (frontend build)
                         └──────┬───────┘
                                │
┌─────────────┐    HTTPS    ┌───▼───────────┐
│   Browser   │────────────▶│   Node.js     │  Express API (port 3001)
└─────────────┘             │   (PM2)       │
                            └───┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │   PostgreSQL          │
                    └───────────────────────┘
```

## Backend Deployment

### 1. Database — Switch to PostgreSQL

Edit `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Run migrations:
```bash
npx prisma migrate deploy
npx prisma db seed
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
| P2 | Add try/catch on JSON.parse(instance.steps) |
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
- **SQLite is not suitable for production** — migrate to PostgreSQL before launching
- **File storage on local disk doesn't scale** — use S3 or similar object storage
- **JWT tokens are not revocable** — use short expiry (15min) + refresh tokens, or maintain a denylist
