# GHE Compliance Dashboard — Backend

REST API for managing Gifts, Hospitality & Entertainment compliance declarations, workflow approvals, reporting, and file uploads.

## Quick Start (PostgreSQL required)

```bash
npm install
docker compose up -d db azurite   # local PostgreSQL + attachment emulator
npm run db:pg:up          # migrate deploy + seed-if-empty
npm run dev
```

Copy `NodejsBackend/.env.example` to `NodejsBackend/.env` and set the local
OIDC, database, and Azurite values before starting the backend. Docker Compose
uses the separate root `.env.example`. See [`docs/SETUP.md`](../docs/SETUP.md)
for the complete configuration contract.

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
| `npm run auth:verify-config` | Validate OIDC configuration and public provider metadata |
| `npm run auth:bootstrap-admin` | Link an existing local account to a verified provider identity |
| `npm run attachments:verify-azurite` | Check Azurite connectivity and container access |
| `npm run attachments:migrate-local-to-azurite` | One-time copy of historical local uploads; preserves source files |
| `npm run email:verify-db` | Read-only check of the email procedure and outbox schema |
| `npm run email:verify-smtp` | Check SMTP connectivity without sending a message |
| `npm run email:verify-api` | Validate or test the internal `EMAIL_API` HTTP contract; dry-run by default |
| `npm run email:worker` | Run the separate PostgreSQL outbox delivery worker |
| `npm run staff:inspect` | Inspect the HIS staff API response without printing credentials |

## Environment

Use `NodejsBackend/.env.example` as the backend configuration template. The
root `.env.example` is a separate template for Docker Compose. The backend
requires PostgreSQL and an explicit Azurite connection string; provider
settings, local development identity, optional HIS sync, and email API outbox
settings are documented in [`docs/SETUP.md`](../docs/SETUP.md). For a local
stack, follow the Quick Start above so both PostgreSQL and Azurite are running.

The separate `docker-compose.local-auth.yml` overlay is development-only. Run
it with the existing stub identity overlay (`docker-compose.yml`,
`docker-compose.stub.yml`, and `docker-compose.local-auth.yml`). It
enables seeded employee-ID credentials and PostgreSQL-backed OTP challenges delivered through `EMAIL_API`; never enable it in
production. With the `email` Compose profile, Mailpit captures email at
`http://localhost:8025`. Its seeded password is for local testing only and is
accepted only when `LOCAL_AUTH_ENABLED=true` is explicitly set.

Docker-free option: set `LOCAL_AUTH_ENABLED=true` and `EMAIL_API` in the
backend `.env`, set the matching frontend flag in `.env.local`, then run the
normal backend and frontend dev commands. Configure a registered company or
personal email on each local employee account before testing.

Forgotten local passwords use the registered email address only. If an employee
cannot access that address, self-service recovery is intentionally unavailable;
an authorized administrator or HR operator must verify the employee through
the organization’s separate support process and perform the approved account
recovery action. The application never accepts a replacement phone number
from the unauthenticated recovery form.

```powershell
docker compose -p ghe-compliance-local-auth --env-file .env.docker-stub `
  -f docker-compose.yml -f docker-compose.stub.yml -f docker-compose.local-auth.yml `
  --profile email up -d --build --wait
```

## API Endpoints

All endpoints are documented in Swagger at `/api/docs`. Summary:

| Group | Endpoints | Auth |
|-------|-----------|------|
| **Auth** | `GET /api/auth/me` | Bearer OIDC token |
| **Declarations** | CRUD, submit, status change | Bearer |
| **Workflows** | Pending steps, timeline, approve/decline/return | Bearer |
| **Reports** | Status breakdown, SLA, counterparty concentration, high-value, filtered list, Excel export | Bearer |
| **Files** | `POST /api/files/upload` (10MB max), authenticated download/delete | Bearer |
| **Admin Dashboard** | KPI counts | Admin |
| **Admin Users** | User CRUD, search, filter | Admin |
| **Admin Config** | System config, legacy read-only dropdown options, approval options | Admin |
| **Admin Workflows** | Workflow rule CRUD | Admin |
| **Health** | `GET /api/health` | None |

## Testing

```bash
npm run test          # Run the current backend Vitest suite
npm run test:watch    # Watch mode
```

Tests use PostgreSQL, apply the versioned migrations, and seed isolated
fixtures (`globalSetup.ts`). Tests are sequential (`maxWorkers: 1`). Set
`TEST_PG_DATABASE_URL` to use an external PostgreSQL instance; otherwise the
suite provisions its configured local test database.

### Test Coverage

Before running the backend suite, start Azurite with
`docker compose -f ../docker-compose.azurite.yml up -d --wait azurite` from
this directory. Tests then use the local test container and OIDC/JWKS setup.
The backend suite covers identity resolution,
declaration and workflow transitions, organization-scoped authorization,
admin configuration, report queries and exports, Azurite file lifecycle,
notification outbox behavior, and adversarial input cases. The source of truth
for current gates and the latest recorded counts is [`AGENTS.md`](../AGENTS.md);
use the actual test command output rather than relying on fixed counts in this
README.

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
    globalSetup.ts      # PostgreSQL migrations + fixtures; requires Azurite
    *.test.ts           # Test suites
prisma/
  schema.prisma         # PostgreSQL schema, BIGINT keys (see DATABASE-NORMALIZATION-GOAL.md)
migrations/           # Versioned PostgreSQL migrations through 0022
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
- **Below high-value threshold**: Line manager review only
- **At or above `highValueThreshold`**: Line manager + HR

`mediumValueThreshold` affects the `Low`/`Medium`/`High` priority label, but
does not choose a separate workflow. The SPA previews the label; the backend
derives the persisted priority from the value and server configuration.

Approval decisions: `accept`, `org` (org pool), `foundation` (donate), `decline`, `return`.
