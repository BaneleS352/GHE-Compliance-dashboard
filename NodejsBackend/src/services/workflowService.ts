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

/** Resolve the producing rule for a declaration value under current thresholds. */
export async function resolveRuleId(value: number): Promise<string> {
  const config = await prisma.systemConfig.findFirst();
  if (!config) throw new Error("System config not found");
  return determineRuleId(value, config.highValueThreshold, config.mediumValueThreshold);
}

export async function createWorkflowSteps(_declarationId: string, employeeId: string, value: number): Promise<WorkflowStep[]> {
  const ruleId = await resolveRuleId(value);
  const rule = await prisma.workflowRule.findUnique({ where: { id: ruleId } });
  if (!rule) throw new Error(`Workflow rule ${ruleId} not found`);

  // Phase 5: relational rule-step rows are the ONLY definition source.
  const rows = await (prisma as any).workflowRuleStep.findMany({
    where: { ruleId },
    orderBy: { order: "asc" },
  });
  const stepDefs: WorkflowStepDef[] = rows.map((r: any) => ({ order: r.order, role: r.role, label: r.label }));
  if (!Array.isArray(stepDefs) || stepDefs.length === 0) throw new Error(`Corrupt workflow rule steps for rule ${ruleId}`);
  const employee = await prisma.user.findUnique({ where: { id: employeeId } });
  if (!employee) throw new Error("Employee not found");

  // HR is global (organizationId null) — try same-org HR first, fallback to global, then any HR
  let hrUser: any = null;
  if (employee.organizationId) {
    hrUser = await prisma.user.findFirst({ where: { role: "approver", department: "HR", organizationId: employee.organizationId } });
  }
  if (!hrUser) {
    hrUser = await prisma.user.findFirst({ where: { role: "approver", department: "HR", organizationId: null } });
  }
  if (!hrUser) {
    hrUser = await prisma.user.findFirst({ where: { role: "approver", department: "HR" } });
  }

  const steps: WorkflowStep[] = [];

  const lmIds = stepDefs.filter((d) => d.role === "lineManager" && employee.lineManager).map(() => employee.lineManager!);
  const lmUsers = lmIds.length > 0 ? await prisma.user.findMany({ where: { id: { in: lmIds } } }) : [];
  const lmMap = new Map(lmUsers.map((u) => [u.id, u]));

  for (const def of stepDefs) {
    let assigneeId = "";
    let assigneeName = "";
    let isStale = false;

    if (def.role === "lineManager") {
      assigneeId = employee.lineManager || "";
      const lm = assigneeId ? lmMap.get(assigneeId) : null;
      if (assigneeId && !lm) isStale = true;
      assigneeName = lm?.name || (isStale ? "Unknown" : "Unknown");
    } else if (def.role === "hr") {
      assigneeId = hrUser?.id || "";
      assigneeName = hrUser?.name || "HR";
      if (assigneeId && !hrUser) isStale = true;
    }

    if (!assigneeId || isStale || assigneeId === employeeId) {
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
  // Phase 5: relational step rows are the only workflow state.
  const rows = await (prisma as any).workflowInstanceStep.findMany({
    where: { instanceId: declarationId },
    orderBy: { stepOrder: "asc" },
  });
  if (rows.length === 0) return null;
  const pending = rows.find((r: any) => r.status === "pending");
  if (!pending) return null;
  return {
    order: pending.stepOrder,
    role: pending.role,
    assignee: pending.assigneeId || "",
    assigneeName: pending.assigneeName,
    label: pending.label,
    status: pending.status,
    decision: pending.decision ?? null,
    approvedAt: null,
    notes: pending.notes ?? "",
    decidedAt: pending.decidedAt ? new Date(pending.decidedAt).toISOString() : null,
    decidedById: pending.decidedById ?? null,
    decidedByName: pending.decidedByName ?? null,
  };
}

export function isApprovalDecision(decision: string): boolean {
  return ["accept", "org", "foundation"].includes(decision);
}

// ─── Shared helpers for route response formatting ──────────────────────────────
export function safeJsonParse(val: string | null | undefined): any {
  if (!val) return null;
  try { return JSON.parse(val); } catch { return null; }
}

function toISODate(d: Date | string | null | undefined): string {
  if (!d) return "";
  try {
    const dt = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(dt.getTime())) return "";
    return dt.toISOString().slice(0, 10);
  } catch { return ""; }
}

/**
 * Phase 5: builds the stable user-facing Declaration shape from the
 * normalized tables (Snapshot + Detail + Counterparty + User joins + file
 * join rows). No legacy Declaration text/JSON column is read — the response
 * contract is unchanged so the frontend needs no migration.
 *
 * Callers must include: snapshot, detail, counterpartyRef, declarer (with
 * team + organization), currentApprover, organization, fileLinks (with file).
 * Missing relations degrade to "" / [] rather than throwing, so list views
 * with partial includes still render.
 */
export function declarationResponse(d: any) {
  const snap = d.snapshot || null;
  const det = d.detail || null;
  const cpName: string = d.counterpartyRef?.name ?? d.counterparty ?? "";
  const declarer = d.declarer || null;
  const approverUser = d.currentApprover || null;
  const files = Array.isArray(d.fileLinks)
    ? d.fileLinks.map((l: any) => {
        const f = l.file || {};
        return {
          id: f.id || l.fileId,
          name: f.originalName || f.name || "",
          size: f.size ?? 0,
          type: f.mimeType || f.type || "",
          url: `/api/files/${f.id || l.fileId}`,
          uploadedAt: f.uploadedAt || l.createdAt || null,
        };
      })
    : Array.isArray(d.files)
      ? d.files
      : [];
  return {
    id: d.id,
    employee: snap?.declarerName ?? declarer?.name ?? "",
    employeeId: d.declarerUserId ?? "",
    teamMemberNumber: snap?.employeeNumber ?? declarer?.teamMemberNumber ?? "",
    lineManager: snap?.managerDisplayName ?? "",
    position: snap?.positionTitle ?? declarer?.position ?? "",
    department: snap?.department ?? declarer?.department ?? "",
    company: d.organization?.name ?? declarer?.organization?.name ?? null,
    team: declarer?.team?.name ?? null,
    type: d.type,
    counterparty: cpName,
    value: d.value,
    submitted: toISODate(d.submittedAt),
    approver: approverUser?.name ?? "",
    approverId: d.currentApproverUserId || null,
    status: d.status,
    priority: d.priority,
    description: det?.description ?? "",
    relationship: det?.relationship ?? "",
    receivedGiven: det?.receivedGiven ?? "",
    from: det?.fromField ?? "",
    contactPerson: det?.contactPerson ?? "",
    biddingProcess: det?.biddingProcess ?? "",
    contractNegotiation: det?.contractNegotiation ?? null,
    occasion: det?.occasion ?? "",
    date: toISODate(d.eventDate),
    instances: det?.instances ?? "",
    publicOfficial: det?.publicOfficial ?? "",
    substantiation: det?.substantiation ?? null,
    files,
    organizationId: d.organizationId || null,
  };
}

/** Standard includes for a single/full declaration response. */
export const declarationIncludes = {
  snapshot: true,
  detail: true,
  counterpartyRef: true,
  declarer: { include: { team: true, organization: true } },
  currentApprover: true,
  organization: true,
  fileLinks: { include: { file: true } },
} as const;
