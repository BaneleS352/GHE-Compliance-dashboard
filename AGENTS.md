# GHE Compliance Dashboard — Agent Memory

## Project Overview

Gift, Hospitality & Entertainment compliance declaration management system.
Two-service architecture: Node.js/Express backend + React/Vite frontend.

| Service | Stack | Port |
|---------|-------|------|
| Backend | Express, Prisma, PostgreSQL (single provider) | 3001 |
| Frontend | React 18, Vite, TypeScript | 5173 (dev), 80 (Docker) |

## Key Paths

| Path | Purpose |
|------|---------|
| `NodejsBackend/src/routes/` | Express route handlers |
| `NodejsBackend/src/services/` | Business logic (Prisma queries) |
| `NodejsBackend/src/middleware/` | Auth middleware (`authenticate`, `authorize`) |
| `Enterprise Compliance Platform/src/app/pages/` | React page components |
| `Enterprise Compliance Platform/src/services/api.ts` | API client + `toApiDeclaration`/`mapDeclaration` mappers |
| `Enterprise Compliance Platform/src/types/declaration.ts` | `Declaration` interface (single source of truth) |
| `Enterprise Compliance Platform/src/config/theme.ts` | Colors, `DECISION_LABELS`, `APPROVAL_OPTIONS` |
| `Enterprise Compliance Platform/src/app/hooks/` | Custom hooks (`useWorkflowApproval`, etc.) |
| `NodejsBackend/src/seed.ts` | Test seed data |
| `NodejsBackend/prisma/schema.prisma` | DB schema + indexes |

## Testing

```bash
# Backend (current suite; run command for the live count, embedded PostgreSQL)
cd NodejsBackend && npm test

# Frontend (current suite; run command for the live count, Vitest + Testing Library)
cd "Enterprise Compliance Platform" && npm test

# Clean-database gates (need TEST_PG_/SMOKE_PG_DATABASE_URL; CI provides postgres services)
cd NodejsBackend && npm run pg:test   # PostgreSQL integration checks
cd NodejsBackend && npm run build && npm run pg:smoke  # all smoke checks pass
```

Historical gate results are documented in the focused goal/remediation plans. The current cross-repository audit and latest verification matrix are tracked in [`docs/CODEBASE-AUDIT-CLEANUP.md`](docs/CODEBASE-AUDIT-CLEANUP.md); run the commands above before relying on historical counts.

## Important Details
- **PostgreSQL is the single provider**; SQLite support fully removed (no `db push` fallback, no Dockerfile `sed` provider rewrite)
- Migrations 0006_numeric_keys through 0013_user_manager_fk_only complete the numeric-key, workflow-identity, department, domain-integrity, auth-cutover, SLA-scoping, exact-money, scoped-uniqueness, and manager-FK-only changes
- Migrations through 0020_remove_redundant_indexes are present; attachment bytes are stored only in Azurite and local-disk rows are switched with `npm run attachments:migrate-local-to-azurite` without deleting the source files
- Declaration.id stays public GHE-YYYY-NNNNNN text reference with internal declarationPk referenced by all child tables
- Declaration and SystemConfig monetary fields use Decimal(19,2); numeric API boundaries deliberately convert Prisma Decimal values to JSON numbers after validation caps precision to cents
- Migration 0012 adds scoped team-member and department-code uniqueness, priority checks, exact-money columns with a fail-fast precision preflight, and append-only declaration audit history
- Bearer tokens are provider-issued RS256 JWTs validated via JWKS (no app-issued JWTs); local user ids stay numeric with no legacy text-id compatibility lookup
- `dev.bat` starts Azurite and uses the checked-out backend `.env` and frontend `.env.local`; it does not start or configure the throwaway JWKS provider. The isolated test provider is opt-in through the Docker stub stack or explicit manual configuration.
- API responses carry no tokens beyond the Authorization header (MSAL sessionStorage cache in the SPA); `/api/docs` is disabled in production and `npm run db:seed` refuses `NODE_ENV=production` without `GHE_ALLOW_PROD_SEED=1`
- `User.managerId` is the only persisted manager relationship; `lineManager` is an API display value derived from that FK, while declaration snapshots retain historical manager names
- API response shapes unchanged apart from numeric ids exposed as JSON numbers at boundary via services/ids.ts
- Latest audit check (2026-11-19): backend `npx tsc --noEmit` passed; frontend typecheck, quality, 290 unit tests, and production build passed; both npm audits reported zero vulnerabilities. Backend full tests, Prisma regeneration/build, PostgreSQL gates, and Docker checks remain unverified or environment-blocked; see the audit tracker.
- `npm run pg:smoke` added as clean-database gate; CI runs backend tests + pg:test + smoke + e2e + frontend typecheck/tests/build
- documentation updated: BASELINE, RETIREMENT, SCHEMA, DOCKER, ARCHITECTURE, DEPLOY, goal Current State, AGENTS.md

## Work State

### Completed
- Full clean plan implemented across Phases A-F (normalization + numeric identifier cutover)
- Latest recorded verification (2026-10-08) is 445/445 backend tests, 270/270 frontend tests, typecheck/build, PostgreSQL integration (69/69) and smoke (20/20) gates, and Playwright e2e (desktop 18/18, mobile 2/2); see the goal document for evidence and limitations
- Audit fixes applied 2026-10-08: rate limiting, SLA/approve/file/user org scoping, approval-option validation with fail-closed decisions, workflow-rule delete guards, atomic declaration delete, pagination fix, MSAL refresh recovery, seed-if-empty multi-table check, TLS-bypass removal, dead crypto/secret removal, Playwright CI job, identity rollback procedure
- `(prisma/db/tx as any)` model hatches removed from runtime code, seeds, scripts, tests; `BigInt()` centralized via `services/ids.ts` (`tsc --noEmit` clean)
- `readWorkflowSteps` renamed to `readWorkflowStepRows`; Swagger `Dropdowns` → `DropdownOptions` with PUT as 410 Gone
- Route-level counterparty aggregation moved into `services/reports.ts` (view-first); `AdminWorkflows` consumes step rows (no `JSON.parse`)
- Fixed order-dependent suite flakes: `workflow-regressions` no longer uses hardcoded user ids 12/13/14 (tokens signed from upserted rows); ghost-employeeId test asserts loud 400 at the boundary
- Fixed real bugs surfaced by the gates: `seed.ts` two-pass user seeding (self-FK on clean DB), `smoke.ts` datasource URL + BigInt serialization, order-sensitive `equiv` in `pg-integration-checks`
- CI runs frontend production build; ARCHITECTURE.md provider-rewrite description corrected
- E2E verification 2026-10-26: Playwright 21/21 passed against a fresh local PostgreSQL database with the throwaway JWKS OpenID provider, including the developer quick-login flow. `playwright.config.ts` passes `E2E_PG_DATABASE_URL` to the backend webServer so the API uses the same database that global setup migrates and seeds. See the verification update in `docs/FRONTEND-AUDIT-REMEDIATION-PLAN.md`.

### Active
- Whole-codebase audit and cleanup is active; see `docs/CODEBASE-AUDIT-CLEANUP.md` for findings, changes, verification, and remaining work.
- Frontend product-hardening remains tracked in `docs/FRONTEND-AUDIT-REMEDIATION-PLAN.md`.

### Blocked
- Local Docker-backed checks are blocked while Docker Desktop is unavailable. Prisma regeneration/build is blocked when the schema engine must download through the restricted proxy. These are environment limitations, not passes; rerun in CI or when the services/network are available.

## Next Move
1. Continue the cross-repository source audit, remove confirmed dead/redundant code, and keep the audit tracker current.
2. Rerun backend tests, PostgreSQL/Azurite integration, clean-database smoke, Docker, and browser acceptance when local services are available.

## Relevant Files
- `NodejsBackend/prisma/migrations/0013_user_manager_fk_only/migration.sql` — removes duplicate user manager text
- `NodejsBackend/prisma/migrations/0018_uploadedfile_storage_reference/migration.sql` — attachment path metadata changed to an opaque storage reference
- `NodejsBackend/prisma/migrations/0020_remove_redundant_indexes/migration.sql` — latest migration (remove indexes covered by unique indexes)
- `NodejsBackend/src/__tests__/globalSetup.ts` — embedded PG boot + migration deploy
- `NodejsBackend/.env` — DATABASE_URL set to PostgreSQL only
- `NodejsBackend/package.json` — build, pg:smoke scripts added
- `Enterprise Compliance Platform/package.json` — typecheck script added
