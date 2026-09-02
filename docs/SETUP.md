# Local development setup

## Prerequisites

- Node.js 20 (Docker uses Node 20; the code generally requires Node 18+)
- npm
- Docker Desktop and Compose, if using containers

## Run locally

```powershell
cd NodejsBackend
npm install
npx prisma generate
npx prisma db push
npm run db:seed
$env:JWT_SECRET = "local-development-secret"
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
| `JWT_SECRET` | yes | — | JWT signing secret |
| `DATABASE_URL` | yes for Prisma | — | `file:./dev.db` or PostgreSQL URL |
| `PORT` | no | `3001` | API listen port |
| `CORS_ORIGIN` | no | dev localhost origins | Comma-separated allowed origins |
| `EMAIL_WEBHOOK_URL` | no | — | Notification webhook; absent means log-only |

Frontend accepts `VITE_API_URL` (local default `http://localhost:3001`). Docker uses Nginx and `BACKEND_URL` for the upstream.

## Database and tests

```powershell
npx prisma db push
npx prisma generate
npx prisma studio
npm test
npx vitest run src/__tests__/break.test.ts
```

`db push --force-reset` destroys the selected database. Backend `globalSetup.ts` uses `file:./test.db`, resets it, and seeds isolated fixtures. Frontend tests use Vitest and Testing Library. Playwright E2E tests are under `Enterprise Compliance Platform/e2e`; install Chromium with `npx playwright install chromium`.

## Troubleshooting

- Missing `JWT_SECRET`: set it in `NodejsBackend/.env` or the process environment.
- Port conflict: inspect `netstat -ano | findstr :3001` or `:5173`.
- Prisma errors: run `npx prisma generate` from `NodejsBackend`.
- Vite/esbuild access errors in synced folders: use a local checkout.
