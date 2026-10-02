import type { Prisma, PrismaClient, WorkflowInstanceStep } from "@prisma/client";
import { prisma } from "../config/prisma";
import { toDbId } from "./ids";
import type { WorkflowStep } from "./workflowService";

/** Prisma client or an ambient transaction client (both expose the models). */
export type DbClient = PrismaClient | Prisma.TransactionClient;

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
export async function getDeclarationPk(id: string, db: DbClient = prisma): Promise<bigint | null> {
  const row = await db.declaration.findUnique({ where: { id }, select: { declarationPk: true } });
  return row ? row.declarationPk : null;
}

/**
 * Resolve a department display name to its organization-scoped Department
 * row, creating the master-data row when the organization is known.
 * departmentId is the sole department source of truth: callers store the
 * returned key and derive display names from the relation, never the input
 * string. A null/empty name or a null organization resolves to null (global
 * users cannot link the organization-scoped Department table).
 */
export async function resolveDepartmentId(
  name: string | null | undefined,
  organizationId: bigint | number | null | undefined,
  db: DbClient = prisma,
): Promise<bigint | null> {
  const clean = String(name || "").trim();
  if (!clean) return null;
  if (organizationId === null || organizationId === undefined) return null;
  const org = toDbId(organizationId);
  const existing = await db.department.findFirst({
    where: { name: clean, organizationId: org },
    select: { id: true },
  });
  if (existing) return existing.id;
  try {
    const created = await db.department.create({
      data: { name: clean, organizationId: org },
      select: { id: true },
    });
    return created.id;
  } catch (e) {
    // P2002: unique constraint on (organizationId, name) — another request
    // created it first; fall through to the re-read below.
    if ((e as { code?: string }).code !== "P2002") throw e;
    const retry = await db.department.findFirst({
      where: { name: clean, organizationId: org },
      select: { id: true },
    });
    return retry ? retry.id : null;
  }
}

export async function ensureCounterparty(
  name: string,
  organizationId: bigint | number | null,
  contactName?: string | null,
  db: DbClient = prisma,
): Promise<{ id: bigint } | null> {
  const clean = String(name || "").trim();
  if (!clean) return null;
  const org = organizationId === null || organizationId === undefined ? null : toDbId(organizationId);
  const existing = await db.counterparty.findFirst({
    where: { name: clean, organizationId: org },
    select: { id: true },
  });
  if (existing) return existing;
  try {
    return await db.counterparty.create({
      data: {
        name: clean,
        organizationId: org,
        contactName: contactName ? String(contactName).slice(0, 200) : null,
      },
      select: { id: true },
    });
  } catch (e) {
    // P2002: unique constraint on (organizationId, name) — another request
    // created it first; fall through to the re-read below. The Prisma error
    // shape is untyped here, hence the narrow boundary cast.
    // Identity policy (see docs/SCHEMA.md): scoped names are unique per
    // organization (partial unique index); global NULL-org names may repeat.
    if ((e as { code?: string }).code !== "P2002") throw e;
    return await db.counterparty.findFirst({
      where: { name: clean, organizationId: org },
      select: { id: true },
    });
  }
}

/**
 * Resolve profile-owned declaration identity from the declarer user row.
 *
 * Snapshots always follow the declarer profile (department link and manager
 * link), never request-body identity strings. Returns null when the profile
 * is incomplete so routes can fail with an actionable 400 instead of picking
 * a fallback organization, department, or manager. Admin corrections go
 * through user administration, not declaration payloads.
 */
export async function resolveDeclarationIdentity(
  userPk: bigint | number,
  db: DbClient = prisma,
): Promise<{ department: string; managerDisplayName: string } | null> {
  const u = await db.user.findUnique({
    where: { id: toDbId(userPk) },
    select: { departmentRef: { select: { name: true } }, manager: { select: { name: true } } },
  });
  const department = u?.departmentRef?.name?.trim() || "";
  const managerDisplayName = u?.manager?.name?.trim() || "";
  if (!department || !managerDisplayName) return null;
  return { department, managerDisplayName };
}

export async function captureDeclarationSnapshot(
  declarationPk: bigint | number,
  declarer: { name: string; teamMemberNumber: string; position: string; department: string },
  managerDisplayName: string | null,
  db: DbClient = prisma,
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
    await db.declarationSnapshot.create({ data });
    return;
  }
  await db.declarationSnapshot.upsert({
    where: { declarationPk: pk },
    create: data,
    // Snapshot is immutable after first capture; no update path so later calls
    // cannot rewrite historical declarer context (e.g. team moves).
    update: {},
  });
}

/** Transaction detail fields (camelCase DTO shape; all callers pass literals). */
export interface DeclarationDetailData {
  description?: string | null;
  occasion?: string | null;
  relationship?: string | null;
  receivedGiven?: string | null;
  from?: string | null;
  contactPerson?: string | null;
  biddingProcess?: string | null;
  contractNegotiation?: string | null;
  instances?: string | null;
  publicOfficial?: string | null;
  substantiation?: string | null;
}

export async function syncDeclarationDetail(
  declarationPk: bigint | number,
  d: DeclarationDetailData,
  db: DbClient = prisma,
  // Insert-only fast path for brand-new declarations (see captureDeclarationSnapshot).
  insertOnly = false,
): Promise<void> {
  const pk = toDbId(declarationPk);
  const data = {
    declarationPk: pk,
    description: String(d.description ?? ""),
    occasion: String(d.occasion ?? ""),
    relationship: String(d.relationship ?? ""),
    receivedGiven: String(d.receivedGiven ?? ""),
    fromField: String(d.from ?? ""),
    contactPerson: String(d.contactPerson ?? ""),
    biddingProcess: String(d.biddingProcess ?? ""),
    contractNegotiation: d.contractNegotiation ?? null,
    instances: String(d.instances ?? ""),
    publicOfficial: String(d.publicOfficial ?? ""),
    substantiation: d.substantiation ?? null,
  };
  if (insertOnly) {
    await db.declarationDetail.create({ data });
    return;
  }
  const { declarationPk: _omit, ...fields } = data;
  await db.declarationDetail.upsert({
    where: { declarationPk: pk },
    create: data,
    update: fields,
  });
}

/** Parse admin-supplied rule step defs (array or JSON string). */
export function parseRuleStepDefs(raw: string | unknown[]): { order: number; role: string; label: string }[] {
  try {
    const v: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(v)) return [];
    // Boundary label: admin-supplied JSON step definitions are untyped input;
    // the narrowed cast is contained here and write paths re-validate roles.
    return v as { order: number; role: string; label: string }[];
  } catch {
    return [];
  }
}

export async function syncWorkflowRuleSteps(
  ruleId: bigint | number,
  defsInput?: { order: number; role: string; label: string }[],
  db: DbClient = prisma,
): Promise<number> {
  const rid = toDbId(ruleId);
  const defs = defsInput ?? [];
  const existing = await db.workflowRuleStep.findMany({ where: { ruleId: rid } });
  const existingOrders = new Set(existing.map((s) => s.order));
  const wantedOrders = new Set(defs.map((d) => d.order));
  await Promise.all(
    defs.map((d) =>
      db.workflowRuleStep.upsert({
        where: { ruleId_order: { ruleId: rid, order: d.order } },
        create: { ruleId: rid, order: d.order, role: d.role, label: d.label },
        update: { role: d.role, label: d.label },
      }),
    ),
  );
  const stale = [...existingOrders].filter((o) => !wantedOrders.has(o));
  if (stale.length > 0) {
    await db.workflowRuleStep.deleteMany({ where: { ruleId: rid, order: { in: stale } } });
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
    assigneeId: assigneeKey && validUserIds.has(assigneeKey) ? toDbId(assigneeKey) : null,
    assigneeName: s.assigneeName || "Unknown",
    status: s.status,
    decision: s.decision ?? null,
    notes: s.notes ?? "",
    decidedAt: s.decidedAt ? parseDateSafe(s.decidedAt) : null,
    decidedById: deciderKey && validUserIds.has(deciderKey) ? toDbId(deciderKey) : null,
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
  tx: Prisma.TransactionClient,
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
    const users = await tx.user.findMany({ where: { id: { in: [...ids].map((v) => toDbId(v)) } }, select: { id: true } });
    validUserIds = new Set(users.map((u) => String(u.id)));
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
    const row = toStepRow(pk, instance.id, s, validUserIds);
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
  const stale = existing.map((r) => r.stepOrder).filter((o: number) => !wanted.has(o));
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
  await prisma.$transaction(async (tx) => {
    await writeWorkflowStepsTx(tx, declarationPk, steps, ruleId);
  });
}

/** Read workflow step rows from the authoritative WorkflowInstanceStep table (rows only — no JSON fallback). */
export async function readWorkflowStepRows(declarationPk: bigint | number): Promise<WorkflowStep[] | null> {
  const { rowToStep } = await import("./workflowService");
  const rows = await prisma.workflowInstanceStep.findMany({
    where: { declarationPk: toDbId(declarationPk) },
    orderBy: { stepOrder: "asc" },
  });
  if (!rows || rows.length === 0) return null;
  return rows.map((r) => rowToStep(r));
}

/** Restart every BIGINT identity sequence past existing rows (call after explicit-id seeds so later autoincrement inserts never collide). PostgreSQL-only. */
export async function resetIdentitySequences(db: DbClient = prisma): Promise<void> {
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
