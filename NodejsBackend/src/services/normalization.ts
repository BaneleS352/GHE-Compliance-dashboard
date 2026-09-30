import { prisma } from "../config/prisma";
import { toDbId } from "./ids";
import type { WorkflowStep } from "./workflowService";

/**
 * Normalized writers (numeric identifier cutover complete).
 *
 * There is exactly one store: relational rows with BIGINT keys. The public
 * declaration reference stays text (GHE-YYYY-NNNNNN); every normalized child
 * row references the internal numeric declarationPk. All writers run inside
 * the caller's transaction and take the numeric declarationPk.
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

/** Resolve the internal numeric key for a public GHE- declaration id. */
export async function getDeclarationPk(id: string, db: any = prisma): Promise<bigint | null> {
  const row = await (db as any).declaration.findUnique({ where: { id }, select: { declarationPk: true } });
  return row ? (row.declarationPk as bigint) : null;
}

export async function ensureCounterparty(
  name: string,
  organizationId: bigint | number | null,
  contactName?: string | null,
  db: any = prisma,
): Promise<{ id: bigint } | null> {
  const clean = String(name || "").trim();
  if (!clean) return null;
  const org = organizationId === null || organizationId === undefined ? null : toDbId(organizationId);
  const existing = await (db as any).counterparty.findFirst({
    where: { name: clean, organizationId: org },
    select: { id: true },
  });
  if (existing) return existing;
  try {
    return await (db as any).counterparty.create({
      data: {
        name: clean,
        organizationId: org,
        contactName: contactName ? String(contactName).slice(0, 200) : null,
      },
      select: { id: true },
    });
  } catch (e: any) {
    // P2002: unique constraint on (organizationId, name) — another request
    // created it first; fall through to the re-read below.
    if (e.code !== "P2002") throw e;
    return await (db as any).counterparty.findFirst({
      where: { name: clean, organizationId: org },
      select: { id: true },
    });
  }
}

export async function captureDeclarationSnapshot(
  declarationPk: bigint | number,
  declarer: { name: string; teamMemberNumber: string; position: string; department: string },
  managerDisplayName: string | null,
  db: any = prisma,
  // Insert-only fast path for brand-new declarations (fresh unique key, so no
  // row can exist): skips the upsert's existence read. PUT/submit keep upsert
  // because their rows may already exist.
  insertOnly = false,
): Promise<void> {
  const pk = toDbId(declarationPk);
  const data = {
    declarationPk: pk,
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
    where: { declarationPk: pk },
    create: data,
    // Snapshot is immutable after first capture; no update path so later calls
    // cannot rewrite historical declarer context (e.g. team moves).
    update: {},
  });
}

export async function syncDeclarationDetail(
  declarationPk: bigint | number,
  d: any,
  db: any = prisma,
  // Insert-only fast path for brand-new declarations (see captureDeclarationSnapshot).
  insertOnly = false,
): Promise<void> {
  const pk = toDbId(declarationPk);
  const data = {
    declarationPk: pk,
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
  const { declarationPk: _omit, ...fields } = data;
  await (db as any).declarationDetail.upsert({
    where: { declarationPk: pk },
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
  ruleId: bigint | number,
  defsInput?: { order: number; role: string; label: string }[],
  db: any = prisma,
): Promise<number> {
  const rid = toDbId(ruleId);
  const defs = defsInput ?? [];
  const existing = await (db as any).workflowRuleStep.findMany({ where: { ruleId: rid } });
  const existingOrders = new Set(existing.map((s: any) => s.order));
  const wantedOrders = new Set(defs.map((d) => d.order));
  await Promise.all(
    defs.map((d) =>
      (db as any).workflowRuleStep.upsert({
        where: { ruleId_order: { ruleId: rid, order: d.order } },
        create: { ruleId: rid, order: d.order, role: d.role, label: d.label },
        update: { role: d.role, label: d.label },
      }),
    ),
  );
  const stale = [...existingOrders].filter((o) => !wantedOrders.has(o as number));
  if (stale.length > 0) {
    await (db as any).workflowRuleStep.deleteMany({ where: { ruleId: rid, order: { in: stale as number[] } } });
  }
  return defs.length;
}

function toStepRow(declarationPk: bigint, instanceId: bigint, s: WorkflowStep, validUserIds: Set<string>) {
  const assigneeKey = s.assignee === null || s.assignee === undefined ? null : String(s.assignee);
  const deciderKey = s.decidedById === null || s.decidedById === undefined ? null : String(s.decidedById);
  return {
    stepOrder: s.order,
    role: s.role,
    label: s.label,
    assigneeId: assigneeKey && validUserIds.has(assigneeKey) ? BigInt(assigneeKey) : null,
    assigneeName: s.assigneeName || "Unknown",
    status: s.status,
    decision: s.decision ?? null,
    notes: s.notes ?? "",
    decidedAt: s.decidedAt ? parseDateSafe(s.decidedAt) : null,
    decidedById: deciderKey && validUserIds.has(deciderKey) ? BigInt(deciderKey) : null,
    decidedByName: s.decidedByName ?? null,
  };
}

/**
 * Write the canonical step array inside the caller's transaction: the
 * WorkflowInstance row (numeric PK + producing rule) plus the authoritative
 * WorkflowInstanceStep rows (with stale-row cleanup).
 *
 * `ruleId`: pass the producing rule to record it; pass `undefined` to leave
 * the recorded rule untouched (e.g. an approval that does not reselect the
 * rule). Must be called within an encompassing `$transaction`.
 */
export async function writeWorkflowStepsTx(
  tx: any,
  declarationPk: bigint | number,
  steps: WorkflowStep[],
  ruleId?: bigint | number | null,
): Promise<void> {
  const pk = toDbId(declarationPk);
  if (!Array.isArray(steps)) {
    throw new Error("writeWorkflowStepsTx requires a step array");
  }
  const ids = new Set<string>();
  for (const s of steps) {
    if (s.assignee !== null && s.assignee !== undefined) ids.add(String(s.assignee));
    if (s.decidedById !== null && s.decidedById !== undefined) ids.add(String(s.decidedById));
  }
  let validUserIds = new Set<string>();
  if (ids.size > 0) {
    const users = await tx.user.findMany({ where: { id: { in: [...ids].map((v) => BigInt(v)) } }, select: { id: true } });
    validUserIds = new Set(users.map((u: any) => String(u.id)));
  }
  let instance = await tx.workflowInstance.findUnique({ where: { declarationPk: pk }, select: { id: true } });
  if (!instance) {
    instance = await tx.workflowInstance.create({
      data: { declarationPk: pk, ruleId: ruleId !== undefined ? (ruleId === null ? null : toDbId(ruleId)) : null },
      select: { id: true },
    });
  } else if (ruleId !== undefined) {
    await tx.workflowInstance.update({
      where: { declarationPk: pk },
      data: { ruleId: ruleId === null ? null : toDbId(ruleId) },
    });
  }
  for (const s of steps) {
    const row = toStepRow(pk, instance.id as bigint, s, validUserIds);
    await tx.workflowInstanceStep.upsert({
      where: { instanceId_stepOrder: { instanceId: instance.id, stepOrder: s.order } },
      create: { instanceId: instance.id, declarationPk: pk, ...row },
      update: { ...row },
    });
  }
  const wanted = new Set(steps.map((s) => s.order));
  const existing = await tx.workflowInstanceStep.findMany({
    where: { instanceId: instance.id },
    select: { stepOrder: true },
  });
  const stale = existing.map((r: any) => r.stepOrder).filter((o: number) => !wanted.has(o));
  if (stale.length > 0) {
    await tx.workflowInstanceStep.deleteMany({ where: { instanceId: instance.id, stepOrder: { in: stale } } });
  }
}

/**
 * Standalone writer (seed, tests). Opens its own transaction — request paths
 * that already hold a transaction MUST use `writeWorkflowStepsTx` instead.
 */
export async function persistWorkflowInstanceSteps(
  declarationPk: bigint | number,
  steps: WorkflowStep[],
  ruleId?: bigint | number | null,
): Promise<void> {
  if (!Array.isArray(steps)) {
    throw new Error("persistWorkflowInstanceSteps requires a step array");
  }
  await (prisma as any).$transaction(async (tx: any) => {
    await writeWorkflowStepsTx(tx, declarationPk, steps, ruleId);
  });
}

/** Read workflow steps from the authoritative step rows (no fallback). */
export async function readWorkflowSteps(declarationPk: bigint | number): Promise<WorkflowStep[] | null> {
  const { rowToStep } = await import("./workflowService");
  const rows = await (prisma as any).workflowInstanceStep.findMany({
    where: { declarationPk: toDbId(declarationPk) },
    orderBy: { stepOrder: "asc" },
  });
  if (!rows || rows.length === 0) return null;
  return rows.map((r: any) => rowToStep(r));
}

/** Restart every BIGINT identity sequence past existing rows (call after explicit-id seeds so later autoincrement inserts never collide). PostgreSQL-only. */
export async function resetIdentitySequences(db: any = prisma): Promise<void> {
  const tables: [string, string][] = [
    ["Organization", "id"], ["User", "id"], ["Department", "id"], ["Team", "id"],
    ["Counterparty", "id"], ["CounterpartyContact", "id"], ["UploadedFile", "id"],
    ["WorkflowRule", "id"], ["WorkflowRuleStep", "id"], ["DeclarationFile", "id"],
    ["WorkflowInstanceStep", "id"], ["DeclarationSnapshot", "id"], ["DeclarationDetail", "id"],
    ["Declaration", "declarationPk"], ["WorkflowInstance", "id"],
  ];
  for (const [table, col] of tables) {
    await db.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"${table}"', '${col}'), COALESCE((SELECT MAX("${col}") FROM "${table}"), 0) + 1, false)`,
    );
  }
}
