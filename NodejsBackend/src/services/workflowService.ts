import { prisma } from "../config/prisma";

export interface WorkflowStepDef {
  order: number;
  role: "lineManager" | "hr" | "ceo";
  label: string;
}

export interface WorkflowStep {
  order: number;
  role: "lineManager" | "hr" | "ceo";
  assignee: string;
  assigneeName: string;
  label: string;
  status: "pending" | "approved" | "declined" | "returned";
  decision: string | null;
  notes: string;
  decidedAt: string | null;
}

export function determineRuleId(value: number, highThreshold: number, mediumThreshold: number): string {
  if (value > highThreshold) return "rule-3";
  if (value > mediumThreshold) return "rule-2";
  return "rule-1";
}

export async function createWorkflowSteps(declarationId: string, employeeId: string, value: number): Promise<WorkflowStep[]> {
  const config = await prisma.systemConfig.findFirst();
  if (!config) throw new Error("System config not found");

  const ruleId = determineRuleId(value, config.highValueThreshold, config.mediumValueThreshold);
  const rule = await prisma.workflowRule.findUnique({ where: { id: ruleId } });
  if (!rule) throw new Error(`Workflow rule ${ruleId} not found`);

  const stepDefs: WorkflowStepDef[] = JSON.parse(rule.steps);
  const employee = await prisma.user.findUnique({ where: { id: employeeId } });
  if (!employee) throw new Error("Employee not found");

  const hrUser = await prisma.user.findFirst({ where: { role: "approver", department: "HR" } });
  const ceoUser = await prisma.user.findFirst({ where: { position: "Group CEO" } });

  const steps: WorkflowStep[] = [];
  for (const def of stepDefs) {
    let assigneeId = "";
    let assigneeName = "";

    if (def.role === "lineManager") {
      assigneeId = employee.lineManager || "";
      const lm = assigneeId ? await prisma.user.findUnique({ where: { id: assigneeId } }) : null;
      assigneeName = lm?.name || "Unknown";
    } else if (def.role === "hr") {
      assigneeId = hrUser?.id || "";
      assigneeName = hrUser?.name || "HR";
    } else if (def.role === "ceo") {
      assigneeId = ceoUser?.id || "";
      assigneeName = ceoUser?.name || "CEO";
    }

    if (!assigneeId || assigneeId === employeeId) continue;

    steps.push({
      order: def.order,
      role: def.role,
      assignee: assigneeId,
      assigneeName,
      label: def.label,
      status: "pending",
      decision: null,
      notes: "",
      decidedAt: null,
    });
  }

  return steps;
}

export async function getCurrentStep(declarationId: string): Promise<WorkflowStep | null> {
  const instance = await prisma.workflowInstance.findUnique({ where: { declarationId } });
  if (!instance) return null;
  const steps: WorkflowStep[] = JSON.parse(instance.steps);
  return steps.find((s) => s.status === "pending") || null;
}

export async function getFirstPendingStep(declarationId: string): Promise<WorkflowStep | null> {
  return getCurrentStep(declarationId);
}

export function isApprovalDecision(decision: string): boolean {
  return ["accept", "org", "foundation"].includes(decision);
}
