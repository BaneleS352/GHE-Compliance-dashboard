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

Latest recorded verification is documented in docs/DATABASE-NORMALIZATION-GOAL.md; run the commands above before relying on counts.

## Important Details
- **PostgreSQL is the single provider**; SQLite support fully removed (no `db push` fallback, no Dockerfile `sed` provider rewrite)
- Migrations 0006_numeric_keys through 0011_sla_org_scope complete the numeric-key, workflow-identity, department, domain-integrity, auth-cutover, and SLA-scoping cutovers
- Declaration.id stays public GHE-YYYY-NNNNNN text reference with internal declarationPk referenced by all child tables
- Bearer tokens are provider-issued RS256 JWTs validated via JWKS (no app-issued JWTs); local user ids stay numeric with no legacy text-id compatibility lookup
- API responses carry no tokens beyond the Authorization header (MSAL sessionStorage cache in the SPA); `/api/docs` is disabled in production and `npm run db:seed` refuses `NODE_ENV=production` without `GHE_ALLOW_PROD_SEED=1`
- `User.lineManager` display text only; authoritative manager reference is `managerId` FK (workflow resolution uses it)
- API response shapes unchanged apart from numeric ids exposed as JSON numbers at boundary via services/ids.ts
- `npm run build` passes cleanly for backend (`npx tsc`) and frontend (Vite)
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

### Active
- Database normalization is implemented; frontend product-hardening remains tracked in `docs/FRONTEND-AUDIT-REMEDIATION-PLAN.md`

### Blocked
- None

## Next Move
1. Run the current backend/frontend and PostgreSQL gates before release decisions.
2. Follow `docs/DATABASE-NORMALIZATION-GOAL.md` and the frontend remediation plan for remaining work.

## Relevant Files
- `NodejsBackend/prisma/migrations/0011_sla_org_scope/migration.sql` — latest migration (SLA view org scope)
- `NodejsBackend/src/__tests__/globalSetup.ts` — embedded PG boot + migration deploy
- `NodejsBackend/.env` — DATABASE_URL set to PostgreSQL only
- `NodejsBackend/package.json` — build, pg:smoke scripts added
- `Enterprise Compliance Platform/package.json` — typecheck script added
