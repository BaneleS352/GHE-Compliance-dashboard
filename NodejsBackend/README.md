# GHE Compliance Dashboard — Backend

REST API for managing Gifts, Hospitality & Entertainment compliance declarations, workflow approvals, reporting, and file uploads.

## Quick Start

```bash
npm install
npx prisma generate
npm run db:push
npm run db:seed
npm run dev
```

Server starts at `http://localhost:3001`.

## API Docs (Swagger)

With the server running, visit:
```
http://localhost:3001/api/docs
```
Explore and test all endpoints interactively.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server with hot reload (`tsx watch`) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled production build |
| `npm run test` | Run all tests once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run db:push` | Push schema to database |
| `npm run db:seed` | Seed with sample data |
| `npm run db:generate` | Generate Prisma client |

## Environment

Copy `.env.example` to `.env`:

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="change-this-to-a-random-secret"
PORT=3001
```

For PostgreSQL, set `DATABASE_URL` to a Postgres connection string and run `docker compose up -d` for a local instance.

## API Endpoints

All endpoints are documented in Swagger at `/api/docs`. Summary:

| Group | Endpoints | Auth |
|-------|-----------|------|
| **Auth** | `POST /api/auth/login`, `GET /api/auth/me` | None / Bearer |
| **Declarations** | CRUD, submit, status change | Bearer |
| **Workflows** | Pending steps, timeline, approve/decline/return | Bearer |
| **Reports** | Status breakdown, SLA, counterparty concentration, high-value, filtered list, Excel export | Bearer |
| **Files** | Upload (10MB max), download, delete | Bearer (download public) |
| **Admin Dashboard** | KPI counts | Admin |
| **Admin Users** | User CRUD, search, filter | Admin |
| **Admin Config** | System config, dropdowns, approval options | Admin |
| **Admin Workflows** | Workflow rule CRUD | Admin |
| **Health** | `GET /api/health` | None |

## Testing

```bash
npm run test          # 96 tests across 9 suites
npm run test:watch    # Watch mode
```

Tests use a separate SQLite database (`test.db`) that's reset before each run via `globalSetup.ts`. Tests are sequential (`maxWorkers: 1`) to avoid database lock contention.

### Test Coverage

| File | Tests | Focus |
|------|-------|-------|
| `auth.test.ts` | 7 | Login, token validation, role check |
| `declarations.test.ts` | 12 | CRUD, submit, workflow creation, status |
| `workflows.test.ts` | 8 | Pending steps, approve, decline, return |
| `reports.test.ts` | 8 | All report endpoints, filters, export |
| `admin/users.test.ts` | 10 | Admin user CRUD, duplicate email, last admin |
| `admin/config.test.ts` | 8 | Config, dropdowns, approval options |
| `admin/workflows.test.ts` | 5 | Workflow rule CRUD |
| `admin/dashboard.test.ts` | 2 | Dashboard KPIs, auth enforcement |
| `break.test.ts` | 36 | **Negative/injection/stress tests** |

## Project Structure

```
src/
  index.ts              # Express app entry
  config/
    env.ts              # Environment config
    prisma.ts           # PrismaClient singleton
    swagger.ts          # OpenAPI 3.0 spec definition
  middleware/
    auth.ts             # JWT authentication & role authorization
  routes/
    auth.ts, declarations.ts, workflows.ts, reports.ts, files.ts
    admin/              # Admin routes (dashboard, users, config, workflows)
  services/
    workflowService.ts  # Workflow step creation & approval logic
    excelService.ts     # XLSX buffer generation
  __tests__/
    helpers.ts          # buildApp(), JWT token helpers
    globalSetup.ts      # Test DB push + seed
    *.test.ts           # Test suites
prisma/
  schema.prisma         # Database schema (10 models)
```

## Database

SQLite by default, PostgreSQL optional. 10 models:

`User` → `Declaration` → `WorkflowInstance`/`WorkflowRule` → uploaded files, config, dropdowns, compliance trends, type breakdowns, approval options.

## Workflow Rules

Rule matching is value-based:
- **Low** (`≤ mediumThreshold`): Line manager review only
- **Medium** (`> mediumThreshold`, `≤ highThreshold`): Line manager + HR
- **High** (`> highThreshold`): Line manager + HR + CEO

Approval decisions: `accept`, `org` (org pool), `foundation` (donate), `decline`, `return`.
