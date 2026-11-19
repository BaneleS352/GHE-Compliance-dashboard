# Docker deployment

The root `docker-compose.yml` runs the core services:

| Service | Container | Host | Purpose |
|---|---:|---:|---|
| `frontend` | 80 | 3000 | Vite build served by Nginx; proxies API requests |
| `backend` | 3001 | 3001 | Express API |
| `db` | 5432 | 5432 | PostgreSQL 16 |
| `azurite` | 10000 | 10000 | Private attachment blob storage for local development |

The `email-worker` service is opt-in through the `email` profile. The
`attachment-migration` profile is a one-time bridge for historical local-disk
uploads; the API itself does not mount or read the legacy `uploads` volume.
`pgdata` and `azurite_data` persist database and attachment data. `uploads` is
retained only for the one-time migration. The compose file publishes local
development ports and contains example credentials, so it is not a hardened
internet-facing deployment configuration.

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

Replace OIDC settings, database credentials, and `CORS_ORIGIN` before
deployment. `BACKEND_URL` controls the Nginx upstream and defaults to
`http://backend:3001`. Attachments use the Azurite emulator in this Compose
setup; it does not provide production cloud-storage durability or availability
guarantees. Notifications are queued in PostgreSQL. To deliver them, enable
`EMAIL_DELIVERY_ENABLED`, configure the `SMTP_*` settings, and run the optional
email worker.

```bash
docker compose logs -f frontend backend db
docker compose down       # keeps volumes
docker compose down -v    # destructive: removes PostgreSQL, Azurite, and legacy upload volumes
docker compose build --no-cache
```

Use TLS and edge authentication, restrict CORS, back up PostgreSQL and Azurite
data, and do not publicly expose database or blob ports in production. Replace
the Azurite emulator with a supported production storage service before
relying on cloud durability or availability.
