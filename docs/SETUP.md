# Local development setup

## Prerequisites

- Node.js 20 (Docker uses Node 20; the code generally requires Node 18+)
- npm
- PostgreSQL 16 or compatible

## Run locally (PostgreSQL required)

### Windows

1. Install Node.js 20 LTS and make sure a PostgreSQL server is available.
2. Set `DATABASE_URL` in `NodejsBackend\.env` to that PostgreSQL server.
3. Double-click `dev.bat` in the project folder.

`dev.bat` does not install or start PostgreSQL. The first-run `.env.example`
uses `postgres:root` on `localhost:5432`; adjust `DATABASE_URL` to match the
PostgreSQL account on your computer. The launcher installs app dependencies
when needed, applies database migrations, and seeds only an empty database.
Later launches reuse those dependencies and the same database. If database
setup fails, the dashboard windows will not open; make sure PostgreSQL is
running and the address and login details in `NodejsBackend\.env` are correct,
then run `dev.bat` again. For a Prisma `EPERM`/file-in-use message, close other
GHE or Node.js windows and retry.

### Other platforms or manual startup

```powershell
cd NodejsBackend
npm install
# Point .env DATABASE_URL at an available PostgreSQL server
npm run db:pg:up   # migrate deploy + seed-if-empty
npm run dev
```

In another terminal:

```powershell
cd "Enterprise Compliance Platform"
npm install
npm run dev
```

The API is `http://localhost:3001`; Vite is `http://localhost:5173`. `dev.bat` starts Azurite and the app services; it reads Entra settings from the backend `.env` and frontend `.env.local`, so normal local sign-in uses Microsoft Entra ID. It does not start or configure the throwaway OpenID provider. For isolated quick-login testing, use the Docker stub stack described in [`DEPLOY.md`](DEPLOY.md), or start the test provider manually and explicitly configure both services for it.

When starting the test provider manually, run `npm run test:provider` in `NodejsBackend`. Configure backend `OIDC_AUTHORITY` and `OIDC_ISSUER` as `http://127.0.0.1:55439`, `OIDC_AUDIENCE` as `ghe-test-api-audience`, `OIDC_ALLOWED_CLIENT_IDS` as `test-spa-client-id`, and `OIDC_REQUIRED_SCOPE` as `access_as_user`. Configure the frontend with `VITE_DEV_TEST_PROVIDER=true` and the matching test client/scope settings. The Vite dev server proxies `/__dev-auth` to the local provider. These settings replace Entra only for that explicitly selected test run.

## Environment

Backend loads `.env` with `dotenv`:

| Variable | Required | Default | Meaning |
|---|---|---|---|
| `DATABASE_URL` | yes for Prisma | — | PostgreSQL URL (SQLite is no longer supported) |
| `OIDC_AUTHORITY` | yes | — | Entra tenant authority/JWKS base |
| `OIDC_ALLOWED_CLIENT_IDS` | yes | — | Comma-separated SPA client IDs allowed by the API |
| `OIDC_REQUIRED_SCOPE` | yes | — | Delegated API scope required in access tokens |
| `OIDC_AUDIENCE` | yes | — | Accepted API token audience |
| `OIDC_ISSUER` | no | authority | Expected token issuer |
| `PORT` | no | `3001` | API listen port |
| `CORS_ORIGIN` | no | dev localhost origins | Comma-separated allowed origins |
| `EMAIL_DELIVERY_ENABLED` | no | `false` | Enable durable notification queueing and SMTP worker delivery |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | required when enabled | —, `587`, `false` | SMTP relay endpoint and TLS mode |
| `SMTP_USER`, `SMTP_PASS` | no | — | Optional paired SMTP credentials; store the password as a deployment secret |
| `SMTP_FROM` | required when enabled | — | Approved sender address |
| `EMAIL_WORKER_POLL_INTERVAL_MS`, `EMAIL_WORKER_BATCH_SIZE`, `EMAIL_WORKER_LOCK_TIMEOUT_MS` | no | `5000`, `10`, `900000` | Worker polling, claim batch, and stale-claim recovery settings |

Attachments use Azurite only. `AZURITE_CONNECTION_STRING` points to the Azurite Blob endpoint and `AZURITE_CONTAINER` defaults to `ghe-attachments`. The local emulator connection string is a development/test default; production startup requires an explicit connection string. `dev.bat` starts Azurite from `docker-compose.azurite.yml`; verify the service with `npm run attachments:verify-azurite`. Docker Compose starts its Azurite service alongside the backend. Existing local `uploads/` records return unavailable until migrated with `npm run attachments:migrate-local-to-azurite`; that command retains source files. For the old Docker `uploads` volume, run `docker compose --profile attachment-migration run --build --rm attachment-migration` after applying migrations. Only that one-off migration service mounts the volume read-only; the API container has no local upload mount. If running without Docker, start Azurite on `127.0.0.1:10000`, make the old `NodejsBackend/uploads/` directory and PostgreSQL available, then run the npm migration command from `NodejsBackend`.

Apply the versioned database migration before enabling delivery. Inspect the database contract with `npm run email:verify-db`; check SMTP connectivity without sending a message with `npm run email:verify-smtp`. Run the worker separately with `npm run email:worker` (Docker Compose: `docker compose --profile email up -d email-worker`). Leave delivery disabled in development and tests unless a safe test relay is explicitly configured.

The SPA sends API requests to same-origin `/api` paths. Vite proxies those
requests to `http://localhost:3001` during development; Docker Nginx proxies
them to `BACKEND_URL`. Frontend identity settings are `VITE_ENTRA_CLIENT_ID`,
`VITE_ENTRA_AUTHORITY`, `VITE_ENTRA_API_SCOPE`, and optional
`VITE_ENTRA_REDIRECT_URI`.

## Database and tests

```powershell
npx prisma migrate deploy
npx prisma generate
npx prisma studio
npm test
npx vitest run src/__tests__/break.test.ts
```

Backend `globalSetup.ts` boots an embedded PostgreSQL (or uses
`TEST_PG_DATABASE_URL` when set), applies the versioned migrations, and seeds
isolated normalized fixtures — the full suite runs against PostgreSQL.
Backend integration tests also require Azurite on port 10000; start it with
`docker compose -f docker-compose.azurite.yml up -d --wait azurite` first.
Frontend tests use Vitest and Testing Library. Playwright E2E tests are under
`Enterprise Compliance Platform/e2e` (require `E2E_PG_DATABASE_URL`);
install Chromium with `npx playwright install chromium`.

## Troubleshooting

- Missing OIDC configuration: set the `OIDC_*` variables from `.env.example`, or use the test JWKS provider for automated tests.
- `TypeError: Invalid URL` while starting the backend: check `OIDC_AUTHORITY` and `OIDC_ISSUER` in `NodejsBackend/.env`; the config trims these values. `dev.bat` clears inherited OIDC variables so the checked-out `.env` remains authoritative.
- Port conflict: inspect `netstat -ano | findstr :3001` or `:5173`.
- Prisma errors: run `npx prisma generate` from `NodejsBackend`.
- Vite/esbuild access errors in synced folders: use a local checkout.
