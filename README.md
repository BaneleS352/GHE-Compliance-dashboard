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
# Backend (203+ tests)
cd NodejsBackend && npm test

# Frontend (230 tests)
cd "Enterprise Compliance Platform" && npm test
```

The backend includes **72 breaking tests** covering auth bypass, injection, oversized payloads, unicode attacks, and rapid-fire requests. The frontend includes **27 HTTP-layer breaking tests** covering error codes, network failure, malformed responses, and header validation.

## Documentation

| File | Description |
|------|-------------|
| [`docs/README.md`](docs/README.md) | Documentation index |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System architecture |
| [`docs/SETUP.md`](docs/SETUP.md) | Development setup |
| [`docs/DEPLOY.md`](docs/DEPLOY.md) | Production deployment |
| [`DOCKER.md`](DOCKER.md) | Docker setup |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Security vulnerabilities |