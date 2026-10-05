# Compatibility retirement — COMPLETE (Phases 5–9)

## Phase 5 (0005_phase5_retirement) — applied

Retired the legacy compatibility surface after the backfill/verify gates
passed: `Declaration` legacy text/JSON columns, `WorkflowRule.steps` and
`WorkflowInstance.steps` JSON, `UploadedFile.declarationId`, and the
`Dropdowns` / `ComplianceTrendPoint` / `TypeBreakdownItem` / `AppRole` /
`UserRole` / `OrganizationSetting` / `Ref*` tables. Ownership frozen:
`SystemConfig` over `OrganizationSetting`, `User.role` over `UserRole`;
`PUT /api/admin/config/dropdowns` returns 410 (dropdowns served from
Department master data + fixed domain lists).

## Numeric identifier cutover and integrity hardening (0006–0009) — applied

Every internal primary/foreign key is now native PostgreSQL BIGINT identity;
`Declaration.id` (`GHE-YYYY-NNNNNN`) stays the public text reference with an
internal `declarationPk` referenced by all child tables. `WorkflowInstance`
uses a numeric surrogate PK with a unique numeric declaration reference.
`SystemConfig` (`default`) and `ApprovalOption` (`opt-*`/`ao-*`) keep text
ids as singleton/code-list rows. `UserRole`/`AppRole`,
`OrganizationSetting`, `Ref*`, and `UploadedFile.declarationId` needed no
numeric migration (retired in 0005); declaration `type`/`status`/`priority`
remain validated strings per the frozen Phase 5 ownership decision.

- API contract: same response shapes; numeric ids are JSON numbers
  (`services/ids.ts`: `toJsonId`/`toDbId`/`parseIdParam`). JWTs carry numeric
  user ids; legacy text ids have no compatibility lookup and are rejected.
- `User.lineManager` is display text only; the authoritative manager
  reference is the `managerId` FK (workflow step resolution uses it).
- `User.departmentId` is the sole department source; the legacy
  `User.department` column was removed by `0008_department_id_only`.
- `0009_domain_checks` enforces declaration and workflow-critical values at
  the database boundary.
- Reporting views are migration-owned; the runtime DDL helper,
  provider-branching (`bindParams`/`isPostgresProvider`), JSON fallbacks
  (`safeJsonParse`), dual-write helpers, backfill/verify scripts, and the
  Dockerfile provider-rewrite were removed. SQLite is no longer supported.
- Seed, test fixtures, and PG integration fixtures write numeric keys
  directly; identity sequences are restarted past explicit fixture ids.

## Evidence

- Backend `npx tsc` clean (sources + tests); frontend `npm run typecheck`
  clean; `git diff --check` clean.
- Backend suite runs against PostgreSQL via embedded PG in
  `globalSetup` (versioned `migrate deploy` + normalized fixtures); frontend
  suite green (mocked API).
- `npm run pg:test` + `postgres-normalization` CI job cover the full
  migration chain, all 7 scoped views, FK enforcement/delete rules,
  information_schema key-type assertions, and the counterparty identity
  policy on production-shaped data.
- `npm run pg:smoke` runs `migrate deploy` on a clean database, seeds,
  starts the built API, exercises declaration/approval/file/reporting/admin
  flows, and asserts post-flow integrity (snapshot+detail coverage, step
  coverage, no dangling FKs, views serving rows).
