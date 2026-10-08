# Testing Guide

> Current authentication uses OpenID Connect with a throwaway test JWKS
> provider. Password-login, SQLite, `test.db`, and local-JWT examples in older
> sections are retired and must not be used. Use the current test JWKS provider,
> `globalSetup.ts`, and `docs/IDENTITY-CONTRACT.md` as the authoritative test
> contract. Current commands and counts are in `AGENTS.md` and
> `docs/DATABASE-NORMALIZATION-GOAL.md`.

## Quick Start

```bash
# Install dependencies (if not done)
npm install

# Run all backend tests
npx vitest run

# Run a specific test file
npx vitest run src/__tests__/break.test.ts

# Run with watch mode during development
npx vitest

# Run frontend tests
cd "..\Enterprise Compliance Platform"
npx vitest run
```

## Authentication and manual acceptance

There are no preset users, passwords, local login endpoints, or SQLite manual
testing workflows. Automated tests use the throwaway JWKS provider started by
`globalSetup.ts`; manual acceptance must use the development OIDC seam or a
real staging Entra tenant with provisioned local users. Never copy credentials
from historical examples into a deployment.

The release acceptance pass must cover login/logout, declaration lifecycle,
workflow approval and queue refresh, profile locking, organization isolation,
protected PDF/XLSX exports, supporting-file lifecycle, and unauthorized,
expired-session, empty, loading, and server-error states.

## Swagger UI

Start the server, then open: `http://localhost:3001/api/docs`

The current API docs require OIDC configuration from `.env.example`; Swagger
is development-only and is disabled in production.

## Manual API Tests (curl / PowerShell)

### Auth

There is no password login and no preset-users endpoint. `POST
/api/auth/login` and `GET /api/auth/preset-users` were removed in the
OpenID cutover and both return `404` (pinned by `auth.test.ts`). The only
identity route is `GET /api/auth/me`, which resolves the local user from
a validated bearer token (see `docs/IDENTITY-CONTRACT.md`).

To call the API manually, mint a throwaway RS256 token for a seeded local
user. Identity resolves by email, so the email must exist in the database
(`admin@hb.co.za`, `sipho@hb.co.za`, `lindiwe@hb.co.za`,
`nomvula@hb.co.za` in the development seed):

```powershell
# Terminal 1 — throwaway provider (test-only, never production)
npm run test:provider
# Test identity provider up at http://127.0.0.1:55439

# Terminal 2 — API against the throwaway provider (migrated + seeded DB)
$env:OIDC_AUTHORITY="http://127.0.0.1:55439"
$env:OIDC_ISSUER="http://127.0.0.1:55439"
$env:OIDC_AUDIENCE="ghe-test-api-audience"
$env:OIDC_CLIENT_ID="manual-testing"
npm run dev

# Mint a token (any terminal)
$token = Invoke-RestMethod -Uri "http://127.0.0.1:55439/test-token" `
  -Method Post -Body '{"email":"admin@hb.co.za","name":"Admin User","oid":"manual-admin"}' `
  -ContentType "application/json"

# Get current user
Invoke-RestMethod -Uri "http://localhost:3001/api/auth/me" `
  -Headers @{Authorization="Bearer $token"}
```

Unknown emails get `403` (default-deny, no auto-provisioning); tokens
with a wrong issuer, audience, expiry, or missing `oid` get `401`
(pinned by `auth-validation.test.ts`).

### Declarations

```powershell
# List declarations
Invoke-RestMethod -Uri "http://localhost:3001/api/declarations" `
  -Headers @{Authorization="Bearer $token"}

# Filter by status and search
Invoke-RestMethod -Uri "http://localhost:3001/api/declarations?status=Pending&search=Gift" `
  -Headers @{Authorization="Bearer $token"}

# Get stats / KPIs
Invoke-RestMethod -Uri "http://localhost:3001/api/declarations/stats" `
  -Headers @{Authorization="Bearer $token"}

# Get single declaration
Invoke-RestMethod -Uri "http://localhost:3001/api/declarations/GHE-TEST-001" `
  -Headers @{Authorization="Bearer $token"}

# Create a declaration (as team member)
$body = @{
  employee="Nomvula Team"; employeeId="user-team"; teamMemberNumber="TM-001"
  lineManager="Sipho Approver"; position="BM"; department="Marketing"
  type="Gift"; counterparty="TestCo"; value=500
  submitted="2026-07-01"; approver="Sipho Approver"; status="Draft"; priority="Low"
  description="Manual test"; relationship="Test"
  receivedGiven="Received"; from="Supplier"; contactPerson="T"
  biddingProcess="No"; occasion="Business Meeting"; date="2026-07-01"
  instances="1"; publicOfficial="No"
} | ConvertTo-Json
$decl = Invoke-RestMethod -Uri "http://localhost:3001/api/declarations" `
  -Method Post -Body $body -ContentType "application/json" `
  -Headers @{Authorization="Bearer $token"}

# Update a draft
Invoke-RestMethod -Uri "http://localhost:3001/api/declarations/$($decl.id)" `
  -Method Put -Body '{"description":"Updated desc"}' -ContentType "application/json" `
  -Headers @{Authorization="Bearer $token"}

# Submit a draft (creates workflow)
Invoke-RestMethod -Uri "http://localhost:3001/api/declarations/$($decl.id)/submit" `
  -Method Patch -Headers @{Authorization="Bearer $token"}

# Update status directly
Invoke-RestMethod -Uri "http://localhost:3001/api/declarations/$($decl.id)/status" `
  -Method Patch -Body '{"status":"Approved"}' -ContentType "application/json" `
  -Headers @{Authorization="Bearer $token"}

# Delete a draft
Invoke-RestMethod -Uri "http://localhost:3001/api/declarations/$($decl.id)" `
  -Method Delete -Headers @{Authorization="Bearer $token"}
```

### Workflows

```powershell
# Get pending approvals for current user
Invoke-RestMethod -Uri "http://localhost:3001/api/workflows/pending" `
  -Headers @{Authorization="Bearer $token"}

# Get workflow instance for a declaration
Invoke-RestMethod -Uri "http://localhost:3001/api/workflows/instances/GHE-TEST-001" `
  -Headers @{Authorization="Bearer $token"}

# Approve a step
Invoke-RestMethod -Uri "http://localhost:3001/api/workflows/approve" `
  -Method Post -Body '{"declarationId":"GHE-TEST-001","decision":"accept","notes":"Approved"}' `
  -ContentType "application/json" -Headers @{Authorization="Bearer $token"}

# Decline
Invoke-RestMethod -Uri "http://localhost:3001/api/workflows/approve" `
  -Method Post -Body '{"declarationId":"GHE-TEST-001","decision":"decline","notes":"Rejected"}' `
  -ContentType "application/json" -Headers @{Authorization="Bearer $token"}

# Return for info
Invoke-RestMethod -Uri "http://localhost:3001/api/workflows/approve" `
  -Method Post -Body '{"declarationId":"GHE-TEST-001","decision":"return","notes":"Need more info"}' `
  -ContentType "application/json" -Headers @{Authorization="Bearer $token"}
```

### Files

```powershell
# Upload a file (link to declaration)
Invoke-RestMethod -Uri "http://localhost:3001/api/files/upload" `
  -Method Post -Form @{file=Get-Item -Path "test.pdf"; declarationId="GHE-TEST-001"} `
  -Headers @{Authorization="Bearer $token"}

# Download a file
Invoke-RestMethod -Uri "http://localhost:3001/api/files/{file-id}" `
  -Headers @{Authorization="Bearer $token"} -OutFile "downloaded.txt"

# Delete a file
Invoke-RestMethod -Uri "http://localhost:3001/api/files/{file-id}" `
  -Method Delete -Headers @{Authorization="Bearer $token"}
```

### Reports

```powershell
# Status breakdown
Invoke-RestMethod -Uri "http://localhost:3001/api/reports/status-breakdown" `
  -Headers @{Authorization="Bearer $token"}

# SLA turnaround
Invoke-RestMethod -Uri "http://localhost:3001/api/reports/sla" `
  -Headers @{Authorization="Bearer $token"}

# Counterparty concentration
Invoke-RestMethod -Uri "http://localhost:3001/api/reports/counterparty-concentration" `
  -Headers @{Authorization="Bearer $token"}

# High value declarations
Invoke-RestMethod -Uri "http://localhost:3001/api/reports/high-value" `
  -Headers @{Authorization="Bearer $token"}

# Filtered list
Invoke-RestMethod -Uri "http://localhost:3001/api/reports/list?department=Marketing&status=Pending" `
  -Headers @{Authorization="Bearer $token"}

# Export XLSX
Invoke-RestMethod -Uri "http://localhost:3001/api/reports/export" `
  -Headers @{Authorization="Bearer $token"} -OutFile "report.xlsx"
```

### Admin — Dashboard

```powershell
# Dashboard KPI counts
Invoke-RestMethod -Uri "http://localhost:3001/api/admin/dashboard" `
  -Headers @{Authorization="Bearer $token"}
```

### Admin — Users

```powershell
# List users (filter by search/role)
Invoke-RestMethod -Uri "http://localhost:3001/api/admin/users?role=teamMember" `
  -Headers @{Authorization="Bearer $token"}

# Get user by ID
Invoke-RestMethod -Uri "http://localhost:3001/api/admin/users/user-admin" `
  -Headers @{Authorization="Bearer $token"}

# Create user
$newUser = @{
  name="Test User"; email="test@test.com"; role="teamMember"
  department="IT"; position="Dev"
} | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3001/api/admin/users" `
  -Method Post -Body $newUser -ContentType "application/json" `
  -Headers @{Authorization="Bearer $token"}

# Update user
Invoke-RestMethod -Uri "http://localhost:3001/api/admin/users/{user-id}" `
  -Method Put -Body '{"role":"approver"}' -ContentType "application/json" `
  -Headers @{Authorization="Bearer $token"}

# Delete user
Invoke-RestMethod -Uri "http://localhost:3001/api/admin/users/{user-id}" `
  -Method Delete -Headers @{Authorization="Bearer $token"}
```

### Admin — Config

```powershell
# Get system config
Invoke-RestMethod -Uri "http://localhost:3001/api/admin/config" `
  -Headers @{Authorization="Bearer $token"}

# Update system config
Invoke-RestMethod -Uri "http://localhost:3001/api/admin/config" `
  -Method Put -Body '{"highValueThreshold":5000,"mediumValueThreshold":500,"slaEscalationDays":5,"maxDeclarationsPerCounterparty":10,"emailTemplate":"Updated template"}' `
  -ContentType "application/json" -Headers @{Authorization="Bearer $token"}

# Get dropdowns
Invoke-RestMethod -Uri "http://localhost:3001/api/admin/config/dropdowns" `
  -Headers @{Authorization="Bearer $token"}

# Update dropdowns
Invoke-RestMethod -Uri "http://localhost:3001/api/admin/config/dropdowns" `
  -Method Put -Body '{"departments":["Marketing","IT","HR","Finance"],"categories":["Gift","Hospitality","Entertainment"]}' `
  -ContentType "application/json" -Headers @{Authorization="Bearer $token"}

# Get approval options
Invoke-RestMethod -Uri "http://localhost:3001/api/admin/config/approval-options" `
  -Headers @{Authorization="Bearer $token"}

# Create approval option
Invoke-RestMethod -Uri "http://localhost:3001/api/admin/config/approval-options" `
  -Method Post -Body '{"id":"new-opt","value":"new-opt","label":"New Option"}' `
  -ContentType "application/json" -Headers @{Authorization="Bearer $token"}

# Update approval option
Invoke-RestMethod -Uri "http://localhost:3001/api/admin/config/approval-options/accept" `
  -Method Put -Body '{"value":"accept","label":"Accept (Updated)"}' `
  -ContentType "application/json" -Headers @{Authorization="Bearer $token"}

# Delete approval option
Invoke-RestMethod -Uri "http://localhost:3001/api/admin/config/approval-options/new-opt" `
  -Method Delete -Headers @{Authorization="Bearer $token"}
```

### Admin — Workflow Rules

```powershell
# List rules
Invoke-RestMethod -Uri "http://localhost:3001/api/admin/workflows/rules" `
  -Headers @{Authorization="Bearer $token"}

# Create rule
$rule = @{
  name="New Rule"; condition="medium"; priority=4
  steps=@(@{order=1; role="lineManager"; label="LM Review"})
} | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3001/api/admin/workflows/rules" `
  -Method Post -Body $rule -ContentType "application/json" `
  -Headers @{Authorization="Bearer $token"}

# Update rule
Invoke-RestMethod -Uri "http://localhost:3001/api/admin/workflows/rules/rule-1" `
  -Method Put -Body '{"name":"Updated Rule"}' -ContentType "application/json" `
  -Headers @{Authorization="Bearer $token"}

# Delete rule
Invoke-RestMethod -Uri "http://localhost:3001/api/admin/workflows/rules/rule-1" `
  -Method Delete -Headers @{Authorization="Bearer $token"}
```

### Health

```powershell
# Health check (no auth)
Invoke-RestMethod -Uri "http://localhost:3001/api/health"
```

## Switching User Roles

Mint one token per role from the throwaway provider (`npm run
test:provider`, then `POST /test-token` as above) using a seeded email for
that role. Roles are database-authoritative — tokens carry no role:

```powershell
$provider = "http://127.0.0.1:55439/test-token"

# Admin token
$admin = Invoke-RestMethod -Uri $provider -Method Post `
  -Body '{"email":"admin@hb.co.za","name":"Admin User","oid":"manual-admin"}' -ContentType "application/json"

# Approver (Line Manager) token
$approver = Invoke-RestMethod -Uri $provider -Method Post `
  -Body '{"email":"sipho@hb.co.za","name":"Sipho Nkosi","oid":"manual-sipho"}' -ContentType "application/json"

# Approver (HR) token
$hr = Invoke-RestMethod -Uri $provider -Method Post `
  -Body '{"email":"lindiwe@hb.co.za","name":"Lindiwe Zulu","oid":"manual-lindiwe"}' -ContentType "application/json"

# Team Member token
$team = Invoke-RestMethod -Uri $provider -Method Post `
  -Body '{"email":"nomvula@hb.co.za","name":"Nomvula Dlamini","oid":"manual-nomvula"}' -ContentType "application/json"
```

## Test Coverage Summary

Counts below are the 2026-10-08 gate results (backend 445/445 across 26
files, frontend 270/270 across 23 files). Re-run the suites for current
totals; counts are not fixed documentation.

### Backend coverage areas

| File | Tests | What's tested |
|------|-------|---------------|
| `break.test.ts` | 72 | Injection/XSS/SQLi shapes, auth attacks, HTTP abuse, rapid requests (negative assertions; failures return safe errors) |
| `edge-cases.test.ts` | 51 | Self-approval blocked (403), step order enforced (403), reviewer file-delete refused (403), concurrent-approve race, approver isolation, file size/orphans, config/workflow coupling, null LM, SLA dates |
| `logical-flaws.test.ts` | 48 | Status-transition guards, edit/delete/submit preconditions, approval preconditions, unmapped-decision fail-closed, admin override + reconvergence |
| `logical-flaws-2.test.ts` | 46 | Return/resubmit preservation, credential-less user creation, file cascade on declaration delete |
| `logical-flaws-3.test.ts` | 39 | Rule-delete guards (routing rules protected), empty-steps rejected, dashboard KPIs, threshold routing, approval notes |
| `admin/config.test.ts` | 18 | Config/dropdown/approval-option CRUD + RBAC, identifier validation |
| `organization.test.ts` | 19 | Multi-tenant isolation, cross-org 403s, counterparty per-org isolation, SLA org isolation, approve org backstop, global-enumeration block |
| `workflows.test.ts` | 16 | Pending list, instances, approve/decline/return, unmapped-decision rejection, ownerless-submit rejection |
| `workflow-paths.test.ts` | 13 | Full approval-path scenarios |
| `reports-protection.test.ts` | 12 | Export password validation, auth, real-encryption round-trips |
| `workflow-e2e.test.ts` | 12 | Return/resubmit/decline lifecycle, full LM→HR chain |
| `auth-validation.test.ts` | 11 | Wrong issuer/audience/algorithm/expiry/oid → 401 |
| `admin/users.test.ts` | 10 | Users CRUD, department-link resolution, RBAC |
| `declarations.test.ts` | 13 | CRUD, stats, submit, status change, limit/offset pagination |
| `reports.test.ts` | 8 | Breakdown, SLA, concentration, high-value, list, export |
| `normalization.test.ts` | 8 | Snapshot/detail/counterparty writes, relational step rows |
| `auth.test.ts` | 7 | Login/preset routes removed (404), `/me` identity resolution |
| `workflow-regressions.test.ts` | 7 | Return + value-increase flows, HR escalation, approval preservation |
| `production-posture.test.ts` | 9 | Docs gating (incl. production-app mount), seed guard incl. subprocess refusal proof, rate-limit 429 behavior |
| `files-and-export-coverage.test.ts` | 5 | Upload/download/delete, export coverage |
| `admin/workflows.test.ts` | 5 | Workflow rules CRUD |
| `profile-locking.test.ts` | 3 | Crafted identity ignored, incomplete profile rejected |
| `admin/dashboard.test.ts` | 2 | Dashboard stats |
| `queue.test.ts` | 2 | Authoritative `{ items, total }` queue contract |
| `seed-if-empty.test.ts` | 5 | Emptiness predicate (partial-wipe cases), live counts |
| `notifications.test.ts` | 4 | Webhook no-op paths, placeholder rendering, failure never throws |

### Frontend coverage areas

| File | Tests | What's tested |
|------|-------|---------------|
| `api-services.test.ts` | 43 | All API wrappers including approval-options CRUD |
| `frontend-break.test.ts` | 31 | httpClient edge cases, API wrapper URL building |
| `workflow-e2e.test.tsx` | 29 | Review/approve/decline journeys, file flows, error states |
| `integration.test.ts` | 28 | Auth + screen access, dashboard stats, create declaration |
| `approval-workflow.test.tsx` | 23 | WorkflowTimeline rendering, decisions, notes, auto-fetch, submit |
| `ApprovalDetail.test.tsx` | 15 | Detail loading, decisions, submission, back navigation |
| `MyDeclarationsScreen.test.tsx` | 15 | Loading, error, table, filters, export, KPIs, drafts, same-name isolation |
| `NewDeclarationScreen.test.tsx` | 14 | Form rendering, validation, submit, draft, upload |
| `ApprovalQueue.test.tsx` | 11 | Queue loading, filtering, review, protected export, refresh |
| `auth-edge-cases.test.ts` | 11 | MSAL adapter mocks, no `localStorage` token persistence, RBAC |
| `msal-refresh.test.ts` | 3 | Silent-token success, interaction-required redirect, non-interaction passthrough |
| `dialogs.test.tsx` | 8 | Confirm dialog, Escape, user-dialog validation, password dialog |
| `UserContext.test.tsx` | 6 | Auth state, loading, initialization |
| `download.test.ts` | 8 | Auth header, failure, preview path, data-URL click attach, pagehide release |
| `ErrorBoundary.test.tsx` | 5 | Error fallback, custom fallback, reset |
| `org-api.test.ts` | 5 | Organization-scoped lookups |
| `workflow-fix.test.tsx` | 3 | Completed-step states and decision text |
| `admin-dashboard-states.test.tsx` | 2 | API errors and recovered dashboard data |
| `notifications.test.ts` | 2 | Success/error wrapper routing |
| `LandingScreen.test.tsx` | 3 | Sign-in CTA, provider start, generic failure (no detail leak) |
| `AdminDropdownOptions.test.tsx` | 3 | Reference-list render, optimistic add, failure rollback |
| `AdminApprovalOptions.test.tsx` | 1 | Page header and options table |
| `dashboard-render.test.tsx` | 1 | ApproverDashboard mount smoke test |

Run the backend and frontend test commands separately to obtain the current totals; counts are not fixed documentation.
