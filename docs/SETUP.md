# Local development setup

## Prerequisites

- Node.js 20 (Docker uses Node 20; the code generally requires Node 18+)
- npm
- Docker Desktop and Compose, if using containers

## Run locally (PostgreSQL required)

```powershell
cd NodejsBackend
npm install
# Point .env DATABASE_URL at PostgreSQL, e.g. via docker compose up -d db
npm run db:pg:up   # migrate deploy + seed-if-empty
npm run dev
```

In another terminal:

```powershell
cd "Enterprise Compliance Platform"
npm install
npm run dev
```

The API is `http://localhost:3001`; Vite is `http://localhost:5173`. `dev.bat` starts both on Windows.

## Environment

Backend loads `.env` with `dotenv`:

| Variable | Required | Default | Meaning |
|---|---|---|---|
| `DATABASE_URL` | yes for Prisma | — | PostgreSQL URL (SQLite is no longer supported) |
| `OIDC_AUTHORITY` | yes | — | Entra tenant authority/JWKS base |
| `OIDC_CLIENT_ID` | yes | — | API application client ID |
| `OIDC_AUDIENCE` | yes | — | Accepted API token audience |
| `OIDC_ISSUER` | no | authority | Expected token issuer |
| `PORT` | no | `3001` | API listen port |
| `CORS_ORIGIN` | no | dev localhost origins | Comma-separated allowed origins |
| `EMAIL_WEBHOOK_URL` | no | — | Notification webhook; absent means log-only |

Frontend accepts `VITE_API_URL` (local default `http://localhost:3001`) plus `VITE_ENTRA_CLIENT_ID`, `VITE_ENTRA_AUTHORITY`, `VITE_ENTRA_API_SCOPE`, and optional `VITE_ENTRA_REDIRECT_URI`. Docker uses Nginx and `BACKEND_URL` for the upstream.

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
Frontend tests use Vitest and Testing Library. Playwright E2E tests are under
`Enterprise Compliance Platform/e2e` (require `E2E_PG_DATABASE_URL`);
install Chromium with `npx playwright install chromium`.

## Troubleshooting

- Missing OIDC configuration: set the `OIDC_*` variables from `.env.example`, or use the test JWKS provider for automated tests.
- Port conflict: inspect `netstat -ano | findstr :3001` or `:5173`.
- Prisma errors: run `npx prisma generate` from `NodejsBackend`.
- Vite/esbuild access errors in synced folders: use a local checkout.
