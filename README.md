# GHE Compliance Dashboard

Gift, Hospitality & Entertainment compliance declaration management system.

## Structure

| Directory | Description |
|-----------|-------------|
| `NodejsBackend/` | REST API (Express + Prisma + SQLite/PostgreSQL) — port 3001 |
| `Enterprise Compliance Platform/` | React frontend (Vite + TypeScript) — port 5173 (dev) / 80 (Docker) |

## Quick Start

### Local development

```bash
dev.bat          # Starts both backend and frontend
```

Or start individually:

```bash
cd NodejsBackend
npm install && npx prisma generate && npm run db:push && npm run db:seed && npm run dev
```

```bash
cd "Enterprise Compliance Platform"
npm install && npm run dev
```

### Docker (production-like)

```bash
docker compose up -d --build
docker compose exec backend npm run db:seed   # first time only
open http://localhost:3000
```

## Docker

A 3-container setup is defined in [`docker-compose.yml`](./docker-compose.yml):

- **Frontend** (Nginx, port 3000) — serves the built SPA, proxies `/api/` and `/uploads/` to the backend
- **Backend** (Node, port 3001) — Express API with Prisma (PostgreSQL via sed-swapped schema)
- **Database** (PostgreSQL 16, port 5432) — persistent volume

See [`DOCKER.md`](./DOCKER.md) for full details.

## Theme

All status, priority, and brand colours are centralized in `src/config/theme.ts` and `src/styles/theme.css` — the single source of truth. See [`Enterprise Compliance Platform/src/config/theme.ts`](./Enterprise%20Compliance%20Platform/src/config/theme.ts).

## Testing

```bash
# Backend (360 tests, Vitest)
cd NodejsBackend && npm test

# Frontend (Vitest + Testing Library)
cd "Enterprise Compliance Platform" && npm test

# E2E (Playwright)
cd "Enterprise Compliance Platform"
npx playwright install chromium
npx playwright test
```

Backend: 360/360 passing. Frontend: build clean.

### Playwright E2E Tests

The E2E test suite covers key user flows:

- Full approval workflows (LM → HR → CEO)
- Rejections and returns with resubmit
- Declaration creation and submission
- Admin user management
- Dashboard and KPIs
- Reports access
- Edge cases and error handling

Tests run against the dev server (frontend at `:5173`, backend at `:3001`).
The `global-setup.ts` seeds the database before running E2E tests.

### E2E Test Commands

```bash
# Run all E2E tests (headed)
npx playwright test --headed

# Run specific test file
npx playwright test e2e/approval-flows.spec.ts

# Run mobile viewport tests
npx playwright test --project=mobile

# Debug a specific test
npx playwright test --debug

# Show test trace
npx playwright show-trace
```

## Audit Status

All 42 audit findings across 6 severity levels have been resolved:

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 7 | ✅ All fixed |
| HIGH | 8 | ✅ All fixed |
| MEDIUM | 15 | ✅ All fixed |
| LOW | 12 | ✅ All fixed |

See [`docs/SECURITY.md`](./docs/SECURITY.md) for the detailed fix log.

## Documentation

| File | Description |
|------|-------------|
| [`docs/README.md`](docs/README.md) | Documentation index |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System architecture |
| [`docs/SETUP.md`](docs/SETUP.md) | Development setup |
| [`docs/DEPLOY.md`](docs/DEPLOY.md) | Production deployment |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Security audit fix log |
| [`docs/API.md`](docs/API.md) | API reference |
| [`docs/SCHEMA.md`](docs/SCHEMA.md) | Database schema |
| [`AGENTS.md`](AGENTS.md) | Agent memory & known patterns |