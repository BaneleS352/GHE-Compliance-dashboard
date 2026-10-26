# GHE Frontend Audit Remediation Plan

## Purpose

Address the findings from the GHE frontend review while preserving the
existing PostgreSQL-first data model, workflow rules, authorization boundaries,
and public API declaration references.

This plan covers:

- profile-controlled team member details;
- authoritative approval queue counts and records;
- consistent mutation feedback;
- consistent modal and confirmation UX;
- validation and sanitization;
- password-protected document downloads.
- shared data-access and security consistency across lookup, download, export,
  refresh, and configuration flows.

## Implementation status — 2 October 2026 (gates re-verified 6 October 2026)

Phases 1–6 are implemented and covered by tests (backend 445/445 across
26 files, frontend 270/270 across 23 files, typecheck and production
build clean — full gates re-run after each addition; `pg:test` 69/69 and
`pg:smoke` 20/20 against scratch embedded PostgreSQL on 2026-10-08).

### Phase 1 — done

- `resolveDeclarationIdentity` derives snapshot department/manager from the
  declarer profile; crafted values are ignored whenever profile links exist.
- Self-service team members without a manager link get a clear `400`;
  manager-less declarer flows (LM-skip) remain available through admin
  creation with legacy request values.
- Non-admin declaration updates cannot rewrite snapshot identity
  (draft/returned edits included); admin corrections go through user
  administration.
- `NewDeclarationScreen` renders company/department/manager read-only for
  team members from `UserContext`, with no first-organization fallback and an
  actionable incomplete-profile error.
- Tests: `profile-locking.test.ts` (crafted values ignored, draft edits
  ignored, incomplete profile rejected).

### Phase 2 — done

- New `GET /api/workflows/queue` returns `{ items, total }` computed by one
  shared `fetchActionableQueue` helper after scoping and actionability.
- `ApprovalQueue` consumes `{ items, total }` and shows the authoritative
  total; `ApproverDashboard` badge uses the same total, never status counts.
- `ghe:queue-changed` event refreshes queue and badge after workflow actions.
- Tests: `queue.test.ts` (contract, empty queue).

### Phase 3 — done

- Shared `notifySuccess`/`notifyError` (sonner) with `<Toaster>` at the app
  root; shared accessible `ConfirmDialog` (Escape, focus, destructive
  variant).
- No product flow uses browser `prompt`/`confirm`/`alert` (verified by
  search): `AdminUsers` uses `UserDialog`, `AdminApprovalOptions` and org
  deletion use dialogs, dropdown/workflow deletes use `ConfirmDialog`, adds
  use inline inputs.
- Notifications cover admin CRUD, workflow decisions, declaration draft
  save/submit outcomes (submit success additionally shows the existing
  success modal), file download/preview errors, and every Excel/PDF export
  path including the report-PDF text fallback (which now announces which
  variant was produced).
- Tests: `dialogs.test.tsx` (confirm, Escape, user-dialog validation),
  `notifications.test.ts` (wrapper routing), queue-refresh regression in
  `ApprovalQueue.test.tsx`.

### Phase 4 — done for the profile boundary

- Backend Zod + XSS sanitization + value bounds remain; profile-owned fields
  are now authoritative as described in Phase 1, with negative tests.

### Phase 6 — done

- Lookup scoping: `/api/users/organizations` returns only the caller's org
  (`[]` for global callers, all for admins); `/managers` and `/departments`
  reject cross-organization queries for non-admins (403) and default to the
  caller's scope. Covered by updated `organization.test.ts` negatives.
- One authenticated download service (`services/download.ts`): Bearer token,
  filename handling, user-facing errors, object-URL cleanup.
  `DeclarationDetailView` and `NewDeclarationScreen` migrated; console-only
  download failures replaced with visible notifications.
- Config failures that affect business rules now warn visibly
  (`NewDeclarationScreen`, `ApprovalQueue` SLA, `DeclarationDetailView`,
  `AdminConfig` templates, `AdminWorkflows` thresholds).
- A developer-only quick-login was added 2026-10-26 for local testing. It
  mints a signed token through the loopback test OIDC provider and is omitted
  from production builds; production remains provider sign-in only.
- `UserDialog` department control is organization-scoped (no free text).
- Tests: `download.test.ts` (auth header, failure, preview path).

### Phase 5 — done (scope approved: report PDFs + explicit exports)

Password model: the downloader sets a per-export password (8–128 chars) in
the shared `PasswordDialog`. It travels in the POST body only, is passed to
the encryption helper via environment (never argv/logs), and is never
stored. Failures never produce an unprotected copy (400/415 validation,
503 missing tooling, 502 encryption failure).

- New `POST /api/reports/protect-document` (any authenticated user —
  team members export from My Declarations): validates magic bytes
  (`%PDF-` / OOXML `PK..`), encrypts via `scripts/protect_document.py`
  (`pypdf` AES-256 for PDFs, `msoffcrypto` ECMA-376 for `.xlsx`), returns
  the protected bytes with a `protected-` filename. Multer memory storage
  only; temp files are 0600 and unlinked in `finally`.
- Frontend: `requestProtectedDocument` + `saveBlob` in the shared download
  service; all four export paths (ApprovalQueue, My Declarations ×2,
  AdminReports Excel + image/text-fallback PDF) collect a password first.
  Client Excel now emits OOXML `.xlsx` (legacy BIFF `.xls` cannot carry
  ECMA-376 encryption).
- Supporting-document downloads stay unprotected by decision (uploaded
  files would need conversion/repackaging — separately approvable).
- Ops: sidecars baked into the backend Docker image; CI installs them
  before `npm test`; `GHE_PYTHON_BIN` overrides the interpreter.
- Tests: `reports-protection.test.ts` (12 tests: auth/validation/415,
  team-member access, header contract, real-encryption round-trips verified
  by opening outputs with/without the password, no-input-bytes-on-failure,
  unavailable-tooling contract); `PasswordDialog` + `requestProtectedDocument`
  unit tests; export-button tests drive the dialog flow.

Recommended first scope (unchanged): generated PDF reports and explicitly
exported documents; uploaded files need a separately approved conversion or
repackaging approach.

Implementation is complete for the approved scope through
`POST /api/reports/protect-document` and the shared `PasswordDialog` flow.
Passwords are supplied per export, used once by the server, and never stored.

## Audit continuation — 23 October 2026

The comprehensive React/TypeScript audit identified a second layer of
engineering-hardening work beyond the original product-security phases. The
following items are now implemented in the working tree and must remain part
of the release plan:

### Completed in this continuation

- `NewDeclarationScreen` now delegates validation, priority calculation,
  currency parsing, and payload construction to the typed
  `newDeclarationModel.ts` module. This keeps business rules testable without
  rendering the page and reduces the page's responsibility to orchestration
  and presentation.
- Supporting-document upload UI and declaration guidance/navigation were
  extracted from the declaration page into focused components.
- Screen rendering was extracted from `App.tsx` into
  `AppScreenRenderer.tsx`; role-to-screen policy and navigation authorization
  now live in `screenPolicy.ts`.
- Form labels, validation relationships, keyboard-operable upload controls,
  dialog focus trapping/restoration, and admin quick-link keyboard behavior
  were corrected. The error boundary renders only a user-safe message.
- API boundary types were tightened across declarations, users, workflow,
  reports, configuration, and admin data. The production quality gate rejects
  new `any` annotations/casts in app, shell, and service code.
- The production quality gate also resolves local TypeScript imports and
  fails on circular dependencies, making this module-boundary check repeatable
  in CI rather than dependent on manual review.
- Admin pages and shared table components no longer use three-level relative
  imports to reach config, service, or domain modules; those imports now use
  the `@/` alias. The quality gate rejects new `../../../` production imports.
- API and download services no longer import the MSAL/UI adapter directly.
  They consume the `services/authToken.ts` token-provider port, configured by
  the authenticated application shell. The quality gate rejects service-to-app
  imports, preserving the dependency direction between transport and UI/auth
  layers.
- The production quality gate also rejects direct browser `fetch` calls
  outside transport services, native `alert`/`confirm`/`prompt`, and
  unapproved console logging. Current production source passes this check.
- CI path filters now include frontend package manifests, quality scripts,
  TypeScript/Vite configuration, and the architecture gate itself, so changes
  to the release checks cannot bypass the frontend CI job.
- Previously swallowed organization-lookup failures in `AdminConfig` and
  `AdminUsers` now produce actionable, user-safe error states instead of
  silently leaving selectors empty.
- Admin user and organization lookup effects now pass `AbortSignal` through
  the API boundary and abort on unmount, preventing stale state writes during
  navigation.
- Admin configuration and workflow-rule loading now use the same cancellation
  pattern, and aborted requests are excluded from user-facing error states.
- The shared declaration detail renderer now lives under
  `app/components/DeclarationDetailView.tsx`; approval and self-service pages
  no longer import one another's page modules. The quality gate rejects future
  page-to-page imports.
- Abort signals are propagated through the shared HTTP client and the main
  lookup/listing flows so unmounted or superseded requests cannot update state.
- `clientTelemetry.ts` is the single client error-reporting seam. It emits
  normalized metadata through a host event and logs only in development; it
  does not include response bodies, bearer tokens, or raw backend details.

### Verification for this continuation

- Frontend tests: 282 passing across 27 files.
- Frontend typecheck: passing.
- Frontend production quality gate: passing.
- Frontend architecture gate: passing for circular dependencies, deep
  relative imports, and service-to-app boundary violations.
- Declaration accessibility coverage now verifies required-field label
  association, `aria-invalid`, and `aria-describedby` linkage in the rendered
  form; the focused declaration suite passes 15/15.
- `clientTelemetry.test.ts` now pins the observability contract: emitted
  events contain feature/operation/status plus normalized error metadata,
  never the original error object, raw error messages, or non-`Error` response
  bodies.
- Declaration persistence orchestration was extracted from the page into
  `useDeclarationMutations.ts`. The hook owns create/update, upload sync,
  submit, draft rollback, loading state, and operation feedback; the page now
  owns form state, validation, and presentation. The declaration workflow
  suite passes 15/15 after extraction.
- The remaining React error stacks printed by the test runner are expected
  React/jsdom diagnostics from intentional ErrorBoundary tests; the tests
  themselves pass.

### Still open after the code pass

1. Run the complete backend, PostgreSQL, frontend build, and Playwright gates
   from a clean checkout and attach current evidence rather than relying on
   historical counts.
2. Complete staging OIDC and browser acceptance against a real deployed
   environment, including expired-session and unauthorized states.
3. Finish decomposing the remaining orchestration in
   `NewDeclarationScreen.tsx` into submission and profile/lookup hooks where
   doing so preserves behavior; do not split JSX merely to reduce line count.
4. Add the remaining automated dependency-boundary checks and a lint rule set
   covering hooks, accessibility, unused exports, and import direction. The
   circular-import and three-level deep-import portions are implemented in
   `scripts/quality-gate.mjs`; finer-grained feature-direction rules remain
   open because they require first documenting the intended ownership graph.
5. Connect the `ghe:client-error` event to the approved production telemetry
   backend, with redaction tests and a retention policy. Until then, the
   event is an integration seam, not a claim of centralized production
   observability.
6. Add focused accessibility tests for the complete declaration form,
   keyboard upload interaction, focus restoration, and screen-reader error
   associations; supplement the existing component tests with browser-level
   assertions.

The remediation goal remains open until these release, observability,
architecture-gate, and browser-acceptance items are either completed or
explicitly accepted by the owning team.

## Remaining Work

Audit update — 8 October 2026: the repository was reviewed against this plan
and every finding fixed the same day, then the remaining test gaps filled:
backend tests pass 445/445 across 26 files; frontend tests pass 283/283
across 27 files; backend build, frontend typecheck, and frontend production
build pass; `pg:test` (69/69) and `pg:smoke` (20/20) pass against scratch
embedded PostgreSQL; Playwright e2e passes desktop 18/18 + mobile 2/2; and
CI runs all of these plus the e2e job against postgres services. The
remaining work is therefore release evidence (staging OIDC run, browser
acceptance) and environment-level acceptance, not another remediation
phase.

The remediation plan is approximately 90–95% complete. The core remediation
features are implemented, but deployment hardening and final verification
remain:

1. **Development quick-login isolation — verified 2026-10-26**

    `LandingScreen` exposes quick login only in Vite development mode. It
    obtains a signed token from the separate loopback JWKS test provider;
    the API still resolves the selected account and role from PostgreSQL.
    The production build excludes the selector, token key, and test-provider
    client. No password, preset credential, or production auth fallback is
    introduced.

2. **Final full regression and acceptance verification**

   Before closing the plan, confirm the full test results and manually verify:

   - protected PDFs open only with the supplied password;
   - protected Excel exports open only with the supplied password;
   - the queue badge equals the queue total after approval actions;
   - cross-organization lookups return `403`;
   - profile fields cannot be altered through crafted requests;
   - all downloads use the shared authenticated path.

   Implement this as a repeatable release-acceptance suite:

   - Add or complete Playwright coverage for login/logout, declaration
     lifecycle, queue refresh, locked profile fields, admin management,
     protected exports, supporting-file flows, and loading/empty/error/
     expired-session states.
   - Run the suite against a clean migrated PostgreSQL database, not mocked
     persistence alone.
   - Store the browser report, screenshots/traces for failures, commit SHA,
     migration version, environment, and date as release evidence.

3. **Production security hardening — code items done (2026-10-06)**

    - Token storage is MSAL-managed `sessionStorage` with no
      `localStorage` persistence (test-pinned); the threat model and the
      cookie-migration option are recorded in `docs/SECURITY.md`.
    - `/api/docs` is disabled in production (test-pinned).
    - Production seeding is refused without `GHE_ALLOW_PROD_SEED=1`
      (test-pinned); seeds carry no credentials and log no passwords.
    - Supporting-document downloads remain intentionally unprotected by
      recorded decision (conversion/repackaging needs separate approval).

### Phase 7 — production hardening and audit closure

Status: code items complete 2026-10-06; human-gated verification (items 6–7)
remains open.

1. Done — quick login is available only in the Vite dev server and uses the
   loopback test JWKS provider; the production bundle scan confirms its UI,
   test-token key, and helper are absent. No preset passwords or production
   auth fallback exist.
2. Decided and documented — tokens live only in the MSAL-managed
   `sessionStorage` cache with no `localStorage` persistence
   (test-pinned); see `docs/SECURITY.md` “Production posture”. Cookie
   migration stays available if a deployment threat model requires it.
3. Done — `/api/docs` is mounted only when `NODE_ENV !== "production"`
   (`docsEnabled()`, test-pinned); production answers `404`.
4. Done — `seed.ts` refuses `NODE_ENV=production` without
   `GHE_ALLOW_PROD_SEED=1` (test-pinned, including a subprocess proof
   that refusal precedes any database work); seeds carry no credentials.
5. Confirmed and documented — generated reports and explicit exports are
   password-protected; uploaded supporting documents stay unprotected by
   recorded decision (see `docs/SECURITY.md`).
6. Done 2026-10-06, re-verified 2026-10-08 (local scratch-PostgreSQL runs;
   CI re-runs against its postgres services): backend `npm test` 445/445
   (26 files), `npm run build` clean, `pg:test` 69/69, `pg:smoke` 20/20,
   frontend `npm test` 283/283 (27 files), `npm run typecheck` clean,
   `npm run build` clean, Playwright e2e desktop 18/18 + mobile 2/2,
   plus a production-bundle scan with zero demo/password-login markers.
   Remaining: CI confirmation and the staging-OIDC + manual browser
   acceptance below.
7. Complete manual acceptance testing for protected exports, queue refresh,
   cross-organization access, profile tampering, and authenticated downloads.

### Release-acceptance implementation plan

1. **CI PostgreSQL gate** — provision dedicated PostgreSQL services and wire
   `TEST_PG_DATABASE_URL` and `SMOKE_PG_DATABASE_URL` into CI. Run migrations,
   `npm test`, `npm run pg:test`, `npm run build`, and `npm run pg:smoke` in
   serial order where they share generated Prisma artifacts. Run frontend
   tests, typecheck, and production build in the same workflow.
2. **Browser gate** — run Playwright against the built frontend and backend,
   using the development-only injected test token seam or a staging identity
   provider as appropriate. Cover the acceptance list above and fail the
   release when any item is unverified.
3. **Staging OIDC gate** — use a real Entra test tenant and provisioned local
   users. Record successful login, returning login, logout, token refresh,
   unprovisioned-user rejection, subject mismatch, expired token, wrong
   issuer, wrong audience, and role-boundary results.
4. **Deployment evidence** — record commit, migration version, schema hash,
   environment configuration, test counts, browser evidence, and rollback
   steps. Confirm production has no demo credentials, password-login path, or
   exposed Swagger UI.
5. **Documentation cleanup — done 2026-10-08 for the identified items.**
   `NodejsBackend/docs/TESTING.md` manual sections use the throwaway
   provider flow (removed password-login/preset-users routes documented as
   `404`), coverage tables carry verified counts, `docs/DEPLOY.md`
   hardening rows are triaged to resolved-with-pinning-tests, the
   frontend deploy documents same-origin `/api` proxying plus the real
   `VITE_ENTRA_*` build variables, and migration references run through
   `0010_auth_cutover`.

## Historical Findings (superseded by the 2 October 2026 status above)

### Re-audit status — 1 October 2026

The following findings were recorded before the implementation described at
the beginning of this document. They are retained as audit history only; the
authoritative current status is the 2 October 2026 implementation-status
section above.

- Company, department, and approving manager are still editable in the new
  declaration screen.
- The backend still accepts client-supplied department and line-manager values
  in declaration creation/update paths.
- Draft/returned declarations still allow line-manager edits.
- The backend computes a `snapshotDepartment` value but currently persists
  `data.department` instead, leaving the server-derived value unused.
- Organization, department, and manager lookup endpoints remain broader than
  the caller's organization scope.
- The dashboard queue badge still uses declaration status counts instead of
  the actionable workflow queue.
- Native prompts and confirmations remain in admin screens.
- Direct and ad hoc download paths remain, with download failures logged only
  to the console.
- PDF and Excel exports remain unprotected.
- Queue refresh after workflow actions is not consistently implemented.
- The production login error still exposes the demo password.

The review identified the following gaps:

1. New declarations allow users to edit company, department, and approving
   manager values that should be derived from the authenticated user profile.
2. The approval queue badge is calculated from broad declaration statuses,
   while the queue itself is calculated from actionable workflow steps. These
   are not guaranteed to contain the same records.
3. Success feedback is inconsistent. Errors are often inline, but create,
   update, delete, and download operations do not share a common notification
   pattern.
4. Some administration flows use browser prompts/confirmations instead of
   application-styled dialogs.
5. Validation and sanitization are present in parts of the system, but the
   server does not yet make profile-owned declaration fields authoritative.
6. Uploaded files and generated reports are downloadable without file-level
   password protection.
7. Lookup endpoints expose broader organization, department, and manager data
   than necessary for ordinary authenticated users.
8. File downloads use multiple client-side paths, with some failures only
   logged to the console and some links bypassing the shared download flow.
9. Queue data may remain stale after an approval action, and several
   configuration failures silently fall back to defaults.
10. Demo credentials are exposed in the login error message outside an
    explicitly isolated demo mode.

## Design Decisions

### Profile-controlled declaration details

For a team member creating or editing their own declaration:

- Company is derived from `user.organizationId`.
- Department is derived from `user.departmentId` and its related department.
- Line manager is derived from `user.managerId`.
- The frontend displays these values as read-only fields or disabled controls.
- The backend derives the values from the authenticated user and does not
  trust replacement values supplied by the browser.

The declaration should retain the captured values needed for historical
reporting, but a user must not be able to alter their profile identity or
workflow manager through declaration input. If the profile is incomplete, the
request should fail with a clear actionable error rather than selecting a
fallback organization, department, or manager.

Admin workflows that intentionally reassign or correct profile data remain
separate and must use the user administration screens and authorization rules.

### Approval queue source of truth

The approval queue count, queue list, empty state, and dashboard badge must all
use the same actionable workflow query. The preferred implementation is to
return a response containing the queue records and total count from the
backend, with the count calculated after organization scoping and actionable
step resolution.

The dashboard must not calculate the queue badge from all declarations with a
`Pending` or `Escalated` status. Those statuses describe declaration state,
not whether the current approver has an actionable step.

### Notifications

Introduce one shared notification interface, backed by the existing UI
notification dependency, with success and error variants. Mutation handlers
should use it for:

- declaration create, update, save draft, submit, and delete;
- workflow approval, decline, and return;
- admin create, update, and delete operations;
- file upload and delete;
- report generation and downloads.

Inline field validation remains appropriate for form errors. Notifications are
for operation-level outcomes and should include a useful action or retry
message where possible.

### Modal and confirmation UX

Create reusable application components for:

- confirmation dialogs;
- destructive-action confirmation;
- success and error result dialogs where a toast is insufficient;
- text/input dialogs where an administrator must provide a value.

Replace browser `prompt`, `alert`, and `confirm` usage in product flows. The
components must support keyboard focus, Escape-to-close where appropriate,
clear primary/destructive button labels, and mobile-friendly layout.

### Validation and sanitization

Keep validation at both boundaries:

- frontend validation for immediate user guidance;
- backend Zod validation and authorization for enforcement.

Normalize and constrain free-text fields on the server, reject unexpected
values, enforce maximum lengths, validate numeric/date ranges, and sanitize
stored/displayed rich text where applicable. Profile-controlled fields must be
ignored or rejected when they disagree with the authenticated profile.

File uploads must continue to validate MIME type, extension, size, filename,
and storage path containment. Download authorization must remain unchanged.

### Password-protected downloads

Treat this as a security design item, not only a frontend change. Before
implementation, confirm the required scope with stakeholders:

- uploaded supporting documents;
- generated report PDFs;
- Excel exports;
- all downloads or only externally shared documents.

The recommended first scope is generated PDF reports and explicitly exported
documents. For uploaded files, password protection may require conversion or
repackaging, which can alter file behaviour and should be separately approved.

Passwords must not be hard-coded, logged, stored in plaintext, or transmitted
in URLs. The product must define how the recipient receives or sets the
password. Use a maintained server-side PDF/document protection library where
possible and verify that the resulting file opens only with the password.

### Shared data-access and security consistency

Lookup APIs must enforce the same organization scope as the business workflow.
Frontend query parameters are not an authorization boundary. Team members
should receive only the organization, department, manager, and related data
needed for their own flows; cross-organization lookup remains an explicit
admin capability.

All file downloads and previews should use one authenticated client service.
That service must provide consistent authorization, password-protection
handling, filename handling, visible failure feedback, and object URL cleanup.
Direct download anchors should not create a second security path.

Exports must be included in the document-security policy. The policy must
explicitly cover browser-generated Excel exports, report PDFs, fallback PDF
generation, declaration exports, and approval queue exports. No fallback path
may silently produce an unprotected copy when protection is required.

After workflow mutations, queue data and dashboard totals must be refreshed or
invalidated so the user sees the current actionable state. Configuration load
failures must be distinguishable from intentional safe defaults and should
produce an appropriate warning when they affect business rules.

Demo credentials and development-only authentication hints must be removed
from production builds or protected behind an explicit demo-mode flag.

## Implementation Phases

### Phase 1 — Profile locking and server enforcement

1. Add a backend helper that loads the authenticated user's organization,
   department, and manager relationships.
2. Update declaration create/update handlers to derive these values for team
   members.
3. Reject incomplete profiles with a clear `400` response.
4. Decide and document admin behaviour for editing another user's declaration.
5. Update `NewDeclarationScreen` to populate values from `UserContext` and
   render them read-only/disabled.
6. Remove the organization fallback to the first available organization.
7. Add tests proving that crafted requests cannot change company, department,
   or manager.
8. Replace the currently unused server-derived `snapshotDepartment` value in
   the persisted snapshot and derive the manager display/reference from the
   authenticated user's `managerId`.
9. Remove or reject client-supplied identity fields for self-service team
   member declarations, including draft and returned updates.

### Phase 2 — Queue consistency

1. Add an authoritative queue response with `items` and `total`.
2. Ensure the backend applies the same actionable-step and organization rules
   to both fields.
3. Update `ApprovalQueue` to consume the response without recomputing the
   authoritative total incorrectly.
4. Update `ApproverDashboard` to use the same total for the badge.
5. Refresh or invalidate queue data after an approval action.
6. Add regression tests for pending declarations with no actionable step,
   steps assigned to another approver, multiple workflow steps, and empty
   queues.

### Phase 3 — Notifications and modal consistency

1. Mount the shared toaster at the application root.
2. Add a small notification utility with consistent success/error wording.
3. Replace mutation-specific inline-only feedback with notifications while
   retaining field-level errors.
4. Build shared confirmation and input-dialog components using the existing
   design tokens.
5. Replace admin browser prompts and destructive confirmations.
6. Add tests that verify success and failure feedback for representative create,
   update, and delete flows.

### Phase 4 — Validation and security hardening

1. Inventory all declaration and administration request schemas.
2. Add max lengths, enum validation, date validation, numeric bounds, and
   cross-field checks where missing.
3. Apply server-side normalization/sanitization consistently.
4. Confirm that authorization and organization scoping occur before data is
   returned or mutated.
5. Add negative tests for altered profile fields, malformed values, XSS-like
   strings, unauthorized IDs, and oversized/invalid files.

### Phase 5 — Protected document downloads

1. Confirm the required document scope and password-delivery model.
2. Select and evaluate a maintained protection library compatible with the
   deployment environment.
3. Implement protected PDF/report generation first if PDF-only scope is
   approved.
4. Define handling for unsupported uploaded formats rather than silently
   returning unprotected files.
5. Add download response and file-open verification tests.
6. Update security, deployment, and user documentation.

### Phase 6 — Shared data-access and security consistency

1. Restrict organization, department, manager, and user lookup endpoints by
   authenticated organization and role.
2. Add backend tests for cross-organization lookup attempts and unauthorized
   organization query parameters.
3. Create one authenticated file download/preview client service and migrate
   all direct anchors and ad hoc `fetch` implementations to it.
4. Show user-facing errors for failed download and preview operations.
5. Inventory every export path and apply the approved password-protection and
   authorization policy to each path, including PDF fallbacks.
6. Refresh or invalidate approval queue data after approval, decline, return,
   or other workflow mutations.
7. Add stale-data regression tests for queue records, dashboard badges, and
   post-action navigation.
8. Review configuration fetches and replace silent fallback behaviour with
   explicit warning or blocking states where business rules are affected.
9. Remove default-password hints from production authentication flows and add
   build/environment tests for demo-mode isolation.
10. Replace remaining free-text administrative selectors with validated,
    organization-scoped controls.

## Re-audit Exit Criteria

Status after the 5 October 2026 implementation (core phases delivered; Phase
7 open):

1. Done — team-member screens render profile-owned values read-only.
2. Done — backend derives/ignores on create/update, including drafts;
   manager-less self-service gets a clear `400`.
3. Done — snapshots persist server-derived values; crafted values ignored.
4. Done — lookups enforce organization and role scope (403 on cross-org).
5. Done — badge and list share the authoritative `{ items, total }` queue.
6. Done — no browser-native `prompt`/`confirm`/`alert` in product flows.
7. Done — all downloads/previews use the shared authenticated service.
8. Done — report PDFs and explicit Excel exports are password-protected
   (downloader-set password, verified open-only-with-password); supporting
   uploads stay unprotected by decision.
9. Done — queue/badge refresh on `ghe:queue-changed`; config failures warn
   visibly where they affect business rules.
10. Done — the development quick-login uses a signed test-provider token and
    is excluded from production; no demo credential, preset password, or
    production auth fallback exists.
11. Done for code posture — MSAL `sessionStorage`-only token storage,
    production Swagger disabled, production seed refused, and the
    supporting document-protection scope decision are implemented,
    test-pinned, and recorded in `docs/SECURITY.md`.
12. The earlier environment limitation was resolved in a subsequent dedicated
    run: backend tests, frontend tests/typecheck/build, PostgreSQL integration,
    and smoke gates were recorded as passing. Preserve exact command output in
    the normalization goal when gates are re-run; this historical note is not a
    substitute for current verification.

The plan remains open until Phase 7 and final manual acceptance verification
are complete.

## Acceptance Criteria

### Team member details

- A team member cannot select another company, department, or line manager in
  the new declaration flow.
- The displayed values match the authenticated profile.
- A crafted API request attempting to change those values is rejected or the
  values are safely replaced with profile values.
- No first-organization or arbitrary-manager fallback remains.
- Historical declaration snapshots remain stable after later profile changes.

### Approval queue

- The dashboard badge total equals the queue total for the same user and point
  in time.
- Every counted record is displayed by the queue query, subject only to
  pagination.
- A declaration with no actionable step is not counted.
- A declaration assigned to another approver is not counted.
- Empty and filtered states are clearly distinguished.

### Feedback and UX

- Successful and failed create, update, and delete actions produce immediate,
  visible feedback.
- Destructive actions use application-styled confirmation dialogs.
- Browser-native prompts/alerts/confirms are absent from product flows.
- Dialogs are keyboard accessible and responsive.

### Security

- Server-side validation is authoritative for all user-controlled fields.
- Stored/displayed text cannot inject executable markup into the application.
- File access remains authorization- and organization-scoped.
- All downloads covered by the approved scope are password protected and
  verified to require the password to open.
- Ordinary authenticated users cannot enumerate other organizations or
  cross-organization managers and departments.
- Every file download and preview follows the same authorization and feedback
  path.
- Every export path follows the documented protection policy, including error
  and fallback paths.
- Queue and dashboard data refresh after workflow actions.
- Production authentication does not reveal demo credentials.

## Verification Plan

E2E acceptance (Playwright, resurrected 2026-10-02 — the suite was red from
spec drift and had never run in CI): desktop 17/17 (including a
password-protected report download asserting the `protected-*.xlsx`
filename via the download event), mobile 2/2, against embedded
PostgreSQL + seeded data. Repairs: stale `LOGIN_INDEX` (admin
logged in as the wrong user), CSS-space selectors, object timeouts, strict
violations, label drift, UserDialog rewrite of the prompt-driven admin test,
self-contained return/resubmit flow, login backoff for the 429 rate limit.
Project split in `playwright.config.ts`: desktop runs table-driven
`approval-flows`, mobile runs `mobile-interactions` (mobile card-flow
coverage is a follow-up). Playwright `test-results/` and
`playwright-report/` are git-ignored test artifacts.

Re-verified post-OIDC-cutover 2026-10-08 against embedded PostgreSQL +
seeded data: desktop 18/18 (incl. a sign-out flow test: landing returns,
session token cleared), mobile 2/2. Two harness repairs were needed
for the provider-auth world: (1) the e2e `fetchCurrentUser` stub returned
a hardcoded teamMember for every persona, hiding all role-gated screens —
removed, so `/api/auth/me` resolves each persona's real seeded role;
(2) the login gate `waitForSelector("aside nav, nav")` latched onto the
hidden desktop twin on mobile viewports — now waits on
`aside nav:visible, nav:visible`. A Playwright `e2e` job now runs this
suite in CI against postgres services.

Product changes found necessary by the E2E resurrection:

- Inline workflow success banner removed (it collided with the shared toast
  and broke strict-mode assertions; toast is now the single success signal).
- Approvers can open Reports in the UI (`canAccessScreen`), matching the
  backend `authorize("admin", "approver")` on report routes.
- Seed: Sipho Nkosi reports to Lindiwe Zulu, giving the approver-submit
  journey a resolvable manager.

Run the existing gates after implementation:

```text
cd NodejsBackend && npm test
cd NodejsBackend && npm run pg:test
cd NodejsBackend && npm run build
cd NodejsBackend && npm run pg:smoke
cd "Enterprise Compliance Platform" && npm test
cd "Enterprise Compliance Platform" && npm run typecheck
cd "Enterprise Compliance Platform" && npm run build
```

Add focused tests before relying on the full suite:

- profile-controlled declaration fields;
- queue count/list parity;
- notification success/error paths;
- styled confirmation dialogs;
- validation and sanitization boundary cases;
- password-protected document opening.

Perform a manual acceptance pass for team member creation, approver queue
navigation, admin CRUD flows, file download, report export, keyboard dialog
navigation, and mobile layouts.

## Risks and Open Decisions

- Password protection for arbitrary uploaded formats may require conversion,
  which can affect fidelity and user expectations.
- Existing declarations may contain historical values that differ from current
  profiles; remediation must not rewrite immutable historical context.
- Admin correction workflows need an explicit rule for whether profile fields
  or declaration snapshots may be changed.
- Queue pagination must preserve a stable total while records are changing;
  refresh behaviour after workflow actions should be defined.
- Restricting lookup endpoints may affect existing admin and global-HR flows;
  those roles need explicit, tested exceptions rather than broad default
  access.
- Consolidating downloads may expose existing assumptions about browser-native
  file handling, authentication headers, and unsupported file formats.

## Suggested Delivery Order

Deliver Phase 1 first because it contains the highest-risk data-integrity
issue, including the unused `snapshotDepartment` calculation. Deliver Phase 2
next to restore queue count/list consistency, followed by Phases 3 and 4 for
UX and boundary hardening. Complete Phase 6 before or alongside Phase 5 so all
download and export paths are consolidated before protection is introduced.
Complete Phase 5 after the password scope, recipient model, and compatible
protection technology have been approved.
# Completion plan

The frontend plan closes only when the behavior is verified at the rendered UI and at the API boundary. Unit tests and type checks are necessary but do not prove that a user can complete the workflow in a browser.

## Remaining work

### Phase 7A — production safety

- Gate demo mode and preset credentials behind an explicit development-only flag.
- Verify production builds contain no demo login shortcut, preset password, or seed credential logging.
- Decide and document the token-storage strategy; if localStorage remains, document the accepted threat model and mitigation.
- Disable or protect Swagger in production.
- Decide whether password protection applies to generated reports only or also to arbitrary uploaded files.

### Phase 7B — browser acceptance

Run a clean browser session against a migrated PostgreSQL database and record evidence for:

- OIDC login and logout;
- declaration creation, draft save, submit, return, resubmit, approve, and reject;
- locked profile fields and authoritative department/manager display;
- admin user, organization, lookup, and workflow management;
- dashboard status filters and report totals;
- generated PDF and explicit spreadsheet downloads;
- upload, preview, download, replacement, and error states;
- empty, loading, expired-session, unauthorized, and server-error states.

### Phase 7C — release gate

- Run backend tests, frontend tests, frontend typecheck, frontend production build, `pg:test`, and `pg:smoke` from a clean checkout.
- Run the real staging OIDC flow with a test tenant and real signed tokens.
- Record browser evidence, environment, commit, migration version, and date.
- Mark each acceptance item done, failed, or not applicable; unresolved items keep this plan open.

## Definition of complete

The plan can be closed only when all Phase 7 decisions are recorded, automated gates pass, browser acceptance passes, and real staging identity/API verification is recorded. Historical audit observations below must remain labelled historical and must not be read as current defects.

## Verification update — 2026-10-23

- Clean UTF-8 PostgreSQL integration gate: **69/69 checks passed**.
- Clean PostgreSQL smoke assertions: **19/19 passed**. The temporary embedded-Postgres wrapper did not exit cleanly during teardown; this is harness cleanup noise, not an assertion failure.
- Clean Playwright run after disabling `reuseExistingServer`: **12 passed, 3 flaky, 5 failed** across 20 tests (desktop and mobile). The run now exercised this application rather than an unrelated process on port 5173.
- Fixed in the E2E harness: `e2e/common-helpers.ts` now locates locked identity fields through their public labels (`Team Member Name`, `Approving Manager Name`) instead of assuming a particular wrapper structure.
- Added `NodejsBackend/requirements.txt` as the single pinned source for `pypdf` and `msoffcrypto-tool`; Docker and CI now install from that manifest so protected-export behavior is reproducible outside the developer workstation.
- Remaining browser failures: the focused declaration rerun encountered backend `ECONNRESET`/temporary-harness instability and needs another clean run; staging OIDC and real production-like document-protection verification remain outstanding. The local sidecar dependency gap is fixed by the new manifest and installed pins.
- The plan remains open. Do not count the browser gate as passed until the corrected E2E run and the staging identity/export checks are recorded.

## Verification update — 2026-10-26

- Full Playwright suite: **21/21 passed** (desktop 19/19, mobile 2/2) against a fresh local PostgreSQL database and the throwaway RS256/JWKS provider; this includes the development quick-login flow, with no Entra tenant or production credentials used.
- Fixed the database split in `playwright.config.ts`: global setup already migrated and seeded `E2E_PG_DATABASE_URL`, but the backend webServer inherited `NodejsBackend/.env` instead. The webServer now receives the same E2E database URL, preventing stale local application data from being served to browser tests.
- Fixed deterministic persona switching in `e2e/common-helpers.ts` by setting the newly minted token before reload, and updated form locators to match accessible-label prefixes after the UI labels were lengthened.
- The local Prisma schema-engine failure was caused by using CI sample credentials against the local server. With a dedicated database and the configured local PostgreSQL account, migrations and seeding completed successfully.
- `dev.bat` now starts the test identity provider and configures the local backend to trust its issuer/audience. The landing page offers a development-only picker for seeded users; it preflights `/api/auth/me` and fails clearly if the account is linked to another provider identity.
- Frontend typecheck, quality gate, and `git diff --check` pass. Staging OIDC and production-like document-protection checks remain outstanding; this does not close the release plan.
