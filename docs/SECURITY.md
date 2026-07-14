# Security Audit

## Confirmed Vulnerabilities

Each vulnerability below is confirmed by a passing test that documents the buggy behavior (marked with `// BUG:` comments).

### 1. Mass Assignment — Team Member Can Escalate Status
**Severity:** Critical  
**File:** `routes/declarations.ts:202-255`  
**Test:** `edge-cases.test.ts > PUT /api/declarations/:id — team member CAN update status`

The `PUT` handler has no field whitelist. A team member can set `{ status: "Approved" }` to bypass the entire workflow approval process. All fields including `employeeId`, `value`, `status` are writable.

**Fix:** Implement a field whitelist per role. Team members should only be able to update non-status, non-ownership fields.

### 2. No Status Restriction on Create
**Severity:** Critical  
**File:** `routes/declarations.ts:105-134`  
**Test:** `edge-cases.test.ts > POST /api/declarations — create with status Approved`

The `createSchema` Zod schema accepts `status: z.string()` with no restriction to "Draft". Any user can create a declaration pre-approved, bypassing the workflow entirely.

**Fix:** Restrict `status` to `z.literal("Draft")` on create.

### 3. No Status Authorization Guard on PATCH
**Severity:** Critical  
**File:** `routes/declarations.ts:313-334`  
**Test:** `edge-cases.test.ts > PATCH /api/declarations/:id/status — team member escalates to Approved`

The `PATCH /:id/status` endpoint has no `authorize("admin")` guard. Any authenticated user can set any status on any declaration. A team member can self-escalate to "Approved".

**Fix:** Add `authorize("admin")` middleware, or at minimum restrict status changes based on current workflow state.

### 4. Self-Approval — No Guard
**Severity:** High  
**File:** `routes/workflows.ts:71-153`  
**Test:** `edge-cases.test.ts > Self-approval — creating and self-approving`

An approver can create a declaration for themselves and approve their own step. There's no check that the approver is different from the declarant.

**Fix:** Reject approval if `declaration.employeeId === req.user.id`.

### 5. Workflow Step Order Not Enforced
**Severity:** High  
**File:** `routes/workflows.ts:96-128`  
**Test:** `edge-cases.test.ts > HR can approve before Line Manager`

The approve handler finds the first pending step matching the user's ID regardless of step `order`. HR can approve their step before the LM step is completed.

**Fix:** Check that all prior-order steps are completed before allowing approval.

### 6. No Ownership Check on Single-Declaration GET
**Severity:** High  
**File:** `routes/declarations.ts:188-200`  
**Test:** `edge-cases.test.ts > team member reads non-owned declaration by ID`

The list endpoint (`GET /api/declarations`) filters by `employeeId` for team members, but the single-resource endpoint (`GET /api/declarations/:id`) has no such filter. Team members can read any declaration by iterating IDs.

**Fix:** Add the same `employeeId` filter on the single-resource endpoint for team members.

### 7. No Ownership Check on Workflow Instances
**Severity:** High  
**File:** `routes/workflows.ts:51-62`  
**Test:** `edge-cases.test.ts > any user views non-owned workflow instance`

Any authenticated user can view the workflow instance (including approval history) for any declaration by ID.

**Fix:** Filter by user role and assignment: team members should only see their own, approvers should only see their assigned steps.

### 8. JWT Role Never Re-Validated Against DB
**Severity:** High  
**File:** `middleware/auth.ts:14-30`  
**Test:** `edge-cases.test.ts > old JWT still valid after role change`

The `authenticate` middleware decodes the JWT and trusts the embedded `role` field. Changing a user's role via the admin API does not invalidate existing tokens. A user can keep using old privileges until the token expires.

**Fix:** Option A: Look up user from DB on each authenticated request (performance cost). Option B: Maintain a token blacklist or role version counter. Option C: Short token expiry (e.g., 15 minutes).

### 9. No Cascade Delete — Orphaned Records
**Severity:** Medium  
**File:** `routes/declarations.ts:257-275`, `routes/files.ts:100-115`  
**Test:** `edge-cases.test.ts > file orphaned after declaration delete`

Deleting a draft declaration does not cascade to delete linked `UploadedFile` records or their disk files. File records and disk blobs become orphaned.

**Fix:** Delete associated files before deleting the declaration.

### 10. Null LineManager Creates Unreviewable Workflow
**Severity:** Medium  
**File:** `services/workflowService.ts:47-49`  
**Test:** `edge-cases.test.ts > null lineManager submit`

If a user's `lineManager` is null, the LM workflow step is created with `assignee: ""` and `assigneeName: "Unknown"`. No user can ever claim this step — the declaration is stuck forever.

**Fix:** Validate that the employee has a line manager before submission, or assign to a fallback approver.

### 11. No File Ownership Check
**Severity:** Medium  
**File:** `routes/files.ts:80-97, 100-115`  
**Test:** `edge-cases.test.ts > upload as team, download as HR`

Any authenticated user can download or delete any file by ID, regardless of who uploaded it or which declaration it belongs to.

**Fix:** Restrict file access to the uploader and admins.

### 12. Rule Deletion Crashes New Submissions
**Severity:** Medium  
**File:** `services/workflowService.ts:32-33`  
**Test:** `edge-cases.test.ts > deleting rule-3 would break new high-value submissions`

If a workflow rule is deleted, `createWorkflowSteps` throws `"Workflow rule rule-N not found"` with no try/catch, causing a 500 error on any new submission that would use that rule.

**Fix:** Add try/catch in `createWorkflowSteps` with a graceful fallback (e.g., use a default rule or reject with a meaningful error).

### 13. SLA Report — NaN from Invalid Dates
**Severity:** Low  
**File:** `routes/reports.ts:56-61`  
**Test:** `edge-cases.test.ts > SLA report with bad dates`

If a workflow step has an unparseable `decidedAt` string, `new Date(invalid).getTime()` returns `NaN`, which propagates through `avg/min/max` calculations and produces `null` values in the JSON response.

**Fix:** Validate date parsing before computing stats; skip entries with invalid dates.

### 14. JSON.parse of Workflow Steps Without try/catch
**Severity:** Medium  
**File:** `routes/workflows.ts:23,61,96` and `routes/declarations.ts:197`  
**Test:** Cannot be tested via API (Express 4 hangs on async handler rejection)

Four endpoints call `JSON.parse(instance.steps)` without try/catch. If stored JSON is corrupted, the async handler rejects without sending a response, hanging the client.

**Fix:** Wrap all `JSON.parse` calls in try/catch and return 500 with a meaningful message.

---

## Security Headers

The app uses `helmet()` middleware (see `src/index.ts:23`), which sets standard security headers (CSP, X-Frame-Options, etc.).

## Rate Limiting

`express-rate-limit` is applied to `POST /api/auth/login` (10 requests per minute per IP). Not tested (would poison test suite state).
