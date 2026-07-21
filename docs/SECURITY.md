# Security Audit — All Fixes Applied

All 14 vulnerabilities identified in the original audit have been fixed. Below is the fix summary.

| # | Vulnerability | Severity | File | Fix |
|---|---------------|----------|------|-----|
| 1 | Mass assignment — team member can escalate status | Critical | `routes/declarations.ts:202-255` | Field whitelist per role (status field excluded for teamMembers) |
| 2 | No status restriction on create | Critical | `routes/declarations.ts:105-134` | Create schema forces `status: "Draft"` |
| 3 | No status authorization guard on PATCH | Critical | `routes/declarations.ts:313-334` | `authorize("admin")` middleware added |
| 4 | Self-approval — no guard | High | `routes/workflows.ts:118-126` | Reject if `step.assignee === declaration.employeeId` |
| 5 | Workflow step order not enforced | High | `routes/workflows.ts:129-133` | Skip approval if prior-order steps are pending |
| 6 | No ownership check on single-declaration GET | High | `routes/declarations.ts:188-200` | `employeeId` filter already present for teamMembers |
| 7 | No ownership check on workflow instances | High | `routes/workflows.ts:63-75` | Restrict to admin/assignee/owner |
| 8 | JWT role never re-validated against DB | High | `middleware/auth.ts:14-30` | DB role cross-check on every `authenticate()` call |
| 9 | No cascade delete — orphaned records | Medium | `routes/declarations.ts:282-290` | Delete `UploadedFile` + `WorkflowInstance` + disk files before declaration |
| 10 | Null lineManager creates unreviewable workflow | Medium | `services/workflowService.ts:47-49` | LM step skipped if lineManager is null |
| 11 | No file ownership check | Medium | `routes/files.ts:124-131,147-154` | Restrict file access to declaration owner + admin |
| 12 | Rule deletion crashes new submissions | Medium | `services/workflowService.ts:32-33` | try/catch with graceful fallback |
| 13 | SLA report — NaN from invalid dates | Low | `routes/reports.ts:56-58` | Skip entries with unparseable `decidedAt` dates |
| 14 | JSON.parse of workflow steps without try/catch | Medium | `workflows.ts:23,61,96` + `declarations.ts:197` | All four call sites wrapped in try/catch |

## Security Headers

The app uses `helmet()` middleware (see `src/index.ts:23`), which sets standard security headers (CSP, X-Frame-Options, etc.).

## Rate Limiting

`express-rate-limit` is applied to `POST /api/auth/login` (10 requests per minute per IP).
