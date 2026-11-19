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
- Checked credential placement without recording or printing values: the
  current backend `.env` is ignored and untracked, and the historical tracked
  `.env` snapshots found by `git log` contained empty HIS/SMTP secret entries.
- Removed three migration-managed indexes that duplicated the leading
  columns of unique indexes in the current Prisma schema. Migration 0020 drops
  only the redundant indexes; migration history remains unchanged.

## Verification status

| Check | Result | Evidence / limitation |
|---|---|---|
| Backend TypeScript | Pass | `NodejsBackend/npx tsc --noEmit` passed against the installed Prisma client. |
| Prisma schema validation | Blocked | `npx prisma validate` attempted to download the Windows schema engine from `binaries.prisma.sh`; the configured proxy refused the connection. The new schema change removes only indexes confirmed redundant against migration 0006's unique constraints. |
| Frontend typecheck | Pass | `Enterprise Compliance Platform/npm run typecheck` |
| Frontend quality gate | Pass | No forbidden `any`, dependency cycles, deep imports, boundary violations, or browser side channels |
| Frontend unit suite | Pass: 285/285 | Vitest, run with process spawning permitted after retiring the obsolete Dropdown Options page. Expected ErrorBoundary tests print simulated component errors. |
| Frontend production build | Pass | Vite production bundle generated after the latest frontend changes. |
| Stub Compose interpolation | Pass | Both stub and standard Compose configurations resolved with `.env.docker-stub`. |
| Standard Compose interpolation | Pass | Standard Compose configuration resolved with `.env.docker-stub`; the Docker workflow also supplies its CI-only dummy values. |
| Backend unit suite | Blocked locally | Sandbox initially denied child-process spawn; elevated run stalled during global setup. Azurite was unavailable on `127.0.0.1:10000`, and Docker Desktop daemon was not running. No backend test result is claimed. |
| Backend production build | Blocked locally | `npm run build` could not download the Prisma Windows schema engine because the configured proxy refused the connection. Direct `npx tsc --noEmit` passed. |
| PostgreSQL integration/smoke and Docker image builds | Not run | Docker daemon unavailable; do not treat earlier historical counts as current verification. |
| Live browser journeys and staging Entra | Not run | To be scheduled after local clean-database gates; staging identity requires a configured tenant. |
| Security dependency audit | Pass | `npm audit --audit-level=high` passed for both Node packages: zero vulnerabilities. |
| Declaration priority boundaries | Pass | Node's native TypeScript stripping ran assertions against the actual helper for Low, Medium, High, exact boundaries, and overlapping thresholds. The new Vitest file remains covered by the blocked backend suite. |

## Open work

- Finish route/service authorization, identity, upload/download, export, and
  notification failure-path review against source and focused tests.
- Compare Prisma schema and all migrations/indexes with query usage and current
  database checks; review reporting bounds and transaction/delete behavior.
- Review import reachability, dependency usage, and test-only escapes for
  confirmed dead paths without treating compatibility fields as unused.
- Rerun backend tests with Azurite available; run `pg:test`, `pg:smoke`,
  Playwright, Compose image validation, and dependency audits where tooling and
  services are available.
- Update this document and `AGENTS.md` with final evidence and remaining
  externally blocked checks before marking the goal complete.
