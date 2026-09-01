import { Router, Response } from "express";
import { z } from "zod";
import xss from "xss";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import { prisma } from "../config/prisma";
import { authenticate, authorize, AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { createWorkflowSteps, safeJsonParse, declarationResponse } from "../services/workflowService";

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

function safeParseWorkflowSteps(data: string | null | undefined): any[] {
  return safeJsonParse(data) as any[] || [];
}

const VALID_STATUSES = ["Draft", "Pending", "Approved", "Declined", "Escalated", "Returned"] as const;

router.get("/stats", authenticate, authorize("admin", "approver"), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const orgWhere: any = {};
  if ((req.user as any)?.organizationId) orgWhere.organizationId = (req.user as any).organizationId;
  // Use DB aggregation instead of loading all rows
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
  let declarations: any[];
  if (search) {
    const q = String(search);
    // Try DB contains first; for SQLite we still filter case-insensitively in memory after
    declarations = await prisma.declaration.findMany({ where, orderBy: { submitted: "desc" } });
    const qLower = q.toLowerCase();
    declarations = declarations.filter(
      (d) =>
        d.employee.toLowerCase().includes(qLower) ||
        d.counterparty.toLowerCase().includes(qLower) ||
        d.id.toLowerCase().includes(qLower) ||
        d.description.toLowerCase().includes(qLower)
    );
  } else {
    declarations = await prisma.declaration.findMany({ where, orderBy: { submitted: "desc" } });
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
  status: z.enum(VALID_STATUSES).default("Draft"),
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

  const declaration = await prisma.declaration.create({
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
      counterparty: sanitize(data.counterparty),
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
    },
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

  const instance = await prisma.workflowInstance.findUnique({ where: { declarationId: declaration.id } });
  const rawSteps = instance ? safeJsonParse(instance.steps) : [];

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

  const fieldMap: Record<string, string> = {
    employee: "employee",
    teamMemberNumber: "teamMemberNumber",
    lineManager: "lineManager", position: "position", department: "department",
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

  const sanitizeFields = new Set(["employee","teamMemberNumber","lineManager","position","department","company","team","type","counterparty","priority","description","relationship","receivedGiven","contactPerson","biddingProcess","contractNegotiation","occasion","date","instances","publicOfficial","substantiation","submitted","from"]);
  for (const [key, dbField] of Object.entries(fieldMap)) {
    const val = (data as Record<string, unknown>)[key];
    if (val !== undefined) {
      updateData[dbField] = typeof val === "string" && sanitizeFields.has(key) ? sanitize(val) : val;
    }
  }
  if (data.files !== undefined) {
    updateData.files = JSON.stringify(data.files);
  }

  const updated = await prisma.declaration.update({
    where: { id },
    data: updateData,
  });

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

  // Cascade: delete workflow instance and uploaded files before declaration
  const files = await prisma.uploadedFile.findMany({ where: { declarationId: id } });
  await Promise.all(files.map(async (f) => {
    const fp = path.join(UPLOAD_DIR, f.path);
    try { await fs.promises.unlink(fp); } catch { /* file may have been deleted already */ }
  }));
  await Promise.all([
    prisma.uploadedFile.deleteMany({ where: { declarationId: id } }),
    prisma.workflowInstance.deleteMany({ where: { declarationId: id } }),
    prisma.declaration.delete({ where: { id } }),
  ]);

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

  const existingInstance = await prisma.workflowInstance.findUnique({ where: { declarationId: existing.id } });

  let workflowSteps: any[];
  if (existing.status === "Returned" && existingInstance) {
    const savedSteps = safeParseWorkflowSteps(existingInstance.steps);
    const hasReturnedStep = savedSteps.some((step) => step.status === "returned");
    if (hasReturnedStep) {
      // Check if value change would change workflow (e.g., Low ↔ High)
      const freshSteps = await createWorkflowSteps(existing.id, existing.employeeId, existing.value);
      const savedRoles = savedSteps.map((s: any) => s.role).join(",");
      const freshRoles = freshSteps.map((s: any) => s.role).join(",");
      if (savedRoles !== freshRoles) {
        // Value crossed threshold — regenerate but preserve already-approved steps
        const approvedMap = new Map(savedSteps.filter((s: any) => s.status === "approved").map((s: any) => [s.role, s]));
        workflowSteps = freshSteps.map((fs: any) => {
          const approved = approvedMap.get(fs.role);
          if (approved) return { ...fs, status: "approved", decision: approved.decision, notes: approved.notes, decidedAt: approved.decidedAt, decidedById: approved.decidedById, decidedByName: approved.decidedByName, approvedAt: approved.approvedAt };
          return fs;
        });
        // If fresh has fewer steps, the extra returned step is now handled by fresh's pending
        // If fresh has more steps, new HR step is pending
      } else {
        workflowSteps = savedSteps.map((step) =>
          step.status === "returned"
            ? {
                ...step,
                status: "pending",
                decision: null,
                notes: "",
                decidedAt: null,
                decidedById: null,
                decidedByName: null,
              }
            : step
        );
      }
    } else {
      workflowSteps = await createWorkflowSteps(existing.id, existing.employeeId, existing.value);
    }
  } else {
    workflowSteps = await createWorkflowSteps(existing.id, existing.employeeId, existing.value);
  }

  const nextApprover = workflowSteps.find((step) => step.status === "pending");
  const approverName = nextApprover ? nextApprover.assigneeName : existing.approver;
  const approverIdValue = nextApprover ? nextApprover.assignee : existing.approverId;

  const [updated] = await prisma.$transaction([
    prisma.declaration.update({
      where: { id: existing.id },
      data: { status: "Pending", approver: approverName, approverId: approverIdValue },
    }),
    prisma.workflowInstance.upsert({
      where: { declarationId: existing.id },
      create: { declarationId: existing.id, steps: JSON.stringify(workflowSteps) },
      update: { steps: JSON.stringify(workflowSteps) },
    }),
  ]);

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
    const steps: any[] = safeJsonParse(instance.steps);
    const pendingStep = steps.find((s: any) => s.status === "pending");
    if (pendingStep) {
      res.status(400).json({ error: "Cannot approve/decline — pending approval step still exists" });
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

