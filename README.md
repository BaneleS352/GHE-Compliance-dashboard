# GHE Compliance Dashboard

Gift, Hospitality & Entertainment compliance declaration management system.

## Structure

| Directory | Description |
|-----------|-------------|
| `NodejsBackend/` | REST API (Express + Prisma + SQLite/PostgreSQL) — port 3001 |
| `Enterprise Compliance Platform/` | React frontend (Vite + TypeScript) — port 5173 |

## Quick Start

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

## Testing

```bash
# Backend (212 tests)
cd NodejsBackend && npm test

# Frontend (160 tests)
cd "Enterprise Compliance Platform" && npm test
```

The backend includes **72 breaking tests** covering auth bypass, injection, oversized payloads, unicode attacks, and rapid-fire requests. The frontend includes **27 HTTP-layer breaking tests** covering error codes, network failure, malformed responses, and header validation.

All 14 security vulnerabilities documented in [`docs/SECURITY.md`](docs/SECURITY.md) have been fixed and verified by passing tests.
