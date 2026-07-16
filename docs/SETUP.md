# Development Setup

## Prerequisites

- Node.js 18+
- npm

## Quick Start

```bash
# 1. Clone and install backend dependencies
cd NodejsBackend
npm install

# 2. Initialize the database (SQLite)
npx prisma db push
npx prisma db seed    # Seeds test data with preset users, rules, config

# 3. Start the backend
# (uses tsx watch — hot reload enabled)
npm run dev
# Server starts on http://localhost:3001

# 4. In a new terminal — install and start frontend
cd "Enterprise Compliance Platform"
npm install
npx vite
# Frontend starts on http://localhost:5173
```

## Environment Variables

### Backend (`NodejsBackend/.env`)
| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `file:./dev.db` | SQLite path or PostgreSQL URL |
| `JWT_SECRET` | (required) | Secret for signing JWT tokens |
| `PORT` | `3001` | Server port |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed CORS origins (comma-separated) |

### Frontend
| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:3001` | Backend API base URL |

## Database Commands

```bash
# Push schema to DB (creates tables)
npx prisma db push

# Push with force reset (drops all data)
npx prisma db push --force-reset

# Run seed script
npx prisma db seed

# Open Prisma Studio (GUI)
npx prisma studio

# Generate Prisma client (after schema changes)
npx prisma generate
```

## Running Tests

```bash
# Backend (203 tests)
cd NodejsBackend
npm test                         # Full suite
npx vitest run src/__tests__/break.test.ts   # Single file
npx vitest                       # Watch mode

# Frontend (156 tests)
cd "Enterprise Compliance Platform"
npm test
npx vitest run -t "login"        # By test name pattern
```

## Test Database

Tests use a separate SQLite database at `NodejsBackend/src/__tests__/test.db`. The `globalSetup.ts` script:
1. Runs `prisma db push --force-reset` to create tables
2. Seeds preset test data (5 users, 3 declarations, 3 workflow rules, config)
3. Each test run starts with a clean database

## Common Issues

**Port already in use:**
```bash
# Find and kill process on port 3001
netstat -ano | findstr :3001
taskkill /PID <pid> /F
```

**Prisma client not generated:**
```bash
cd NodejsBackend
npx prisma generate
```

**Node version mismatch:**
Check with `node --version`. Requires 18+.
