import { Router, Response } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import xss from "xss";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import { prisma } from "../config/prisma";
import { authenticate, authorize, AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { createWorkflowSteps, resolveRuleId, declarationResponse, declarationIncludes } from "../services/workflowService";
import type { DeclarationWithRelations, WorkflowStep } from "../services/workflowService";
import {
  parseDateSafe,
  ensureCounterparty,
  captureDeclarationSnapshot,
  syncDeclarationDetail,
  writeWorkflowStepsTx,
  readWorkflowStepRows,
} from "../services/normalization";
import { toDbId, toJsonId } from "../services/ids";
import { sendNotification } from "../services/notificationService";
import { containedUploadPath } from "./files";
import {
  viewStatusSummaryFull,
  viewMonthly,
  viewTypeBreakdown,
} from "../services/reportingViews";

const router = Router();
const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");

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
const numericId = z.union([z.number().int(), z.string().regex(/^\d+$/)], { errorMap: () => ({ message: "Expected a numeric identifier" }) });

/**
 * Line-Manager department scoping for direct-ID routes. The list endpoint
 * filters LMs to their own department; without this, an LM could read/edit/
 * delete/submit another department's declarations by ID. Returns true when
 * access is denied (response already sent). Department comes from the
 * immutable snapshot (submission-time context).
 */
function denyCrossDepartmentLM(req: AuthRequest, res: Response, snapshotDepartment: string | null | undefined): boolean {
  if (
    req.user!.role !== "admin" &&
    req.user!.role === "approver" &&
    req.user!.department &&
    req.user!.position === "Line Manager" &&
    snapshotDepartment !== req.user!.department
  ) {
    res.status(403).json({ error: "Access denied: declaration is outside your department" });
    return true;
  }
  return false;
}

const VALID_STATUSES = ["Draft", "Pending", "Approved", "Declined", "Escalated", "Returned"] as const;

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
  const [counts, totalValueAgg, monthly, typeRows] = await Promise.all([
    prisma.declaration.groupBy({ by: ["status"], where: orgWhere, _count: { status: true } }),
    prisma.declaration.aggregate({ where: orgWhere, _sum: { value: true } }),
    prisma.declaration.findMany({ where: { ...orgWhere, eventDate: { not: null } }, select: { eventDate: true, status: true } }),
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
    totalValue: totalValueAgg._sum.value || 0,
  };
  const monthMap = new Map<string, { approved: number; declined: number }>();
  for (const d of monthly) {
    if (!d.eventDate) continue;
    const month = new Date(d.eventDate).toISOString().slice(0, 7);
    const e = monthMap.get(month) || { approved: 0, declined: 0 };
    if (d.status === "Approved") e.approved++;
    if (d.status === "Declined") e.declined++;
    monthMap.set(month, e);
  }
  const complianceTrend = [...monthMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([month, v]) => ({ month, ...v }));
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
  if (search) {
    const q = String(search);
    declarations = await prisma.declaration.findMany({ where, orderBy: { submittedAt: "desc" }, include: declarationIncludes });
    const qLower = q.toLowerCase();
    declarations = declarations.filter(
      (d) =>
        String(d.snapshot?.declarerName || "").toLowerCase().includes(qLower) ||
        String(d.counterpartyRef?.name || "").toLowerCase().includes(qLower) ||
        String(d.id || "").toLowerCase().includes(qLower) ||
        String(d.detail?.description || "").toLowerCase().includes(qLower)
    );
  } else if (limit !== undefined) {
    declarations = await prisma.declaration.findMany({ where, orderBy: { submittedAt: "desc" }, take: limit, skip: offset, include: declarationIncludes });
  } else {
    declarations = await prisma.declaration.findMany({ where, orderBy: { submittedAt: "desc" }, include: declarationIncludes });
  }

  // Pagination (in-memory slice after search; keeps backwards compatible when no limit)
  if (limit !== undefined) {
    declarations = declarations.slice(offset, offset + limit);
  }

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
  type: z.string().min(1),
  counterparty: z.string().min(1),
  value: z.number().nonnegative(),
  submitted: z.string(),
  approver: z.string().optional(),
  approverId: numericId.optional(),
  // No `status` key: the server owns it ("Draft" on create). Accepting it
  // would silently discard a client-supplied Pending and mislead callers.
  priority: z.string(),
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
  files: z.any().optional(),
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
  const maxVal = sysCfg?.maximumValue ?? 1000000;
  if (data.value > maxVal) {
    res.status(400).json({ error: `Maximum value exceeded. Please enter an amount of R${maxVal.toLocaleString("en-ZA").replace(/,/g, " ")} or less to continue.` });
    return;
  }
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
    orgId = bodyOrg;
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
      : prisma.user.findUnique({ where: { id: employeePk }, select: { id: true, name: true } }),
    data.approverId !== undefined
      ? toDbId(data.approverId) === callerPk
        ? Promise.resolve({ id: callerPk })
        : prisma.user.findUnique({ where: { id: toDbId(data.approverId) }, select: { id: true } })
      : Promise.resolve(null),
  ]);
  const declarerUserId: bigint | null = declarerRow?.id || null;
  const txApproverUserId: bigint | null = approverRow?.id || null;

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
        priority: sanitize(data.priority),
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
        department: sanitize(data.department),
      },
      sanitize(data.lineManager) || null,
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
  if (data.value !== undefined) {
    const sysCfg2 = await prisma.systemConfig.findFirst();
    const maxVal2 = sysCfg2?.maximumValue ?? 1000000;
    if (data.value > maxVal2) {
      res.status(400).json({ error: `Maximum value exceeded. Please enter an amount of R${maxVal2.toLocaleString("en-ZA").replace(/,/g, " ")} or less to continue.` });
      return;
    }
  }
  // Prevent org spoof on update — non-admin cannot change org
  const bodyOrgPut = data.organizationId !== undefined ? toDbId(data.organizationId) : undefined;
  if (bodyOrgPut !== undefined && userOrgIdPut !== undefined && userOrgIdPut !== null && bodyOrgPut !== toDbId(userOrgIdPut) && req.user!.role !== "admin") {
    res.status(403).json({ error: "Cannot move declaration to another organization" });
    return;
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
  // recreation. lineManager stays editable while Draft/Returned (pre-submit
  // context, not yet audited); the snapshot manager is updated alongside and
  // frozen at submit.
  const updateData: Record<string, unknown> = {};
  if (data.type !== undefined) updateData.type = sanitize(data.type);
  if (data.value !== undefined) updateData.value = data.value;
  if (data.priority !== undefined) updateData.priority = sanitize(data.priority);
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

  // Resolve relational links before the transaction (pure reads).
  // When approverId is reassigned the approver display name moves with it —
  // otherwise the detail view shows the previous manager's name with the new id.
  let putCounterpartyId: bigint | null | undefined;
  if (data.counterparty !== undefined) {
    if (data.counterparty) {
      const contactText = data.contactPerson ?? existing.detail?.contactPerson ?? null;
      const cp = await ensureCounterparty(sanitize(data.counterparty), bodyOrgPut ?? existing.organizationId, contactText ? sanitize(contactText) : null);
      putCounterpartyId = cp?.id || null;
    } else {
      putCounterpartyId = null;
    }
  }
  let putApproverUser: bigint | null | undefined;
  if (data.approverId !== undefined) {
    const approverPk = toDbId(data.approverId);
    const putAu = await prisma.user.findUnique({ where: { id: approverPk }, select: { id: true } });
    putApproverUser = putAu ? putAu.id : null;
  }

  // Single transaction: lean row, links, pre-submit snapshot manager, detail.
  // Status/approver ownership: `status` and `currentApproverUserId` are
  // deliberately maintained cache columns summarizing the step rows (they
  // power lists/reports without step joins). The approver preference written
  // here is pre-submit only; whenever steps are (re)built, the approver is
  // re-derived from the first pending step in the same transaction (below,
  // and in submit/approve paths).
  const pk = existing.declarationPk;
  const willRebuildSteps =
    existing.status === "Returned" && data.value !== undefined && data.value !== existing.value;
  await prisma.$transaction(async (tx) => {
    // Boundary label: updateData is assembled from individually validated
    // zod fields above; the spread into the update input is the one place
    // the validated pieces rejoin a Prisma input type.
    const txData: any = { ...updateData };
    if (putCounterpartyId !== undefined) txData.counterpartyId = putCounterpartyId;
    // Skip the approver preference when steps are rebuilt below — the
    // rebuilt rows own the approver (derived from first pending step).
    if (putApproverUser !== undefined && !willRebuildSteps) txData.currentApproverUserId = putApproverUser;
    await tx.declaration.update({ where: { declarationPk: pk }, data: txData });
    if (data.lineManager !== undefined) {
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
  });

  const updated = await prisma.declaration.findUnique({ where: { declarationPk: pk }, include: declarationIncludes });
  if (!updated) {
    res.status(500).json({ error: "Failed to read back the updated declaration" });
    return;
  }

  // Refresh the workflow immediately when a returned declaration's value
  // changes, so the detail view reflects newly required approvers before submit.
  // The approver link is re-derived from the rebuilt first pending step in
  // the same transaction (step rows own the approver, not the PUT payload).
  let response = updated;
  if (willRebuildSteps) {
    const instance = await prisma.workflowInstance.findUnique({ where: { declarationPk: pk } });
    if (instance) {
      const savedSteps = (await readWorkflowStepRows(pk)) || [];
      const freshSteps = await createWorkflowSteps(pk, existing.declarerUserId!, updated.value);
      const approvedMap = new Map(savedSteps.filter((s) => s.status === "approved").map((s) => [s.role, s]));
      const workflowSteps: WorkflowStep[] = freshSteps.map((step) => {
        const approved = approvedMap.get(step.role);
        return approved
          ? { ...step, status: "approved" as const, decision: approved.decision, notes: approved.notes, decidedAt: approved.decidedAt, decidedById: approved.decidedById, decidedByName: approved.decidedByName, approvedAt: approved.approvedAt }
          : step;
      });
      const next = workflowSteps.find((s) => s.status === "pending");
      await prisma.$transaction(async (tx) => {
        await writeWorkflowStepsTx(tx, pk, workflowSteps);
        await tx.declaration.update({
          where: { declarationPk: pk },
          data: { currentApproverUserId: next?.assignee === null || next?.assignee === undefined ? null : toDbId(next.assignee) },
        });
      });
      const reread = await prisma.declaration.findUnique({ where: { declarationPk: pk }, include: declarationIncludes });
      if (!reread) {
        res.status(500).json({ error: "Failed to read back the updated declaration" });
        return;
      }
      response = reread;
    }
  }

  res.json(declarationResponse(response));
}));

router.delete("/:id", authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const existing = await prisma.declaration.findUnique({ where: { id }, include: { snapshot: true, fileLinks: { include: { file: true } } } });
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

  // Delete disk files via the join rows (the only file association).
  const pk = existing.declarationPk;
  const links = await prisma.declarationFile.findMany({ where: { declarationPk: pk }, include: { file: true } });
  await Promise.all(links.map(async (l) => {
    const fp = containedUploadPath(l.file.path);
    if (!fp) return;
    try { await fs.promises.unlink(fp); } catch { /* file may have been deleted already */ }
  }));
  const fileIds = links.map((l) => l.fileId);
  await prisma.declarationFile.deleteMany({ where: { declarationPk: pk } });
  if (fileIds.length > 0) {
    await prisma.uploadedFile.deleteMany({ where: { id: { in: fileIds } } });
  }
  await Promise.all([
    prisma.workflowInstance.deleteMany({ where: { declarationPk: pk } }),
    prisma.workflowInstanceStep.deleteMany({ where: { declarationPk: pk } }).catch(() => undefined),
    prisma.declarationSnapshot.deleteMany({ where: { declarationPk: pk } }).catch(() => undefined),
    prisma.declarationDetail.deleteMany({ where: { declarationPk: pk } }).catch(() => undefined),
  ]);
  await prisma.declaration.delete({ where: { declarationPk: pk } });

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
      const freshSteps = await createWorkflowSteps(pk, existing.declarerUserId!, existing.value);
      // Preserve approvals only for roles present in the newly selected rule.
      const approvedMap = new Map(savedSteps.filter((s) => s.status === "approved").map((s) => [s.role, s]));
      workflowSteps = freshSteps.map((fs) => {
        const approved = approvedMap.get(fs.role);
        return approved
          ? { ...fs, status: "approved" as const, decision: approved.decision, notes: approved.notes, decidedAt: approved.decidedAt, decidedById: approved.decidedById, decidedByName: approved.decidedByName, approvedAt: approved.approvedAt }
          : fs;
      });
    } else {
      workflowSteps = await createWorkflowSteps(pk, existing.declarerUserId!, existing.value);
    }
  } else {
    workflowSteps = await createWorkflowSteps(pk, existing.declarerUserId!, existing.value);
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
  const ruleId = await resolveRuleId(existing.value);
  await prisma.$transaction(async (tx) => {
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
  });

  const updated = await prisma.declaration.findUnique({ where: { declarationPk: pk }, include: declarationIncludes });
  if (!updated) {
    res.status(500).json({ error: "Failed to read back the submitted declaration" });
    return;
  }
  res.json(declarationResponse(updated));
  if (nextApprover && nextApprover.assignee !== null) {
    void sendNotification(nextApprover.role === "hr" ? "hrApproval" : "managerApproval", existing.id, nextApprover.assignee);
  }
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

  const existing = await prisma.declaration.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Declaration not found" });
    return;
  }
  const pk = existing.declarationPk;

  if (status === "Approved" || status === "Declined") {
    const instance = await prisma.workflowInstance.findUnique({ where: { declarationPk: pk } });
    if (!instance) {
      res.status(400).json({ error: "Cannot approve/decline a declaration with no workflow instance" });
      return;
    }
    const steps: WorkflowStep[] = (await readWorkflowStepRows(pk)) || [];
    const pendingStep = steps.find((s) => s.status === "pending");
    if (pendingStep) {
      res.status(400).json({ error: "Cannot approve/decline — pending approval step still exists" });
      return;
    }
    // A terminal override needs decided workflow evidence: all-skipped (or
    // empty) steps would desync the declaration from its step rows.
    const decided = steps.some((s) => s.status !== "pending" && s.status !== "skipped");
    if (!decided) {
      res.status(400).json({ error: "Cannot approve/decline — no decided workflow step exists" });
      return;
    }
  }

  await prisma.declaration.update({
    where: { declarationPk: pk },
    data: { status },
  });

  const enriched = await prisma.declaration.findUnique({ where: { declarationPk: pk }, include: declarationIncludes });
  if (!enriched) {
    res.status(500).json({ error: "Failed to read back the updated declaration" });
    return;
  }
  res.json(declarationResponse(enriched));
}));

export default router;
