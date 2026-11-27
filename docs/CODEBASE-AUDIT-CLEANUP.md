# Codebase Audit and Cleanup

**Status:** In progress  
**Started:** 2026-11-19  
**Scope:** Full GHE Compliance Dashboard repository

This is the umbrella audit for frontend, backend, database, integrations,
infrastructure, tests, and documentation. Existing focused plans such as
[`FRONTEND-AUDIT-REMEDIATION-PLAN.md`](FRONTEND-AUDIT-REMEDIATION-PLAN.md)
remain subsystem references; this document records cross-cutting findings
and the final verification matrix.

## Goal

Remove confirmed dead code and redundant logic, fix demonstrated inconsistencies
and gaps, and align operational documentation with the running code. Preserve
user-visible behavior and API/database compatibility unless a documented
migration is required. Do not remove persisted data, rewrite migration history,
or delete code based only on a search result. Finish with no known unresolved
cleanup findings in scope, or document evidence-backed blockers and decisions.

## Audit areas and exit criteria

1. **Inventory and architecture:** identify entry points, scripts, runtime
   boundaries, source-of-truth documents, and current behavior. Record known
   exceptions and external dependencies.
2. **Frontend:** trace key declaration, review, administration, reporting,
   identity, and file journeys through state, API clients, and rendering.
   Remove confirmed unused state/branches; keep keyboard, responsive, loading,
   error, and authorization behavior covered.
3. **Backend:** trace routes through validation, authorization, services,
   transactions, and persistence. Check duplicated policy logic, unsafe
   fallbacks, inconsistent response boundaries, and unused runtime paths.
4. **Persistence and reporting:** compare Prisma models, migrations, SQL
   views, indexes, query limits, and data-retention rules. Preserve migration
   history and require an explicit safe plan for any data/schema change.
5. **Integrations and security:** check OIDC/JWKS, HIS profile sync, Azurite,
   notification outbox/SMTP, secrets, TLS, and failure/retry behavior.
6. **CI, Docker, scripts, and dependencies:** compare trigger filters, job
   environments, Compose interpolation, local/deployment setup, and package
   scripts. Remove duplication only when execution semantics remain clear.
7. **Documentation and tests:** correct current-state contradictions; keep
   dated historical results clearly labelled. Run targeted tests and the full
   available gates; distinguish pass, failure, and environment-blocked checks.

## Confirmed cleanup completed in this audit

- CI push triggers now target all branches explicitly and exclude tags; the
  Docker and dependency-audit workflows retain their existing path filters.
- The Docker workflow validates Compose and builds the standard images in one
  step with a single CI environment block, eliminating duplicated test values.
- Removed unused configuration fields from the declaration form and detail
  view state. The form retains high/medium priority thresholds and maximum
  amount; detail view retains only the threshold it renders.
- Declaration priority is now derived by the backend from amount and current
  thresholds on create/update; client-supplied enum values remain accepted for
  request compatibility but cannot forge the stored label. Added API regression
  assertions for mismatched create and update labels.
- Corrected `pg-up.ts` comments to describe the current full migration chain
  and the three-table empty-database seed guard.
- Corrected local setup documentation to match `dev.bat`: it starts Azurite,
  clears inherited settings so the checked-out `.env` files are used, and
  signs in with Entra by default. The isolated test identity provider is
  opt-in through the Docker stub workflow or explicit manual configuration.
- `dev.bat` now starts the npm-managed local Azurite emulator without Docker,
  persists its data under `NodejsBackend/data/azurite`, and reuses an emulator
  already listening on port 10000. Local setup now requires Node.js 22 or later.
- Aligned threshold text in declaration details and the API description with
  the implemented inclusive comparison (`value >= highValueThreshold`).
- Added direct tests for Low/Medium/High threshold boundaries and overlapping
  thresholds. The API regression assertions also prove client-supplied
  priority labels cannot override the stored value.
- Exposed the existing medium priority threshold in Admin Configuration and
  validate it cannot exceed the high threshold in both the UI and API. Equal
  defaults remain valid and intentionally produce no Medium band until an
  administrator configures a lower medium threshold.
- Updated current docs for all-branch CI triggers, PostgreSQL outbox/SMTP
  notification delivery, Azurite storage references and Compose volumes, and
  the distinction between priority labels and workflow routing.
- Updated backend setup/testing docs to include the required Azurite service,
  current migration chain, and current script names. Historical test-count
  tables remain labelled as snapshots rather than current guarantees.
- Removed the obsolete admin Dropdown Options page and its API client methods:
  its write route has been retired with HTTP 410 and the declaration UI reads
  department master data through the scoped departments endpoint. Removed the
  corresponding stale navigation, page, test, E2E expectation, and current
  testing/security documentation references. Kept the admin-only backend
  compatibility endpoint and documented its access restriction.
- Tightened `/api/workflows/instances/:declarationId` so organization-scoped
  callers are denied a cross-organization timeline before workflow-step rows
  are loaded, matching the queue and approval decision boundaries.
- Removed the swallowed pre-delete of `WorkflowRuleStep`; the declared
  `ON DELETE CASCADE` on the rule relation already performs that cleanup as
  part of deleting an unreferenced workflow rule.
- Production backend startup now requires an explicit Azurite connection
  string instead of silently using the local development emulator fallback;
  the fallback remains available in development and tests.
- `dev.bat` now clears every backend `.env.example` key before dotenv loads,
  including staff-sync and SMTP settings, so inherited shell values cannot
  silently override the checked-out configuration. Corrected the env example
  to reflect Entra-backed local sign-in and the Docker-only stub identity flow.
- Checked credential placement without recording or printing values: the
  current backend `.env` is ignored and untracked, and the historical tracked
  `.env` snapshots found by `git log` contained empty HIS/SMTP secret entries.
- Removed three migration-managed indexes that duplicated the leading
  columns of unique indexes in the current Prisma schema. Migration 0020 drops
  only the redundant indexes; migration history remains unchanged.
- File upload, evidence deletion, and draft declaration deletion now lock and
  re-read the declaration inside their write transaction before enforcing the
  owner/status policy. This closes the gap where an outside-transaction status
  read could allow evidence changes to race with review submission/deletion.
- Added `AttachmentCleanupOutbox` so evidence metadata deletion and blob cleanup
  enqueue commit atomically. The API worker claims jobs with PostgreSQL
  `SKIP LOCKED`, retries transient Azurite failures with capped backoff, and
  drains queued rollback cleanup. A blob whose delete succeeds but outbox-row
  removal fails is safe to retry because Azurite `deleteIfExists` is idempotent.
- Added backend regressions for transactional enqueue on file and declaration
  deletion and worker success/retry transitions. They are typechecked but await
  execution against PostgreSQL and Azurite.
- Workflow approval now locks and re-reads the declaration before checking
  organization access and workflow existence. This closes a stale authorization
  window if organization ownership changes while an approval request is in
  flight. Added a PostgreSQL race regression that reassigns the declaration
  while the request is blocked on the row lock; execution remains pending the
  local Azurite/PostgreSQL test harness.
- Admin user deletion no longer treats a failed pending-approval query as an
  empty result. Deletion checks identity audit, pending workflow assignments,
  and last-admin policy in one transaction while locking admin rows and the
  target user. Role demotion and deactivation also serialize against the admin
  set and reject removal of the last active administrator; a regression covers
  the single-admin demotion case.
- Admin declaration status overrides now run under the declaration lock.
  `Pending` requires an actionable workflow step; an in-flight workflow cannot
  be reset to `Draft` or administratively `Returned` while a step is pending.
  Terminal `Approved`/`Declined` overrides retain the existing decided-step
  checks. Regression expectations and API/OpenAPI access descriptions now
  match the admin-only constrained behavior.
- File upload, download, and deletion now share declaration organization and
  line-manager department scope helpers with direct declaration access. This
  prevents a misassigned cross-organization or cross-department approver from
  obtaining evidence through the file route. Regressions cover wrong-org owners
  and same-org/cross-org misassigned reviewers; execution still requires the
  local PostgreSQL/Azurite harness.
- Backend test setup now supports `TEST_SKIP_AZURITE=1` for explicitly
  selected database-only tests; default and attachment tests still require
  Azurite. The embedded PostgreSQL data directory is process-scoped by default
  so an interrupted run's stale cluster cannot block the next `initdb`.
- Corrected the schema guide's stale `UploadedFile.id` description; it is a
  PostgreSQL `BIGINT` identity, not a string CUID.
- Reworded regression-test names and comments that still claimed already-fixed
  authorization, upload, workflow, and cascade defects were present. Removed
  fixed test-count snapshots from the architecture's test philosophy section;
  dated verification records remain in their history documents.
- Removed duplicate file-to-declaration reads from authenticated downloads,
  using the relation already loaded with the file. File deletion now does its
  lookup, ownership/status checks, outbox insert, audit, and metadata removal
  in one transaction instead of pre-reading and then repeating the same checks.
- Removed untyped request fields and dead `files` input from declaration
  creation, typed Prisma update payloads for declaration/workflow edits, and
  removed route/service `any` escapes from workflow errors, reports, and Excel
  worksheet rows. These cleanups preserve validated runtime boundaries and
  produce the same response shapes.
- Corrected an API guide access-control statement that said the legacy
  `/api/admin/config/dropdowns` read route was available to every signed-in
  user. The implementation and OpenAPI both require admin; regular forms use
  the scoped `/api/users/departments` endpoint, while dropdown `PUT` is retired
  with `410 Gone`. Updated the backend README to remove a conflicting abbreviated
  environment example and list current operational scripts.
- Removed the unreferenced `NodejsBackend/docker-compose.yml` Postgres-only
  stack. The root Compose file is the documented full-stack entry point; the
  duplicate exposed a second database on the same host port and embedded a
  development password.
- Removed the unused frontend pnpm lockfile and workspace manifest. The
  frontend package documentation, Docker image, CI workflows, and repository
  setup all use npm; the pnpm-only overrides also pinned Vite 6.3.5 while the
  package manifest and npm lockfile specify 6.4.5. `package-lock.json` is now
  the sole frontend dependency lock source.
- Removed 45 unused generated frontend UI wrappers after tracing all source and
  test references. Kept the active Card, Select, and class utility modules
  used by declaration screens. Removed 49 unused direct dependencies (from 60
  to 11) used only by dead wrappers or with no source imports, and pruned their
  transitive packages from the npm lockfile. An import scan now finds source
  references for all 11 remaining runtime dependencies. The production CSS
  bundle fell from 137 KB to 81 KB after Tailwind stopped seeing classes from
  dead wrappers.
- Removed the redundant `@types/html2canvas` and `@types/jspdf` development
  packages: the installed `html2canvas` and `jspdf` packages both declare
  bundled TypeScript definitions. Typecheck passes using those declarations.
- Re-ran the frontend static import graph from `src/main.tsx`: all 67
  production-reachable TypeScript modules are connected to the app entry.
  The only two modules outside that graph are expected non-production files,
  `test-setup.ts` and `vite-env.d.ts`.
- Found and removed a second redundant database index missed by the prior
  index cleanup: `Counterparty_name_org_unique` duplicated the Prisma unique
  constraint on `(name, organizationId)` for every non-null organization.
  PostgreSQL's standard unique constraint already allows repeated `NULL`
  organization IDs, preserving the existing global-counterparty behavior.
  Added forward-only migration 0022 and schema, smoke, and integration-check
  updates; a focused Vitest check applied the complete migration chain to a
  fresh embedded PostgreSQL instance and confirmed only the constraint-backed
  index remains. Its first run exposed a brittle assertion matcher (PostgreSQL
  leaves the `name` column unquoted in `pg_indexes.indexdef`); the matcher is
  now corrected in the unit, integration, and smoke checks. No rows or public
  identifiers change.
- Wired optional HIS profile-sync variables through production Docker Compose
  and the root `.env.example`; deployment docs now describe enabling the
  integration and supplying its token via secrets. The stub overlay explicitly
  disables HIS sync and clears the HIS token, even if the caller environment
  requests sync or supplies a token. Added
  production/stub flag assertions to the Docker workflow so the two modes
  cannot silently drift.
- Fixed the admin user dialog's department lookup failure path. Failed lookups
  had been silently rendered as an empty department list, and changing
  organizations quickly could let an older request overwrite the latest
  options. The dialog now cancels stale requests, shows a visible lookup error,
  ignores late responses even when a transport resolves after cancellation,
  and disables save until organization departments load successfully. Added
  failure and out-of-order response regressions.
- Removed two commented-out duplicate counterparty-name fields from the
  declaration detail renderer; the active field already displays the value in
  both record shapes.
- Consolidated modal keyboard handling in a shared focus hook. All four
  `aria-modal` dialogs now place focus on opening, keep Tab navigation inside,
  close on Escape, and restore focus to the opener; the approval-option dialog
  now follows the same behavior. Password validation errors use an alert
  announcement. Added focused modal and file-upload keyboard/accessibility
  regressions.
- Added clean-database smoke assertions for the attachment cleanup outbox's
  required columns and claim index, so a migration drift is caught by the
  PostgreSQL smoke gate before the worker is used. Static typecheck passes;
  actual smoke execution still needs Docker/PostgreSQL/Azurite.
- Expanded cleanup-worker regression coverage to exercise due-job claims,
  attempt increments, and expired-lease recovery in addition to blob success
  and retry scheduling. These tests compile but cannot be claimed as passed
  until the PostgreSQL-backed backend suite runs.
- Serialized declaration edit and submit against the same declaration-row lock
  used by evidence mutations. These routes now recheck status, owner, org,
  department, and the pre-read `updatedAt` after locking, returning a conflict
  instead of applying stale workflow/value data. Returned-value workflow
  rebuild and its audit now commit with the declaration edit. Added lock-race
  regressions for edit-after-submit and submit-after-concurrent-edit; compiled,
  but awaiting PostgreSQL-backed execution. Counterparty creation and
  approver lookup now occur after the lock, so a stale rejected edit cannot
  leave an unlinked counterparty or use a deleted approver reference.
- Confirmed SLA, counterparty concentration, and high-value report fallbacks
  fetch declaration rows by cursor in batches of 500, rather than materializing
  every matching declaration in one Prisma call. Removed the unreferenced
  `getReportsData` wrapper and unused high-value accumulator field. Aggregate
  maps and API result arrays still scale with distinct counterparties,
  employees, and employee/supplier pairs; a top-N or paginated report contract
  would change visible behavior and remains a product decision, not a silent
  cleanup.
- Removed fixture and response-shape `any` casts from the organization
  integration tests. Fixtures now have explicit organization/user types,
  token creation only requires the identity fields it reads, and Prisma create
  calls are checked against generated input types. The focused organization
  scope regression passed against fresh embedded PostgreSQL with Azurite
  skipped.
- Replaced explicit `any` callbacks in the admin workflow and approval-option
  tests with local response contracts. Missing owned/seed workflow rules now
  fail with explicit test errors instead of relying on unchecked `any` access.
  Both admin suites passed against fresh embedded PostgreSQL with Azurite
  skipped.
- Fixed the cause of the Vite shutdown warning in test runs. The helper now
  disconnects the module-level Prisma client used by app routes after each
  test file; global teardown no longer constructs and disconnects an unrelated
  client. Re-running both admin suites on a dedicated embedded PostgreSQL port
  passed 27/27 and exited cleanly without the prior timeout.
- Typed the embedded PostgreSQL lifecycle handle and constructor options in
  global test setup; startup and migration failures now accept `unknown` and
  extract only the error details they use. Migration diagnostics preserve
  both stdout and stderr instead of hiding stderr whenever stdout exists. The
  local `@ts-ignore` remains only for TypeScript's inability to resolve the
  ESM-only dependency under the project's CommonJS module resolution.
  Typecheck and the same 27 admin tests pass with the typed setup.
- Replaced explicit `any` callbacks in workflow regression tests with local
  step and pending-item response contracts. All seven workflow regressions
  passed on fresh embedded PostgreSQL with Azurite skipped. A rerun with
  Vitest's hanging-process reporter exited cleanly and reported no remaining
  handles; the earlier shutdown timeout did not recur.
- Fixed declaration-test cleanup that attempted to delete protected audit
  events directly. Cleanup now resets only the test-mutated workflow status
  when needed, then deletes each fixture through the API, which appends the
  required deletion event while retaining append-only history. The complete
  declarations suite passed 16/16 on fresh embedded PostgreSQL.
- Replaced explicit response `any` callbacks in queue and report tests with
  minimal queue-item and report-row interfaces; both suites passed 11/11 on
  fresh embedded PostgreSQL with Azurite skipped.
- Removed the `any` casts from the affected edge-case tests, including valid
  workflow-step fixtures, and changed the SLA finite-number assertion to use
  `Number.isFinite`. The eight affected edge-case regressions passed against
  fresh embedded PostgreSQL with Azurite skipped.
- Removed approval-option response `any` casts from `logical-flaws.test.ts`
  and made a missing seeded option fail explicitly before its ID is used. Its
  two approval-option integrity tests passed with the hanging-process reporter
  and no shutdown warning.
- Removed obsolete Prisma `any` casts from normalization tests: the current
  approver and workflow rule fields are present in the generated model, and
  missing rows now fail explicitly. Replaced an empty `any` filter with `{}`,
  typed the report breakdown, and disconnected the suite's own Prisma client
  after the file. All eight normalization tests passed with the
  hanging-process reporter.
- Replaced the email worker test's `as any` SMTP mock with its narrow
  `EmailDeliveryTransport` contract and disconnected that suite's dedicated
  Prisma client. Notification tests pass 6/6 against fresh embedded
  PostgreSQL with Azurite skipped and the hanging-process reporter exits
  cleanly.
- Removed explicit `any` from the PostgreSQL smoke script's HTTP body,
  response, and raw-query handling. It now uses unknown JSON values with
  checked field access and typed Prisma tagged queries. Backend TypeScript
  checking passes; the end-to-end smoke still requires Azurite for its upload
  and download journey.
- Consolidated eight duplicate frontend `ResizeObserver`/layout mocks into
  one typed helper with the same dimensions per suite. The eight affected UI
  suites pass 113/113 and frontend typechecking passes.
- Reworked frontend integration and organization API test fetch mocks to use
  real typed `Response` objects and checked `RequestInit` access instead of
  `any` casts. Both suites pass 34/34. The stale 285-test summary was removed
  from `AGENTS.md`; the audit matrix remains the source of current gate counts.
- Full frontend suite rerun after the shared layout and fetch-mock changes:
  290/290 tests across 27 files pass. Existing React `act(...)`, simulated
  ErrorBoundary, and jsdom navigation diagnostics are emitted by tests and do
  not fail the suite.
- Removed the unused legacy string-record branch from `DeclarationDetailView`;
  all production callers pass the typed `Declaration` API model. Supporting
  documents now consume the declared `UploadedFile[]` contract, and workflow
  tests use realistic file records. Typed fixture and fetch-mock cleanup now
  leaves no actual `any` annotations or casts in either frontend or backend
  TypeScript sources (two backend comments mention the phrase only).

## Verification status

| Check | Result | Evidence / limitation |
|---|---|---|
| Backend TypeScript | Pass | Re-run 2026-11-19: `npx tsc --noEmit` passes after typed notification transport, smoke-script JSON/raw-query handling, test setup diagnostics, admin response contracts, and Prisma teardown; `npm run build` passed after typed request/report/workflow cleanups, migration 0021, smoke-gate assertions, and file access-scope changes. |
| Prisma schema validation/generation | Pass | `PRISMA_SCHEMA_ENGINE_BINARY` pointed Prisma at the installed matching Windows schema engine; `npx prisma validate` and `npx prisma generate` passed for migration 0021's model. |
| Frontend typecheck | Pass | `Enterprise Compliance Platform/npm run typecheck` |
| Frontend quality gate | Fail: pre-existing browser side channel | Re-run 2026-11-27: the gate flags the direct local-auth `fetch` in `src/app/pages/LandingScreen.tsx:24`. That source is unchanged by the Playwright expansion; the 2026-11-19 pass is historical and does not describe the current checkout. |
| Frontend unit suite | Pass: 290/290 | Re-run 2026-11-19 after department loading, modal focus management, file-upload keyboard regressions, approval-option Escape/focus restoration, typed shared layout/fetch mocks, and removal of the unused legacy declaration-detail branch. Expected ErrorBoundary tests print simulated component errors; React `act(...)` warnings and jsdom navigation diagnostics remain non-failing test output. |
| Frontend production build | Pass | Re-run 2026-11-19 after cleanup: `npm run build` transformed 2,750 modules and completed; CSS fell from 137 KB to 81 KB. |
| Backend source reachability | Pass, static only | TypeScript import graph over 89 backend source files with API, seed, scripts, and tests as roots found no unreachable `.ts` modules. This does not prove every runtime branch executes. |
| Frontend source reachability | Pass, static only | Import graph from `src/main.tsx` reaches all 67 production modules; only test setup and Vite ambient declarations are outside the runtime graph. |
| Report read bounds | Pass for fetched rows; aggregate cardinality documented | Reviewed `getSLABreakdown`, `getCounterpartyConcentration`, and `getHighValueDeclarations`: each query fetches at most 500 declarations and advances by unique `declarationPk`; summary maps/output still scale with distinct grouping keys. Removed dead wrapper/accumulator state; backend TypeScript check passes. |
| Backend smoke/test source | Pass, execution pending | `npx tsc --noEmit` and `npm run build` passed with smoke assertions for outbox columns/index; regression cases cover cleanup claim, stale-lock recovery, success/retry, and declaration edit/submit races. PostgreSQL-backed execution remains blocked by unavailable Docker/PostgreSQL/Azurite. |
| Counterparty uniqueness index | Pass, focused clean migration test | `npm test -- --reporter=dot src/__tests__/schema-integrity.test.ts` applied all migrations through 0022 to fresh embedded PostgreSQL and confirmed exactly one `(name, organizationId)` unique index remains: `Counterparty_name_organizationId_key`. The matcher was corrected to account for PostgreSQL omitting quotes around the `name` column in `pg_indexes.indexdef`. Existing `pg:test` behavior checks and clean-database smoke assertions remain in place; full `pg:test`/`pg:smoke` still need their dedicated environment gates. |
| Local environment precedence | Pass | Static comparison confirms `dev.bat` clears all 27 keys in `NodejsBackend/.env.example` and all 24 keys in the ignored local `.env` before dotenv loads. |
| Stub Compose interpolation | Pass | Re-run 2026-11-19: stub overlay resolved using the tracked `.env.docker-stub`; the connection string is present and targets `azurite:10000`. |
| Standard Compose interpolation | Pass with env file | Re-run 2026-11-19: standard Compose configuration resolved using the tracked root `.env.example` (placeholder values validate syntax only); CI supplies equivalent CI-only dummy values. Running without an env file fails as designed because required database and provider settings are unset. |
| HIS Compose configuration | Pass | Standard and stub Compose configs parse. With the process sync flag set to `true` and a sentinel token, standard Compose forwards `true`; the stub resolves to `false` and clears the token. CI asserts these production/stub differences. |
| Backend unit suite | Partial: focused suites pass; full suite not completed | The organization endpoint regression passed (1/1), admin workflow/config suites passed (27/27), workflow regression tests passed (7/7), declarations suite passed (16/16), queue/report suites passed (11/11), eight selected edge-case tests passed, two approval-option tests passed, normalization passed (8/8), and notifications passed (6/6), each against fresh embedded PostgreSQL with `TEST_SKIP_AZURITE=1`. Hanging-process reporter runs exited cleanly for workflow, approval-option, normalization, and notification suites. The full suite remains unverified: an earlier full run stalled, and attachment cases require unavailable Azurite. |
| Backend production build | Pass | Re-run 2026-11-19 after migration 0022 and cleanup checks; `npm run build` passed with `PRISMA_SCHEMA_ENGINE_BINARY` set to the installed schema engine. |
| PostgreSQL integration/smoke and Docker image builds | Not run | Docker daemon unavailable; do not treat earlier historical counts as current verification. |
| Local Playwright journeys | Pass: 31/31 | Re-run 2026-11-27 against a fresh embedded PostgreSQL database and the throwaway RS256/JWKS provider: desktop 27/27 and mobile 4/4. Added profile-lock, role/API authorization, validation, declaration filter/empty-state, draft resume, queue filter/refresh, admin user lifecycle, and mobile card/draft coverage. No Azurite or production identity was used. |
| Live browser journeys and staging Entra | Not run | The local Playwright gate uses the throwaway provider and does not replace staging Entra, attachment/upload acceptance, or production-like document-protection verification. |
| Security dependency audit | Pass | `npm audit --audit-level=high` passed for both Node packages: zero vulnerabilities. |
| Declaration priority boundaries | Pass | Node's native TypeScript stripping ran assertions against the actual helper for Low, Medium, High, exact boundaries, and overlapping thresholds. The new Vitest file remains covered by the blocked backend suite. |
| Attachment cleanup retry | Implemented; database gate pending | Migration `0021_attachment_cleanup_outbox` durably queues deletions in the same transaction as metadata removal; the API worker retries with bounded backoff and multi-instance-safe claims. Added regression tests, but migration application and retry behavior still require the blocked PostgreSQL/Azurite integration gates. If both PostgreSQL and Azurite fail during upload rollback, durable enqueue is unavailable; the backend logs the opaque reference for manual reconciliation. |
| API access documentation | Pass | Compared `docs/API.md`, `NodejsBackend/src/routes/admin/config.ts`, and OpenAPI definition; fixed the route role description and retired-write behavior. |
| Compose entry points | Pass | Repository search found no consumer of `NodejsBackend/docker-compose.yml`; removed that duplicate Postgres-only config, leaving root `docker-compose.yml` as documented Compose source. |
| Frontend lockfile source | Pass | Setup, CI, and Docker use `npm install`/`npm ci`; removed unused pnpm workspace/lock metadata, including a stale Vite 6.3.5 override. The npm lockfile remains the CI/Docker dependency source. |
| Frontend clean-install contract | Pass, dry-run | `npm ci --dry-run --ignore-scripts --offline --no-audit --no-fund` exits 0 against the pruned manifest/lockfile. It confirms npm can resolve the lock without network; a real clean install remains a CI/environment gate. |
| Frontend dependency declarations | Pass | Source import scan found references for all 11 remaining runtime dependencies. Removed duplicate `@types` packages after confirming `html2canvas` and `jspdf` bundle their declarations; `npm run typecheck` passes. |
| Backend dependency declarations | Pass, static import scan | All 16 backend runtime dependencies have source import references across routes, services, configuration, and scripts. The remaining development tools are used through TypeScript declarations, test imports, or package scripts. |
| Approval authorization race | Pass, targeted PostgreSQL regression | Backend build passes after moving declaration lock, organization check, and workflow lookup into the decision transaction. With `TEST_SKIP_AZURITE=1`, the regression held the declaration row, reassigned it, and confirmed the waiting approver received 403 without changing the step (1/1). |
| Admin deletion and last-active-admin policy | Pass, targeted PostgreSQL regressions | Pending-step DB errors abort deletion; audit/pending/admin-count checks run transactionally with ordered admin-row locks and a target-user lock. Demotion/deactivation applies the same last-active-admin guard. Targeted PostgreSQL regressions passed for demoting/deactivating the only active admin (1/1) and protecting a user with a pending approval (1/1), with Azurite skipped. |
| Admin declaration status transitions | Pass, targeted PostgreSQL regressions | Status validation reads workflow rows through the transaction after locking the declaration. Pending requires an actionable pending step; Draft cannot erase workflow history; Returned cannot bypass a pending decision. With `TEST_SKIP_AZURITE=1`, both status-transition regressions passed (2/2). |
| File access scope consistency | Pass, database-only authorization regressions | Shared helpers enforce organization scope and snapshot-based line-manager department scope across upload/download/delete. With `TEST_SKIP_AZURITE=1`, new tests confirmed cross-department line managers and owners whose organization no longer matches cannot download or delete evidence (2/2); checks run before touching the Azurite reference. Existing upload-backed tests still need Azurite. |
| Organization fixture type cleanup | Pass, focused PostgreSQL regression | Removed `any` casts from `organization.test.ts`; `npx tsc --noEmit` passes and the organizations endpoint regression passed (1/1) against fresh embedded PostgreSQL with `TEST_SKIP_AZURITE=1`. |
| Admin test response typing and teardown cleanup | Pass, focused PostgreSQL suites | Replaced explicit `any` callback types in admin workflow/config tests with response interfaces; both files passed (27/27) with `TEST_SKIP_AZURITE=1`. TypeScript check passes. Teardown disconnects the app's shared Prisma client; the rerun exited cleanly without a server-close timeout. |
| Embedded PostgreSQL setup typing | Pass, focused PostgreSQL suites | Replaced `any` for the embedded server handle, startup errors, and migration failure details with explicit handle/options interfaces and `unknown` error handling. The ESM-only import retains a scoped `@ts-ignore`; `npx tsc --noEmit` and the admin workflow/config suites pass (27/27) on a dedicated embedded database port. |
| Workflow regression response typing | Pass, focused PostgreSQL suite | Replaced callback `any` types in `workflow-regressions.test.ts` with workflow-step and pending-item response contracts; all 7 tests pass with Azurite skipped. Vitest's hanging-process reporter completed without a shutdown warning. |
| Declaration test cleanup and response typing | Pass, focused PostgreSQL suite | Removed the audit-row deletion that violated append-only history; fixture cleanup now uses the API deletion path and retains the deletion audit event. Replaced explicit `any` callbacks with declaration/audit response types; all 16 tests pass with Azurite skipped. |
| Queue/report test response typing | Pass, focused PostgreSQL suites | Replaced explicit `any` callbacks in `queue.test.ts` and `reports.test.ts` with narrow response interfaces; both suites pass (11/11) with Azurite skipped. |
| Edge-case test typing and numeric assertion | Pass, focused PostgreSQL regressions | Removed `any` from valid workflow-step fixtures and response callbacks in `edge-cases.test.ts`; changed the SLA data-quality check to `Number.isFinite`. The eight affected tests pass; file upload/Azurite tests were skipped. |
| Approval-option response typing | Pass, focused PostgreSQL regressions | Removed response `any` callbacks from the approval-option CRUD tests in `logical-flaws.test.ts`, added an explicit failure for a missing seeded option, and passed both tests with no hanging-process report. |
| Normalization test typing and Prisma teardown | Pass, focused PostgreSQL suite | Removed unchecked field casts for generated Prisma properties, typed report values, replaced an empty `any` filter, and disconnected the suite's separately constructed Prisma client. All 8 tests pass with no hanging-process report. |
| Targeted backend regressions | Partial pass | With `TEST_SKIP_AZURITE=1` and fresh embedded PostgreSQL clusters: organization recheck-after-reassignment passed (1/1); both status-transition regressions passed (2/2); last-active-admin demotion/deactivation passed (1/1); pending-approval user deletion protection passed (1/1); file access scope regressions passed (2/2); and notification outbox tests passed (6/6). Attachment storage/cleanup regressions, the full backend suite, PostgreSQL smoke/integration, and Compose image checks remain unverified without Azurite/Docker. |

## Open work

- The frontend remediation plan remains open for browser-level accessibility
  acceptance of the complete declaration form and upload flow, fine-grained
  feature-boundary rules (the ownership graph needs agreement), and connection
  of client telemetry to an approved production collector with a retention
  policy. Unit coverage now includes modal focus management, upload keyboard
  activation and errors; see
  [`FRONTEND-AUDIT-REMEDIATION-PLAN.md`](FRONTEND-AUDIT-REMEDIATION-PLAN.md).
- Run real staging Entra and rendered browser acceptance; local Playwright
  evidence uses the throwaway provider and does not substitute for staging.
- Continue route/service authorization, identity, upload/download, export, and
  notification failure-path review against source and focused tests; the
  current static pass has not independently exercised every failure path.
  Approval authorization, admin status transitions, last-admin protection,
  pending-approval deletion, and file access scope now have passing focused
  PostgreSQL regressions. File storage/cleanup still needs its Azurite-backed
  regressions.
- Compare Prisma schema and all migrations/indexes with query usage and current
  database checks; the duplicate Counterparty index is verified against a
  fresh migrated database. Reporting fetch bounds are reviewed, while
  aggregate cardinality remains proportional to result groups.
- Static import reachability and declared runtime-dependency scans are
  complete: no unreachable production modules or unreferenced direct runtime
  dependencies were found. The backend runtime and tests have no actual `any`
  annotations or casts in the TypeScript source scan (two comment mentions
  remain); the frontend runtime and tests also have no actual `any`
  annotations or casts. Continue reviewing other explicit type assertions and
  non-`any` unsafe boundaries based on actual contracts.
- Run the full backend suite with Azurite available; run `pg:test`, `pg:smoke`,
  the expanded Playwright suite in CI, Compose image validation, and dependency
  audits where tooling and services are available.
- Run the new attachment cleanup outbox through backend tests and clean
  PostgreSQL/Azurite gates when local services are available.
- Update this document and `AGENTS.md` with final evidence and remaining
  externally blocked checks before marking the goal complete.
