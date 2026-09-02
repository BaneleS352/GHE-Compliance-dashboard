# Security & Hardening — Audit Fix Log

The application has been hardened across authentication, workflow authorization, file access, organization isolation, reporting access, and notification delivery. This document records the principal controls; run the current test suites before release.

---

## CRITICAL Fixes (7)

| # | Finding | File | Fix |
|---|---------|------|-----|
| 1 | Static `/uploads` directory exposed unauthenticated | `NodejsBackend/src/index.ts` | Removed static `/uploads` middleware; all file access now requires authentication via `GET /api/files/:id` |
| 2 | TOCTOU race in `POST /api/workflows/approve` | `NodejsBackend/src/routes/workflows.ts` | Read-check-write moved inside single Prisma `$transaction` |
| 3 | 4 async route handlers unhandled | `NodejsBackend/src/routes/admin/workflows.ts` | All 4 handlers wrapped with `asyncHandler` |
| 4 | `viewFile()` has no try/catch or `response.ok` check | `Enterprise Compliance Platform/src/app/pages/DeclarationDetailView.tsx` | Added try/catch + `response.ok` validation |
| 5 | `handleSaveEdit`/`handleDelete` no try/catch | `Enterprise Compliance Platform/src/app/pages/admin/AdminApprovalOptions.tsx` | Both handlers wrapped with try/catch |
| 6 | File upload allows orphan files (no `declarationId`) | `NodejsBackend/src/routes/files.ts` | `declarationId` now required; returns 400 without it |
| 7 | Error messages leak internals via `err.message` | `NodejsBackend/src/routes/workflows.ts`, `NodejsBackend/src/routes/files.ts` | Replaced with safe generic messages |

## HIGH Fixes (8)

| # | Finding | File | Fix |
|---|---------|------|-----|
| 8 | Report endpoints lack role guards | `NodejsBackend/src/routes/reports.ts` | All 6 report endpoints + `/stats` now use `authorize("admin", "approver")` |
| 9 | `GET /api/users/:id` accessible to any authenticated user | `NodejsBackend/src/routes/users.ts` | Now restricted to admin or the user themselves |
| 10 | Approve endpoint doesn't verify user role | `NodejsBackend/src/routes/workflows.ts` | Now requires `approver` or `admin` role |
| 11 | `Counterparty` casing mismatch (frontend↔backend) | `Enterprise Compliance Platform/src/types/declaration.ts` + all consumers | Renamed to `counterparty` (lowercase) consistently |
| 12 | `err.message` leaked to client — approvals | `NodejsBackend/src/routes/workflows.ts` catch block | Sanitized to generic messages |
| 13 | Multer/file errors leak internals | `NodejsBackend/src/routes/files.ts` | Sanitized error messages |
| 14 | Missing role guard on `/preset-users` | `NodejsBackend/src/routes/auth.ts` | Preserved as intentional public endpoint |
| 15 | Approver sees all declarations regardless of department | `NodejsBackend/src/routes/declarations.ts` | Department scoping added for approver role |

## MEDIUM Fixes (15)

| # | Finding | File | Fix |
|---|---------|------|-----|
| 16 | N+1 in `GET /api/workflows/pending` | `NodejsBackend/src/routes/workflows.ts` | Batched declaration lookup |
| 17 | N+1 in `createWorkflowSteps` | `NodejsBackend/src/services/workflowService.ts` | Batched line-manager user lookup |
| 18 | N+1 in `getSLABreakdown` | `NodejsBackend/src/services/reports.ts` | Batched workflow instance lookup via `findMany` + Map |
| 19 | `/stats` unpaginated `findMany` | `NodejsBackend/src/routes/declarations.ts` | Queries parallelized via `Promise.all` |
| 20 | `DELETE /api/declarations/:id` sequential deletes | `NodejsBackend/src/routes/declarations.ts` | Parallelized with `Promise.all` |
| 21 | `fetchConfig()` silently swallows errors | `Enterprise Compliance Platform/src/app/pages/NewDeclarationScreen.tsx` | Error now logged to console |
| 22 | `fetchCurrentUser()` has no timeout | `Enterprise Compliance Platform/src/app/auth/UserContext.tsx` | 8s timeout via `Promise.race` |
| 23 | `httpClient` returns `null` on 204 | `Enterprise Compliance Platform/src/services/httpClient.ts` | Returns `undefined` instead |
| 24 | `AdminDashboard` missing loading state | `Enterprise Compliance Platform/src/app/pages/admin/AdminDashboard.tsx` | Loading spinner + error banner added |
| 25 | `ApprovalQueue` empty state missing | `Enterprise Compliance Platform/src/app/pages/ApprovalQueue.tsx` | Empty state messages for mobile + desktop |
| 26 | `AdminApprovalOptions` no error handling | `Enterprise Compliance Platform/src/app/pages/admin/AdminApprovalOptions.tsx` | try/catch added to save/delete handlers |
| 27 | `DeclarationDetailView` no error handling for file fetch | `Enterprise Compliance Platform/src/app/pages/DeclarationDetailView.tsx` | try/catch + `response.ok` check |
| 28 | `NewDeclarationScreen` `fetchConfig`/`fetchUserById` silent failures | `Enterprise Compliance Platform/src/app/pages/NewDeclarationScreen.tsx` | Error logging added |
| 29 | Sequential independent DB queries in `/stats` | `NodejsBackend/src/routes/declarations.ts` | Parallelized with `Promise.all` |
| 30 | Department scoping missing for approvers | `NodejsBackend/src/routes/declarations.ts` + `workflows.ts` | Approver-scoped queries by department |

## LOW Fixes

| # | Finding | File | Fix |
|---|---------|------|-----|
| 31 | Missing DB indexes for common query fields | `NodejsBackend/prisma/schema.prisma` | Added indexes on `employeeId`, `status`, `department`, `approverId`, `position`, `lineManager`, `counterparty`, `declarationId` |
| 32 | Dead function `hasApprovedPredecessors` | `NodejsBackend/src/routes/workflows.ts` | Removed |
| 33 | `useWorkflowApproval.ts` had backend Express code prepended | `Enterprise Compliance Platform/src/app/hooks/useWorkflowApproval.ts` | Cleaned up; restored proper React imports with correct relative paths |
| 34 | Import path bugs in test files for `APPROVAL_OPTIONS`/`DECISION_LABELS` | `Enterprise Compliance Platform/src/__tests__/approval-workflow.test.tsx` | Fixed to import from correct path (`../config/theme`) |

---

## Notification and reporting controls

- Notification templates are admin-only and validated as a complete five-event configuration.
- Notifications resolve recipients from the database and post only to the configured `EMAIL_WEBHOOK_URL`; no external delivery occurs when it is absent.
- Email failures are logged without changing workflow state.
- Reports require admin or approver authorization and apply organization isolation.
- High-value reports use `value >= highValueThreshold` and inclusive date filters.

## Verification status

- Backend build passes.
- Targeted workflow, report, and configuration tests pass.
- Frontend Vite builds may fail in the OneDrive workspace with an esbuild directory-access error; verify from a local checkout if encountered.
