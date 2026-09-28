# Database Normalization and Reporting Goal

## Purpose

Evolve the GHE Compliance Dashboard database from its current application-led, partially denormalized schema into a PostgreSQL production schema with enforced referential integrity, auditable workflow data, and database-owned reporting read models.

This is a staged modernization. The objective is to improve correctness, traceability, and reporting performance without breaking the current React API contract or losing historical declaration records.

## Current State

The current implementation uses Prisma with SQLite in development and PostgreSQL in Docker production. Production starts with `prisma db push`, so schema changes are not versioned as deployable migrations.

The existing `Declaration` table stores both transactional data and copied employee/organisation attributes. Workflow rules and workflow instances serialize their steps as JSON text. Several logical references are strings without database foreign-key constraints, including declaration owners, approvers, workflows, and uploaded files.

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
