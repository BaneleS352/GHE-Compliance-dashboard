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
- Migrations through 0022_remove_duplicate_counterparty_index are present; attachment bytes are stored only in Azurite, failed blob cleanup is retried from PostgreSQL, and local-disk rows are switched with `npm run attachments:migrate-local-to-azurite` without deleting the source files
- Declaration.id stays public GHE-YYYY-NNNNNN text reference with internal declarationPk referenced by all child tables
- Declaration and SystemConfig monetary fields use Decimal(19,2); numeric API boundaries deliberately convert Prisma Decimal values to JSON numbers after validation caps precision to cents
- Migration 0012 adds scoped team-member and department-code uniqueness, priority checks, exact-money columns with a fail-fast precision preflight, and append-only declaration audit history
- Bearer tokens are provider-issued RS256 JWTs validated via JWKS (no app-issued JWTs); local user ids stay numeric with no legacy text-id compatibility lookup
- `dev.bat` starts Azurite and uses the checked-out backend `.env` and frontend `.env.local`; it does not start or configure the throwaway JWKS provider. The isolated test provider is opt-in through the Docker stub stack or explicit manual configuration.
- API responses carry no tokens beyond the Authorization header (MSAL sessionStorage cache in the SPA); `/api/docs` is disabled in production and `npm run db:seed` refuses `NODE_ENV=production` without `GHE_ALLOW_PROD_SEED=1`
- `User.managerId` is the only persisted manager relationship; `lineManager` is an API display value derived from that FK, while declaration snapshots retain historical manager names
- API response shapes unchanged apart from numeric ids exposed as JSON numbers at boundary via services/ids.ts
- Current cross-repository gate results are maintained in `docs/CODEBASE-AUDIT-CLEANUP.md`; use its dated verification matrix as the single current summary instead of relying on counts in this memory file.
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
- Frontend dependency installation uses npm; the stale unused pnpm lock/workspace files were removed because setup, CI, and Docker all consume `package-lock.json`
- Removed 45 unreferenced generated frontend UI wrappers and 49 unused runtime dependencies; retained the declaration screen's Card and Select primitives, leaving 11 runtime dependencies, all referenced in source
- Removed duplicate `@types/html2canvas` and `@types/jspdf` packages because both libraries bundle TypeScript declarations; frontend typecheck passes without relying on them
- Frontend import graph from `src/main.tsx` reaches all 67 production TypeScript modules; only `test-setup.ts` and `vite-env.d.ts` are outside the runtime graph
- Docker Compose forwards optional HIS settings only when configured; the local stub overlay disables staff sync and clears its token, and CI asserts this boundary
- Static backend dependency scan finds source imports for all 16 declared runtime dependencies
- E2E verification 2026-10-26: Playwright 21/21 passed against a fresh local PostgreSQL database with the throwaway JWKS OpenID provider, including the developer quick-login flow. `playwright.config.ts` passes `E2E_PG_DATABASE_URL` to the backend webServer so the API uses the same database that global setup migrates and seeds. See the verification update in `docs/FRONTEND-AUDIT-REMEDIATION-PLAN.md`.

### Active
- Whole-codebase audit and cleanup is active; see `docs/CODEBASE-AUDIT-CLEANUP.md` for findings, changes, verification, and remaining work.
- Frontend product-hardening remains tracked in `docs/FRONTEND-AUDIT-REMEDIATION-PLAN.md`.
- Additional focused backend verification on 2026-11-19 passed the organization endpoint regression (1/1) and admin workflow/config suites (27/27) against fresh embedded PostgreSQL with Azurite skipped. `organization.test.ts`, `admin/workflows.test.ts`, and `admin/config.test.ts` no longer contain explicit `any` casts. Fixed test teardown to disconnect the actual app-level Prisma client; the admin rerun exited cleanly without the previous Vite server-close timeout.
- Typed the embedded PostgreSQL lifecycle and error handling in `src/__tests__/globalSetup.ts`; only the documented ESM import-resolution suppression remains. Backend `npx tsc --noEmit` and the admin workflow/config suites (27/27) pass after this change.
- Replaced response `any` callbacks in `src/__tests__/workflow-regressions.test.ts`; all 7 workflow regressions pass with Azurite skipped. Vitest's hanging-process reporter completed without a shutdown warning.
- Reworked `declarations.test.ts` cleanup to preserve append-only audit history and delete concurrency fixtures through the API; all 16 declaration tests pass with Azurite skipped. Replaced its response `any` callbacks with explicit response shapes.
- Replaced queue/report test response `any` callbacks with narrow response interfaces; both focused suites pass (11/11) against embedded PostgreSQL with Azurite skipped.
- Removed `any` casts from edge-case workflow fixtures and response assertions; eight affected edge-case tests pass. The SLA finite-number check uses `Number.isFinite`.
- Removed approval-option response `any` callbacks in `logical-flaws.test.ts`; both integrity tests pass, and the hanging-process reporter found no shutdown issue.
- Removed obsolete Prisma `any` casts in `normalization.test.ts`, typed its report response, and disconnected its dedicated Prisma client; all 8 tests pass with the hanging-process reporter.
- Removed `any` from the email outbox test mock and PostgreSQL smoke-script request/response/query handling; `npx tsc --noEmit` passes and notification tests pass 6/6 against fresh embedded PostgreSQL with Azurite skipped. Test setup migration diagnostics now include both stdout and stderr, and notification tests disconnect their dedicated Prisma client.
- Latest cleanup verification (2026-11-19): frontend 290/290 tests, quality gate, typecheck, and production build pass, including UserDialog department lookup/race handling, focus trapping/restoration across modal dialogs, upload keyboard activation and file-selection accessibility, and approval-option Escape handling; backend build passes, Prisma Client generation/schema validation pass using the installed local schema engine, and standard/stub Compose configuration checks pass. Static import graphs found no unreachable backend TypeScript modules among 89 files with API, seed, scripts, and tests as roots or frontend production modules among 67 reachable files. The focused schema-integrity test applied migrations through 0022 to fresh embedded PostgreSQL and confirmed only the single Counterparty scoped-unique index remains; corresponding integration and smoke assertions use the corrected PostgreSQL catalog matcher. Worker tests cover claim, stale-lock recovery, blob success, and retry scheduling. Declaration edit/submit serialize against evidence mutations and reject stale writes; approval checks organization access under the declaration row lock. Admin deletion fails closed on pending-step query errors; role demotion/deactivation and deletion protect administrator access. Admin status overrides validate workflow state under the declaration lock: Pending needs an actionable step, Draft cannot erase workflow history, and Returned cannot bypass a pending decision. File upload, download, and delete enforce shared organization and line-manager department scope; focused database-only authorization tests passed cross-department and organization-reassignment denial cases (2/2) without Azurite. Other targeted PostgreSQL regressions passed: approval org reassignment (1/1), admin status transitions (2/2), last-active-admin guard (1/1), pending-approval deletion guard (1/1), and organization endpoint fixture/type cleanup (1/1), using the opt-in database-only test setup with Azurite skipped. `organization.test.ts` now has no explicit `any` casts and passes `npx tsc --noEmit`. Attachment storage/cleanup regressions and full backend/PostgreSQL/Azurite/Docker/browser gates remain unverified because Azurite and Docker Desktop are unavailable. The elevated full backend suite previously remained live without output and was stopped; details are in the audit tracker. If both PostgreSQL and Azurite fail during upload rollback, only the logged opaque blob reference remains for manual reconciliation. The API reference was checked against route/OpenAPI access control and corrected for the admin-only legacy dropdown endpoint.

### Blocked
- Local Docker-backed checks are blocked while Docker Desktop is unavailable. Prisma commands require `PRISMA_SCHEMA_ENGINE_BINARY` to use the installed engine because the restricted proxy blocks engine downloads; this override has been verified for schema validation and backend build. A full backend Vitest attempt previously stalled without output, but a focused database-only organization regression now passes with fresh embedded PostgreSQL; attachment/full-suite checks still need Azurite.

## Next Move
1. Continue the cross-repository source audit, remove confirmed dead/redundant code, and keep the audit tracker current.
2. Rerun backend tests, PostgreSQL/Azurite integration, clean-database smoke, Docker, and browser acceptance when local services are available.

## Relevant Files
- `NodejsBackend/prisma/migrations/0013_user_manager_fk_only/migration.sql` — removes duplicate user manager text
- `NodejsBackend/prisma/migrations/0018_uploadedfile_storage_reference/migration.sql` — attachment path metadata changed to an opaque storage reference
- `NodejsBackend/prisma/migrations/0022_remove_duplicate_counterparty_index/migration.sql` — latest migration (drops redundant partial unique index)
- `NodejsBackend/src/__tests__/globalSetup.ts` — embedded PG boot + migration deploy
- `NodejsBackend/.env` — DATABASE_URL set to PostgreSQL only
- `NodejsBackend/package.json` — build, pg:smoke scripts added
- `Enterprise Compliance Platform/package.json` — typecheck script added
