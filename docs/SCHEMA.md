# Database Schema

**ORM:** Prisma 6
**File:** `NodejsBackend/prisma/schema.prisma`
**Provider:** PostgreSQL (only). All internal keys are BIGINT identity columns;
`Declaration.id` stays the public `GHE-YYYY-NNNNNN` text reference with an
internal numeric `declarationPk` that normalized children reference.
Numeric ids are exposed as JSON numbers (see `services/ids.ts`).

## Entity Relationship Diagram (Text)

```
Organization ──(1:N)──> Department ──(1:N)──> Team ──(1:N)──> User
User ──(self-FK managerId)──> User
User ──(1:N)──> Declaration  (declarerUserId / currentApproverUserId, SetNull)
Declaration ──(1:1)──> DeclarationSnapshot / DeclarationDetail (immutable history)
Declaration ──(1:N)──> DeclarationFile ──(N:1)──> UploadedFile (join-only)
Declaration ──(1:1)──> WorkflowInstance ──(1:N)──> WorkflowInstanceStep
WorkflowRule ──(1:N)──> WorkflowRuleStep
Counterparty ──(1:N)──> Declaration; Counterparty ──(1:N)──> CounterpartyContact
SystemConfig (1 record) configures thresholds
```

## Models

### User
| Field | Type | Notes |
|-------|------|-------|
| id | BigInt @id | Numeric user key (JWT `id`, API ids) |
| name | String | |
| email | String @unique | Used for login |
| passwordHash | String | bcrypt hash |
| role | String | "admin", "approver", "teamMember" (authoritative authorization source) |
| teamMemberNumber | String | Employee number (business code, not a key) |
| departmentId | BigInt? | Sole department source (`Department` FK, SetNull). The legacy `department` text column was removed in `0008_department_id_only`; display values derive from the related record. Links are not organization-constrained (master-data vocabulary); unscoped users resolve to `""` |
| position | String | User's job position |
| lineManager | String? | Display text only; the authoritative manager reference is `managerId` |
| managerId | BigInt? | Self-FK to User.id (SetNull) |
| organizationId / departmentId / teamId | BigInt? | FKs to master data |

### Declaration
| Field | Type | Notes |
|-------|------|-------|
| id | String @id | Public reference: `GHE-YYYY-NNNNNN` (never replaced) |
| declarationPk | BigInt @unique | Internal key; all child rows reference this |
| type / value / status / priority | String / Float / String / String | Validated strings + non-negative value |
| eventDate / submittedAt | DateTime? | Canonical timestamps (UTC) |
| declarerUserId / currentApproverUserId / counterpartyId / organizationId | BigInt? | Enforced FKs (SetNull / Restrict) |

The user-facing Declaration shape (employee/counterparty/approver names,
detail fields, files) is built by `declarationResponse` from
Snapshot/Detail/Counterparty/User joins. The schema file is authoritative for
exact types and defaults.

### WorkflowInstance
| Field | Type | Notes |
|-------|------|-------|
| id | BigInt @id | Numeric instance key |
| declarationPk | BigInt @unique | One-to-one numeric declaration reference |
| ruleId | BigInt? | Producing rule (SetNull) |

Each step (`WorkflowInstanceStep`, numeric `instanceId` + `declarationPk`,
unique `(instanceId, stepOrder)`, numeric `assigneeId`/`decidedById`):
```json
{
  "order": 1,
  "role": "lineManager",
  "assignee": 2,
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
| id | BigInt @id | Numeric rule key (seed rules are 1 and 2) |
| name | String | |
| condition | String | "low", "high" |
| priority | Int | Sort order |
| steps | — | `WorkflowRuleStep` rows (unique `(ruleId, order)`); no JSON column |

### SystemConfig
| Field | Type | Default |
|-------|------|---------|
| highValueThreshold | Float | 1000 |
| mediumValueThreshold | Float | 1000 |
| slaEscalationDays | Int | 3 |
| maxDeclarationsPerCounterparty | Int | 5 |
| maximumValue | Float | 1,000,000; declarations above this are blocked |
| emailTemplate | String | Legacy single-template field |
| notificationTemplates | String | JSON object containing the five validated event templates |

### UploadedFile
| Field | Type | Notes |
|-------|------|-------|
| id | String @id | cuid |
| originalName | String | |
| mimeType | String | |
| size | Int | |
| path | String | File name on disk |

File association is join-only: `DeclarationFile` links a declaration to a
file. **File lifecycle policy (decided): unattached temporary uploads are not
supported — every file requires its declaration link.** Upload creates
metadata + join row in one transaction so orphans cannot be created through
the API; `UploadedFile.link` is a required back-relation. Files without a
join row (pre-policy data, if any) are admin-quarantined on read (403 for
non-admins) and cascade-removed with their declaration. `pg:test` asserts a
zero orphan-file count.

### Workflow step identity

`WorkflowInstanceStep.declarationPk` duplicates the instance's key for
reporting joins, but the composite foreign key
`WorkflowInstanceStep(instanceId, declarationPk) → WorkflowInstance(id,
declarationPk)` (migration `0007_step_identity`) proves both values identify
the same declaration. A step row cannot reference an instance of one
declaration while carrying another declaration's key; mismatched writes fail
with a foreign-key violation (proven by `pg:test`).

### Other Models
- **ApprovalOption** — Decision options (accept, org, foundation, decline, return)

Phase 5 retirements (see `NodejsBackend/prisma/RETIREMENT.md`): the
`Dropdowns` JSON table (now Department master data + fixed domain lists),
static `ComplianceTrendPoint`/`TypeBreakdownItem` tables (now reporting
views), `AppRole`/`UserRole` (authorization is `User.role`),
`OrganizationSetting` (config is `SystemConfig`), and the unenforced `Ref*`
lookup copies were removed.

## Notification Templates

`SystemConfig.notificationTemplates` stores the administrator-editable subject/body pair for each event: manager approval, HR approval, returned, declined, and approved. The backend validates the complete object and renders supported placeholders before posting to the configured email webhook.

## Key Business Rules

- Values at or above `highValueThreshold` use the high-value workflow and appear in the high-value report.
- HR step routing resolves through department links, deterministically ordered:
  same-organization HR link first, then a global approver carrying an HR
  link, then any global approver, then any HR-linked approver (`services/workflowService.ts`).
- Returned declarations are re-evaluated when saved/resubmitted; newly required approvers are added while valid completed approvals are preserved.
- Report date filters are inclusive.
- **Declaration status/approver ownership (decided):** `Declaration.status`
  and `currentApproverUserId` are deliberately maintained cache columns
  summarizing the workflow step rows (they power lists/reports without step
  joins). Step rows are the facts; the cache is rewritten in the SAME
  transaction as the steps on every path that (re)builds them (create sets
  Draft, submit sets Pending + first pending assignee, approve sets the
  outcome + next assignee, Returned PUT re-derives the approver from the
  rebuilt first pending step). The only exception is the guarded admin status
  override (`PATCH /:id/status`), a terminal-state escape hatch that requires
  no pending steps and leaves rows untouched. Divergence is detected by
  regression tests asserting status/approver against the step rows after
  submit, approvals, Returned edits, and overrides.
- **Organization consistency invariant (service-level, `services/orgConsistency.ts`):**
  whenever a user row carries an `organizationId` and references a manager,
  both organizations must match; a `NULL` (global) value on either side is
  always allowed. Enforced on admin user create/update (400 on violation);
  counterparty links are structurally scoped by `ensureCounterparty`, and
  declaration organization is derived from the caller (non-admin writes cannot
  spoof it). Composite database FKs stay impractical while the links are
  nullable by design, so this module plus the multi-tenant negative tests are
  the enforcement point — route query filters alone are not trusted.
- **Counterparty identity policy (decided):** counterparty names are unique per
  organization, enforced by the partial unique index
  `Counterparty_name_org_unique ... WHERE "organizationId" IS NOT NULL`
  (migration `0006_numeric_keys`). Global (`NULL`-org) rows are explicitly
  exempt and may share a name — they are unscoped fallback rows, not the
  canonical registry. Concurrent scoped creates resolve via the P2002
  re-read in `ensureCounterparty`; `pg:test` proves both halves
  ("scoped duplicate counterparty rejected", "global same-name counterparties
  allowed").

## Cascade behavior (Phase 5)

| Action | Result |
|--------|--------|
| Delete draft declaration | Workflow instance + step rows, snapshot, detail, file joins + file rows, and disk files are removed |
| Delete user | Declarations survive with `declarerUserId`/`currentApproverUserId` set to NULL (history stays in the immutable snapshot); step assignee links NULL the same way |
| Delete workflow rule | Existing `WorkflowInstance` rows survive with `ruleId` set to NULL |
| Delete counterparty | Linked declarations survive with `counterpartyId` set to NULL |

## Key Business Rules (Not Enforced by DB)

- Team members see only their own declarations in the list endpoint (enforced in-app, not in DB)
- Approvers can see all declarations (no DB constraint)
- Declaration `priority`, relationship/direction strings, and the Yes/No-style
  detail fields are validated strings (zod + valid-status lists), not
  FK-backed references

## Domain integrity (enforced by DB since 0009)

- `Declaration.status` ∈ Draft/Pending/Approved/Declined/Escalated/Returned
- `Declaration.type` ∈ Gift/Hospitality/Entertainment
- `WorkflowInstanceStep.status` ∈ pending/approved/declined/returned/skipped
- `WorkflowInstanceStep.role` and `WorkflowRuleStep.role` ∈ lineManager/hr
- Application validation rejects these first; the CHECK constraints defend
  writers that reach past the API. `pg:test` proves invalid values fail.
