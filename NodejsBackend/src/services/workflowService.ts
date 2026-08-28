import { prisma } from "../config/prisma";

export interface WorkflowStepDef {
  order: number;
  role: "lineManager" | "hr";
  label: string;
}

export interface WorkflowStep {
  order: number;
  role: "lineManager" | "hr";
  assignee: string;
  assigneeName: string;
  label: string;
  status: "pending" | "approved" | "declined" | "returned" | "skipped";
  decision: string | null;
  approvedAt: string | null;
  notes: string;
  decidedAt: string | null;
  decidedById: string | null;
  decidedByName: string | null;
}

export function determineRuleId(value: number, highThreshold: number, _mediumThreshold: number): string {
  // 2-tier workflow: < high → LM only (rule-1), >= high → LM + HR (rule-2). mediumThreshold is legacy, kept for API compatibility.
  if (value >= highThreshold) return "rule-2";
  return "rule-1";
}

export async function createWorkflowSteps(declarationId: string, employeeId: string, value: number): Promise<WorkflowStep[]> {
  const config = await prisma.systemConfig.findFirst();
  if (!config) throw new Error("System config not found");

  const ruleId = determineRuleId(value, config.highValueThreshold, config.mediumValueThreshold);
  const rule = await prisma.workflowRule.findUnique({ where: { id: ruleId } });
  if (!rule) throw new Error(`Workflow rule ${ruleId} not found`);

  let stepDefs: WorkflowStepDef[];
  try { stepDefs = JSON.parse(rule.steps); } catch { throw new Error(`Corrupt workflow rule steps for rule ${ruleId}`); }
  const employee = await prisma.user.findUnique({ where: { id: employeeId } });
  if (!employee) throw new Error("Employee not found");

  const hrWhere: any = { role: "approver", department: "HR" };
  if (employee.organizationId) hrWhere.organizationId = employee.organizationId;
  const hrUser = await prisma.user.findFirst({ where: hrWhere });

  const steps: WorkflowStep[] = [];

  const lmIds = stepDefs.filter((d) => d.role === "lineManager" && employee.lineManager).map(() => employee.lineManager!);
  const lmUsers = lmIds.length > 0 ? await prisma.user.findMany({ where: { id: { in: lmIds } } }) : [];
  const lmMap = new Map(lmUsers.map((u) => [u.id, u]));

  for (const def of stepDefs) {
    let assigneeId = "";
    let assigneeName = "";

    if (def.role === "lineManager") {
      assigneeId = employee.lineManager || "";
      const lm = assigneeId ? lmMap.get(assigneeId) : null;
      assigneeName = lm?.name || "Unknown";
    } else if (def.role === "hr") {
      assigneeId = hrUser?.id || "";
      assigneeName = hrUser?.name || "HR";
    }

    if (!assigneeId || assigneeId === employeeId) {
      steps.push({
        order: def.order,
        role: def.role,
        assignee: assigneeId,
        assigneeName,
        label: def.label,
        status: "skipped",
        decision: null,
        approvedAt: null,
        notes: !assigneeId ? "No assignee found - step skipped" : "Self-approval - step skipped",
        decidedAt: null,
        decidedById: null,
        decidedByName: null,
      });
      continue;
    }

    steps.push({
      order: def.order,
      role: def.role,
      assignee: assigneeId,
      assigneeName,
      label: def.label,
      status: "pending",
      decision: null,
      approvedAt: null,
      notes: "",
      decidedAt: null,
      decidedById: null,
      decidedByName: null,
    });
  }

  return steps;
}

export async function getCurrentStep(declarationId: string): Promise<WorkflowStep | null> {
  const instance = await prisma.workflowInstance.findUnique({ where: { declarationId } });
  if (!instance) return null;
  let steps: WorkflowStep[];
  try { steps = JSON.parse(instance.steps); } catch { return null; }
  return steps.find((s) => s.status === "pending") || null;
}

export async function getFirstPendingStep(declarationId: string): Promise<WorkflowStep | null> {
  return getCurrentStep(declarationId);
}

export function isApprovalDecision(decision: string): boolean {
  return ["accept", "org", "foundation"].includes(decision);
}

// ─── Shared helpers for route response formatting ──────────────────────────────
export function safeJsonParse(val: string | null | undefined): any {
  if (!val) return null;
  try { return JSON.parse(val); } catch { return null; }
}

export function declarationResponse(d: any) {
  const parsed = safeJsonParse(d.files);
  return {
    id: d.id,
    employee: d.employee,
    employeeId: d.employeeId,
    teamMemberNumber: d.teamMemberNumber,
    lineManager: d.lineManager,
    position: d.position,
    department: d.department,
    company: d.company,
    team: d.team,
    type: d.type,
    counterparty: d.counterparty,
    value: d.value,
    submitted: d.submitted,
    approver: d.approver,
    approverId: d.approverId || null,
    status: d.status,
    priority: d.priority,
    description: d.description,
    relationship: d.relationship,
    receivedGiven: d.receivedGiven,
    from: d.fromField,
    contactPerson: d.contactPerson,
    biddingProcess: d.biddingProcess,
    contractNegotiation: d.contractNegotiation,
    occasion: d.occasion,
    date: d.date,
    instances: d.instances,
    publicOfficial: d.publicOfficial,
    substantiation: d.substantiation,
    files: parsed || [],
    organizationId: d.organizationId || null,
  };
}
