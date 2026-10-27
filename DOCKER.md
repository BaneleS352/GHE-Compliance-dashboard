# Docker deployment

The root `docker-compose.yml` runs three services:

| Service | Container | Host | Purpose |
|---|---:|---:|---|
| `frontend` | 80 | 3000 | Vite build served by Nginx; proxies API requests |
| `backend` | 3001 | 3001 | Express API |
| `db` | 5432 | 5432 | PostgreSQL 16 |

`pgdata` and `uploads` named volumes persist database and uploaded-file data. The compose file publishes PostgreSQL and contains example credentials, so it is a deployment baseline, not a hardened internet-facing configuration.

Published ports bind to loopback by default. For remote users, place a TLS
reverse proxy in front of the frontend; expose the frontend port explicitly
only when required, and keep the API and database ports private.

## Start

For a real Entra configuration, copy `.env.example` to `.env` and replace
its placeholders before building. For local sign-in without Entra, follow
the isolated stub-stack instructions in `docs/DEPLOY.md`.

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f backend
```

Open <http://localhost:3000>. Health is at <http://localhost:3001/api/health>; Swagger UI is at <http://localhost:3001/api/docs>.

To seed an empty database on first start, set `SEED_ON_BOOT=true` in the root
`.env` before running Compose. The entrypoint uses `seed-if-empty`; it skips
seeding when users, organizations, or declarations already exist.

The backend entrypoint runs `prisma migrate deploy` before starting — versioned
migrations only, failing fast with no `db push` fallback — seeds an empty
database only when `SEED_ON_BOOT=true`, then starts the API. The Prisma schema
is PostgreSQL-native (BIGINT keys; no provider rewrite at build time).
Pre-migration databases must use the one-time baseline procedure in
`NodejsBackend/prisma/BASELINE.md` (see also
`NodejsBackend/prisma/RETIREMENT.md` for the completed cutovers).

## Configuration and operations

Replace OIDC settings, database credentials, and `CORS_ORIGIN` before production. `BACKEND_URL` controls the Nginx upstream and defaults to `http://backend:3001`. Set `EMAIL_WEBHOOK_URL` to deliver notifications; without it, events are logged.

```bash
docker compose logs -f frontend backend db
docker compose down       # keeps volumes
docker compose down -v    # destructive: removes database and upload volumes
docker compose build --no-cache
```

Use TLS and edge authentication, restrict CORS, back up PostgreSQL and uploads, and do not publicly expose port 5432 in production. Consider object storage for uploads when containers are replaced or scaled.
