# Phase 5 compatibility retirement — COMPLETE

Applied as `0005_phase5_retirement` (forward-only). The legacy compatibility
surface was removed after the gates below passed:

## Gates (were required, now recorded as passed)

1. Backfill idempotent with zero unresolved required mappings on a
   production-shaped copy.
2. `db:verify` zero drift between relational rows and legacy columns.
3. A full release window ran with relational reads.
4. Tested backup/restore rollback plan (see BASELINE.md §5).

## What was retired

- `Declaration` legacy columns: employee-context strings (`employee`,
  `employeeId`, `teamMemberNumber`, `lineManager`, `position`, `department`,
  `company`, `team`), detail columns (`description`, `occasion`,
  `relationship`, `receivedGiven`, `from_field`, `contactPerson`,
  `biddingProcess`, `contractNegotiation`, `instances`, `publicOfficial`,
  `substantiation`), `files` JSON, approver text (`approver`, `approverId`),
  timestamp text (`date`, `submitted`), counterparty text (`counterparty`).
- `WorkflowRule.steps` and `WorkflowInstance.steps` JSON caches.
- `UploadedFile.declarationId` duplicate FK (`DeclarationFile` is the only
  file association; orphans are rejected).
- Tables: `Dropdowns`, `ComplianceTrendPoint`, `TypeBreakdownItem`,
  `AppRole`, `UserRole`, `OrganizationSetting`, `RefDeclarationType`,
  `RefDeclarationStatus`, `RefPriority`, `RefRelationshipType`,
  `RefDirection`, `RefWorkflowStatus`.

## Ownership decisions (frozen)

- `SystemConfig` is the authoritative config source (`OrganizationSetting`
  removed).
- `User.role` is the authoritative authorization source (`AppRole`/`UserRole`
  removed).
- Declaration `type`/`status`/`priority` remain validated strings
  (zod + valid-status lists); the unenforced `Ref*` copies were removed until
  a domain-specific FK-backed reference design is approved.
- The API contract is unchanged: `declarationResponse`
  (`services/workflowService.ts`) builds the same user-facing shape from
  Snapshot/Detail/Counterparty/User joins, so the frontend needed no
  migration. `PUT /api/admin/config/dropdowns` returns 410 (dropdowns are
  served from Department master data + fixed domain lists).

## Evidence

- Backend: 381/381 Vitest passing (incl. rewritten `normalization.test.ts`:
  transactional writes, snapshot immutability, rule FK, view equivalence,
  provider-aware binding, `/stats` equivalence).
- `npx tsc` clean; `git diff --check` clean.
- PostgreSQL harness: `npm run pg:test` + `postgres-normalization` CI job
  cover migrations, all 7 scoped views, FK enforcement, and the 0003
  duplicate reconciliation on production-shaped data.
- Reporting views are migration-owned on PostgreSQL (application role needs
  only SELECT); `ensureReportingViews()` executes DDL on SQLite dev/test only.
