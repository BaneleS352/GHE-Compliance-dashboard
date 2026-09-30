import { prisma } from "../config/prisma";
import type { WorkflowStep } from "./workflowService";

/**
 * Phase 5 normalized writers (DATABASE-NORMALIZATION-GOAL cutover complete).
 *
 * There is exactly one store: relational rows. Legacy JSON/text columns no
 * longer exist, so there is no dual-write, no fallback read, and no mirror
 * to keep in sync. Every writer below runs inside the caller's transaction.
 */

export function parseDateSafe(val: string | null | undefined): Date | null {
  if (!val) return null;
  const s = String(val).trim();
  if (!s) return null;
  // Accept YYYY-MM-DD (declaration calendar dates) and ISO strings.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) {
    const d = new Date(`${s}T00:00:00.000Z`);
    // Reject impossible calendar dates: JS rolls "2026-02-30" over to Mar 2
    // instead of failing, which would store a wrong-but-plausible eventDate.
    if (
      Number.isNaN(d.getTime()) ||
      d.getUTCFullYear() !== Number(m[1]) ||
      d.getUTCMonth() + 1 !== Number(m[2]) ||
      d.getUTCDate() !== Number(m[3])
    ) {
      return null;
    }
    return d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function ensureCounterparty(
  name: string,
  organizationId: string | null,
  contactName?: string | null,
  db: any = prisma,
): Promise<{ id: string } | null> {
  const clean = String(name || "").trim();
  if (!clean) return null;
  const existing = await (db as any).counterparty.findFirst({
    where: { name: clean, organizationId: organizationId || null },
    select: { id: true },
  });
  if (existing) return existing;
  try {
    return await (db as any).counterparty.create({
      data: {
        name: clean,
        organizationId: organizationId || null,
        contactName: contactName ? String(contactName).slice(0, 200) : null,
      },
      select: { id: true },
    });
  } catch (e: any) {
    // P2002: unique constraint on (organizationId, name) — another request
    // created it first; fall through to the re-read below.
    if (e.code !== "P2002") throw e;
    return await (db as any).counterparty.findFirst({
      where: { name: clean, organizationId: organizationId || null },
      select: { id: true },
    });
  }
}

export async function captureDeclarationSnapshot(
  declarationId: string,
  declarer: { name: string; teamMemberNumber: string; position: string; department: string },
  managerDisplayName: string | null,
  db: any = prisma,
  // Insert-only fast path for brand-new declarations (fresh unique id, so no
  // row can exist): skips the upsert's existence read. PUT/submit keep upsert
  // because their rows may already exist.
  insertOnly = false,
): Promise<void> {
  const data = {
    declarationId,
    declarerName: declarer.name,
    employeeNumber: declarer.teamMemberNumber,
    positionTitle: declarer.position,
    department: declarer.department,
    managerDisplayName,
  };
  if (insertOnly) {
    await (db as any).declarationSnapshot.create({ data });
    return;
  }
  await (db as any).declarationSnapshot.upsert({
    where: { declarationId },
    create: data,
    // Snapshot is immutable after first capture; no update path so later calls
    // cannot rewrite historical declarer context (e.g. team moves).
    update: {},
  });
}

export async function syncDeclarationDetail(
  declarationId: string,
  d: any,
  db: any = prisma,
  // Insert-only fast path for brand-new declarations (see captureDeclarationSnapshot).
  insertOnly = false,
): Promise<void> {
  const data = {
    declarationId,
    description: String(d.description ?? ""),
    occasion: String(d.occasion ?? ""),
    relationship: String(d.relationship ?? ""),
    receivedGiven: String(d.receivedGiven ?? d.received_given ?? ""),
    fromField: String(d.fromField ?? d.from ?? ""),
    contactPerson: String(d.contactPerson ?? ""),
    biddingProcess: String(d.biddingProcess ?? ""),
    contractNegotiation: d.contractNegotiation ?? null,
    instances: String(d.instances ?? ""),
    publicOfficial: String(d.publicOfficial ?? ""),
    substantiation: d.substantiation ?? null,
  };
  if (insertOnly) {
    await (db as any).declarationDetail.create({ data });
    return;
  }
  const { declarationId: _omit, ...fields } = data;
  await (db as any).declarationDetail.upsert({
    where: { declarationId },
    create: data,
    update: fields,
  });
}

/** Parse admin-supplied rule step defs (array or JSON string). */
export function parseRuleStepDefs(raw: string | any[]): { order: number; role: string; label: string }[] {
  try {
    const v = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export async function syncWorkflowRuleSteps(
  ruleId: string,
  defsInput?: { order: number; role: string; label: string }[],
  db: any = prisma,
): Promise<number> {
  const defs = defsInput ?? [];
  const existing = await (db as any).workflowRuleStep.findMany({ where: { ruleId } });
  const existingOrders = new Set(existing.map((s: any) => s.order));
  const wantedOrders = new Set(defs.map((d) => d.order));
  await Promise.all(
    defs.map((d) =>
      (db as any).workflowRuleStep.upsert({
        where: { ruleId_order: { ruleId, order: d.order } },
        create: { ruleId, order: d.order, role: d.role, label: d.label },
        update: { role: d.role, label: d.label },
      }),
    ),
  );
  const stale = [...existingOrders].filter((o) => !wantedOrders.has(o as number));
  if (stale.length > 0) {
    await (db as any).workflowRuleStep.deleteMany({ where: { ruleId, order: { in: stale as number[] } } });
  }
  return defs.length;
}

function toStepRow(declarationId: string, s: WorkflowStep, validUserIds: Set<string>) {
  return {
    stepOrder: s.order,
    role: s.role,
    label: s.label,
    assigneeId: s.assignee && validUserIds.has(s.assignee) ? s.assignee : null,
    assigneeName: s.assigneeName || "Unknown",
    status: s.status,
    decision: s.decision ?? null,
    notes: s.notes ?? "",
    decidedAt: s.decidedAt ? parseDateSafe(s.decidedAt) : null,
    decidedById: s.decidedById && validUserIds.has(s.decidedById) ? s.decidedById : null,
    decidedByName: s.decidedByName ?? null,
  };
}

/**
 * Write the canonical step array inside the caller's transaction:
 * the WorkflowInstance row (id + producing rule) plus the authoritative
 * WorkflowInstanceStep rows (with stale-row cleanup).
 *
 * `ruleId`: pass the producing rule to record it; pass `undefined` to leave
 * the recorded rule untouched (e.g. an approval that does not reselect the
 * rule). Must be called within an encompassing `$transaction`.
 */
export async function writeWorkflowStepsTx(
  tx: any,
  declarationId: string,
  steps: WorkflowStep[],
  ruleId?: string | null,
): Promise<void> {
  if (!declarationId || !Array.isArray(steps)) {
    throw new Error("writeWorkflowStepsTx requires a declarationId and a step array");
  }
  const ids = new Set<string>();
  for (const s of steps) {
    if (s.assignee) ids.add(s.assignee);
    if (s.decidedById) ids.add(s.decidedById);
  }
  let validUserIds = new Set<string>();
  if (ids.size > 0) {
    const users = await tx.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true } });
    validUserIds = new Set(users.map((u: any) => u.id));
  }
  if (ruleId !== undefined) {
    await tx.workflowInstance.upsert({
      where: { declarationId },
      create: { declarationId, ruleId: ruleId ?? null },
      update: { ruleId: ruleId ?? null },
    });
  } else {
    await tx.workflowInstance.upsert({
      where: { declarationId },
      create: { declarationId },
      update: {},
    });
  }
  for (const s of steps) {
    const row = toStepRow(declarationId, s, validUserIds);
    await tx.workflowInstanceStep.upsert({
      where: { instanceId_stepOrder: { instanceId: declarationId, stepOrder: s.order } },
      create: { instanceId: declarationId, declarationId, ...row },
      update: { ...row },
    });
  }
  const wanted = new Set(steps.map((s) => s.order));
  const existing = await tx.workflowInstanceStep.findMany({
    where: { instanceId: declarationId },
    select: { stepOrder: true },
  });
  const stale = existing.map((r: any) => r.stepOrder).filter((o: number) => !wanted.has(o));
  if (stale.length > 0) {
    await tx.workflowInstanceStep.deleteMany({ where: { instanceId: declarationId, stepOrder: { in: stale } } });
  }
}

/**
 * Standalone writer (seed, tests). Opens its own transaction — request paths
 * that already hold a transaction MUST use `writeWorkflowStepsTx` instead.
 */
export async function persistWorkflowInstanceSteps(
  declarationId: string,
  steps: WorkflowStep[],
  ruleId?: string | null,
): Promise<void> {
  if (!declarationId || !Array.isArray(steps)) {
    throw new Error("persistWorkflowInstanceSteps requires a declarationId and a step array");
  }
  await (prisma as any).$transaction(async (tx: any) => {
    await writeWorkflowStepsTx(tx, declarationId, steps, ruleId);
  });
}

/** Read workflow steps from the authoritative step rows (no fallback). */
export async function readWorkflowSteps(declarationId: string): Promise<WorkflowStep[] | null> {
  const rows = await (prisma as any).workflowInstanceStep.findMany({
    where: { instanceId: declarationId },
    orderBy: { stepOrder: "asc" },
  });
  if (!rows || rows.length === 0) return null;
  return rows.map((r: any) => ({
    order: r.stepOrder,
    role: r.role,
    assignee: r.assigneeId || "",
    assigneeName: r.assigneeName,
    label: r.label,
    status: r.status,
    decision: r.decision ?? null,
    approvedAt: r.status === "approved" && r.decidedAt ? new Date(r.decidedAt).toISOString() : null,
    notes: r.notes ?? "",
    decidedAt: r.decidedAt ? new Date(r.decidedAt).toISOString() : null,
    decidedById: r.decidedById ?? null,
    decidedByName: r.decidedByName ?? null,
  }));
}
