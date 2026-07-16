# API Reference

Base URL: `http://localhost:3001`  
Auth: `Authorization: Bearer <jwt-token>`  
Content-Type: `application/json`

---

## Auth

### `GET /api/auth/preset-users`
No auth required. Returns 5 preset users for the login dropdown.

**Response 200:**
```json
[
  { "label": "Team Member — Nomvula Dlamini", "email": "nomvula@hb.co.za", "role": "teamMember" },
  { "label": "Line Manager — Sipho Nkosi", "email": "sipho@hb.co.za", "role": "approver" },
  { "label": "HR — Lindiwe Zulu", "email": "lindiwe@hb.co.za", "role": "approver" },
  { "label": "CEO — Sandile Shabalala", "email": "sandile@hb.co.za", "role": "approver" },
  { "label": "Admin — System Admin", "email": "admin@hb.co.za", "role": "admin" }
]
```

### `POST /api/auth/login`
Authenticate and receive JWT token.

**Request:**
```json
{ "email": "admin@test.com", "password": "password" }
```

**Response 200:**
```json
{
  "token": "eyJ...",
  "user": { "id": "user-admin", "name": "Admin User", "email": "admin@test.com", "role": "admin" }
}
```

**Errors:** 400 (validation), 401 (invalid credentials)

### `GET /api/auth/me`
Return user profile from JWT.

**Headers:** `Authorization: Bearer <token>`

**Response 200:** Full user object  
**Errors:** 401 (missing/invalid token)

---

## Declarations

### `GET /api/declarations`
List declarations. Team members see only their own.

**Query params:** `?status=Pending&search=Gift`

**Response 200:** Array of declaration objects

### `GET /api/declarations/stats`
Dashboard KPIs.

**Response 200:**
```json
{
  "kpis": { "total": 10, "pending": 5, "approved": 3, "declined": 1, "escalated": 0, "totalValue": 15000 },
  "complianceTrend": [{ "month": "Jan", "approved": 5, "declined": 1 }],
  "typeBreakdown": [{ "name": "Gift", "value": 50, "color": "#7c3aed" }]
}
```

### `POST /api/declarations`
Create a new declaration.

**Request body:** Full `DeclarationInput` (see Swagger for field list)  
**Ownership check:** Team members can only create for themselves (`employeeId` must match token)  
**Note:** Status is always set to "Draft" on creation (overrides any submitted status)

**Response 201:** Created declaration object  
**Errors:** 400 (Zod validation), 403 (IDOR)

### `GET /api/declarations/:id`
Get single declaration with workflow steps.

**Note:** No ownership check — any authenticated user can read any declaration by ID.

**Response 200:** Declaration with `workflowSteps` array  
**Errors:** 404

### `PUT /api/declarations/:id`
Update declaration fields. Only drafts or info-requested declarations can be edited.

**Note:** No field whitelist — `status`, `employeeId`, and all other fields can be changed by the owner. Team members cannot edit other users' declarations.

**Errors:** 400 (not editable), 403 (IDOR), 404

### `DELETE /api/declarations/:id`
Delete a draft declaration. Only drafts can be deleted.

**Errors:** 400 (not a draft), 403 (IDOR), 404

### `PATCH /api/declarations/:id/submit`
Submit a draft — creates workflow steps and sets status to Pending.

**Note:** User with `lineManager: null` will create a workflow step with `assignee: ""` that can never be approved.

**Errors:** 400 (not a draft), 500 (missing system config or workflow rule)

### `PATCH /api/declarations/:id/status`
Directly set declaration status. **Admin only.**

**Request:** `{ "status": "Approved" }`  
**Valid statuses:** Draft, Pending, Approved, Declined, Escalated, Info Requested

---

## Workflows

### `GET /api/workflows/pending`
List pending approval steps for the current user.

**Response 200:**
```json
[{
  "declaration": { "id": "GHE-TEST-001", "employee": "...", "status": "Pending" },
  "step": { "order": 1, "role": "lineManager", "assignee": "user-approver", "status": "pending" }
}]
```

### `GET /api/workflows/instances/:declarationId`
Get workflow timeline for a declaration.

**Note:** No ownership check — any authenticated user can view any workflow instance.

**Response 200:** `{ "declarationId": "...", "steps": [...] }`  
**Errors:** 404

### `POST /api/workflows/approve`
Approve, decline, or return a workflow step.

**Request:**
```json
{ "declarationId": "GHE-TEST-001", "decision": "accept", "notes": "Approved" }
```

**Valid decisions:** `return`, `accept`, `org`, `foundation`, `decline`, `reject`, `info`, `escalate`

**Note:** No self-approval guard — approver can approve their own declaration.  
**Note:** No step order enforcement — HR can approve before Line Manager.

**Response 200:** `{ "declarationId", "newStatus", "currentStep", "workflowSteps" }`  
**Errors:** 400 (invalid decision, missing fields), 403 (no pending step), 404

---

## Files

### `POST /api/files/upload`
Upload a file (max 10MB).

**Content-Type:** `multipart/form-data`  
**Fields:** `file` (binary), `declarationId` (string, optional)

**Allowed MIME types:** `application/pdf`, `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `text/plain`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

**Note:** `declarationId` is not validated — can attach to non-existent declaration.  
**Note:** Files > 10MB cause a 500 error (no multer error handler, should be 413).  
**Note:** No file ownership check — any user can download or delete any file.

**Response 201:** File metadata `{ id, name, size, type, url, uploadedAt }`

### `GET /api/files/:id`
Download a file.

**Response 200:** Binary file stream with `Content-Type` and `Content-Disposition` headers  
**Errors:** 404 (not found in DB or on disk)

### `DELETE /api/files/:id`
Delete a file (DB record + disk file).

**Response 200:** `{ "message": "File deleted" }`  
**Errors:** 404

---

## Reports

### `GET /api/reports/status-breakdown`
Declaration counts grouped by status.

**Query params:** `?startDate=&endDate=&department=&status=`

### `GET /api/reports/sla`
Average/min/max turnaround days by approver role.

**Query params:** `?startDate=&endDate=&department=&status=`

### `GET /api/reports/counterparty-concentration`
Declarations grouped by counterparty, sorted by total value descending.

**Query params:** `?startDate=&endDate=&department=&status=`

### `GET /api/reports/high-value`
Declarations above `highValueThreshold` (default 2000), sorted by value descending.

**Query params:** `?startDate=&endDate=&department=&status=`

### `GET /api/reports/list`
Filtered declaration list for result tables.

**Query params:** `?department=&status=&startDate=&endDate=&search=`

### `GET /api/reports/export`
Export as XLSX spreadsheet.

**Query params:** `?reportType=My+Report&department=&status=&startDate=&endDate=`

**Response 200:** XLSX file download

---

## Admin

### Dashboard

#### `GET /api/admin/dashboard`
KPI counts. **Admin only.**

**Response 200:** `{ users, declarations, workflows, threshold }`

### Users

#### `GET /api/admin/users`
List users. **Admin only.**

**Query params:** `?search=&role=`

#### `GET /api/admin/users/:id`
Get user by ID. **Admin only.**

#### `POST /api/admin/users`
Create user. **Admin only.**

**Required fields:** `name`, `email`, `role`, `department`, `position`  
**Optional:** `teamMemberNumber`, `lineManager`  
**Default password:** `"password"`  
**Errors:** 409 (duplicate email)

#### `PUT /api/admin/users/:id`
Update user. **Admin only.**

**Note:** Role changes don't invalidate existing JWT tokens.

#### `DELETE /api/admin/users/:id`
Delete user. **Admin only.** Blocks deleting the last admin.

### Config

#### `GET /api/admin/config`
Get system config. **Admin only.**

**Response:** `{ highValueThreshold, mediumValueThreshold, slaEscalationDays, maxDeclarationsPerCounterparty, emailTemplate }`

#### `PUT /api/admin/config`
Update system config. **Admin only.**

**All fields required.** Partial updates rejected by Zod.

**Note:** Config threshold changes affect new workflow rule selection but don't re-evaluate existing pending workflows.

#### `GET /api/admin/config/dropdowns`
Get dropdown options. **Admin only.**

#### `PUT /api/admin/config/dropdowns`
Update dropdown options. **Admin only.** Empty arrays rejected.

#### `GET /api/admin/config/approval-options`
Get approval decision options. **Admin only.**

#### `POST /api/admin/config/approval-options`
Create a new approval option. **Admin only.**

**Request:** `{ id, value, label }`  
**Response 201:** `{ value, label }`  
**Errors:** 400 (missing fields), 409 (duplicate id)

#### `PUT /api/admin/config/approval-options/:id`
Update an existing approval option. **Admin only.**

**Request:** `{ value, label }`  
**Response 200:** `{ value, label }`  
**Errors:** 400 (missing fields), 404 (not found)

#### `DELETE /api/admin/config/approval-options/:id`
Delete an approval option. **Admin only.**

**Response 200:** `{ "message": "Approval option deleted" }`  
**Errors:** 404 (not found)

### Workflow Rules

#### `GET /api/admin/workflows/rules`
List workflow rules sorted by priority. **Admin only.**

#### `POST /api/admin/workflows/rules`
Create workflow rule. **Admin only.**

**Request:** `{ name, condition, priority, steps: [{ order, role, label }] }`

#### `PUT /api/admin/workflows/rules/:id`
Update workflow rule. **Admin only.** Blocks adding roles with active pending steps.

#### `DELETE /api/admin/workflows/rules/:id`
Delete workflow rule. **Admin only.**

**Note:** Deleting a rule doesn't break existing workflow instances, but new submissions matching that rule threshold will crash with a 500 error.

---

## Health

### `GET /api/health`
No auth required.

**Response 200:** `{ "status": "ok", "timestamp": "2026-07-14T..." }`
