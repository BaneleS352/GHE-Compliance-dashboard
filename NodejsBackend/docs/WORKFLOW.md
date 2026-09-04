# Workflow Configuration Guide

## Overview

Workflows determine the approval steps required for a declaration. The system uses three tiers based on declaration value:

| Tier | Value Range | Rule | Steps |
|------|-------------|------|-------|
| Standard | < highValueThreshold (seed default 1000) | rule-1 | 1: Line Manager |
| High | ≥ highValueThreshold (seed default 1000) | rule-2 | 2: Line Manager → HR |

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
5. The resolved steps (with actual user IDs) are stored as JSON in `WorkflowInstance.steps`

## Config ↔ Workflow Coupling

### Config Thresholds → Rule Selection

The `SystemConfig` fields `highValueThreshold` and `mediumValueThreshold` determine which rule is selected on submission:

```typescript
function determineRuleId(value, highThreshold, mediumThreshold): string {
  if (value >= highThreshold) return "rule-2";
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

Pending workflows remain stable when administrators change rules. A returned declaration is re-evaluated when the employee saves/resubmits it: if its value now meets the high-value threshold, the HR step is added and valid completed approvals are preserved.

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
Valid roles: `lineManager`, `hr`

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
- Required configuration fields: `highValueThreshold`, `mediumValueThreshold`, `slaEscalationDays`, `maxDeclarationsPerCounterparty`, `emailTemplate`, and validated `notificationTemplates`.

Notification events are delivered through `EMAIL_WEBHOOK_URL`; without that environment variable, local development logs the event only.
- Affects new submissions only

## Decision Values

When an approver submits a decision via `POST /api/workflows/approve`, the `decision` field accepts one of the following values:

| Value | Effect on Step Status | Effect on Declaration Status |
|-------|----------------------|----------------------------|
| `accept` | `approved` | "Pending" (if more steps) or "Approved" (if final step) |
| `decline` | `declined` | "Declined" |
| `return` | `returned` | "Returned" |
| `org` | `approved` | Legacy — still accepted |
| `foundation` | `approved` | Legacy — still accepted |

The current UI (`WorkflowTimeline` component) sends the configured approval options: `return`, `accept`, `org`, `foundation`, and `decline`. These are also the values documented by the backend Swagger schema. Do not describe `reject`, `info`, or `escalate` as current UI decisions unless the backend and frontend are intentionally changed to support them.

## Known Bugs

1. **Null lineManager** → unreviewable LM step (assignee: "")
2. **Deleting rule-2** → 500 on new high-value submissions
3. **Deleting system config** → 500 on any submission
4. **Step order is enforced** — downstream approvers cannot action a step before earlier steps are approved.
5. **Self-approval is blocked** — a user cannot approve their own declaration; invalid self-assigned steps are not actionable.

## Self-Approval Guard

Approval requests verify the authenticated user's role, assigned step, declaration ownership, and workflow order. A user cannot approve their own declaration. The exact workflow step list is created from the matched rule and stored in the workflow instance.

### Scenarios

| Creator | Skipped Steps | Remaining Steps |
|---------|---------------|-----------------|
| Team member | None | All rule-defined steps (normal flow) |
| Line Manager | None | All rule-defined Line Manager steps |
| HR approver | HR step | Line Manager step |
