# Database Normalization and Reporting Goal

## Purpose

Move the GHE Compliance Dashboard to a PostgreSQL-first relational model with
database-enforced relationships, stable reporting views, and a codebase that
can be changed without repeating a broad compatibility migration.

This is the authoritative design and completion plan. Resolved audit history is
summarized rather than repeated as separate review narratives.

## Current State

PostgreSQL is the only provider for development, CI, and production. The
versioned migration chain is:

```text
0000_baseline → 0001_normalization → 0002_rule_fk
→ 0003_counterparty_unique → 0004_monthly_eventdate
→ 0005_phase5_retirement → 0006_numeric_keys
```

Internal primary and foreign keys use PostgreSQL `BIGINT` identity values.
`Declaration.id` remains the public `GHE-YYYY-NNNNNN` text reference and
`Declaration.declarationPk` is the numeric key used by normalized children.

The active source of truth is:

- organization, department, team, and user relationships through numeric FKs;
- `DeclarationSnapshot` for immutable declarer context;
- `DeclarationDetail` for transaction details;
- `eventDate` and `submittedAt` for typed dates/timestamps;
- `Counterparty` and `CounterpartyContact` for counterparty data;
- `DeclarationFile` and `UploadedFile` for files;
- `WorkflowRuleStep` and `WorkflowInstanceStep` for workflow state;
- migration-owned reporting views for dashboard/report projections.

SQLite, production `db push`, Docker provider rewriting, workflow JSON
fallbacks, and legacy declaration storage are retired from the target design.

## Target Outcomes

1. No internal UUID/CUID/text primary keys remain where numeric keys are required.
2. Every FK has the same PostgreSQL type as its referenced key.
3. No retired table, JSON workflow column, duplicate file FK, or legacy
   declaration storage column remains in the active schema.
4. Public declaration references remain stable and human-readable.
5. Reporting views provide shared read models while API authorization and
   organization scoping remain in the application.
6. A clean database can migrate, seed, start, exercise the main flows, and
   verify relational integrity without compatibility setup.

## Ownership Decisions

- `Declaration.id` is the public business identifier; `declarationPk` is the
  internal relational key.
- `SystemConfig` remains the configuration source; `OrganizationSetting` is
  retired.
- `User.role` remains the authorization source; `AppRole` and `UserRole` are
  retired unless a future role redesign is separately approved.
- Type, status, priority, relationship, and direction remain validated strings
  unless a future change introduces enforced domain FKs.
- `DeclarationSnapshot` is immutable after capture.
- `User.departmentId` is the sole department source of truth. `User.department`
  will be removed; API and UI display values are derived from the related
  `Department` record.
- `User.managerId` is the authoritative manager relationship. The existing
  `User.lineManager` text is display/compatibility data only.
- Workflow step rows are authoritative; JSON workflow fallback is unsupported.
- `DeclarationFile` is the only declaration/file association.

## Single-Source-of-Truth Rules

The application must preserve the following rules as the normalized model
evolves:

1. Store every mutable fact once, in its canonical table. A relation is not a
   reason to duplicate its descriptive fields on dependent records.
2. Preserve historical facts only in explicit immutable snapshot/audit tables,
   never in silently duplicated mutable columns.
3. Treat API payloads as DTO projections of the domain model, not an alternate
   persistence model. Route handlers validate, authorize, and map; they do not
   own duplicate business state.
4. Keep aggregate reads, writes, transactions, and DTO transformations in
   typed service/repository mappers. Do not scatter database-shape and ID
   conversions through routes or React components.
5. Use migration-owned reporting views as the shared dashboard/report read
   model. API code supplies authorization, organization scoping, and request
   validation; it must not recreate view logic per endpoint.
6. Use versioned migrations as the only schema-change mechanism. Seeds create
   non-production data and must not become schema or production-data tooling.
7. Add tests that prove one authoritative write path for each aggregate and
   that derived API fields agree with their canonical relations.
8. Every temporary compatibility field needs an owner, consumer inventory,
   purpose, removal condition, and target removal migration. Compatibility
   fields without all five are not permitted.

## Additional Audit Gaps

The normalized table names and foreign keys are not sufficient by themselves;
the following invariants must also be resolved:

- **Organization consistency:** a user's `organizationId` can currently differ
  from the organization reached through `departmentId` or `teamId`. The same
  risk exists for declarations, declarers, counterparties, workflow rules, and
  approvers. Enforce tenant ownership with composite foreign keys, database
  checks where practical, or one documented service-level invariant with
  negative tests. Organization scoping must not depend only on route filters.
- **Workflow identity duplication:** `WorkflowInstanceStep.declarationPk`
  duplicates `WorkflowInstance.declarationPk`. Remove the duplicate or enforce
  a composite relationship proving that both values identify the same
  declaration. A child row must not have two independently writable parents.
- **Workflow projections:** declaration status and current approver are
  derived from workflow state but are also stored on `Declaration`. Define
  whether they are canonical workflow facts or deliberately maintained cache
  columns. If retained, require one transaction-owned update path and tests
  that detect divergence.
- **Historical workflow values:** step `role`, `label`, `assigneeName`, and
  `decidedByName` may be valid immutable execution snapshots, but this must be
  documented and protected from later master-data edits. Otherwise derive them
  from the rule/user relations.
- **Domain integrity:** `type`, `status`, `priority`, relationship, direction,
  workflow step status, and roles are largely strings. Decide which are stable
  reference data and create domain tables/foreign keys or PostgreSQL checks.
  Application validation alone is not sufficient for every writer.
- **File lifecycle:** `UploadedFile.link` is optional while the documentation
  says orphan files are rejected. Choose one policy: require a declaration
  link, or explicitly support unattached temporary uploads with ownership,
  expiry, and cleanup rules.
- **Delete semantics:** verify that `SET NULL`, `CASCADE`, and `RESTRICT`
  match retention and audit requirements. In particular, deletion of a user,
  department, organization, declaration, or file must not silently destroy
  legally relevant history.
- **Date/value constraints:** define UTC behavior, allowed date ranges,
  numeric precision, non-negative values, and valid status transitions in the
  database or a clearly owned domain service.

## Target Logical Model

```text
Organization
  └─ Department
      └─ Team
          └─ User (managerId -> User.id)

Declaration (public id + numeric declarationPk)
  ├─ DeclarationSnapshot
  ├─ DeclarationDetail
  ├─ DeclarationFile ── UploadedFile
  └─ WorkflowInstance
      └─ WorkflowInstanceStep

WorkflowRule
  └─ WorkflowRuleStep

Counterparty
  └─ CounterpartyContact
```

All ownership, nullability, uniqueness, indexes, and `ON DELETE` rules must be
defined in Prisma and PostgreSQL migrations.

## Identifier and Foreign-Key Strategy

Use `BIGINT GENERATED BY DEFAULT AS IDENTITY` for internal entity keys:

`Organization`, `User`, `WorkflowRule`, `Department`, `Team`, `Counterparty`,
`CounterpartyContact`, `DeclarationSnapshot`, `DeclarationDetail`,
`DeclarationFile`, `UploadedFile`, `WorkflowInstance`, `WorkflowRuleStep`, and
`WorkflowInstanceStep`.

Use `INTEGER` only for bounded values such as step order and priority. Keep the
public declaration reference as text. Do not convert it into an integer.

Every dependent FK must also be `BIGINT`, including organization, manager,
department, team, declarer, current approver, counterparty, declaration child,
workflow, assignee, decision-maker, and file relationships. Mixed relationships
such as `TEXT → BIGINT` are not acceptable.

The numeric cutover uses deterministic mappings and rejects unmapped non-null
references. Legacy IDs are migration inputs only; no permanent legacy-ID
columns, compatibility lookups, or conversion paths are retained.

## Reporting Views

Migration-owned views cover status summary, monthly declarations, type
breakdown, current workflow step, workflow SLA, counterparty concentration, and
high-value declarations. View SQL uses canonical normalized columns and typed
dates. Reporting repositories provide typed results; routes retain
authorization, validation, and organization scoping.

## Completed Implementation

- Added versioned PostgreSQL migrations through `0006_numeric_keys`.
- Added normalized organization, user, declaration, workflow, file, and
  counterparty structures with enforced FKs.
- Removed legacy declaration columns, workflow JSON columns, generic dropdowns,
  static reporting tables, retired reference tables, and duplicate file FK.
- Converted internal PKs/FKs to `BIGINT` and preserved the public declaration ID.
- Updated backend routes/services, JWTs, seeds, fixtures, frontend mappings,
  reporting, Swagger, deployment, and architecture documentation.
- Added PostgreSQL integration and clean-database smoke-test commands.
- Added deterministic identity-sequence handling for seeded numeric IDs.

## Verification status (audited 2026-10-01)

The migration implementation is substantially complete, but completion is not
yet fully reproducible from this checkout. The following claims are separated
so future maintainers do not confuse implementation with verification.

### Verified by repository inspection

- The Prisma schema is PostgreSQL-only and models normalized child tables,
  numeric internal keys, typed timestamps, and explicit foreign-key delete
  behavior.
- Migrations `0000` through `0006` exist, including retirement of legacy tables
  and columns and the numeric-key cutover.
- The clean-database integration and smoke scripts contain assertions for
  numeric PK/FK types, retired structures, views, orphan references, and
  delete behavior.
- Frontend typecheck completed successfully in the current environment.
- The working tree is clean at the time of this audit.

### Reported by CI/project history but not reproduced locally in this audit

- Backend: 381/381 tests across 19 files.
- Frontend: 240/240 tests and production build.
- PostgreSQL integration: 61/61 checks.
- PostgreSQL smoke flow: migration, seed, startup, API workflow, reporting,
  and integrity checks.

### Current verification limitation

`NodejsBackend npm test` did not reach test discovery locally because the
embedded PostgreSQL process failed to initialize on Windows (`initdb` could
not create a restricted token and reported the temporary database path as an
existing directory). The backend result therefore remains CI-reported rather
than locally reproduced. A dedicated PostgreSQL URL or a documented Windows
test setup is required before claiming local end-to-end verification.

## Full Codebase Migration Requirements

### Backend

- Routes handle authorization, validation, and DTO serialization only.
- Repositories/services own normalized aggregate queries and transactions.
- Separate boundaries exist for declarations, workflows, identity, files, and
  reporting.
- Required child writes occur inside the parent transaction.
- Prisma `any` escape hatches are removed from schema-sensitive queries. The
  audit still finds broad `as any` usage in routes, reporting, seeds, and
  tests; each remaining occurrence must be classified as test transport code,
  untyped external input, or a real schema-typing gap.
- All BigInt/number/string conversion is centralized in `services/ids.ts`.

### Frontend and API

- Transport DTOs are separate from Prisma/database models and form state.
- Public declaration references remain strings; internal numeric IDs are handled
  consistently at the API boundary.
- Workflow pages consume step rows, not serialized JSON.
- Dropdowns consume explicit department/domain endpoints.
- Static trend/type-breakdown assumptions are removed.

### Seeds, tests, and CI

- Seeds, smoke fixtures, integration fixtures, and test setup use shared typed
  factories.
- PostgreSQL is the normal test provider; tests must not pass because SQLite is
  more permissive.
- Each migration has assertions for row counts, FK type equality, orphan
  references, unique keys, indexes, delete behavior, and view results.
- CI runs backend tests, PostgreSQL integration, clean-database smoke tests,
  frontend typecheck, frontend tests, and frontend build.

## Audit Findings and Cleanup Plan

Already removed from the active schema:

- `Dropdowns`, `ComplianceTrendPoint`, `TypeBreakdownItem`;
- `OrganizationSetting`, `AppRole`, `UserRole`, and `Ref*` lookup copies;
- legacy declaration text/detail/file columns;
- workflow JSON columns;
- `UploadedFile.declarationId`.

The following items remain after the current audit:

### High priority

- Make backend tests reproducible on Windows by documenting a dedicated
  `TEST_PG_DATABASE_URL` path or fixing the embedded PostgreSQL initialization
  directory/token setup. Do not report backend tests as locally verified until
  this is resolved.
- Resolve the Windows Prisma engine-lock failure observed during `npm run
  build` (`EPERM` while replacing `query_engine-windows.dll.node`). Confirm
  that the documented build/test workflow works with no stale Node/Prisma
  process holding the generated engine.
- Replace unnecessary runtime `as any` casts in declaration, workflow, user,
  report, admin, and notification code with Prisma select/include types and
  explicit DTO types. Keep casts only at genuine untyped boundaries and label
  those boundaries.
- Remove `User.department` through a forward migration and derive all API/UI
  department display values through `User.departmentId → Department.name`.
  Update Prisma, route DTOs, frontend types, forms, seeds, fixtures, reports,
  Swagger, and tests together; add assertions that the legacy column and
  runtime references are absent after the cutover.
- Decide whether global counterparties may share a name. PostgreSQL allows
  multiple `NULL` values under `@@unique([name, organizationId])`; add a
  partial unique index or an explicit policy if global names must be unique.
- Resolve organization consistency across hierarchy and transaction FKs. Add
  composite constraints or a single tested service invariant so users,
  departments, teams, declarations, counterparties, workflow rules, and
  approvers cannot cross organization boundaries accidentally.
- Remove or constrain the duplicate `WorkflowInstanceStep.declarationPk`.
  Prefer deriving the declaration through `instanceId`; if the direct FK is
  retained for reporting performance, enforce equality with the instance.
- Define the owner of `Declaration.status` and `currentApproverUserId` versus
  workflow step state, then consolidate writes into one transaction-owned
  workflow service.
- Reconcile the uploaded-file orphan policy with the nullable `UploadedFile`
  relation and add expiry/cleanup behavior if temporary unattached uploads are
  intentional.
- Restore the user-delete integration assertion. The current integration
  script has the `await user.delete(...)` call embedded in a comment, so it
  does not actually verify `SET NULL` declaration links or preservation of the
  immutable snapshot.
- Remove local credential drift from tracked configuration. `.env` must not
  switch to ad hoc administrator credentials; use ignored local secrets and a
  consistent `.env.example`/Docker/test setup.

### Medium priority

- Remove or rewrite stale deployment guidance, especially the instruction to
  add error handling around `JSON.parse(instance.steps)` when workflow steps
  are now relational rows.
- Update architecture and schema documentation that still describes the
  removed `User.department` field or says organization relationships are not
  constrained. Current documentation must describe the actual normalized
  contract and its tenant-boundary guarantees.
- Remove active frontend/backend API naming that still presents the retired
  generic `Dropdowns` concept, unless it is deliberately retained as a
  compatibility label. `fetchDropdowns`, the admin screen name, and related
  tests should use the current domain-specific terminology.
- Separate seed/migration fixture parsing of legacy workflow JSON from runtime
  code and make that boundary explicit. Legacy JSON may be an input fixture,
  but it must not be an application fallback.
- Convert stable domain strings to database-enforced checks or reference tables
  where the business requires controlled values; add transition tests for
  status and workflow state.
- Add explicit tenant-boundary, delete-retention, duplicate-workflow-identity,
  date/timezone, numeric-range, and file-lifecycle tests.
- Add negative tests for cross-organization user/department/team,
  declaration/declarer, counterparty, workflow-rule, and approver references.
- Add tests proving `Declaration.status` and `currentApproverUserId` cannot
  diverge from workflow step state, including the guarded administrative
  override path.
- Re-run a repository-wide search for retired names after cleanup and add a CI
  check for forbidden runtime references. Historical migration comments may
  remain, but active routes, services, frontend code, and current deployment
  instructions should not reference retired structures.

### Low priority

- Remove migration-era diagnostics only after the clean PostgreSQL gates are
  reproducible in both CI and the supported local setup.
- Consolidate repeated test fixture casts and introduce shared typed factories
  for users, declarations, workflow steps, and API responses.
- Review the remaining compatibility field `mediumValueThreshold` and either
  retire it through an API versioned change or document its permanent
  read-only compatibility purpose.

Do not delete migration history. Old migrations remain necessary for databases
that have applied them; cleanup applies to the current schema, runtime code,
seeds, fixtures, documentation, and deployment paths.

## Future Schema-Change Process

For every future schema change:

1. Define ownership and the final source of truth before editing code.
2. Update Prisma schema, migration SQL, repository/service types, DTOs, seeds,
   fixtures, reporting views, and documentation together.
3. Add migration assertions and API/workflow/reporting regression tests.
4. Run the clean PostgreSQL migration and smoke sequence from both CI and the
   supported developer setup, recording exact command output.
5. Search for retired field/table names, `as any` schema escape hatches, direct
   route-level aggregation, and stale API/documentation terminology.
6. Review FK nullability, exact parent/child types, indexes, uniqueness,
   identity sequences, organization consistency, and delete behavior.
7. Test empty and populated databases, including seed order and sequence
   behavior after explicit IDs.
8. For every temporary field, record its owner, consumer inventory, purpose,
   removal condition, and target removal migration.
9. Verify duplicate relationship paths cannot disagree, especially workflow
   instance/declaration identity and declaration/workflow status.
10. Only then remove obsolete code or schema objects.

## Completion Criteria

The goal is complete when a clean PostgreSQL database migrates and seeds
successfully in CI and the supported local setup, all backend/frontend checks
pass, the main API workflows pass, reporting views return expected scoped
results, all PK/FK types are verified, organization boundaries and delete
semantics are enforced, duplicate relationship paths cannot disagree, retired
concepts and `User.department` are absent from active code and current
documentation, the remaining `as any` uses are justified, `departmentId` and
`managerId` are the only authoritative hierarchy relationships, and
maintainers can add a schema change through one documented
migration/test/repository process.
