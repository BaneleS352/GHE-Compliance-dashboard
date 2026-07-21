# Database Schema

**ORM:** Prisma 6  
**File:** `NodejsBackend/prisma/schema.prisma`  
**Provider:** SQLite (dev) / PostgreSQL (prod)

## Entity Relationship Diagram (Text)

```
User ──(1:N)──> Declaration  (via employeeId)
User ──(1:N)──> Declaration  (as lineManager reference, loose)
WorkflowRule (1:1) used by createWorkflowSteps()
SystemConfig (1 record) configures thresholds
WorkflowInstance ──(1:1)──> Declaration  (via declarationId)
UploadedFile ──(N:1)──> Declaration  (via declarationId, optional, no FK constraint)
```

## Models

### User
| Field | Type | Notes |
|-------|------|-------|
| id | String @id | e.g. "user-admin", "user-team" |
| name | String | |
| email | String @unique | Used for login |
| passwordHash | String | bcrypt hash |
| role | String | "admin", "approver", "teamMember" |
| teamMemberNumber | String | Employee number |
| department | String | |
| position | String | e.g. "Group CEO" (used for CEO step resolution) |
| lineManager | String? | References another User's id. Null = no manager |

### Declaration
| Field | Type | Notes |
|-------|------|-------|
| id | String @id | Auto-generated: `GHE-YYYY-NNNNNN` |
| employee | String | Employee name |
| employeeId | String | FK to User.id (loose — no constraint) |
| status | String | Draft, Pending, Approved, Declined, Escalated, Info Requested |
| value | Float | Declaration monetary value |
| files | String? | JSON array of file references |
| fromField | String | Mapped from `from` (Prisma `@map("from_field")`) |

**Full field list:** 30+ fields covering declaration metadata, compliance details, and workflow tracking.

### WorkflowInstance
| Field | Type | Notes |
|-------|------|-------|
| declarationId | String @id | FK to Declaration.id (loose) |
| steps | String | JSON array of WorkflowStep objects |

Each step:
```json
{
  "order": 1,
  "role": "lineManager",
  "assignee": "user-approver",
  "assigneeName": "Sipho Approver",
  "label": "Line Manager Review",
  "status": "pending",
  "decision": null,
  "notes": "",
  "decidedAt": null
}
```

### WorkflowRule
| Field | Type | Notes |
|-------|------|-------|
| id | String @id | rule-1, rule-2, rule-3 or custom |
| name | String | |
| condition | String | "low", "medium", "high" |
| priority | Int | Sort order |
| steps | String | JSON array of `{ order, role, label }` |

### SystemConfig
| Field | Type | Default |
|-------|------|---------|
| highValueThreshold | Float | 2000 |
| mediumValueThreshold | Float | 250 |
| slaEscalationDays | Int | 3 |
| maxDeclarationsPerCounterparty | Int | 5 |
| emailTemplate | String | Template string |

### UploadedFile
| Field | Type | Notes |
|-------|------|-------|
| id | String @id | cuid |
| declarationId | String? | Loose reference — no FK constraint |
| originalName | String | |
| mimeType | String | |
| size | Int | |
| path | String | File name on disk |

### Other Models
- **Dropdowns** — JSON data for form dropdown options
- **ComplianceTrendPoint** — Monthly approval/decline counts (dashboard)
- **TypeBreakdownItem** — Declaration type stats (dashboard)
- **ApprovalOption** — Decision options (accept, org, foundation, decline, return)

## Cascade Gaps

| Action | Orphans |
|--------|---------|
| Delete declaration | UploadedFile records (DB + disk) remain |
| Delete declaration | WorkflowInstance record remains |
| Delete user | User's declarations remain (employeeId not updated) |
| Delete workflow rule | Existing WorkflowInstance records remain |

## Key Business Rules (Not Enforced by DB)

- Team members see only their own declarations in the list endpoint (enforced in-app, not in DB)
- Approvers can see all declarations (no DB constraint)
- Workflow step order is logical (order field) but not enforced in approve handler
- File associations to declarations are loose strings, not FK constraints
