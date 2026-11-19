import { Router, Response } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import xss from "xss";
import crypto from "crypto";
import { prisma } from "../config/prisma";
import { authenticate, authorize, AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { createWorkflowSteps, resolveRuleId, declarationResponse, declarationIncludes } from "../services/workflowService";
import type { DeclarationWithRelations, WorkflowStep } from "../services/workflowService";
import {
  parseDateSafe,
  ensureCounterparty,
  captureDeclarationSnapshot,
  resolveDeclarationIdentity,
  syncDeclarationDetail,
  writeWorkflowStepsTx,
  readWorkflowStepRows,
  lockDeclarationRow,
  getDeclarationPk,
} from "../services/normalization";
import { toDbId, toJsonId } from "../services/ids";
import { notificationDedupeKey, queueNotificationSafely } from "../services/notificationService";
import { recordDeclarationAudit } from "../services/declarationAudit";
import { declarationPriorityForValue } from "../services/declarationPriority";
import { isAzuriteAttachment } from "../services/attachmentStorage";
import { isCrossDepartmentLineManager } from "../services/declarationAccess";
import { enqueueAttachmentCleanup } from "../services/attachmentCleanupQueue";
import {
  viewStatusSummaryFull,
  viewMonthly,
  viewTypeBreakdown,
} from "../services/reportingViews";

const router = Router();
function generateDeclarationId(): string {
  const year = new Date().getFullYear();
  const rand = crypto.randomInt(100000, 999999);
  return `GHE-${year}-${rand}`;
}

function sanitize(val: string): string {
  return xss(val, { whiteList: {}, stripIgnoreTag: true });
}

// Identifiers arrive as JSON numbers (see services/ids.ts). Accept numeric
// strings defensively (query/form edge cases); legacy text ids have no
// mapping and are rejected by toDbId.
const numericId = z.union([z.number().int(), z.string().regex(/^\d+$/)], { error: () => "Expected a numeric identifier" });

/**
 * Line-Manager department scoping for direct-ID routes. The list endpoint
 * filters LMs to their own department; without this, an LM could read/edit/
 * delete/submit another department's declarations by ID. Returns true when
 * access is denied (response already sent). Department comes from the
 * immutable snapshot (submission-time context).
 */
function isCrossDepartmentLMDenied(req: AuthRequest, snapshotDepartment: string | null | undefined): boolean {
  return isCrossDepartmentLineManager(req.user!, snapshotDepartment);
}

function denyCrossDepartmentLM(req: AuthRequest, res: Response, snapshotDepartment: string | null | undefined): boolean {
  if (!isCrossDepartmentLMDenied(req, snapshotDepartment)) return false;
  res.status(403).json({ error: "Access denied: declaration is outside your department" });
  return true;
}

function auditEventResponse(event: Awaited<ReturnType<typeof prisma.declarationAuditEvent.findMany>>[number]) {
  return {
    id: toJsonId(event.id),
    action: event.action,
    changedFields: event.changedFields,
    oldValues: event.oldValues,
    newValues: event.newValues,
    actorUserId: event.actorUserId === null ? null : toJsonId(event.actorUserId),
    actorName: event.actorName,
    createdAt: event.createdAt,
  };
}

const VALID_STATUSES = ["Draft", "Pending", "Approved", "Declined", "Escalated", "Returned"] as const;
const moneyAmount = z.number().finite().nonnegative().refine(
  (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8,
  "Amount must have no more than two decimal places",
);

router.get("/stats", authenticate, authorize("admin", "approver"), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const orgId = req.user?.organizationId ?? undefined;
  const orgWhere: Prisma.DeclarationWhereInput = {};
  if (orgId !== undefined && orgId !== null) orgWhere.organizationId = toDbId(orgId);

  // Agreed dashboard read models come from the scoped reporting views.
  // The direct aggregation below is the fallback for databases where the
  // views do not exist yet. All view numerics are converted with
  // Number() — raw driver values (e.g. BigInt counts) must never reach res.json.
  try {
    const [statusRows, monthlyRows, typeRows] = await Promise.all([
      viewStatusSummaryFull(orgId ?? undefined),
      viewMonthly(orgId ?? undefined),
      viewTypeBreakdown(orgId ?? undefined),
    ]);
    if (statusRows && monthlyRows && typeRows) {
      // Unscoped queries return one row per (organisation, status/month/type)
      // — sum across organisations so the KPIs are global totals.
      const sumBy = (rows: { status: string; count: number }[], match: string) =>
        rows.filter((r) => r.status === match).reduce((n, r) => n + r.count, 0);
      const kpis = {
        total: statusRows.reduce((n, r) => n + r.count, 0),
        pending: sumBy(statusRows, "Pending"),
        approved: sumBy(statusRows, "Approved"),
        declined: sumBy(statusRows, "Declined"),
        returned: sumBy(statusRows, "Returned"),
        escalated: sumBy(statusRows, "Escalated"),
        totalValue: statusRows.reduce((n, r) => n + r.totalValue, 0),
      };
      const monthMap = new Map<string, { approved: number; declined: number }>();
      for (const m of monthlyRows) {
        const e = monthMap.get(String(m.month)) || { approved: 0, declined: 0 };
        e.approved += Number(m.approved);
        e.declined += Number(m.declined);
        monthMap.set(String(m.month), e);
      }
      const complianceTrend = [...monthMap.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, v]) => ({ month, ...v }));
      const typeMap = new Map<string, number>();
      for (const t of typeRows) {
        typeMap.set(String(t.type), (typeMap.get(String(t.type)) || 0) + Number(t.count));
      }
      const typeBreakdown = [...typeMap.entries()].map(([name, value]) => ({ name, value }));
      res.json({ kpis, complianceTrend, typeBreakdown });
      return;
    }
  } catch {
    // Fall through to direct aggregation.
  }

  // Fallback: direct aggregation on the normalized tables.
  const monthlyOrgFilter = orgId !== undefined && orgId !== null
    ? Prisma.sql`AND "organizationId" = ${toDbId(orgId)}`
    : Prisma.empty;
  const [counts, totalValueAgg, monthly, typeRows] = await Promise.all([
    prisma.declaration.groupBy({ by: ["status"], where: orgWhere, _count: { status: true } }),
    prisma.declaration.aggregate({ where: orgWhere, _sum: { value: true } }),
    prisma.$queryRaw<Array<{ month: Date; approved: bigint; declined: bigint }>>(Prisma.sql`
      SELECT date_trunc('month', "eventDate") AS "month",
        COUNT(*) FILTER (WHERE "status" = 'Approved') AS "approved",
        COUNT(*) FILTER (WHERE "status" = 'Declined') AS "declined"
      FROM "Declaration"
      WHERE "eventDate" IS NOT NULL ${monthlyOrgFilter}
      GROUP BY date_trunc('month', "eventDate")
      ORDER BY "month" ASC
    `),
    prisma.declaration.groupBy({ by: ["type"], where: orgWhere, _count: { type: true } }),
  ]);
  const countMap = new Map(counts.map((c) => [c.status, c._count.status]));
  const total = Array.from(countMap.values()).reduce((a: number, b: number) => a + b, 0);
  const kpis = {
    total,
    pending: countMap.get("Pending") || 0,
    approved: countMap.get("Approved") || 0,
    declined: countMap.get("Declined") || 0,
    returned: countMap.get("Returned") || 0,
    escalated: countMap.get("Escalated") || 0,
    totalValue: Number(totalValueAgg._sum.value || 0),
  };
  const complianceTrend = monthly.map((row) => ({
    month: new Date(row.month).toISOString().slice(0, 7),
    approved: Number(row.approved),
    declined: Number(row.declined),
  }));
  const typeBreakdown = typeRows.map((t) => ({ name: t.type, value: t._count.type }));

  res.json({ kpis, complianceTrend, typeBreakdown });
}));

router.get("/", authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const status = req.query.status as string | undefined;
  const search = req.query.search as string | undefined;
  const limit = req.query.limit ? Math.min(Math.max(parseInt(String(req.query.limit), 10) || 0, 1), 100) : undefined;
  const offset = req.query.offset ? Math.max(parseInt(String(req.query.offset), 10) || 0, 0) : 0;

  const where: Prisma.DeclarationWhereInput = {};
  if (status && (VALID_STATUSES as readonly string[]).includes(status)) where.status = status;
  // Org isolation — scope all queries by caller's org if present
  const listOrgId = req.user?.organizationId ?? undefined;
  if (listOrgId !== undefined && listOrgId !== null) {
    where.organizationId = toDbId(listOrgId);
  }
  if (req.user!.role === "teamMember") {
    where.declarerUserId = toDbId(req.user!.id);
  } else if (req.user!.role === "approver" && req.user!.department && req.user!.position === "Line Manager") {
    where.snapshot = { department: req.user!.department };
  }

  // Ordering uses the canonical submittedAt DateTime column (populated
  // synchronously on every write).
  let declarations: DeclarationWithRelations[];
  if (search?.trim()) {
    const q = search.trim().slice(0, 100);
    where.OR = [
      { id: { contains: q, mode: "insensitive" } },
      { snapshot: { is: { declarerName: { contains: q, mode: "insensitive" } } } },
      { counterpartyRef: { is: { name: { contains: q, mode: "insensitive" } } } },
      { detail: { is: { description: { contains: q, mode: "insensitive" } } } },
    ];
  }
  // Never return an unbounded declaration set; callers can request subsequent pages.
  declarations = await prisma.declaration.findMany({ where, orderBy: { submittedAt: "desc" }, take: limit ?? 100, skip: offset, include: declarationIncludes });

  res.json(declarations.map(declarationResponse));
}));

const createSchema = z.object({
  employee: z.string().min(1),
  employeeId: numericId,
  teamMemberNumber: z.string(),
  lineManager: z.string(),
  position: z.string(),
  department: z.string(),
  company: z.string().optional(),
  team: z.string().optional(),
  type: z.enum(["Gift", "Hospitality", "Entertainment"]),
  counterparty: z.string().min(1),
  value: moneyAmount,
  submitted: z.string(),
  approver: z.string().optional(),
  approverId: numericId.optional(),
  // No `status` key: the server owns it ("Draft" on create). Accepting it
  // would silently discard a client-supplied Pending and mislead callers.
  priority: z.enum(["Low", "Medium", "High"]),
  description: z.string().max(10000),
  relationship: z.string(),
  receivedGiven: z.string(),
  from: z.string(),
  contactPerson: z.string(),
  biddingProcess: z.string(),
  contractNegotiation: z.string().optional(),
  occasion: z.string(),
  date: z.string(),
  instances: z.string(),
  publicOfficial: z.string(),
  substantiation: z.string().optional(),
  organizationId: numericId.optional(),
});

router.post("/", authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const data = parsed.data;
  const employeePk = toDbId(data.employeeId);
  const callerPk = toDbId(req.user!.id);
  if (req.user!.role === "teamMember" && employeePk !== callerPk) {
    res.status(403).json({ error: "Cannot create declaration for another user" });
    return;
  }
  // Enforce maximum value from SystemConfig (dynamic, not hard-coded)
  const sysCfg = await prisma.systemConfig.findFirst();
  const maxVal = Number(sysCfg?.maximumValue ?? 1000000);
  if (data.value > maxVal) {
    res.status(400).json({ error: `Maximum value exceeded. Please enter an amount of R${maxVal.toLocaleString("en-ZA").replace(/,/g, " ")} or less to continue.` });
    return;
  }
  const priority = declarationPriorityForValue(
    data.value,
    Number(sysCfg?.highValueThreshold ?? 1000),
    Number(sysCfg?.mediumValueThreshold ?? 1000),
  );
  // Collision guard for GHE ID
  let id: string = generateDeclarationId();
  for (let attempts = 0; attempts < 5; attempts++) {
    const exists = await prisma.declaration.findUnique({ where: { id } });
    if (!exists) break;
    id = generateDeclarationId();
    if (attempts === 4) id = `GHE-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8)}`;
  }

  // Derive organizationId server-side — prefer user's org, fallback to client value for admin
  let orgId: bigint | null = null;
  const userOrgId = req.user?.organizationId ?? undefined;
  const bodyOrg = data.organizationId !== undefined ? toDbId(data.organizationId) : null;
  if (userOrgId !== undefined && userOrgId !== null) {
    const userOrgPk = toDbId(userOrgId);
    // Non-admin must stay in own org
    if (bodyOrg !== null && bodyOrg !== userOrgPk && req.user!.role !== "admin") {
      res.status(403).json({ error: "Cannot create declaration for another organization" });
      return;
    }
    orgId = bodyOrg !== null && req.user!.role === "admin" ? bodyOrg : userOrgPk;
  } else {
    if (bodyOrg !== null && req.user!.role !== "admin") {
      res.status(403).json({ error: "Cannot create declaration for another organization" });
      return;
    }
    orgId = req.user!.role === "admin" ? bodyOrg : null;
  }
  if (orgId !== null) {
    const orgExists = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!orgExists) {
      res.status(400).json({ error: "Invalid organizationId" });
      return;
    }
  }

  const sanitizedCounterparty = sanitize(data.counterparty);
  const eventDate = parseDateSafe(data.date);
  const submittedAt = parseDateSafe(data.submitted);

  // Resolve user links before the transaction (pure reads, so the transaction
  // holds the write lock for the shortest possible time).
  // No lookup is needed when the declarer/approver is the authenticated
  // caller: `authenticate` already verified that user against the database.
  const [declarerRow, approverRow] = await Promise.all([
    employeePk === callerPk
      ? Promise.resolve({ id: callerPk, name: req.user!.name })
      : prisma.user.findUnique({ where: { id: employeePk }, select: { id: true, name: true, departmentRef: { select: { name: true } } } }),
    data.approverId !== undefined
      ? toDbId(data.approverId) === callerPk
        ? Promise.resolve({ id: callerPk })
        : prisma.user.findUnique({ where: { id: toDbId(data.approverId) }, select: { id: true } })
      : Promise.resolve(null),
  ]);
  const declarerUserId: bigint | null = declarerRow?.id || null;
  const txApproverUserId: bigint | null = approverRow?.id || null;
  // Snapshot identity ownership (Phase 1):
  // - Profile links win wherever they exist: department and manager display
  //   follow the declarer user row, never request-body strings. Crafted
  //   company/department/lineManager values are accepted for compatibility
  //   but ignored for snapshot purposes (exit criterion: ignore or reject
  //   altered values).
  // - A self-service team member without a manager link fails with an
  //   actionable 400 instead of picking a fallback manager. Manager-less
  //   declarer flows (LM-skip) remain available through admin creation, and
  //   department-less declarers (e.g. global users who cannot link the
  //   organization-scoped Department table) keep the legacy request value.
  // - Corrections go through user administration, not declaration payloads.
  const selfServiceTeamMember = employeePk === callerPk && req.user!.role === "teamMember";
  const identity = await resolveDeclarationIdentity(employeePk);
  const legacyDepartment =
    (employeePk === callerPk ? req.user!.department : declarerRow && "departmentRef" in declarerRow ? declarerRow.departmentRef?.name : undefined) ||
    data.department;
  const snapshotDepartment = identity.department ?? legacyDepartment;
  const snapshotManager = identity.managerDisplayName
    ?? (selfServiceTeamMember ? null : sanitize(data.lineManager) || null);
  if (selfServiceTeamMember && snapshotManager === null) {
    res.status(400).json({ error: "Incomplete profile: a line manager is required before creating a declaration" });
    return;
  }

  // Single transaction: lean declaration row, canonical DateTime columns and
  // links, immutable snapshot, detail rows, and the counterparty identity
  // (resolved inside the transaction so a failed create never leaves an
  // unused counterparty row behind).
  const declarationPk = await prisma.$transaction(async (tx) => {
    const cp = sanitizedCounterparty
      ? await ensureCounterparty(sanitizedCounterparty, orgId, data.contactPerson ? sanitize(data.contactPerson) : null, tx)
      : null;
    const created = await tx.declaration.create({
      data: {
        id,
        type: sanitize(data.type),
        value: data.value,
        status: "Draft",
        // Client priority is retained in the request contract for compatibility,
        // but the persisted label is derived from the value and server config.
        priority,
        organizationId: orgId,
        eventDate,
        submittedAt,
        declarerUserId,
        currentApproverUserId: txApproverUserId,
        counterpartyId: cp?.id || null,
      },
    });
    await captureDeclarationSnapshot(
      created.declarationPk,
      {
        name: sanitize(data.employee),
        teamMemberNumber: sanitize(data.teamMemberNumber),
        position: sanitize(data.position),
        department: sanitize(snapshotDepartment),
      },
      snapshotManager,
      tx,
      true,
    );
    await syncDeclarationDetail(created.declarationPk, {
      description: sanitize(data.description),
      occasion: sanitize(data.occasion),
      relationship: sanitize(data.relationship),
      receivedGiven: sanitize(data.receivedGiven),
      from: sanitize(data.from),
      contactPerson: sanitize(data.contactPerson),
      biddingProcess: sanitize(data.biddingProcess),
      contractNegotiation: data.contractNegotiation ? sanitize(data.contractNegotiation) : null,
      instances: sanitize(data.instances),
      publicOfficial: sanitize(data.publicOfficial),
      substantiation: data.substantiation ? sanitize(data.substantiation) : null,
    }, tx, true);
    await recordDeclarationAudit(tx, {
      declarationPk: created.declarationPk,
      declarationId: created.id,
      organizationId: orgId,
      actorUserId: req.user!.id,
      actorName: req.user!.name,
      action: "created",
      changedFields: ["type", "value", "priority", "eventDate", "submittedAt", "snapshot", "detail", "counterparty"],
      newValues: {
        type: created.type,
        value: Number(created.value),
        status: created.status,
        priority: created.priority,
        eventDate,
        submittedAt,
        declarerUserId,
        counterparty: sanitizedCounterparty,
        snapshot: {
          declarerName: sanitize(data.employee),
          employeeNumber: sanitize(data.teamMemberNumber),
          positionTitle: sanitize(data.position),
          department: sanitize(snapshotDepartment),
          managerDisplayName: snapshotManager,
        },
        detail: {
          description: sanitize(data.description),
          occasion: sanitize(data.occasion),
          relationship: sanitize(data.relationship),
          receivedGiven: sanitize(data.receivedGiven),
          from: sanitize(data.from),
          contactPerson: sanitize(data.contactPerson),
          biddingProcess: sanitize(data.biddingProcess),
          contractNegotiation: data.contractNegotiation ? sanitize(data.contractNegotiation) : null,
          instances: sanitize(data.instances),
          publicOfficial: sanitize(data.publicOfficial),
          substantiation: data.substantiation ? sanitize(data.substantiation) : null,
        },
      },
    });
    return created.declarationPk;
  });

  const declaration = await prisma.declaration.findUnique({ where: { declarationPk }, include: declarationIncludes });
  if (!declaration) {
    res.status(500).json({ error: "Failed to read back the created declaration" });
    return;
  }
  res.status(201).json(declarationResponse(declaration));
}));

router.get("/:id", authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const declaration = await prisma.declaration.findUnique({ where: { id }, include: declarationIncludes });
  if (!declaration) {
    res.status(404).json({ error: "Declaration not found" });
    return;
  }

  if (req.user!.role === "teamMember" && declaration.declarerUserId !== toDbId(req.user!.id)) {
    res.status(403).json({ error: "Cannot view another user's declaration" });
    return;
  }
  const userOrgIdGet = req.user?.organizationId ?? undefined;
  if (declaration.organizationId !== null && userOrgIdGet !== undefined && userOrgIdGet !== null && declaration.organizationId !== toDbId(userOrgIdGet) && req.user!.role !== "admin") {
    res.status(403).json({ error: "Cannot view declaration from another organization" });
    return;
  }
  if (denyCrossDepartmentLM(req, res, declaration.snapshot?.department)) return;

  const rawSteps = (await readWorkflowStepRows(declaration.declarationPk)) || [];

  const workflowSteps = req.user!.role === "admin" || req.user!.role === "approver"
    ? rawSteps
    : rawSteps.map((s) => ({
        order: s.order,
        role: s.role,
        label: s.label,
        status: s.status,
        decision: s.decision,
        notes: s.notes,
        decidedAt: s.decidedAt,
      }));

  res.json({ ...declarationResponse(declaration), workflowSteps });
}));

router.get("/:id/audit", authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const declaration = await prisma.declaration.findUnique({ where: { id: req.params.id as string }, include: { snapshot: true } });
  if (!declaration) {
    if (req.user!.role !== "admin") {
      res.status(404).json({ error: "Declaration not found" });
      return;
    }
    const retained = await prisma.declarationAuditEvent.findMany({
      where: { declarationId: req.params.id as string },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    res.json(retained.map(auditEventResponse));
    return;
  }
  if (req.user!.role === "teamMember" && declaration.declarerUserId !== toDbId(req.user!.id)) {
    res.status(403).json({ error: "Cannot view another user's declaration history" });
    return;
  }
  const callerOrgId = req.user?.organizationId ?? undefined;
  if (declaration.organizationId !== null && callerOrgId !== undefined && callerOrgId !== null && declaration.organizationId !== toDbId(callerOrgId) && req.user!.role !== "admin") {
    res.status(403).json({ error: "Cannot view declaration history from another organization" });
    return;
  }
  if (denyCrossDepartmentLM(req, res, declaration.snapshot?.department)) return;

  const events = await prisma.declarationAuditEvent.findMany({
    where: { declarationPk: declaration.declarationPk },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  res.json(events.map(auditEventResponse));
}));

router.put("/:id", authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const existing = await prisma.declaration.findUnique({ where: { id }, include: { snapshot: true, detail: true } });
  if (!existing) {
    res.status(404).json({ error: "Declaration not found" });
    return;
  }
  if (existing.status !== "Draft" && existing.status !== "Returned") {
    res.status(400).json({ error: "Only drafts or returned declarations can be edited" });
    return;
  }
  // Org isolation
  const userOrgIdPut = req.user?.organizationId ?? undefined;
  if (existing.organizationId !== null && userOrgIdPut !== undefined && userOrgIdPut !== null && existing.organizationId !== toDbId(userOrgIdPut) && req.user!.role !== "admin") {
    res.status(403).json({ error: "Cannot edit declaration from another organization" });
    return;
  }
  if (existing.declarerUserId !== toDbId(req.user!.id) && req.user!.role !== "admin") {
    res.status(403).json({ error: "Cannot edit another user's declaration" });
    return;
  }
  if (denyCrossDepartmentLM(req, res, existing.snapshot?.department)) return;

  const parsed = createSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const data = parsed.data;
  const priorityInputChanged = data.value !== undefined || data.priority !== undefined;
  const sysCfg2 = priorityInputChanged ? await prisma.systemConfig.findFirst() : null;
  if (data.value !== undefined) {
    const maxVal2 = Number(sysCfg2?.maximumValue ?? 1000000);
    if (data.value > maxVal2) {
      res.status(400).json({ error: `Maximum value exceeded. Please enter an amount of R${maxVal2.toLocaleString("en-ZA").replace(/,/g, " ")} or less to continue.` });
      return;
    }
  }
  // Prevent org spoof on update — non-admin cannot change org
  const bodyOrgPut = data.organizationId !== undefined ? toDbId(data.organizationId) : undefined;
  if (bodyOrgPut !== undefined && req.user!.role !== "admin") {
    if (userOrgIdPut === undefined || userOrgIdPut === null || bodyOrgPut !== toDbId(userOrgIdPut)) {
      res.status(403).json({ error: "Cannot move declaration to another organization" });
      return;
    }
  }
  if (bodyOrgPut !== undefined) {
    const orgExists = await prisma.organization.findUnique({ where: { id: bodyOrgPut } });
    if (!orgExists) {
      res.status(400).json({ error: "Invalid organizationId" });
      return;
    }
  }

  // Editable via PUT: everything EXCEPT the immutable declarer identity
  // (employee name, teamMemberNumber, position, department — captured once
  // into DeclarationSnapshot at creation). Identity corrections require admin
  // action. lineManager snapshot updates are admin-only, including
  // Draft/Returned edits; self-service payloads cannot alter snapshot
  // identity and are ignored.
  const updateData: Prisma.DeclarationUncheckedUpdateInput = {};
  if (data.type !== undefined) updateData.type = sanitize(data.type);
  if (data.value !== undefined) updateData.value = data.value;
  if (priorityInputChanged) {
    updateData.priority = declarationPriorityForValue(
      data.value ?? Number(existing.value),
      Number(sysCfg2?.highValueThreshold ?? 1000),
      Number(sysCfg2?.mediumValueThreshold ?? 1000),
    );
  }
  if (bodyOrgPut !== undefined) updateData.organizationId = bodyOrgPut;
  if (data.date !== undefined) updateData.eventDate = parseDateSafe(data.date);
  if (data.submitted !== undefined) updateData.submittedAt = parseDateSafe(data.submitted);

  const sanitizeFields = new Set(["type", "priority", "counterparty", "description", "relationship", "receivedGiven", "contactPerson", "biddingProcess", "contractNegotiation", "occasion", "instances", "publicOfficial", "substantiation", "from"]);
  const detailPatch: Record<string, unknown> = {};
  for (const key of ["description", "relationship", "receivedGiven", "contactPerson", "biddingProcess", "contractNegotiation", "occasion", "instances", "publicOfficial", "substantiation"] as const) {
    const val = data[key];
    if (val !== undefined) detailPatch[key] = typeof val === "string" && sanitizeFields.has(key) ? sanitize(val) : val;
  }
  if (data.from !== undefined) detailPatch.from = sanitize(data.from);

  // Resolve relational links after the declaration lock so a stale write does
  // not leave an orphaned counterparty and an approver cannot be deleted
  // between lookup and update. Reassignment keeps the display name aligned.
  let putCounterpartyId: bigint | null | undefined;
  let putApproverUser: bigint | null | undefined;

  // Single transaction: lean row, links, pre-submit snapshot manager, detail.
  // Status/approver ownership: `status` and `currentApproverUserId` are
  // deliberately maintained cache columns summarizing the step rows (they
  // power lists/reports without step joins). The approver preference written
  // here is pre-submit only; whenever steps are (re)built, the approver is
  // re-derived from the first pending step in the same transaction (below,
  // and in submit/approve paths).
  const pk = existing.declarationPk;
  const willRebuildSteps =
    existing.status === "Returned" && data.value !== undefined && data.value !== Number(existing.value);
  let rebuiltWorkflowSteps: WorkflowStep[] | null = null;
  if (willRebuildSteps) {
    const instance = await prisma.workflowInstance.findUnique({ where: { declarationPk: pk } });
    if (instance) {
      if (existing.declarerUserId === null) {
        res.status(400).json({ error: "Declaration has no linked owner and its workflow cannot be rebuilt" });
        return;
      }
      const savedSteps = (await readWorkflowStepRows(pk)) || [];
      const freshSteps = await createWorkflowSteps(pk, existing.declarerUserId, data.value!);
      const approvedMap = new Map(savedSteps.filter((step) => step.status === "approved").map((step) => [step.role, step]));
      rebuiltWorkflowSteps = freshSteps.map((step) => {
        const approved = approvedMap.get(step.role);
        return approved
          ? { ...step, status: "approved" as const, decision: approved.decision, notes: approved.notes, decidedAt: approved.decidedAt, decidedById: approved.decidedById, decidedByName: approved.decidedByName, approvedAt: approved.approvedAt }
          : step;
      });
    }
  }
  const updateResult = await prisma.$transaction(async (tx) => {
    if (!await lockDeclarationRow(tx, pk)) return { kind: "not_found" as const };
    const currentDeclaration = await tx.declaration.findUnique({
      where: { declarationPk: pk },
      include: { snapshot: true },
    });
    if (!currentDeclaration) return { kind: "not_found" as const };
    if (currentDeclaration.status !== "Draft" && currentDeclaration.status !== "Returned") {
      return { kind: "not_editable" as const };
    }
    const callerOrgId = req.user?.organizationId ?? undefined;
    if (currentDeclaration.organizationId !== null && callerOrgId !== undefined && callerOrgId !== null && currentDeclaration.organizationId !== toDbId(callerOrgId) && req.user!.role !== "admin") {
      return { kind: "wrong_organization" as const };
    }
    if (currentDeclaration.declarerUserId !== toDbId(req.user!.id) && req.user!.role !== "admin") {
      return { kind: "not_owner" as const };
    }
    if (isCrossDepartmentLMDenied(req, currentDeclaration.snapshot?.department)) {
      return { kind: "wrong_department" as const };
    }
    if (currentDeclaration.updatedAt.getTime() !== existing.updatedAt.getTime()) {
      return { kind: "stale" as const };
    }
    if (data.counterparty !== undefined) {
      if (data.counterparty) {
        const contactText = data.contactPerson ?? existing.detail?.contactPerson ?? null;
        const cp = await ensureCounterparty(
          sanitize(data.counterparty),
          bodyOrgPut ?? existing.organizationId,
          contactText ? sanitize(contactText) : null,
          tx,
        );
        putCounterpartyId = cp?.id ?? null;
      } else {
        putCounterpartyId = null;
      }
    }
    if (data.approverId !== undefined) {
      const approverPk = toDbId(data.approverId);
      const putAu = await tx.user.findUnique({ where: { id: approverPk }, select: { id: true } });
      putApproverUser = putAu?.id ?? null;
    }

    const txData: Prisma.DeclarationUncheckedUpdateInput = { ...updateData };
    if (putCounterpartyId !== undefined) txData.counterpartyId = putCounterpartyId;
    // Skip the approver preference when steps are rebuilt below — the
    // rebuilt rows own the approver (derived from first pending step).
    if (putApproverUser !== undefined && !willRebuildSteps) txData.currentApproverUserId = putApproverUser;
    await tx.declaration.update({ where: { declarationPk: pk }, data: txData });
    // Self-service identity lock: non-admin callers cannot alter snapshot
    // identity through declaration updates, including draft/returned edits.
    // Admin corrections use user administration; declaration payloads never
    // rewrite snapshot identity for non-admins.
    if (data.lineManager !== undefined && req.user!.role === "admin") {
      await tx.declarationSnapshot.upsert({
        where: { declarationPk: pk },
        create: {
          declarationPk: pk,
          declarerName: existing.snapshot?.declarerName || "",
          employeeNumber: existing.snapshot?.employeeNumber || "",
          positionTitle: existing.snapshot?.positionTitle || "",
          department: existing.snapshot?.department || "",
          managerDisplayName: sanitize(data.lineManager) || null,
        },
        update: { managerDisplayName: sanitize(data.lineManager) || null },
      });
    }
    if (Object.keys(detailPatch).length > 0) {
      const current = await tx.declarationDetail.findUnique({ where: { declarationPk: pk } });
      const base = {
        description: current?.description ?? "",
        occasion: current?.occasion ?? "",
        relationship: current?.relationship ?? "",
        receivedGiven: current?.receivedGiven ?? "",
        fromField: current?.fromField ?? "",
        contactPerson: current?.contactPerson ?? "",
        biddingProcess: current?.biddingProcess ?? "",
        contractNegotiation: current?.contractNegotiation ?? null,
        instances: current?.instances ?? "",
        publicOfficial: current?.publicOfficial ?? "",
        substantiation: current?.substantiation ?? null,
      };
      const aliasMap: Record<string, string> = { from: "fromField" };
      for (const [k, v] of Object.entries(detailPatch)) {
        // Boundary label: keys are the fixed detail allow-list above and
        // values are validated/sanitized strings; the base object keeps its
        // literal detail type for the upsert below, so only this computed
        // assignment is cast.
        (base as Record<string, string | null>)[aliasMap[k] || k] = v as string;
      }
      await tx.declarationDetail.upsert({ where: { declarationPk: pk }, create: { declarationPk: pk, ...base }, update: base });
    }
    const auditFields = [...new Set([
      ...Object.keys(updateData),
      ...Object.keys(detailPatch),
      ...(data.lineManager !== undefined && req.user!.role === "admin" ? ["snapshot.managerDisplayName"] : []),
      ...(putCounterpartyId !== undefined ? ["counterpartyId"] : []),
      ...(putApproverUser !== undefined ? ["currentApproverUserId"] : []),
    ])];
    if (auditFields.length > 0) {
      await recordDeclarationAudit(tx, {
        declarationPk: pk,
        declarationId: existing.id,
        organizationId: bodyOrgPut !== undefined ? bodyOrgPut : existing.organizationId,
        actorUserId: req.user!.id,
        actorName: req.user!.name,
        action: "updated",
        changedFields: auditFields,
        oldValues: {
          type: existing.type,
          value: Number(existing.value),
          priority: existing.priority,
          eventDate: existing.eventDate,
          submittedAt: existing.submittedAt,
          status: existing.status,
          snapshot: existing.snapshot,
          detail: existing.detail,
          organizationId: existing.organizationId,
          counterpartyId: existing.counterpartyId,
          currentApproverUserId: existing.currentApproverUserId,
        },
        newValues: {
          ...updateData,
          ...detailPatch,
          ...(bodyOrgPut !== undefined ? { organizationId: bodyOrgPut } : {}),
          ...(putCounterpartyId !== undefined ? { counterpartyId: putCounterpartyId } : {}),
          ...(putApproverUser !== undefined ? { currentApproverUserId: putApproverUser } : {}),
          ...(data.lineManager !== undefined && req.user!.role === "admin" ? { managerDisplayName: sanitize(data.lineManager) || null } : {}),
        },
      });
    }
    if (rebuiltWorkflowSteps) {
      const next = rebuiltWorkflowSteps.find((step) => step.status === "pending");
      await writeWorkflowStepsTx(tx, pk, rebuiltWorkflowSteps);
      await tx.declaration.update({
        where: { declarationPk: pk },
        data: { currentApproverUserId: next?.assignee === null || next?.assignee === undefined ? null : toDbId(next.assignee) },
      });
      await recordDeclarationAudit(tx, {
        declarationPk: pk,
        declarationId: existing.id,
        organizationId: bodyOrgPut !== undefined ? bodyOrgPut : existing.organizationId,
        actorUserId: req.user!.id,
        actorName: req.user!.name,
        action: "updated",
        changedFields: ["workflowSteps", "currentApproverUserId"],
        oldValues: { currentApproverUserId: existing.currentApproverUserId },
        newValues: {
          currentApproverUserId: next?.assignee ?? null,
          workflowSteps: rebuiltWorkflowSteps.map((step) => ({ order: step.order, role: step.role, status: step.status, assignee: step.assignee })),
        },
      });
    }
    return { kind: "updated" as const };
  });

  if (updateResult.kind !== "updated") {
    if (updateResult.kind === "not_editable") res.status(400).json({ error: "Only drafts or returned declarations can be edited" });
    else if (updateResult.kind === "wrong_organization") res.status(403).json({ error: "Cannot edit declaration from another organization" });
    else if (updateResult.kind === "not_owner") res.status(403).json({ error: "Cannot edit another user's declaration" });
    else if (updateResult.kind === "wrong_department") res.status(403).json({ error: "Access denied: declaration is outside your department" });
    else if (updateResult.kind === "stale") res.status(409).json({ error: "Declaration changed while you were editing; reload and retry" });
    else res.status(404).json({ error: "Declaration not found" });
    return;
  }

  const updated = await prisma.declaration.findUnique({ where: { declarationPk: pk }, include: declarationIncludes });
  if (!updated) {
    res.status(500).json({ error: "Failed to read back the updated declaration" });
    return;
  }

  res.json(declarationResponse(updated));
}));

router.delete("/:id", authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const existing = await prisma.declaration.findUnique({ where: { id }, include: { snapshot: true, detail: true, fileLinks: { include: { file: true } } } });
  if (!existing) {
    res.status(404).json({ error: "Declaration not found" });
    return;
  }
  if (existing.status !== "Draft") {
    res.status(400).json({ error: "Only draft declarations can be deleted" });
    return;
  }
  const userOrgIdDel = req.user?.organizationId ?? undefined;
  if (existing.organizationId !== null && userOrgIdDel !== undefined && userOrgIdDel !== null && existing.organizationId !== toDbId(userOrgIdDel) && req.user!.role !== "admin") {
    res.status(403).json({ error: "Cannot delete declaration from another organization" });
    return;
  }
  if (existing.declarerUserId !== toDbId(req.user!.id) && req.user!.role !== "admin") {
    res.status(403).json({ error: "Cannot delete another user's declaration" });
    return;
  }
  if (denyCrossDepartmentLM(req, res, existing.snapshot?.department)) return;

  const pk = existing.declarationPk;
  // One transaction for all database deletes: a failure rolls everything
  // back instead of leaving orphaned child rows behind a deleted parent
  // Hold the declaration lock through validation and delete so submission and
  // evidence mutations serialize with this operation. Storage cleanup happens
  // after commit; a storage failure cannot invalidate the DB transaction.
  const deletion = await prisma.$transaction(async (tx) => {
    if (!await lockDeclarationRow(tx, pk)) return { kind: "not_found" as const };
    const current = await tx.declaration.findUnique({
      where: { declarationPk: pk },
      include: { snapshot: true, detail: true, fileLinks: { include: { file: true } } },
    });
    if (!current) return { kind: "not_found" as const };
    if (current.status !== "Draft") return { kind: "not_draft" as const };
    const callerOrgId = req.user?.organizationId ?? undefined;
    if (current.organizationId !== null && callerOrgId !== undefined && callerOrgId !== null && current.organizationId !== toDbId(callerOrgId) && req.user!.role !== "admin") {
      return { kind: "wrong_organization" as const };
    }
    if (current.declarerUserId !== toDbId(req.user!.id) && req.user!.role !== "admin") {
      return { kind: "not_owner" as const };
    }
    if (isCrossDepartmentLMDenied(req, current.snapshot?.department)) {
      return { kind: "wrong_department" as const };
    }
    if (current.fileLinks.some((link) => !isAzuriteAttachment(link.file.storageReference))) {
      return { kind: "migration" as const };
    }

    const fileIds = current.fileLinks.map((link) => link.fileId);
    for (const link of current.fileLinks) {
      await enqueueAttachmentCleanup(tx, link.file.storageReference);
    }
    await recordDeclarationAudit(tx, {
      declarationPk: pk,
      declarationId: current.id,
      organizationId: current.organizationId,
      actorUserId: req.user!.id,
      actorName: req.user!.name,
      action: "deleted",
      changedFields: ["declaration"],
      oldValues: {
        type: current.type,
        value: Number(current.value),
        status: current.status,
        priority: current.priority,
        snapshot: current.snapshot,
        detail: current.detail,
        files: current.fileLinks.map((link) => ({ name: link.file.originalName, size: link.file.size, mimeType: link.file.mimeType })),
      },
    });
    await tx.declarationFile.deleteMany({ where: { declarationPk: pk } });
    if (fileIds.length > 0) await tx.uploadedFile.deleteMany({ where: { id: { in: fileIds } } });
    await tx.workflowInstance.deleteMany({ where: { declarationPk: pk } });
    await tx.workflowInstanceStep.deleteMany({ where: { declarationPk: pk } });
    await tx.declarationSnapshot.deleteMany({ where: { declarationPk: pk } });
    await tx.declarationDetail.deleteMany({ where: { declarationPk: pk } });
    await tx.declaration.delete({ where: { declarationPk: pk } });
    return { kind: "deleted" as const };
  });

  if (deletion.kind !== "deleted") {
    if (deletion.kind === "not_draft") res.status(400).json({ error: "Only draft declarations can be deleted" });
    else if (deletion.kind === "wrong_organization") res.status(403).json({ error: "Cannot delete declaration from another organization" });
    else if (deletion.kind === "not_owner") res.status(403).json({ error: "Cannot delete another user's declaration" });
    else if (deletion.kind === "wrong_department") res.status(403).json({ error: "Access denied: declaration is outside your department" });
    else if (deletion.kind === "migration") res.status(503).json({ error: "Attachment storage migration required; ask an administrator to migrate existing uploads to Azurite" });
    else res.status(404).json({ error: "Declaration not found" });
    return;
  }

  res.json({ message: "Declaration deleted" });
}));

router.patch("/:id/submit", authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const existing = await prisma.declaration.findUnique({ where: { id }, include: { snapshot: true, detail: true } });
  if (!existing) {
    res.status(404).json({ error: "Declaration not found" });
    return;
  }
  if (existing.status !== "Draft" && existing.status !== "Returned") {
    res.status(400).json({ error: "Only drafts or returned declarations can be submitted" });
    return;
  }
  const userOrgIdSub = req.user?.organizationId ?? undefined;
  if (existing.organizationId !== null && userOrgIdSub !== undefined && userOrgIdSub !== null && existing.organizationId !== toDbId(userOrgIdSub) && req.user!.role !== "admin") {
    res.status(403).json({ error: "Cannot submit declaration from another organization" });
    return;
  }
  if (existing.declarerUserId !== toDbId(req.user!.id) && req.user!.role !== "admin") {
    res.status(403).json({ error: "Cannot submit another user's declaration" });
    return;
  }
  // Ownerless (legacy/imported) rows cannot enter workflow: step creation
  // requires a declarer to resolve the manager chain.
  if (existing.declarerUserId === null) {
    res.status(400).json({ error: "Declaration has no linked owner and cannot be submitted" });
    return;
  }
  if (denyCrossDepartmentLM(req, res, existing.snapshot?.department)) return;

  const pk = existing.declarationPk;
  const existingInstance = await prisma.workflowInstance.findUnique({ where: { declarationPk: pk } });

  let workflowSteps: WorkflowStep[];
  if (existing.status === "Returned" && existingInstance) {
    const savedSteps = (await readWorkflowStepRows(pk)) || [];
    const hasReturnedStep = savedSteps.some((step) => step.status === "returned");
    if (hasReturnedStep) {
      // Rebuild from the current value so a returned low-value declaration that
      // becomes high-value gains the HR step on resubmission.
      const freshSteps = await createWorkflowSteps(pk, existing.declarerUserId!, Number(existing.value));
      // Preserve approvals only for roles present in the newly selected rule.
      const approvedMap = new Map(savedSteps.filter((s) => s.status === "approved").map((s) => [s.role, s]));
      workflowSteps = freshSteps.map((fs) => {
        const approved = approvedMap.get(fs.role);
        return approved
          ? { ...fs, status: "approved" as const, decision: approved.decision, notes: approved.notes, decidedAt: approved.decidedAt, decidedById: approved.decidedById, decidedByName: approved.decidedByName, approvedAt: approved.approvedAt }
          : fs;
      });
    } else {
      workflowSteps = await createWorkflowSteps(pk, existing.declarerUserId!, Number(existing.value));
    }
  } else {
    workflowSteps = await createWorkflowSteps(pk, existing.declarerUserId!, Number(existing.value));
  }

  const nextApprover = workflowSteps.find((step) => step.status === "pending");
  // NOTE: when every step is skipped (e.g. an LM-only rule with no
  // resolvable line manager) there is no actionable approver and the
  // declaration sits in Pending until an admin intervenes.
  const approverIdValue = nextApprover ? nextApprover.assignee : (existing.currentApproverUserId === null ? null : toJsonId(existing.currentApproverUserId));

  // User-link existence is resolved before the transaction (pure reads, so the
  // transaction holds the write lock for the shortest possible time).
  let submitApproverUser: bigint | null = null;
  if (approverIdValue !== null) {
    const submitAu = await prisma.user.findUnique({ where: { id: toDbId(approverIdValue) }, select: { id: true } });
    if (submitAu) submitApproverUser = submitAu.id;
  }

  // Single transaction: declaration status, canonical approver link, the
  // authoritative step rows, the producing rule, and the frozen snapshot/detail.
  const ruleId = await resolveRuleId(Number(existing.value));
  const submitResult = await prisma.$transaction(async (tx) => {
    if (!await lockDeclarationRow(tx, pk)) return { kind: "not_found" as const };
    const currentDeclaration = await tx.declaration.findUnique({
      where: { declarationPk: pk },
      include: { snapshot: true },
    });
    if (!currentDeclaration) return { kind: "not_found" as const };
    if (currentDeclaration.status !== "Draft" && currentDeclaration.status !== "Returned") {
      return { kind: "not_submittable" as const };
    }
    const callerOrgId = req.user?.organizationId ?? undefined;
    if (currentDeclaration.organizationId !== null && callerOrgId !== undefined && callerOrgId !== null && currentDeclaration.organizationId !== toDbId(callerOrgId) && req.user!.role !== "admin") {
      return { kind: "wrong_organization" as const };
    }
    if (currentDeclaration.declarerUserId !== toDbId(req.user!.id) && req.user!.role !== "admin") {
      return { kind: "not_owner" as const };
    }
    if (currentDeclaration.declarerUserId === null) return { kind: "ownerless" as const };
    if (isCrossDepartmentLMDenied(req, currentDeclaration.snapshot?.department)) {
      return { kind: "wrong_department" as const };
    }
    // Workflow steps were built from the initial read. Reject if another write
    // changed the declaration while that work was prepared; never submit stale
    // value, identity, or snapshot data over a concurrent edit.
    if (currentDeclaration.updatedAt.getTime() !== existing.updatedAt.getTime()) {
      return { kind: "stale" as const };
    }

    await tx.declaration.update({
      where: { declarationPk: pk },
      data: {
        status: "Pending",
        currentApproverUserId: submitApproverUser,
      },
    });
    await writeWorkflowStepsTx(tx, pk, workflowSteps, ruleId);
    await captureDeclarationSnapshot(
      pk,
      {
        name: existing.snapshot?.declarerName || "",
        teamMemberNumber: existing.snapshot?.employeeNumber || "",
        position: existing.snapshot?.positionTitle || "",
        department: existing.snapshot?.department || "",
      },
      existing.snapshot?.managerDisplayName || null,
      tx,
    );
    const det = await tx.declarationDetail.findUnique({ where: { declarationPk: pk } });
    if (!det) {
      await tx.declarationDetail.create({
        data: {
          declarationPk: pk,
          description: "",
          occasion: "",
          relationship: "",
          receivedGiven: "",
          fromField: "",
          contactPerson: "",
          biddingProcess: "",
          instances: "",
          publicOfficial: "",
        },
      });
    }
    await recordDeclarationAudit(tx, {
      declarationPk: pk,
      declarationId: existing.id,
      organizationId: existing.organizationId,
      actorUserId: req.user!.id,
      actorName: req.user!.name,
      action: "submitted",
      changedFields: ["status", "currentApproverUserId", "workflowSteps"],
      oldValues: { status: existing.status, currentApproverUserId: existing.currentApproverUserId },
      newValues: {
        status: "Pending",
        currentApproverUserId: submitApproverUser,
        workflowSteps: workflowSteps.map((step) => ({ order: step.order, role: step.role, status: step.status, assignee: step.assignee })),
      },
    });

    if (nextApprover && nextApprover.assignee !== null) {
      const event = nextApprover.role === "hr" ? "hrApproval" : "managerApproval";
      const pendingStep = await tx.workflowInstanceStep.findFirst({
        where: { declarationPk: pk, stepOrder: nextApprover.order, status: "pending", assigneeId: toDbId(nextApprover.assignee) },
        select: { id: true },
      });
      if (pendingStep) {
        await queueNotificationSafely(
          tx,
          event,
          existing.id,
          nextApprover.assignee,
          notificationDedupeKey(event, existing.id, pendingStep.id, nextApprover.assignee),
        );
      }
    }
    return { kind: "submitted" as const };
  });

  if (submitResult.kind !== "submitted") {
    if (submitResult.kind === "not_submittable") res.status(400).json({ error: "Only drafts or returned declarations can be submitted" });
    else if (submitResult.kind === "wrong_organization") res.status(403).json({ error: "Cannot submit declaration from another organization" });
    else if (submitResult.kind === "not_owner") res.status(403).json({ error: "Cannot submit another user's declaration" });
    else if (submitResult.kind === "ownerless") res.status(400).json({ error: "Declaration has no linked owner and cannot be submitted" });
    else if (submitResult.kind === "wrong_department") res.status(403).json({ error: "Access denied: declaration is outside your department" });
    else if (submitResult.kind === "stale") res.status(409).json({ error: "Declaration changed while it was being submitted; reload and retry" });
    else res.status(404).json({ error: "Declaration not found" });
    return;
  }

  const updated = await prisma.declaration.findUnique({ where: { declarationPk: pk }, include: declarationIncludes });
  if (!updated) {
    res.status(500).json({ error: "Failed to read back the submitted declaration" });
    return;
  }
  res.json(declarationResponse(updated));
}));

router.patch("/:id/status", authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.user!.role !== "admin") {
    res.status(403).json({ error: "Only admins can change declaration status directly" });
    return;
  }

  const id = req.params.id as string;
  const { status } = req.body;
  const validStatuses = ["Draft", "Pending", "Approved", "Declined", "Escalated", "Returned"];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
    return;
  }

  const pk = await getDeclarationPk(id);
  if (!pk) {
    res.status(404).json({ error: "Declaration not found" });
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    if (!await lockDeclarationRow(tx, pk)) return { kind: "not_found" as const };
    const existing = await tx.declaration.findUnique({ where: { declarationPk: pk } });
    if (!existing) return { kind: "not_found" as const };

    const instance = await tx.workflowInstance.findUnique({ where: { declarationPk: pk } });
    const steps: WorkflowStep[] = instance ? (await readWorkflowStepRows(pk, tx)) || [] : [];
    const hasPendingStep = steps.some((step) => step.status === "pending");
    const hasActionablePendingStep = steps.some((step) =>
      step.status === "pending" && !steps.some((prior) =>
        prior.order < step.order && prior.status !== "approved" && prior.status !== "skipped",
      ),
    );
    if (status === "Draft" && instance) {
      return { kind: "draft_with_workflow" as const };
    }
    if (status === "Pending" && (!instance || !hasActionablePendingStep)) {
      return { kind: "pending_without_step" as const };
    }
    if (status === "Returned" && hasActionablePendingStep) {
      return { kind: "returned_with_pending_step" as const };
    }
    if (status === "Approved" || status === "Declined") {
      if (!instance) return { kind: "terminal_without_workflow" as const };
      if (hasPendingStep) return { kind: "terminal_with_pending_step" as const };
      // A terminal override needs decided workflow evidence: all-skipped (or
      // empty) steps would desync the declaration from its step rows.
      const decided = steps.some((step) => step.status !== "pending" && step.status !== "skipped");
      if (!decided) return { kind: "terminal_without_decision" as const };
    }

    await tx.declaration.update({ where: { declarationPk: pk }, data: { status } });
    await recordDeclarationAudit(tx, {
      declarationPk: pk,
      declarationId: existing.id,
      organizationId: existing.organizationId,
      actorUserId: req.user!.id,
      actorName: req.user!.name,
      action: "status_overridden",
      changedFields: ["status"],
      oldValues: { status: existing.status },
      newValues: { status },
    });
    return { kind: "updated" as const };
  });

  if (result.kind === "not_found") {
    res.status(404).json({ error: "Declaration not found" });
    return;
  }
  if (result.kind === "pending_without_step") {
    res.status(400).json({ error: "Cannot set Pending without an outstanding workflow approval step" });
    return;
  }
  if (result.kind === "draft_with_workflow") {
    res.status(400).json({ error: "Cannot reset a declaration with workflow history to Draft; use the workflow return action" });
    return;
  }
  if (result.kind === "returned_with_pending_step") {
    res.status(400).json({ error: "Cannot return a declaration while an approval step is pending; use the workflow return decision" });
    return;
  }
  if (result.kind === "terminal_without_workflow") {
    res.status(400).json({ error: "Cannot approve/decline a declaration with no workflow instance" });
    return;
  }
  if (result.kind === "terminal_with_pending_step") {
    res.status(400).json({ error: "Cannot approve/decline — pending approval step still exists" });
    return;
  }
  if (result.kind === "terminal_without_decision") {
    res.status(400).json({ error: "Cannot approve/decline — no decided workflow step exists" });
    return;
  }

  const enriched = await prisma.declaration.findUnique({ where: { declarationPk: pk }, include: declarationIncludes });
  if (!enriched) {
    res.status(500).json({ error: "Failed to read back the updated declaration" });
    return;
  }
  res.json(declarationResponse(enriched));
}));

export default router;
