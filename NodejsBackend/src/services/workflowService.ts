import { prisma } from "../config/prisma";
import { toDbId, toJsonId } from "./ids";

export interface WorkflowStepDef {
  order: number;
  role: "lineManager" | "hr";
  label: string;
}

export interface WorkflowStep {
  order: number;
  role: "lineManager" | "hr";
  assignee: number | null;
  assigneeName: string;
  label: string;
  status: "pending" | "approved" | "declined" | "returned" | "skipped";
  decision: string | null;
  approvedAt: string | null;
  notes: string;
  decidedAt: string | null;
  decidedById: number | null;
  decidedByName: string | null;
}

export function determineRuleId(value: number, highThreshold: number, _mediumThreshold: number): bigint {
  // 2-tier workflow: < high → LM only (rule 1), >= high → LM + HR (rule 2). mediumThreshold is legacy, kept for API compatibility.
  if (value >= highThreshold) return 2n;
  return 1n;
}

/** Resolve the producing rule for a declaration value under current thresholds. */
export async function resolveRuleId(value: number): Promise<bigint> {
  const config = await prisma.systemConfig.findFirst();
  if (!config) throw new Error("System config not found");
  return determineRuleId(value, config.highValueThreshold, config.mediumValueThreshold);
}

export async function createWorkflowSteps(_declarationPk: bigint | string | number, employeeId: bigint | number, value: number): Promise<WorkflowStep[]> {
  const ruleId = await resolveRuleId(value);
  const rule = await prisma.workflowRule.findUnique({ where: { id: ruleId } });
  if (!rule) throw new Error(`Workflow rule ${ruleId} not found`);

  // Row-only step definitions (no JSON fallback exists).
  const rows = await prisma.workflowRuleStep.findMany({
    where: { ruleId },
    orderBy: { order: "asc" },
  });
  const stepDefs: WorkflowStepDef[] = rows.map((r: any) => ({ order: r.order, role: r.role, label: r.label }));
  if (!Array.isArray(stepDefs) || stepDefs.length === 0) throw new Error(`Corrupt workflow rule steps for rule ${ruleId}`);
  const employee = await prisma.user.findUnique({ where: { id: toDbId(employeeId) } });
  if (!employee) throw new Error("Employee not found");

  // HR is global (organizationId null) — try same-org HR first, fallback to global, then any HR
  let hrUser: any = null;
  if (employee.organizationId !== null && employee.organizationId !== undefined) {
    hrUser = await prisma.user.findFirst({ where: { role: "approver", department: "HR", organizationId: employee.organizationId } });
  }
  if (!hrUser) {
    hrUser = await prisma.user.findFirst({ where: { role: "approver", department: "HR", organizationId: null } });
  }
  if (!hrUser) {
    hrUser = await prisma.user.findFirst({ where: { role: "approver", department: "HR" } });
  }

  const steps: WorkflowStep[] = [];
  const declarerPk = toJsonId(employee.id);

  // The authoritative manager reference is the managerId FK; lineManager is
  // display text only.
  let lmUser: any = null;
  if (employee.managerId !== null && employee.managerId !== undefined) {
    lmUser = await prisma.user.findUnique({ where: { id: employee.managerId } });
  }

  for (const def of stepDefs) {
    let assigneeId: number | null = null;
    let assigneeName = "";
    let isStale = false;

    if (def.role === "lineManager") {
      if (employee.managerId !== null && employee.managerId !== undefined) {
        assigneeId = toJsonId(employee.managerId);
        if (!lmUser) isStale = true;
        assigneeName = lmUser?.name || "Unknown";
      } else {
        assigneeName = "Unknown";
      }
    } else if (def.role === "hr") {
      assigneeId = hrUser ? toJsonId(hrUser.id) : null;
      assigneeName = hrUser?.name || "HR";
      if (assigneeId && !hrUser) isStale = true;
    }

    if (assigneeId === null || isStale || assigneeId === declarerPk) {
      steps.push({
        order: def.order,
        role: def.role,
        assignee: assigneeId,
        assigneeName,
        label: def.label,
        status: "skipped",
        decision: null,
        approvedAt: null,
        notes: assigneeId === null ? "No assignee found - step skipped" : "Self-approval - step skipped",
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

export async function getCurrentStep(declarationPk: bigint | number): Promise<WorkflowStep | null> {
  // Relational step rows are the only workflow state.
  const rows = await prisma.workflowInstanceStep.findMany({
    where: { declarationPk: toDbId(declarationPk) },
    orderBy: { stepOrder: "asc" },
  });
  if (rows.length === 0) return null;
  const pending = rows.find((r: any) => r.status === "pending");
  if (!pending) return null;
  return rowToStep(pending);
}

export function rowToStep(r: any): WorkflowStep {
  return {
    order: r.stepOrder ?? r.order,
    role: r.role,
    assignee: r.assigneeId === null || r.assigneeId === undefined ? null : toJsonId(r.assigneeId),
    assigneeName: r.assigneeName,
    label: r.label,
    status: r.status,
    decision: r.decision ?? null,
    approvedAt: r.status === "approved" && r.decidedAt ? new Date(r.decidedAt).toISOString() : (r.approvedAt ?? null),
    notes: r.notes ?? "",
    decidedAt: r.decidedAt ? new Date(r.decidedAt).toISOString() : null,
    decidedById: r.decidedById === null || r.decidedById === undefined ? null : toJsonId(r.decidedById),
    decidedByName: r.decidedByName ?? null,
  };
}

export function isApprovalDecision(decision: string): boolean {
  return ["accept", "org", "foundation"].includes(decision);
}

// ─── Shared helpers for route response formatting ──────────────────────────────
function toISODate(d: Date | string | null | undefined): string {
  if (!d) return "";
  try {
    const dt = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(dt.getTime())) return "";
    return dt.toISOString().slice(0, 10);
  } catch { return ""; }
}

/**
 * Builds the stable user-facing Declaration shape from the normalized
 * tables (Snapshot + Detail + Counterparty + User joins + file join rows).
 * Numeric identifiers are exposed as JSON numbers.
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
        const fid = f.id !== undefined ? toJsonId(f.id) : l.fileId;
        return {
          id: fid,
          name: f.originalName || f.name || "",
          size: f.size ?? 0,
          type: f.mimeType || f.type || "",
          url: `/api/files/${fid}`,
          uploadedAt: f.uploadedAt || l.createdAt || null,
        };
      })
    : Array.isArray(d.files)
      ? d.files
      : [];
  return {
    id: d.id,
    employee: snap?.declarerName ?? declarer?.name ?? "",
    employeeId: d.declarerUserId === null || d.declarerUserId === undefined ? null : toJsonId(d.declarerUserId),
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
    approverId: d.currentApproverUserId === null || d.currentApproverUserId === undefined ? null : toJsonId(d.currentApproverUserId),
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
    organizationId: d.organizationId === null || d.organizationId === undefined ? null : toJsonId(d.organizationId),
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
