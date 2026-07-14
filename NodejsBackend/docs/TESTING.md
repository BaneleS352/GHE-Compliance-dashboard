# Testing Guide

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

## Preset Users (for manual testing)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@test.com | password |
| Approver (LM) | sipho@test.com | password |
| Approver (HR) | lindiwe@test.com | password |
| Approver (CEO) | sandile@test.com | password |
| Team Member | nomvula@test.com | password |

## Swagger UI

Start the server, then open: `http://localhost:3001/api/docs`

```bash
cd NodejsBackend
JWT_SECRET=test-secret DATABASE_URL="file:./dev.db" npx ts-node --files src/index.ts
```

## Manual API Tests (curl / PowerShell)

### Auth

```powershell
# Login as admin
$token = (Invoke-RestMethod -Uri "http://localhost:3001/api/auth/login" `
  -Method Post -Body '{"email":"admin@test.com","password":"password"}' `
  -ContentType "application/json").token

# Get preset users (no auth required)
Invoke-RestMethod -Uri "http://localhost:3001/api/auth/preset-users"

# Get current user
Invoke-RestMethod -Uri "http://localhost:3001/api/auth/me" `
  -Headers @{Authorization="Bearer $token"}
```

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

Use different login tokens to test RBAC:

```powershell
# Admin token
$admin = (Invoke-RestMethod -Uri "http://localhost:3001/api/auth/login" -Method Post `
  -Body '{"email":"admin@test.com","password":"password"}' -ContentType "application/json").token

# Approver (Line Manager) token
$approver = (Invoke-RestMethod -Uri "http://localhost:3001/api/auth/login" -Method Post `
  -Body '{"email":"sipho@test.com","password":"password"}' -ContentType "application/json").token

# Approver (HR) token
$hr = (Invoke-RestMethod -Uri "http://localhost:3001/api/auth/login" -Method Post `
  -Body '{"email":"lindiwe@test.com","password":"password"}' -ContentType "application/json").token

# Team Member token
$team = (Invoke-RestMethod -Uri "http://localhost:3001/api/auth/login" -Method Post `
  -Body '{"email":"nomvula@test.com","password":"password"}' -ContentType "application/json").token
```

## Test Coverage Summary

| File | Tests | What's tested |
|------|-------|---------------|
| `break.test.ts` | 72 | Auth attacks, JWT tampering, Zod validation, HTTP abuse, XSS, SQLi, rapid requests |
| `edge-cases.test.ts` | 50 | File uploads, mass assignment, self-approval, workflow order, race conditions, approver isolation, cross-user, export, preset users, workflow access, status escalation, data leaks, pre-approved create, file size, orphan files, double-delete, config/workflow coupling, null LM, cascade gap, token reuse, SLA dates |
| `declarations.test.ts` | 12 | CRUD, stats, submit, status change |
| `workflows.test.ts` | 8 | Pending list, instances, approve/decline/return |
| `auth.test.ts` | 7 | Login, me, preset users, RBAC |
| `reports.test.ts` | 8 | Breakdown, SLA, concentration, high-value, list, export |
| `admin/*.test.ts` | 25 | Dashboard, users CRUD, config CRUD, workflow rules CRUD, RBAC |

**Total backend: 182 tests** | **Frontend: 61 tests** | **Grand total: 243**
