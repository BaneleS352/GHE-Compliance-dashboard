# Workflow Configuration Guide

## Overview

Workflows determine the approval steps required for a declaration. The system uses three tiers based on declaration value:

| Tier | Value Range | Rule | Steps |
|------|-------------|------|-------|
| Low | ≤ mediumThreshold (default 250) | rule-1 | 1: Line Manager |
| Medium | > mediumThreshold, ≤ highThreshold (default 2000) | rule-2 | 2: Line Manager → HR |
| High | > highThreshold | rule-3 | 3: Line Manager → HR → CEO |

## How Rules Are Selected

1. User submits a declaration via `PATCH /:id/submit`
2. `createWorkflowSteps()` in `services/workflowService.ts` runs:
   ```typescript
   const config = await prisma.systemConfig.findFirst();
   const ruleId = determineRuleId(value, config.highValueThreshold, config.mediumValueThreshold);
   const rule = await prisma.workflowRule.findUnique({ where: { id: ruleId } });
   const stepDefs = JSON.parse(rule.steps);
   ```
3. Step definitions (roles + order) are loaded from the matched rule
4. Assignees are resolved from the `User` table:
   - `lineManager` → employee's `lineManager` field
   - `hr` → first user with role `approver` and department `HR`
   - `ceo` → first user with position `Group CEO`
5. The resolved steps (with actual user IDs) are stored as JSON in `WorkflowInstance.steps`

## Config ↔ Workflow Coupling

### Config Thresholds → Rule Selection

The `SystemConfig` fields `highValueThreshold` and `mediumValueThreshold` determine which rule is selected on submission:

```typescript
function determineRuleId(value, highThreshold, mediumThreshold): string {
  if (value > highThreshold) return "rule-3";
  if (value > mediumThreshold) return "rule-2";
  return "rule-1";
}
```

### What Changes Affect

| Change | New Submissions | Existing Workflow Instances |
|--------|----------------|---------------------------|
| Update `highValueThreshold` | Uses new threshold for rule selection | **Frozen** — existing steps unchanged |
| Update `mediumValueThreshold` | Uses new threshold for rule selection | **Frozen** — existing steps unchanged |
| Update rule steps | New submissions use new steps | **Frozen** — existing instances unchanged |
| Delete a rule | **New submissions crash (500)** — no rule found | Existing instances still work (steps are stored) |
| Delete system config | **New submissions crash (500)** — config not found | Existing instances still work |

### Frozen Workflows (By Design)

Once a declaration is submitted, its workflow steps are serialized to JSON in `WorkflowInstance.steps`. Subsequent changes to config thresholds or workflow rules do not modify existing instances. This prevents changing approval requirements for declarations already in flight.

## Step Resolution Details

### Line Manager Step
```typescript
assigneeId = employee.lineManager || "";
assigneeName = lm?.name || "Unknown";
```
If `lineManager` is null/empty, the step gets `assignee: ""` — **no user can ever approve this step**. The declaration is stuck.

### HR Step
```typescript
const hrUser = await prisma.user.findFirst({ where: { role: "approver", department: "HR" } });
assigneeId = hrUser?.id || "";
assigneeName = hrUser?.name || "HR";
```
If no HR approver exists, the step gets `assignee: ""` — stuck.

### CEO Step
```typescript
const ceoUser = await prisma.user.findFirst({ where: { position: "Group CEO" } });
assigneeId = ceoUser?.id || "";
assigneeName = ceoUser?.name || "CEO";
```
If no CEO user exists, the step gets `assignee: ""` — stuck.

## Admin Endpoints

### View Rules
`GET /api/admin/workflows/rules` — lists rules sorted by priority

### Create Rule
`POST /api/admin/workflows/rules`
```json
{
  "name": "Medium Value",
  "condition": "medium",
  "priority": 2,
  "steps": [{ "order": 1, "role": "lineManager", "label": "LM Review" }]
}
```
Valid roles: `lineManager`, `hr`, `ceo`

### Update Rule
`PUT /api/admin/workflows/rules/:id`
- Cannot add a role that has active pending steps in any existing workflow instance
- But CAN remove a role that has active pending steps (not guarded)

### Delete Rule
`DELETE /api/admin/workflows/rules/:id`
- Does not affect existing workflow instances
- **Will crash new submissions** that require this rule

### Update Config
`PUT /api/admin/config`
- All 5 fields required: `highValueThreshold`, `mediumValueThreshold`, `slaEscalationDays`, `maxDeclarationsPerCounterparty`, `emailTemplate`
- Affects new submissions only

## Decision Values

When an approver submits a decision via `POST /api/workflows/approve`, the `decision` field accepts one of the following values:

| Value | Effect on Step Status | Effect on Declaration Status |
|-------|----------------------|----------------------------|
| `accept` | `approved` | "Pending" (if more steps) or "Approved" (if final step) |
| `reject` | `declined` | "Declined" |
| `decline` | `declined` | "Declined" |
| `info` | `returned` | "Info Requested" |
| `return` | `returned` | "Info Requested" |
| `escalate` | `approved` | Preserves next pending step (does not advance to final) |
| `org` | `approved` | Legacy — still accepted |
| `foundation` | `approved` | Legacy — still accepted |

The new UI (`WorkflowTimeline` component) sends `accept`, `reject`, `decline`, `info`, and `escalate`. Legacy values (`return`, `org`, `foundation`) remain accepted for backward compatibility with existing data.

## Known Bugs

1. **Null lineManager** → unreviewable LM step (assignee: "")
2. **Deleting rule-3** → 500 on new high-value submissions
3. **Deleting system config** → 500 on any submission
4. **No step order enforcement** — HR can approve before LM
5. **No self-approval guard** — approver can approve own declaration
