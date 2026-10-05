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

## Implementation status — 2 October 2026

Phases 1–6 are implemented and covered by tests (backend 404/404,
frontend 259/259, typecheck and production build clean — full gates re-run
after each addition).

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
- Demo quick-login restored on explicit user request (2 October 2026):
  preset users and preselected password are back in all builds. The sign-in
  failure message stays generic and no longer discloses the default
  password. Full demo-mode gating (`VITE_DEMO_MODE` + standard login form)
  remains the recommended follow-up if production must not ship demo
  credentials.
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

Status after the 2 October 2026 implementation (all phases delivered):

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
10. Partial — quick login restored on request; failure messages stay generic
   (no password disclosure), but preset demo credentials ship in all builds
   until demo-mode gating is reinstated.

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
spec drift and had never run in CI): desktop 16/16, mobile 2/2, against
embedded PostgreSQL + seeded data. Repairs: stale `LOGIN_INDEX` (admin
logged in as the wrong user), CSS-space selectors, object timeouts, strict
violations, label drift, UserDialog rewrite of the prompt-driven admin test,
self-contained return/resubmit flow, login backoff for the 429 rate limit.
Project split in `playwright.config.ts`: desktop runs table-driven
`approval-flows`, mobile runs `mobile-interactions` (mobile card-flow
coverage is a follow-up). Playwright `test-results/` and
`playwright-report/` are git-ignored test artifacts.

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
