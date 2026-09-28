# Docker deployment

The root `docker-compose.yml` runs three services:

| Service | Container | Host | Purpose |
|---|---:|---:|---|
| `frontend` | 80 | 3000 | Vite build served by Nginx; proxies API requests |
| `backend` | 3001 | 3001 | Express API |
| `db` | 5432 | 5432 | PostgreSQL 16 |

`pgdata` and `uploads` named volumes persist database and uploaded-file data. The compose file publishes PostgreSQL and contains example credentials, so it is a deployment baseline, not a hardened internet-facing configuration.

## Start

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f backend
```

Open <http://localhost:3000>. Health is at <http://localhost:3001/api/health>; Swagger UI is at <http://localhost:3001/api/docs>.

Seed a new database once with `SEED_ON_BOOT=true docker compose up -d --build`
(or `docker compose exec backend npm run db:seed` against a running stack).

The backend entrypoint runs `prisma migrate deploy` before starting — versioned
migrations only, failing fast with no `db push` fallback. It then runs the
idempotent normalization backfill (reconciliation report in the logs, fatal on
failure) and starts the API. The backend image switches the Prisma provider
from SQLite to PostgreSQL during its build. Pre-migration databases must use
the one-time baseline procedure in `NodejsBackend/prisma/BASELINE.md`.

## Configuration and operations

Replace `JWT_SECRET`, database credentials, and `CORS_ORIGIN` before production. `BACKEND_URL` controls the Nginx upstream and defaults to `http://backend:3001`. Set `EMAIL_WEBHOOK_URL` to deliver notifications; without it, events are logged.

```bash
docker compose logs -f frontend backend db
docker compose down       # keeps volumes
docker compose down -v    # destructive: removes database and upload volumes
docker compose build --no-cache
```

Use TLS and edge authentication, restrict CORS, back up PostgreSQL and uploads, and do not publicly expose port 5432 in production. Consider object storage for uploads when containers are replaced or scaled.
