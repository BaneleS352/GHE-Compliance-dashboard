# GHE Compliance Dashboard — Backend

REST API for managing Gifts, Hospitality & Entertainment compliance declarations, workflow approvals, reporting, and file uploads.

## Quick Start (PostgreSQL required)

```bash
npm install
docker compose up -d db   # local PostgreSQL (or point DATABASE_URL at any server)
npm run db:pg:up          # migrate deploy + seed-if-empty
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
| `npm run test` | Run all tests once against PostgreSQL |
| `npm run test:watch` | Run tests in watch mode |
| `npm run db:seed` | Seed with sample data |
| `npm run db:pg:up` | Versioned bring-up: migrate deploy + seed-if-empty |
| `npm run pg:test` | PostgreSQL integration checks (needs `TEST_PG_DATABASE_URL`) |
| `npm run pg:smoke` | Clean-database smoke test (needs `SMOKE_PG_DATABASE_URL` + build) |
| `npm run db:generate` | Generate Prisma client |

## Environment

Copy `.env.example` to `.env`:

```env
DATABASE_URL="postgresql://ghe_user:ghe_password@localhost:5432/ghe_compliance?schema=public"
JWT_SECRET="change-this-to-a-random-secret"
PORT=3001
```

Run `docker compose up -d db` from the repository root for a local instance.

## API Endpoints

All endpoints are documented in Swagger at `/api/docs`. Summary:

| Group | Endpoints | Auth |
|-------|-----------|------|
| **Auth** | `POST /api/auth/login`, `GET /api/auth/me` | None / Bearer |
| **Declarations** | CRUD, submit, status change | Bearer |
| **Workflows** | Pending steps, timeline, approve/decline/return | Bearer |
| **Reports** | Status breakdown, SLA, counterparty concentration, high-value, filtered list, Excel export | Bearer |
| **Files** | `POST /api/files/upload` (10MB max), authenticated download/delete | Bearer |
| **Admin Dashboard** | KPI counts | Admin |
| **Admin Users** | User CRUD, search, filter | Admin |
| **Admin Config** | System config, dropdowns, approval options | Admin |
| **Admin Workflows** | Workflow rule CRUD | Admin |
| **Health** | `GET /api/health` | None |

## Testing

```bash
npm run test          # Run the current backend Vitest suite
npm run test:watch    # Watch mode
```

Tests boot an embedded PostgreSQL, apply the versioned migrations, and seed
isolated fixtures (`globalSetup.ts`), so the full suite runs against
PostgreSQL. Tests are sequential (`maxWorkers: 1`). Set `TEST_PG_DATABASE_URL`
to run against an external PostgreSQL instead of the embedded one.

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
| `break.test.ts` | 72 | **Negative/injection/stress/fuzz tests** |

### Breaking Tests (`break.test.ts` — 72 tests)

Covers scenarios that try to break the API:
- **Auth bypass**: expired token, wrong signature, missing/invalid/whitespace token, no auth header, wrong role
- **Injection**: SQLi (`' OR 1=1--`), NoSQL (`$gt`), XSS payloads in fields
- **Oversized payloads**: 10MB body, 10k-char strings, deeply nested 500-level JSON
- **Unicode/BOM**: UTF-8 BOM prefix in JSON body, emoji in declaration fields
- **Protocol violations**: URL-encoded body where JSON expected, array instead of object, null required fields
- **HTTP edge cases**: CORS preflight, method override headers (X-HTTP-Method-Override), duplicate query params
- **Rapid fire**: 20 sequential requests to test concurrency/connection reuse
- **CRUD integrity**: edit/delete non-owned declaration, tamper with admin-only endpoints
- **Special paths**: `../` traversal, routes with special URL characters

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
  schema.prisma         # PostgreSQL schema, BIGINT keys (see DATABASE-NORMALIZATION-GOAL.md)
  migrations/           # Versioned migrations (0000_baseline → 0009_domain_checks)
```

## Frontend Integration

The frontend (`../Enterprise Compliance Platform`) communicates with this backend via HTTP. The Vite dev server proxies `/api` requests to `http://localhost:3001`. The shared `dev.bat` script at the repository root starts both servers:

```bat
dev.bat
```

## Database

PostgreSQL only (BIGINT identity keys; `Declaration.id` stays the public
`GHE-YYYY-NNNNNN` reference). Internal numeric identifiers are exposed as JSON
numbers. Key relations:

`Organization` → `Department` → `Team` → `User` (self-FK `managerId`); `User` → `Declaration` (declarer/current approver) → `DeclarationSnapshot`/`DeclarationDetail`/`DeclarationFile`/`WorkflowInstance` → `WorkflowInstanceStep`; `WorkflowRule` → `WorkflowRuleStep`; `Counterparty` → declarations/contacts.

## Workflow Rules

Rule matching is value-based:
- **Low** (`≤ mediumThreshold`): Line manager review only
- **Medium** (`> mediumThreshold`, `≤ highThreshold`): Line manager + HR
- **High** (`>= highValueThreshold`): Line Manager + HR

Approval decisions: `accept`, `org` (org pool), `foundation` (donate), `decline`, `return`.
