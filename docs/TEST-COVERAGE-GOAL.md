# Test Coverage Completion Goal

**Status:** Active  
**Started:** 2026-11-27  
**Scope:** Browser, frontend unit, backend API/PostgreSQL/Azurite, CI, staging, deployment, accessibility, and operational acceptance.

## Purpose

Close the remaining coverage gaps for implemented GHE Compliance Dashboard
behavior and make release verification repeatable. A passing test count is not
the goal by itself: critical journeys, authorization boundaries, failure paths,
storage lifecycle, and deployment configuration must be exercised at the layer
where a regression would actually occur.

This is the authoritative coverage backlog. The
[frontend remediation plan](FRONTEND-AUDIT-REMEDIATION-PLAN.md) and
[codebase audit](CODEBASE-AUDIT-CLEANUP.md) retain historical evidence and link
here for remaining coverage work.

## Current State

### Verified baseline

- Playwright passes **31/31** tests against fresh embedded PostgreSQL and the
  throwaway RS256/JWKS provider: desktop 27/27 and mobile 4/4.
- Frontend Vitest passes **290/290** tests.
- Frontend typecheck and a strict standalone TypeScript check of the E2E specs
  and Playwright configuration pass.
- Focused backend PostgreSQL regressions pass with Azurite skipped.

### Existing browser coverage

- Developer quick login and sign-out.
- Declaration creation, draft save/resume/submit, return, resubmit, approval,
  and rejection.
- Locked profile fields and role-specific navigation.
- Admin API authorization and admin user create/edit/disable/enable/delete.
- Declaration search, date filters, and empty states.
- Approval queue filters, authoritative totals, and refresh after a decision.
- Basic dashboard/report smoke checks and one protected Excel download.
- Mobile navigation, declaration-card search, and partial-draft continuation.

### Known blockers and gate defects

- The Playwright run uses the Vite development server and does not exercise
  Azurite, the production bundle, Nginx, or a real identity provider.
- The full backend suite, `pg:test`, `pg:smoke`, attachment cleanup, and Docker
  image acceptance remain unverified for the current checkout.
- `npm run quality` currently fails on the direct local-auth `fetch` in
  `Enterprise Compliance Platform/src/app/pages/LandingScreen.tsx:24`.
- `.github/workflows/database.yml` points `TEST_PG_DATABASE_URL` and
  `SMOKE_PG_DATABASE_URL` at the same `ghe_ci` database, although the smoke gate
  requires an empty disposable database.
- Real Entra/Graph/HIS, live email delivery, and production deployment evidence
  require external environments and credentials.

Use live command output for current counts. The numbers above are the dated
baseline, not permanent guarantees.

## Target Outcomes

1. Every critical user journey has browser coverage through the rendered UI.
2. Security and tenant-isolation rules have negative tests at the API/database
   boundary, not only navigation checks.
3. Attachment upload, persistence, download, deletion, rollback, and cleanup are
   verified against real Azurite and PostgreSQL state.
4. Protected PDF and spreadsheet exports are opened with the correct password
   and rejected with no password or a wrong password.
5. Loading, empty, unauthorized, expired-session, timeout, network-error, and
   server-error states are exercised in the browser.
6. Critical mobile journeys reach the same business outcomes as desktop.
7. CI runs isolated, deterministic database gates and retains release evidence.
8. Staging and production-built acceptance prove the external identity and
   deployment boundaries that local tests cannot simulate.

## Priorities

- **P0 — Gate integrity:** defects that make a green release result unreliable.
- **P1 — Critical behavior:** data integrity, authorization, files, exports, and
  core user journeys.
- **P2 — Journey depth and resilience:** mobile parity, administration,
  reporting, error recovery, and operational behavior.
- **P3 — Assurance:** accessibility, telemetry, evidence retention, and broader
  environment coverage.

P0 and P1 items block release sign-off. P2 and P3 items require explicit
completion or a documented risk acceptance with an owner and target date.

## Workstreams

### Phase 0 — Restore trustworthy gates

1. Route local-auth browser calls through the shared API/service boundary or
   update the quality rule through an approved architecture decision. Do not
   silence the finding without resolving the underlying boundary.
2. Give PostgreSQL integration and smoke checks separate disposable databases.
   The smoke database must be empty before migration and seeding.
3. Run frontend quality, typecheck, unit tests, and production build in CI.
4. Run backend tests with PostgreSQL and Azurite, then `pg:test`, backend build,
   and `pg:smoke` against their intended isolated databases.
5. Run Playwright with retries disabled for release evidence and upload the HTML
   report plus failure screenshots/traces.

**Exit criteria:** all P0 commands pass from a clean checkout, database isolation
is explicit, and a failed check cannot be hidden by shared state or retries.

### Phase 1 — Files and protected exports

Add Playwright coverage for:

- Selecting a valid supporting file during declaration creation.
- Saving a draft with evidence and finding the persisted file after reload.
- Downloading and previewing persisted evidence.
- Removing a pending file before submission and deleting attached evidence
  through the supported flow.
- Unsupported type, oversized file, upload failure, and rollback cleanup.
- Read-only evidence behavior after submission.
- Cross-owner, cross-organization, and cross-department download/delete denial.

Add export coverage for:

- Admin report Excel and PDF exports.
- Approval Queue Excel export.
- My Declarations full-list and single-row Excel exports.
- Correct-password open, wrong-password rejection, and no-password rejection.
- PDF image-render success and text-layout fallback.
- Export of filtered/empty result sets and visible error feedback.

**Exit criteria:** browser and API tests agree on file metadata and blob state;
failed uploads leave no orphaned declaration evidence; protected files cannot
be opened without the supplied password.

### Phase 2 — Browser journey breadth and failure states

Add or complete Playwright coverage for:

- Admin configuration validation and threshold changes affecting a subsequent
  declaration.
- Organization, department lookup, workflow-rule, and approval-option CRUD,
  including guarded deletion and validation errors.
- Dashboard status filters and queue badge/list parity after a decision.
- Report filters and totals compared with known API data.
- Mobile declaration submission, review, approval/return/resubmission, dialogs,
  reports, and exports.
- Loading states, server errors, network failures, timeouts, and retry recovery.
- Expired or invalid sessions and direct attempts to reach forbidden screens.
- Employee-ID OTP login, enrollment, reset, invalid/expired OTP, and logout where
  that authentication path is enabled.

**Exit criteria:** each critical desktop and mobile journey has a complete
business outcome, and injected failures produce accessible, recoverable UI
rather than silent success or a blank screen.

### Phase 3 — PostgreSQL, Azurite, and concurrency regressions

Add backend integration coverage for:

- The complete backend suite with real Azurite enabled.
- Attachment cleanup worker deletion of a real blob after file/declaration
  deletion.
- Two workers competing for the same cleanup job and stale-lease recovery.
- Azurite outage/recovery, retry scheduling, and maximum-attempt behavior.
- Upload/evidence deletion racing with declaration submit, admin status change,
  and draft deletion.
- Cross-organization workflow-timeline denial.
- Cross-organization status, counterparty, and high-value report isolation.
- Report pagination beyond the 500-row fetch batch and export row limits.

**Exit criteria:** races leave no post-submission evidence mutation, orphaned
metadata/blob, or cross-organization data leakage; cleanup is idempotent and
bounded under failure.

### Phase 4 — Staging, production, and non-functional acceptance

Complete evidence for:

- Real Entra authorization-code/PKCE login, returning login, provider logout,
  token refresh, unprovisioned-user rejection, and subject mismatch.
- Graph `User.Read` consent and real HIS profile/manager synchronization.
- Production-built browser journeys through Nginx, including SPA assets,
  same-origin `/api` proxying, baked identity configuration, and Azurite access.
- Protected-export sidecars running inside the backend deployment image.
- Live or controlled email delivery, OTP delivery, worker retry, and restart.
- Keyboard and screen-reader acceptance for the complete declaration, upload,
  dynamic-error, dialog, and mobile flows.
- Client telemetry collector/redaction/retention configuration and cleanup
  failure alerting.

**Exit criteria:** staging and deployment evidence identifies the environment,
configuration, result, and limitations; local throwaway-provider evidence is not
presented as staging proof.

## Coverage Matrix

| Area | Required browser coverage | Required lower-level coverage | Completion evidence |
|---|---|---|---|
| Identity | Login, logout, expired session, unauthorized screen | Issuer/audience/expiry/subject validation, local OTP recovery | Local Playwright plus staging Entra run |
| Declarations | Create, draft, edit, submit, validation, empty/error states | Payload validation, identity locking, stale-write and delete races | Desktop and mobile browser runs plus API regressions |
| Approval workflow | Review, accept, return, reject, resubmit, queue refresh | Organization/department scope, workflow state transitions, concurrency | End-to-end lifecycle and focused PostgreSQL races |
| Attachments | Upload, persist, preview, download, replace, remove, errors | Real Azurite storage, rollback, cleanup outbox, access scope | Browser run with blob and database assertions |
| Exports | Excel/PDF paths, filters, empty/error states | Encryption round-trip and file validation | Files opened/rejected with password tooling |
| Administration | Users, config, organizations, workflows, approval options | CRUD validation, guarded deletion, last-admin policy | Browser CRUD plus API/DB regressions |
| Reports/dashboard | Filters, totals, badge/list parity | Organization isolation, batch/scale boundaries | UI values reconciled with API data |
| Mobile | Critical declaration and approval outcomes | Shared API contracts | Mobile project completion, not desktop skips |
| Accessibility | Full keyboard and assistive-technology journeys | Labels, ARIA, focus, announcements | Browser/manual acceptance record |
| Operations | Failure recovery and retry feedback | Email/storage workers, telemetry, alerting | Controlled staging or deployment exercise |

## Verification Commands

Run these from a clean checkout with the documented environment. Release runs
must capture exact output and generated evidence.

### Frontend

```bash
cd "Enterprise Compliance Platform"
npm ci
npm run typecheck
npm run quality
npm test
npm run build
```

### Browser

```powershell
cd "Enterprise Compliance Platform"
npx playwright install chromium
$env:E2E_PG_DATABASE_URL = "postgresql://user:password@localhost:5432/ghe_e2e?schema=public"
$env:AZURITE_CONNECTION_STRING = "<dedicated test Azurite connection string>"
npx playwright test --retries=0
```

Use a dedicated E2E database and Azurite container. Global setup migrates and
seeds PostgreSQL and starts the throwaway JWKS provider.

### Backend and databases

```bash
cd NodejsBackend
npm ci
npm test
npm run pg:test
npm run build
npm run pg:smoke
```

`TEST_PG_DATABASE_URL` and `SMOKE_PG_DATABASE_URL` must identify separate
disposable databases. Attachment tests require Azurite on the configured endpoint.

## Evidence Requirements

Every completed phase records:

| Field | Required value |
|---|---|
| Date and commit | UTC date and full commit SHA |
| Environment | OS/runtime, PostgreSQL, Azurite, browser, identity provider |
| Database state | Fresh/upgraded, migration version, seed status |
| Commands | Exact commands and relevant environment variable names, never secret values |
| Result | Pass/fail counts and any skipped or retried tests |
| Artifacts | Playwright report, failure screenshots/traces, logs, protected-file verification |
| Limitations | External services not exercised and accepted risks |

Generated reports and credentials must not be committed. Store release evidence
in the approved CI artifact location or release record.

## Test Design Rules

- Prefer self-contained fixtures with unique names/emails/counterparties.
- Do not mutate shared seeded declarations in new tests.
- Assert business outcomes and persisted state, not only headings or visibility.
- Use accessible roles, labels, and public UI contracts for locators.
- Release evidence uses `--retries=0`; retries may assist local diagnosis but do
  not prove stability.
- A skipped critical test is incomplete unless the skip names an external
  blocker, owner, and follow-up.
- Do not add tests solely to increase a percentage or raw count.

## Definition of Done

This goal is complete when:

1. All P0 and P1 workstreams pass in clean, isolated environments.
2. Critical desktop and mobile journeys have complete browser outcomes.
3. Attachment and export tests use real storage and file verification.
4. Authorization, race, and organization-isolation regressions pass.
5. Frontend quality, typecheck, unit tests, build, backend tests, PostgreSQL
   integration/smoke, and Playwright gates are green in CI.
6. Staging identity and production-built acceptance evidence is recorded.
7. Remaining P2/P3 limitations have explicit risk acceptance, owners, and dates.
8. This document, the codebase audit, and the frontend remediation plan agree on
   current status and remaining externally blocked work.

## Next Move

1. Fix the frontend quality-gate boundary and isolate the PostgreSQL CI databases.
2. Add real-Azurite attachment and protected-export Playwright coverage.
3. Run the complete backend suite and clean PostgreSQL/Azurite gates.
4. Complete admin, dashboard/report, error/session, and mobile journey coverage.
5. Schedule staging Entra/Graph/HIS and production-built browser acceptance.
