# Database Normalization and Reporting Goal

## Purpose

Evolve the GHE Compliance Dashboard database from its current application-led, partially denormalized schema into a PostgreSQL production schema with enforced referential integrity, auditable workflow data, and database-owned reporting read models.

This is a staged modernization. The objective is to improve correctness, traceability, and reporting performance without breaking the current React API contract or losing historical declaration records.

## Current State

The implementation uses Prisma with SQLite in development and PostgreSQL in Docker production. Production starts with `prisma migrate deploy` (versioned migrations `0000_baseline`, `0001_normalization`, `0002_rule_fk`); the entrypoint fails fast with no `db push` fallback, then runs the idempotent backfill as an observable, fatal-on-error deployment step. SQLite remains the supported development/testing workflow (`prisma db push`).

The existing `Declaration` table stores both transactional data and copied employee/organisation attributes, now joined by enforced foreign keys (`declarerUserId`, `currentApproverUserId`, `counterpartyId`) and canonical `eventDate`/`submittedAt` (`date`/`timestamptz`) columns populated synchronously on every write; the legacy text fields remain the API write path. Workflow rules and workflow instances maintain their steps as relational rows (`WorkflowRuleStep`, `WorkflowInstanceStep`) written atomically in the same transaction as the legacy JSON cache, which is now read only as a fallback. Remaining string references without database foreign-key constraints are documented as the temporary Phase 5 compatibility surface (see `NodejsBackend/prisma/schema.prisma` header and `RETIREMENT.md`).

These choices were practical for an early-stage application, but they prevent the database from enforcing key integrity and make detailed reporting depend heavily on API-side aggregation.

## Target Outcomes

1. PostgreSQL production deployments use versioned Prisma migrations and `prisma migrate deploy`; production no longer uses `prisma db push`.
2. The database enforces relationships between organisations, users, declarations, workflow instances, workflow steps, and declaration files.
3. Declaration dates and timestamps use PostgreSQL `date` and `timestamptz` types rather than text fields.
4. Workflow rule steps and workflow-instance steps are relational rows, not serialized JSON.
5. Dashboard and reporting endpoints read from PostgreSQL views or materialized views where that improves a stable reporting query.
6. The public API remains compatible during migration: the frontend can continue receiving the existing `Declaration` and `WorkflowStep` response shapes until a deliberate API version change is approved.

## Data Ownership Decision

Employee, team, department, organisation, and manager data are master data. A declaration references its declaring user rather than copying those fields as its source of truth.

Historical accuracy still matters. Rather than treating the current duplicated employee fields as an accidental source of truth, the migration will preserve declaration-time context deliberately. The preferred approach is a small, explicit immutable snapshot (for example, declarer name, employee number, position title, department and manager display name) or an auditable history table. This avoids a declaration silently changing its apparent owner context when a person moves teams while retaining normalised master data for current-state queries.

## Target Logical Model

```
Organization
  └─ Department
      └─ Team
          └─ AppUser (managerId -> AppUser.id)

Organization
  ├─ Declaration -> AppUser (declarer)
  │   ├─ DeclarationDetail
  │   ├─ DeclarationFile -> UploadedFile metadata
  │   └─ WorkflowInstance
  │       └─ WorkflowInstanceStep
  ├─ WorkflowRule
  │   └─ WorkflowRuleStep
  └─ OrganizationSetting

Reference data: declaration type, status, priority, relationship type,
direction, approval option, workflow status, application role.
```

The supplied ERD is a design reference, not executable schema as-is. Before implementation it must be completed and reconciled with the application: in particular `counterparty`, `counterparty_contact`, `declaration_file`, role mapping, workflow decisions, and all required indexes/unique constraints need defined tables and ownership rules.

## Reporting Views

Views are read models, not replacements for transactional tables or authorization. API authorization, organisation scoping, and parameter validation remain required.

The initial reporting view set should cover stable, reusable dashboard/report queries:

- declaration counts and value totals by organisation and status;
- declaration volume and outcomes by month;
- declaration type/value breakdowns;
- current workflow step and pending assignee;
- SLA duration by completed workflow step;
- counterparty concentration and high-value declarations.

Use normal views first. Consider materialized views only after measuring a slow query and defining a refresh strategy; stale materialized data is inappropriate for a live approval queue.

## Delivery Phases

### Phase 0 — Schema governance

- Establish a PostgreSQL Prisma schema and an initial baseline migration matching the deployed production schema.
- Document the one-time baseline procedure for existing databases.
- Change the Docker entrypoint to run `prisma migrate deploy`.
- Keep SQLite development/testing support only if it remains a supported workflow; otherwise move automated tests to PostgreSQL.

### Phase 1 — Referential integrity and timestamps

- Add foreign keys and indexes for declaration owner, current approver, workflow instance, workflow steps, and files.
- Choose explicit delete rules. Declarations must not be deleted after submission; dependent workflow/file metadata may cascade only when a draft declaration is intentionally deleted.
- Convert declaration date/submission fields to `date`/`timestamptz` with validated backfill and UTC handling.

### Phase 2 — Normalised organisation and reference data

- Introduce department, team, application role, user-role, and controlled declaration/workflow reference tables.
- Backfill these tables from existing data with a reviewed mapping report for invalid or ambiguous values.
- Replace loose user manager strings with a self-referencing user foreign key.

### Phase 3 — Normalised declarations and workflow audit trail

- Introduce relational declaration details, file associations, workflow rule steps, workflow instances, and workflow-instance steps.
- Backfill existing JSON workflow data into immutable step rows.
- Update services and endpoints to read/write the relational workflow model while preserving current response shapes.

### Phase 4 — Database reporting read models

- Create tested PostgreSQL views for agreed dashboard and reporting queries.
- Update report services to query the views, retaining API-level organisation scoping and role checks.
- Add query-plan and result-equivalence tests before retiring the old API-side aggregations.

### Phase 5 — Compatibility retirement

- Remove duplicate legacy columns and JSON workflow fields only after backfill verification, a release window, and a rollback plan.
- Make any API simplification or identifier change a separately approved versioned change.

## Identifier Strategy

Use UUIDs for internal PostgreSQL primary keys where a new table is introduced. Retain the existing `GHE-YYYY-NNNNNN` declaration identifier as a unique, user-facing business reference; it does not need to be the physical primary key.

Existing string user IDs and rule IDs require a data migration plan. They must not be changed to numeric IDs opportunistically, because they are currently embedded in API contracts, test fixtures, JWTs, and stored workflow JSON.

## Migration Safety Requirements

- Every migration is forward-only, reviewed, and tested against a representative PostgreSQL backup.
- Production migration execution is separate from application startup seeding; seeding must never overwrite operational data.
- Backfills are idempotent and produce a reconciliation report: source row count, target row count, missing references, and rejected values.
- Destructive column/table removal requires a later migration after verification, not in the same release as table creation/backfill.
- Rollback is achieved through backup/restore and application compatibility, not by assuming all DDL can be safely reversed.

## Definition of Done

The goal is achieved when a production deployment can run only versioned migrations; core relationships are database-enforced; workflow steps and declaration files are relational and auditable; report/dashboard queries have tested PostgreSQL views where appropriate; and the existing user-facing declaration/approval flows pass their automated tests against PostgreSQL.

## Open Decisions

1. Confirm phased, data-preserving migration versus clean-break reset/reseed.
2. Define the historical declaration snapshot fields and retention/audit requirements.
3. Complete ownership and fields for counterparty/contact entities.
4. Confirm whether a user may hold multiple application roles.
5. Approve the initial reporting-view definitions and whether any require materialization.

## Implementation Review — 2026-09-28

### Status: not ready to merge or deploy

The implementation added a baseline migration, normalization migration, relational mirror tables, backfill scripts, reporting views, and compatibility code. The direction is aligned with this goal, but it does not yet meet the safety or verification requirements above.

### Release blockers

1. **Production still falls back to `prisma db push`.** The backend entrypoint runs `prisma migrate deploy`, but if that command fails it falls back to `prisma db push`. A failed migration must stop the application. Continuing with a schema push can mutate a partially migrated or incompatible production database and defeats versioned schema governance. Existing databases must use the documented baseline/resolve procedure instead.

2. **The view queries are not PostgreSQL-compatible for organisation-scoped requests.** `reportingViews.ts` uses SQLite-style `?` parameter placeholders with Prisma raw SQL. PostgreSQL requires `$1`, `$2`, and so on. On PostgreSQL, the tenant-scoped dashboard/report queries will fail and silently use the legacy API aggregation path. The claimed view-backed reporting path is therefore not operationally verified or reliably used in production.

3. **Workflow approval has two sources of truth without an atomic write.** The approval transaction writes legacy workflow JSON and declaration status, then writes `WorkflowInstanceStep` rows in a separate best-effort operation whose errors are swallowed. Other code reads relational rows first. A failed or partial mirror leaves stale relational steps that can affect later pending-queue, authorization, or approval decisions. Both representations must be written in the same transaction until the JSON column is retired, or relational rows must remain read-only until their write guarantee exists.

4. **The required workflow-rule foreign key is missing.** `WorkflowInstance.ruleId` is a nullable string with no Prisma relation and no PostgreSQL foreign key to `WorkflowRule`. A workflow instance can therefore reference a rule that does not exist. The model must define and migrate this relationship, including its nullability and deletion rule.

5. **Automated tests cannot currently run.** `npm test` fails during global setup when `prisma db push --force-reset --skip-generate` attempts to initialise SQLite. No test files run as a result, including the new normalization tests. The database setup must be repaired and the normalization suite must pass before this work can be accepted.

### Important correctness gaps

1. **Dates have been duplicated, not converted.** The new nullable `eventDate` and `submittedAt` columns are added, but the API, filters, most reports, and several views continue to use legacy `Declaration.date` and `Declaration.submitted` text fields. The goal is not met until the canonical transactional fields and relevant queries use `date`/`timestamptz`, with a verified backfill and explicit handling for invalid legacy values.

2. **The migration is not tested against PostgreSQL.** Prisma schema validation and a local TypeScript build are insufficient. The PostgreSQL-only migration SQL, constraints, views, baseline procedure, backfill, and result equivalence have not been exercised against a PostgreSQL fixture or representative backup.

3. **The relational mirror is incomplete for user teams.** The backfill tries to read `user.team`, but the existing `User` model has no legacy team field. Consequently it cannot create a `teamId` association for users from user data. A mapping rule must be defined, or the relationship must remain null and be documented as unresolved.

4. **Workflow source-of-truth rules are contradictory.** Some comments and code designate legacy JSON as canonical during the compatibility period; other read paths designate relational rows as canonical whenever they exist. Choose one authoritative source for each phase and make every read/write path follow it.

5. **Backfill failure is allowed to continue silently at startup.** The entrypoint logs a warning and starts the application if the normalisation backfill fails. That is only safe if relational data is never treated as authoritative. With rows-first reads, the system can start with incomplete or stale data. Run backfill as an explicit, observable deployment step with reconciliation output, or fail startup until compatible reads are guaranteed.

6. **References are only partially enforced during dual-write.** New nullable foreign-key columns are added for declarer, approver, manager, counterparty, and files, but the legacy string columns remain writable and are still used by much of the application. This is acceptable only as a documented temporary compatibility phase; it does not yet satisfy the end-state requirement for database-enforced core relationships.

### Documentation gaps

- `DOCKER.md` and `docs/ARCHITECTURE.md` still state that startup runs `prisma db push`.
- This document's original current-state wording describes the pre-change deployment model and should be updated when the production entrypoint is corrected.
- The baseline guide exists, but the deployment runbook must state the exact one-time command, the responsible operator, backup requirement, verification query, and failure/rollback procedure.

### Verification evidence

- `prisma validate` passed.
- `npm run build` passed only after manually running `prisma generate`; a fresh developer workflow must ensure client generation is automatic and reproducible.
- `npm test` failed before test discovery because the SQLite Prisma setup returned a schema-engine error.
- No PostgreSQL migration, view, backfill, or report-equivalence test has passed yet.

### Required remediation before approval

1. Remove the production `db push` fallback and make migration failure stop startup.
2. Use provider-correct parameter binding for PostgreSQL view queries, then add PostgreSQL integration tests for every scoped reporting view.
3. Add the `WorkflowInstance.ruleId` foreign key and reconcile all declared core relationships.
4. Make JSON/relational workflow compatibility writes atomic, or retain a single authoritative read path until cutover.
5. Repair automated database setup; run the full backend test suite and add a PostgreSQL migration/backfill test job.
6. Complete the timestamp cutover, backfill validation, reconciliation reporting, and updated deployment documentation.

## Follow-up Implementation Audit — 2026-09-28

This follow-up supersedes the resolved findings in the preceding review. The implementation improved materially, but it remains **not approved for deployment** until the remaining blockers are closed and verified.

### Findings resolved since the first review

- The production entrypoint now stops on migration or backfill failure; it no longer falls back to `prisma db push`.
- The deployment runbook, Docker documentation, architecture documentation, and build scripts were updated for versioned migrations and reproducible Prisma-client generation.
- `WorkflowInstance.ruleId` now has a Prisma relation, PostgreSQL foreign key, index, and `ON DELETE SET NULL` behavior.
- Workflow JSON and relational step rows are now written together inside the approval and submission transactions.
- Reporting-view parameter binding now rewrites SQLite `?` placeholders to PostgreSQL `$1`, `$2`, and so on.
- A PostgreSQL migration/backfill/view/FK integration script and CI workflow were added.

### Remaining release blockers

1. **Current approver foreign key drifts after workflow approval.** The approval transaction updates legacy `Declaration.approver` and `Declaration.approverId`, but does not update `Declaration.currentApproverUserId`. When an approval moves to HR, returns to the declarer, or completes, the canonical current-approver relation can retain the previous person. Update the legacy and relational approver values together in the same transaction, and extend the verifier and tests to assert equivalence.

2. **Canonical declaration mirror errors are still swallowed.** `mirrorDeclarationRelational()` catches all failures, so a create, update, or submit request can return success while `eventDate`, `submittedAt`, snapshot, declaration detail, declarer link, approver link, or counterparty link was not written. Calling code awaits the function but receives no failure signal. Move the declaration write and required relational writes into one transaction, or return a retryable error rather than claiming canonical data exists.

3. **The SQLite backend test suite remains blocked.** `npm run build` passes, but `npm test` still fails while global setup runs `prisma db push --force-reset --skip-generate`; no test files execute. The setup error must be diagnosed and fixed, not merely made more visible. The PostgreSQL integration suite also has not been run locally because Docker is unavailable on the audit host. CI must pass before approval.

### Remaining correctness and scope gaps

1. **Dashboard/report views are only partially wired into the application.** The main `/api/declarations/stats` dashboard endpoint still uses Prisma `groupBy` and `aggregate`, while `viewMonthly`, `viewTypeBreakdown`, `viewHighValue`, and `viewCurrentSteps` are not consumed by the application report/dashboard services. The existence of views alone does not satisfy the reporting-read-model goal. Route the agreed dashboard/report queries through scoped views and retain non-view aggregation only where filters genuinely require it.

2. **Monthly reporting still derives from legacy text dates.** `v_declarations_monthly` derives its month via `substr(Declaration.date, 1, 7)` instead of `eventDate`. The typed date cutover is incomplete until PostgreSQL views and all report paths use the canonical date/timestamp fields.

3. **Counterparty identity is not constrained against duplicates.** `ensureCounterparty()` uses `findFirst` followed by create, but the schema has no organisation/name uniqueness constraint. Concurrent requests can create duplicate counterparties. Define the intended organisation/global counterparty identity and enforce it with an appropriate unique index or constraint.

4. **The generic lookup/reference migration is incomplete.** The `Ref*` tables are populated by backfill but `Declaration` still stores type, status, priority, relationship, and direction as unconstrained strings. They are therefore reference-data copies, not controlled transactional references. This remains Phase 2/5 work and must not be described as fully database-enforced normalization.

### Verification status

- `prisma validate` and `npm run build` pass.
- `npm test` does not run the test suite because SQLite test-database setup fails.
- A PostgreSQL integration harness and CI job exist, but no successful PostgreSQL execution was available during this audit.
- Docker was unavailable on the audit host, so the PostgreSQL migration/backfill/view path could not be independently executed locally.

## Dead-Code and Compatibility Cleanup Plan

None of the items below may be removed until the backfill and verification gates pass on production-shaped PostgreSQL data, the release/rollback window has elapsed, and the frontend/API contract has an approved replacement. They are compatibility surfaces, not immediate deletion targets.

### Remove at Phase 5 cutover

- `Declaration` legacy employee-context columns (`employee`, `employeeId`, `teamMemberNumber`, `lineManager`, `position`, `department`, `company`, `team`) after the API is moved to `declarerUserId` plus `DeclarationSnapshot`/joined master data.
- `Declaration` legacy transaction/detail columns duplicated by `DeclarationDetail`, once the service and API read/write the detail table directly.
- `Declaration.files` JSON after all file reads use `UploadedFile`/`DeclarationFile` and reconciliation proves every legacy reference has a join row.
- `WorkflowRule.steps` JSON after `WorkflowRuleStep` is the only workflow-definition write/read path.
- `WorkflowInstance.steps` JSON after `WorkflowInstanceStep` is the only workflow-state write/read path and audit/export responses are mapped from rows.
- Legacy `Declaration.date` and `Declaration.submitted` text fields after all API payloads, exports, views, filters, and ordering use `eventDate`/`submittedAt`.
- Legacy declaration `approver` and `approverId` text fields after current-approver API behavior is served from the enforced relational reference and historical actors are served from workflow-step rows.

### Replace before deletion

- Replace the generic `Dropdowns` JSON model and the form code that consumes it with the approved domain-specific reference tables. Do not remove it until every dropdown has an explicit owner, active/inactive lifecycle, ordering rule, and migration/backfill mapping.
- Replace seeded `ComplianceTrendPoint` and `TypeBreakdownItem` dashboard data with reporting views. Once the dashboard consumes the views and result-equivalence tests pass, remove the seed data, Prisma models, routes/services, and frontend fallbacks that depend on those static tables.
- Replace API-side status, monthly, type, high-value, SLA, counterparty, and current-step aggregation only after their scoped view equivalents are wired in and tested. Retain API authorization and filter validation; only the aggregation/read-model implementation is replaced.

### Remove or narrow transitional implementation code

- Remove production runtime view-creation logic from `services/reportingViews.ts` after migrations are the sole owner of view DDL. Runtime requests should query existing views, not require `CREATE VIEW` privileges. Keep a test-only setup helper if SQLite tests still need it.
- Remove JSON/text fallback reads such as `safeJsonParse`, `readWorkflowSteps` fallback behavior, and legacy report fallbacks only after `db:verify` reports zero drift and all supported databases have completed the cutover.
- Remove `mirrorDeclarationRelational`, `persistWorkflowInstanceSteps`, and all dual-write branches once normalized tables are the only write path. Replace them with direct transactional writes to canonical models.
- Remove the Dockerfile provider-rewrite (`sed` from SQLite to PostgreSQL) when development/testing are moved to PostgreSQL or an explicit separate PostgreSQL Prisma schema is adopted. The production schema must remain migration-authoritative.
- Keep `db:push` only for the explicitly supported SQLite development/test workflow. Remove it from production scripts, documentation, and deployment automation permanently.

### Cleanup acceptance criteria

For each removal, record the migration version, source/target row counts, zero-drift verification output, affected API contract/version, test evidence, deployment date, and rollback/restore reference. A legacy field or table is not dead code until all supported reads and writes have been retired and that evidence is recorded.
