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

## Current Findings

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

Deliver Phases 1–3 first because they directly address the visible audit
findings and reduce workflow ambiguity. Deliver Phase 4 alongside those
changes where schemas are touched. Complete Phase 6 before or alongside Phase
5 so all download and export paths are consolidated before protection is
introduced. Complete Phase 5 after the password scope, recipient model, and
compatible protection technology have been approved.
