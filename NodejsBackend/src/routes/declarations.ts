import { Router, Response } from "express";
import { z } from "zod";
import xss from "xss";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import { prisma } from "../config/prisma";
import { authenticate, authorize, AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { createWorkflowSteps, resolveRuleId, safeJsonParse, declarationResponse } from "../services/workflowService";
import {
  parseDateSafe,
  ensureCounterparty,
  captureDeclarationSnapshot,
  syncDeclarationDetail,
  writeWorkflowStepsTx,
  readWorkflowSteps,
} from "../services/normalization";
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

/**
 * Line-Manager department scoping for direct-ID routes. The list endpoint
 * filters LMs to their own department; without this, an LM could read/edit/
 * delete/submit another department's declarations by ID. Returns true when
 * access is denied (response already sent).
 */
function denyCrossDepartmentLM(req: AuthRequest, res: Response, declaration: { department: string }): boolean {
  if (
    req.user!.role !== "admin" &&
    req.user!.role === "approver" &&
    req.user!.department &&
    req.user!.position === "Line Manager" &&
    declaration.department !== req.user!.department
  ) {
    res.status(403).json({ error: "Access denied: declaration is outside your department" });
    return true;
  }
  return false;
}

function safeParseWorkflowSteps(data: string | null | undefined): any[] {
  return safeJsonParse(data) as any[] || [];
}

const VALID_STATUSES = ["Draft", "Pending", "Approved", "Declined", "Escalated", "Returned"] as const;

router.get("/stats", authenticate, authorize("admin", "approver"), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const orgId = (req.user as any)?.organizationId as string | undefined;
  const orgWhere: any = {};
  if (orgId) orgWhere.organizationId = orgId;

  // Agreed dashboard read models come from the scoped reporting views.
  // The Prisma aggregation below is the fallback for pre-migration databases
  // where the views do not exist yet. All view numerics are converted with
  // Number() — raw driver values (e.g. BigInt counts) must never reach res.json.
  try {
    const [statusRows, monthlyRows, typeRows] = await Promise.all([
      viewStatusSummaryFull(orgId),
      viewMonthly(orgId),
      viewTypeBreakdown(orgId),
    ]);
    if (statusRows && monthlyRows && typeRows) {
      const getCount = (s: string) => statusRows.find((r) => r.status === s)?.count ?? 0;
      const kpis = {
        total: statusRows.reduce((n, r) => n + r.count, 0),
        pending: getCount("Pending"),
        approved: getCount("Approved"),
        declined: getCount("Declined"),
        returned: getCount("Returned"),
        escalated: getCount("Escalated"),
        totalValue: statusRows.reduce((n, r) => n + r.totalValue, 0),
      };
      const complianceTrend = (monthlyRows as any[]).map((m) => ({
        month: String(m.month),
        approved: Number(m.approved),
        declined: Number(m.declined),
      }));
      const typeBreakdown = (typeRows as any[]).map((t) => ({
        name: String(t.type),
        value: Number(t.count),
      }));
      res.json({ kpis, complianceTrend, typeBreakdown });
      return;
    }
  } catch {
    // Fall through to legacy aggregation.
  }

  // Fallback: Prisma aggregation + static seed tables (pre-migration databases).
  const [counts, totalValueAgg, trendItems, typeItems] = await Promise.all([
    prisma.declaration.groupBy({ by: ["status"], where: orgWhere, _count: { status: true } }),
    prisma.declaration.aggregate({ where: orgWhere, _sum: { value: true } }),
    prisma.complianceTrendPoint.findMany({ orderBy: { id: "asc" } }),
    prisma.typeBreakdownItem.findMany(),
  ]);
  const countMap = new Map(counts.map((c: any) => [c.status, c._count.status]));
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

  res.json({ kpis, complianceTrend: trendItems, typeBreakdown: typeItems });
}));

router.get("/", authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const status = req.query.status as string | undefined;
  const search = req.query.search as string | undefined;
  const limit = req.query.limit ? Math.min(Math.max(parseInt(String(req.query.limit), 10) || 0, 1), 100) : undefined;
  const offset = req.query.offset ? Math.max(parseInt(String(req.query.offset), 10) || 0, 0) : 0;

  const where: any = {};
  if (status && (VALID_STATUSES as readonly string[]).includes(status)) where.status = status;
  // Org isolation — scope all queries by caller's org if present
  if ((req.user as any)?.organizationId) where.organizationId = (req.user as any).organizationId;
  if (req.user!.role === "teamMember") {
    where.employeeId = req.user!.id;
  } else if (req.user!.role === "approver" && req.user!.department && req.user!.position === "Line Manager") {
    where.department = req.user!.department;
  }

  // DB-side search using contains (Prisma SQLite is case-sensitive, so fallback to in-memory lowercasing after fetch for SQLite)
  // Ordering uses the canonical submittedAt DateTime column (populated
  // synchronously on every write from the legacy `submitted` text).
  let declarations: any[];
  if (search) {
    const q = String(search);
    // Try DB contains first; for SQLite we still filter case-insensitively in memory after
    declarations = await prisma.declaration.findMany({ where, orderBy: { submittedAt: "desc" } });
    const qLower = q.toLowerCase();
    // String() guards: legacy rows can hold nulls in text columns.
    declarations = declarations.filter(
      (d) =>
        String(d.employee || "").toLowerCase().includes(qLower) ||
        String(d.counterparty || "").toLowerCase().includes(qLower) ||
        String(d.id || "").toLowerCase().includes(qLower) ||
        String(d.description || "").toLowerCase().includes(qLower)
    );
  } else if (limit !== undefined) {
    // Bounded DB page when no search is involved (no shape change: the
    // in-memory slice below becomes a no-op for exact pages).
    declarations = await prisma.declaration.findMany({ where, orderBy: { submittedAt: "desc" }, take: limit, skip: offset });
  } else {
    declarations = await prisma.declaration.findMany({ where, orderBy: { submittedAt: "desc" } });
  }

  // Pagination (in-memory slice after search; keeps backwards compatible when no limit)
  if (limit !== undefined) {
    declarations = declarations.slice(offset, offset + limit);
  }

  res.json(declarations.map(declarationResponse));
}));

const createSchema = z.object({
  employee: z.string().min(1),
  employeeId: z.string().min(1),
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
  approverId: z.string().optional(),
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
  organizationId: z.string().optional(),
});

router.post("/", authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.user!.role === "teamMember" && req.body.employeeId !== req.user!.id) {
    res.status(403).json({ error: "Cannot create declaration for another user" });
    return;
  }

  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const data = parsed.data;
  // Enforce maximum value from SystemConfig (dynamic, not hard-coded)
  const sysCfg = await prisma.systemConfig.findFirst();
  const maxVal = (sysCfg as any)?.maximumValue ?? 1000000;
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
  let orgId: string | null = null;
  const userOrgId = (req.user as any)?.organizationId as string | undefined;
  if (userOrgId) {
    // Non-admin must stay in own org
    if (data.organizationId && data.organizationId !== userOrgId && req.user!.role !== "admin") {
      res.status(403).json({ error: "Cannot create declaration for another organization" });
      return;
    }
    orgId = data.organizationId && req.user!.role === "admin" ? data.organizationId : userOrgId;
  } else {
    orgId = data.organizationId || null;
  }
  if (orgId) {
    const orgExists = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!orgExists) {
      res.status(400).json({ error: "Invalid organizationId" });
      return;
    }
  }

  // Counterparty identity is resolved before the transaction (find-or-create
  // is retry-safe on unique races; the declaration write itself stays atomic).
  const sanitizedCounterparty = sanitize(data.counterparty);
  const eventDate = parseDateSafe(data.date);
  const submittedAt = parseDateSafe(data.submitted);

  // Independent pre-transaction reads run concurrently so the transaction
  // holds the write lock for the shortest possible time — this matters under
  // concurrent creates on SQLite. The residual TOCTOU window is negligible:
  // if a user is deleted mid-flight the FK fails the write.
  // No lookup is needed when the declarer/approver is the authenticated
  // caller: `authenticate` already verified that user against the database.
  const [cp, declarerRow, approverRow] = await Promise.all([
    sanitizedCounterparty
      ? ensureCounterparty(sanitizedCounterparty, orgId, data.contactPerson ? sanitize(data.contactPerson) : null)
      : Promise.resolve(null),
    data.employeeId === req.user!.id
      ? Promise.resolve({ id: req.user!.id })
      : prisma.user.findUnique({ where: { id: data.employeeId }, select: { id: true } }),
    data.approverId
      ? data.approverId === req.user!.id
        ? Promise.resolve({ id: req.user!.id })
        : prisma.user.findUnique({ where: { id: data.approverId }, select: { id: true } })
      : Promise.resolve(null),
  ]);
  const counterpartyId: string | null = cp?.id || null;
  const declarerUserId: string | null = declarerRow?.id || null;
  const txApproverUserId: string | null = approverRow?.id || null;

  // Single transaction: legacy columns, canonical DateTime columns and links,
  // immutable snapshot, and detail rows all commit atomically. A failure
  // returns a retryable error instead of claiming canonical data exists.
  const declaration = await prisma.$transaction(async (tx) => {
    const created = await tx.declaration.create({
      data: {
        id,
        employee: sanitize(data.employee),
        employeeId: data.employeeId,
        teamMemberNumber: sanitize(data.teamMemberNumber),
        lineManager: sanitize(data.lineManager),
        position: sanitize(data.position),
        department: sanitize(data.department),
        company: data.company ? sanitize(data.company) : null,
        team: data.team ? sanitize(data.team) : null,
        type: sanitize(data.type),
        counterparty: sanitizedCounterparty,
        value: data.value,
        submitted: sanitize(data.submitted),
        approver: data.approver ? sanitize(data.approver) : "",
        approverId: data.approverId || null,
        status: "Draft",
        priority: sanitize(data.priority),
        description: sanitize(data.description),
        relationship: sanitize(data.relationship),
        receivedGiven: sanitize(data.receivedGiven),
        fromField: sanitize(data.from),
        contactPerson: sanitize(data.contactPerson),
        biddingProcess: sanitize(data.biddingProcess),
        contractNegotiation: data.contractNegotiation ? sanitize(data.contractNegotiation) : null,
        occasion: sanitize(data.occasion),
        date: sanitize(data.date),
        instances: sanitize(data.instances),
        publicOfficial: sanitize(data.publicOfficial),
        substantiation: data.substantiation ? sanitize(data.substantiation) : null,
        files: data.files ? JSON.stringify(data.files) : null,
        organizationId: orgId,
        eventDate,
        submittedAt,
        declarerUserId,
        currentApproverUserId: txApproverUserId,
        counterpartyId,
      },
    });
    await captureDeclarationSnapshot(
      id,
      {
        name: created.employee,
        teamMemberNumber: created.teamMemberNumber,
        position: created.position,
        department: created.department,
      },
      created.lineManager || null,
      tx,
      true,
    );
    await syncDeclarationDetail(id, created, tx, true);
    return created;
  });

  res.status(201).json(declarationResponse(declaration));
}));

router.get("/:id", authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const declaration = await prisma.declaration.findUnique({ where: { id } });
  if (!declaration) {
    res.status(404).json({ error: "Declaration not found" });
    return;
  }

  if (req.user!.role === "teamMember" && declaration.employeeId !== req.user!.id) {
    res.status(403).json({ error: "Cannot view another user's declaration" });
    return;
  }
  const userOrgIdGet = (req.user as any)?.organizationId as string | undefined;
  if (declaration.organizationId && userOrgIdGet && declaration.organizationId !== userOrgIdGet && req.user!.role !== "admin") {
    res.status(403).json({ error: "Cannot view declaration from another organization" });
    return;
  }
  if (denyCrossDepartmentLM(req, res, declaration)) return;

  const instance = await prisma.workflowInstance.findUnique({ where: { declarationId: declaration.id } });
  // Rows-first; legacy JSON cache is the fallback.
  const rawSteps = instance ? (await readWorkflowSteps(instance.declarationId)) || safeJsonParse(instance.steps) || [] : [];

  const workflowSteps = req.user!.role === "admin" || req.user!.role === "approver"
    ? rawSteps
    : rawSteps.map((s: any) => ({
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
  const existing = await prisma.declaration.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Declaration not found" });
    return;
  }
  if (existing.status !== "Draft" && existing.status !== "Returned") {
    res.status(400).json({ error: "Only drafts or returned declarations can be edited" });
    return;
  }
  // Org isolation
  const userOrgIdPut = (req.user as any)?.organizationId as string | undefined;
  if (existing.organizationId && userOrgIdPut && existing.organizationId !== userOrgIdPut && req.user!.role !== "admin") {
    res.status(403).json({ error: "Cannot edit declaration from another organization" });
    return;
  }
  if (existing.employeeId !== req.user!.id && req.user!.role !== "admin") {
    res.status(403).json({ error: "Cannot edit another user's declaration" });
    return;
  }
  if (denyCrossDepartmentLM(req, res, existing)) return;

  const parsed = createSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const data = parsed.data;
  if ((data as any).value !== undefined) {
    const sysCfg2 = await prisma.systemConfig.findFirst();
    const maxVal2 = (sysCfg2 as any)?.maximumValue ?? 1000000;
    if ((data as any).value > maxVal2) {
      res.status(400).json({ error: `Maximum value exceeded. Please enter an amount of R${maxVal2.toLocaleString("en-ZA").replace(/,/g, " ")} or less to continue.` });
      return;
    }
  }
  // Prevent org spoof on update — non-admin cannot change org
  if ((data as any).organizationId && userOrgIdPut && (data as any).organizationId !== userOrgIdPut && req.user!.role !== "admin") {
    res.status(403).json({ error: "Cannot move declaration to another organization" });
    return;
  }
  if ((data as any).organizationId) {
    const orgExists = await prisma.organization.findUnique({ where: { id: (data as any).organizationId } });
    if (!orgExists) {
      res.status(400).json({ error: "Invalid organizationId" });
      return;
    }
  }

  const updateData: Record<string, unknown> = {};

  // Editable via PUT: everything EXCEPT the immutable declarer identity
  // (employee, teamMemberNumber, position, department). Those four are
  // captured once into DeclarationSnapshot at creation and the verify gate
  // asserts they never diverge — allowing them here would red the gate
  // permanently with no self-heal. Identity corrections require admin
  // recreation. lineManager stays editable (manager changes are legitimate);
  // the snapshot keeps the submission-time value by design.
  const fieldMap: Record<string, string> = {
    lineManager: "lineManager",
    organizationId: "organizationId",
    company: "company", team: "team", type: "type", counterparty: "counterparty",
    value: "value", submitted: "submitted",
    priority: "priority", description: "description", relationship: "relationship",
    receivedGiven: "receivedGiven", from: "fromField", contactPerson: "contactPerson",
    biddingProcess: "biddingProcess", contractNegotiation: "contractNegotiation",
    occasion: "occasion", date: "date", instances: "instances",
    publicOfficial: "publicOfficial", substantiation: "substantiation",
    approverId: "approverId",
  };

  const sanitizeFields = new Set(["lineManager","company","team","type","counterparty","priority","description","relationship","receivedGiven","contactPerson","biddingProcess","contractNegotiation","occasion","date","instances","publicOfficial","substantiation","submitted","from"]);
  for (const [key, dbField] of Object.entries(fieldMap)) {
    const val = (data as Record<string, unknown>)[key];
    if (val !== undefined) {
      updateData[dbField] = typeof val === "string" && sanitizeFields.has(key) ? sanitize(val) : val;
    }
  }
  if (data.files !== undefined) {
    updateData.files = JSON.stringify(data.files);
  }

  // Resolve relational links before the transaction (counterparty
  // find-or-create is retry-safe on unique races outside the tx).
  const putCounterpartyText = (updateData.counterparty as string | undefined) ?? existing.counterparty;
  let putCounterpartyId: string | null = existing.counterpartyId;
  if (updateData.counterparty !== undefined) {
    if (putCounterpartyText) {
      const contactText = (updateData.contactPerson as string | undefined) ?? existing.contactPerson;
      const cp = await ensureCounterparty(putCounterpartyText, (updateData.organizationId as string | undefined) ?? existing.organizationId, contactText);
      putCounterpartyId = cp?.id || null;
    } else {
      putCounterpartyId = null;
    }
  }
  const putEventDate = updateData.date !== undefined ? parseDateSafe(updateData.date as string) : existing.eventDate;
  const putSubmittedAt = updateData.submitted !== undefined ? parseDateSafe(updateData.submitted as string) : existing.submittedAt;
  const putApproverId = (updateData.approverId as string | undefined) ?? existing.approverId ?? null;

  // User-link existence is resolved before the transaction (pure reads, so the
  // transaction holds the write lock for the shortest possible time).
  // When approverId is reassigned the approver display name moves with it —
  // otherwise the detail view shows the previous manager's name with the new id.
  let putDeclarer: string | null = null;
  const putDu = await prisma.user.findUnique({ where: { id: existing.employeeId }, select: { id: true } });
  if (putDu) putDeclarer = putDu.id;
  let putApproverUser: string | null = null;
  if (putApproverId) {
    const putAu = await prisma.user.findUnique({ where: { id: putApproverId }, select: { id: true, name: true } });
    if (putAu) {
      putApproverUser = putAu.id;
      if (updateData.approverId !== undefined) updateData.approver = putAu.name;
    }
  } else if (updateData.approverId !== undefined) {
    updateData.approver = "";
  }

  // Single transaction: legacy edit plus canonical DateTime columns, links,
  // snapshot, and detail rows. A failure returns a retryable error instead of
  // claiming canonical data exists.
  const updated = await prisma.$transaction(async (tx) => {
    const upd = await tx.declaration.update({
      where: { id },
      data: {
        ...updateData,
        eventDate: putEventDate,
        submittedAt: putSubmittedAt,
        declarerUserId: putDeclarer,
        currentApproverUserId: putApproverUser,
        counterpartyId: putCounterpartyId,
      },
    });
    await captureDeclarationSnapshot(
      id,
      {
        name: upd.employee,
        teamMemberNumber: upd.teamMemberNumber,
        position: upd.position,
        department: upd.department,
      },
      upd.lineManager || null,
      tx,
    );
    await syncDeclarationDetail(id, upd, tx);
    return upd;
  });

  // Refresh the workflow immediately when a returned declaration's value
  // changes, so the detail view reflects newly required approvers before submit.
  if (existing.status === "Returned" && data.value !== undefined && data.value !== existing.value) {
    const instance = await prisma.workflowInstance.findUnique({ where: { declarationId: id } });
    if (instance) {
      const savedSteps = (await readWorkflowSteps(id)) || safeParseWorkflowSteps(instance.steps);
      const freshSteps = await createWorkflowSteps(id, existing.employeeId, updated.value);
      const approvedMap = new Map(savedSteps.filter((s: any) => s.status === "approved").map((s: any) => [s.role, s]));
      const workflowSteps = freshSteps.map((step: any) => {
        const approved = approvedMap.get(step.role);
        return approved
          ? { ...step, status: "approved", decision: approved.decision, notes: approved.notes, decidedAt: approved.decidedAt, decidedById: approved.decidedById, decidedByName: approved.decidedByName, approvedAt: approved.approvedAt }
          : step;
      });
      // JSON cache and authoritative rows commit in one transaction.
      await prisma.$transaction(async (tx) => {
        await writeWorkflowStepsTx(tx, id, workflowSteps);
      });
    }
  }

  res.json(declarationResponse(updated));
}));

router.delete("/:id", authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const existing = await prisma.declaration.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Declaration not found" });
    return;
  }
  if (existing.status !== "Draft") {
    res.status(400).json({ error: "Only draft declarations can be deleted" });
    return;
  }
  const userOrgIdDel = (req.user as any)?.organizationId as string | undefined;
  if (existing.organizationId && userOrgIdDel && existing.organizationId !== userOrgIdDel && req.user!.role !== "admin") {
    res.status(403).json({ error: "Cannot delete declaration from another organization" });
    return;
  }
  if (existing.employeeId !== req.user!.id && req.user!.role !== "admin") {
    res.status(403).json({ error: "Cannot delete another user's declaration" });
    return;
  }
  if (denyCrossDepartmentLM(req, res, existing)) return;

  // Cascade: delete workflow instance and uploaded files before declaration.
  // Draft-only deletion is enforced above; relational children cascade at the
  // DB level, with explicit deletes here for pre-migration databases.
  const files = await prisma.uploadedFile.findMany({ where: { declarationId: id } });
  await Promise.all(files.map(async (f) => {
    const fp = containedUploadPath(f.path);
    if (!fp) return;
    try { await fs.promises.unlink(fp); } catch { /* file may have been deleted already */ }
  }));
  await Promise.all([
    prisma.uploadedFile.deleteMany({ where: { declarationId: id } }),
    prisma.workflowInstance.deleteMany({ where: { declarationId: id } }),
    (prisma as any).workflowInstanceStep.deleteMany({ where: { declarationId: id } }).catch(() => undefined),
    (prisma as any).declarationFile.deleteMany({ where: { declarationId: id } }).catch(() => undefined),
    (prisma as any).declarationSnapshot.deleteMany({ where: { declarationId: id } }).catch(() => undefined),
    (prisma as any).declarationDetail.deleteMany({ where: { declarationId: id } }).catch(() => undefined),
  ]);
  await prisma.declaration.delete({ where: { id } });

  res.json({ message: "Declaration deleted" });
}));

router.patch("/:id/submit", authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const existing = await prisma.declaration.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Declaration not found" });
    return;
  }
  if (existing.status !== "Draft" && existing.status !== "Returned") {
    res.status(400).json({ error: "Only drafts or returned declarations can be submitted" });
    return;
  }
  const userOrgIdSub = (req.user as any)?.organizationId as string | undefined;
  if (existing.organizationId && userOrgIdSub && existing.organizationId !== userOrgIdSub && req.user!.role !== "admin") {
    res.status(403).json({ error: "Cannot submit declaration from another organization" });
    return;
  }
  if (existing.employeeId !== req.user!.id && req.user!.role !== "admin") {
    res.status(403).json({ error: "Cannot submit another user's declaration" });
    return;
  }
  if (denyCrossDepartmentLM(req, res, existing)) return;

  const existingInstance = await prisma.workflowInstance.findUnique({ where: { declarationId: existing.id } });

  let workflowSteps: any[];
  if (existing.status === "Returned" && existingInstance) {
    const savedSteps = (await readWorkflowSteps(existing.id)) || safeParseWorkflowSteps(existingInstance.steps);
    const hasReturnedStep = savedSteps.some((step) => step.status === "returned");
    if (hasReturnedStep) {
      // Rebuild from the current value so a returned low-value declaration that
      // becomes high-value gains the HR step on resubmission.
      const freshSteps = await createWorkflowSteps(existing.id, existing.employeeId, existing.value);
      // Preserve approvals only for roles present in the newly selected rule.
      const approvedMap = new Map(savedSteps.filter((s: any) => s.status === "approved").map((s: any) => [s.role, s]));
      workflowSteps = freshSteps.map((fs: any) => {
        const approved = approvedMap.get(fs.role);
        return approved
          ? { ...fs, status: "approved", decision: approved.decision, notes: approved.notes, decidedAt: approved.decidedAt, decidedById: approved.decidedById, decidedByName: approved.decidedByName, approvedAt: approved.approvedAt }
          : fs;
      });
    } else {
      workflowSteps = await createWorkflowSteps(existing.id, existing.employeeId, existing.value);
    }
  } else {
    workflowSteps = await createWorkflowSteps(existing.id, existing.employeeId, existing.value);
  }

  const nextApprover = workflowSteps.find((step) => step.status === "pending");
  // NOTE: when every step is skipped (e.g. an LM-only rule with no
  // resolvable line manager) there is no actionable approver and the
  // declaration sits in Pending until an admin intervenes. Rejecting here
  // was considered, but the suite mandates that all-skipped submits succeed
  // with the skipped steps recorded; admin status-override is the escape hatch.
  const approverName = nextApprover ? nextApprover.assigneeName : existing.approver;
  const approverIdValue = nextApprover ? nextApprover.assignee : existing.approverId;

  // Counterparty identity resolved before the transaction (retry-safe
  // outside the tx); everything else commits atomically below.
  let submitCounterpartyId: string | null = existing.counterpartyId;
  if (existing.counterparty && !submitCounterpartyId) {
    const cp = await ensureCounterparty(existing.counterparty, existing.organizationId, existing.contactPerson);
    submitCounterpartyId = cp?.id || null;
  }

  // User-link existence is resolved before the transaction (pure reads, so the
  // transaction holds the write lock for the shortest possible time).
  let submitDeclarer: string | null = null;
  const submitDu = await prisma.user.findUnique({ where: { id: existing.employeeId }, select: { id: true } });
  if (submitDu) submitDeclarer = submitDu.id;
  let submitApproverUser: string | null = null;
  if (approverIdValue) {
    const submitAu = await prisma.user.findUnique({ where: { id: approverIdValue }, select: { id: true } });
    if (submitAu) submitApproverUser = submitAu.id;
  }

  // Single transaction: declaration status, legacy approver, canonical
  // approver link, timestamps, JSON cache, authoritative step rows, the
  // producing rule, snapshot, and detail — readers never observe a
  // half-mirrored workflow or a success without canonical data.
  const ruleId = await resolveRuleId(existing.value);
  const [updated] = await prisma.$transaction(async (tx) => {
    const upd = await tx.declaration.update({
      where: { id: existing.id },
      data: {
        status: "Pending",
        approver: approverName,
        approverId: approverIdValue,
        eventDate: parseDateSafe(existing.date) ?? existing.eventDate,
        submittedAt: parseDateSafe(existing.submitted) ?? existing.submittedAt,
        declarerUserId: submitDeclarer,
        currentApproverUserId: submitApproverUser,
        counterpartyId: submitCounterpartyId,
      },
    });
    await writeWorkflowStepsTx(tx, existing.id, workflowSteps, ruleId);
    await captureDeclarationSnapshot(
      existing.id,
      {
        name: upd.employee,
        teamMemberNumber: upd.teamMemberNumber,
        position: upd.position,
        department: upd.department,
      },
      upd.lineManager || null,
      tx,
    );
    await syncDeclarationDetail(existing.id, upd, tx);
    return [upd];
  });

  res.json(declarationResponse(updated));
  if (nextApprover) {
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

  if (status === "Approved" || status === "Declined") {
    const instance = await prisma.workflowInstance.findUnique({ where: { declarationId: id } });
    if (!instance) {
      res.status(400).json({ error: "Cannot approve/decline a declaration with no workflow instance" });
      return;
    }
    const steps: any[] = (await readWorkflowSteps(id)) || safeJsonParse(instance.steps) || [];
    const pendingStep = steps.find((s: any) => s.status === "pending");
    if (pendingStep) {
      res.status(400).json({ error: "Cannot approve/decline — pending approval step still exists" });
      return;
    }
    // A terminal override needs decided workflow evidence: all-skipped (or
    // empty) steps would desync the declaration from its step rows.
    const decided = steps.some((s: any) => s.status !== "pending" && s.status !== "skipped");
    if (!decided) {
      res.status(400).json({ error: "Cannot approve/decline — no decided workflow step exists" });
      return;
    }
  }

  const updated = await prisma.declaration.update({
    where: { id },
    data: { status },
  });

  res.json(declarationResponse(updated));
}));

export default router;

