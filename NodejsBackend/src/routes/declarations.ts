import { Router, Response } from "express";
import { z } from "zod";
import xss from "xss";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import { prisma } from "../config/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";
import { createWorkflowSteps } from "../services/workflowService";

const router = Router();
const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");

function generateDeclarationId(): string {
  const year = new Date().getFullYear();
  const rand = crypto.randomInt(100000, 999999);
  return `GHE-${year}-${rand}`;
}

function safeJsonParse(val: string | null | undefined): any {
  if (!val) return null;
  try { return JSON.parse(val); } catch { return val; }
}

function sanitize(val: string): string {
  return xss(val, { whiteList: {}, stripIgnoreTag: true });
}

function safeParseWorkflowSteps(data: string | null | undefined): any[] {
  if (!data) return [];
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function declarationResponse(d: any) {
  const parsed = safeJsonParse(d.files);
  return {
    id: d.id,
    employee: d.employee,
    employeeId: d.employeeId,
    teamMemberNumber: d.teamMemberNumber,
    lineManager: d.lineManager,
    position: d.position,
    department: d.department,
    company: d.company,
    team: d.team,
    type: d.type,
    counterparty: d.counterparty,
    value: d.value,
    submitted: d.submitted,
    approver: d.approver,
    status: d.status,
    priority: d.priority,
    description: d.description,
    relationship: d.relationship,
    receivedGiven: d.receivedGiven,
    from: d.fromField,
    contactPerson: d.contactPerson,
    biddingProcess: d.biddingProcess,
    contractNegotiation: d.contractNegotiation,
    occasion: d.occasion,
    date: d.date,
    instances: d.instances,
    publicOfficial: d.publicOfficial,
    substantiation: d.substantiation,
    files: parsed || [],
  };
}

router.get("/stats", authenticate, async (_req: AuthRequest, res: Response): Promise<void> => {
  const declarations = await prisma.declaration.findMany();

  const kpis = {
    total: declarations.length,
    pending: declarations.filter((d) => d.status === "Pending").length,
    approved: declarations.filter((d) => d.status === "Approved").length,
    declined: declarations.filter((d) => d.status === "Declined").length,
    escalated: declarations.filter((d) => d.status === "Escalated").length,
    totalValue: declarations.reduce((sum, d) => sum + d.value, 0),
  };

  const trendItems = await prisma.complianceTrendPoint.findMany({ orderBy: { id: "asc" } });
  const typeItems = await prisma.typeBreakdownItem.findMany();

  res.json({ kpis, complianceTrend: trendItems, typeBreakdown: typeItems });
});

router.get("/", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const status = req.query.status as string | undefined;
  const search = req.query.search as string | undefined;

  const where: any = {};
  if (status) where.status = status;
  if (req.user!.role === "teamMember") {
    where.employeeId = req.user!.id;
  }

  let declarations = await prisma.declaration.findMany({ where, orderBy: { submitted: "desc" } });

  if (search) {
    const q = String(search).toLowerCase();
    declarations = declarations.filter(
      (d) =>
        d.employee.toLowerCase().includes(q) ||
        d.counterparty.toLowerCase().includes(q) ||
        d.id.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q)
    );
  }

  res.json(declarations.map(declarationResponse));
});

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
  approver: z.string(),
  status: z.string(),
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
});

router.post("/", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
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
  const id = generateDeclarationId();

  const declaration = await prisma.declaration.create({
    data: {
      id,
      employee: data.employee,
      employeeId: data.employeeId,
      teamMemberNumber: data.teamMemberNumber,
      lineManager: data.lineManager,
      position: data.position,
      department: data.department,
      company: data.company || null,
      team: data.team || null,
      type: data.type,
      counterparty: data.counterparty,
      value: data.value,
      submitted: data.submitted,
      approver: "",
      status: "Draft",
      priority: data.priority,
      description: sanitize(data.description),
      relationship: data.relationship,
      receivedGiven: data.receivedGiven,
      fromField: data.from,
      contactPerson: data.contactPerson,
      biddingProcess: data.biddingProcess,
      contractNegotiation: data.contractNegotiation || null,
      occasion: data.occasion,
      date: data.date,
      instances: data.instances,
      publicOfficial: data.publicOfficial,
      substantiation: data.substantiation || null,
      files: data.files ? JSON.stringify(data.files) : null,
    },
  });

  res.status(201).json(declarationResponse(declaration));
});

router.get("/:id", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
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

  const instance = await prisma.workflowInstance.findUnique({ where: { declarationId: declaration.id } });
  const workflowSteps = instance ? safeJsonParse(instance.steps) : [];

  res.json({ ...declarationResponse(declaration), workflowSteps });
});

router.put("/:id", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const existing = await prisma.declaration.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Declaration not found" });
    return;
  }
  if (existing.status !== "Draft" && existing.status !== "Info Requested") {
    res.status(400).json({ error: "Only drafts or info-requested declarations can be edited" });
    return;
  }
  if (req.user!.role === "teamMember" && existing.employeeId !== req.user!.id) {
    res.status(403).json({ error: "Cannot edit another user's declaration" });
    return;
  }

  const parsed = createSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const data = parsed.data;
  const updateData: Record<string, unknown> = {};

  const fieldMap: Record<string, string> = {
    employee: "employee",
    teamMemberNumber: "teamMemberNumber",
    lineManager: "lineManager", position: "position", department: "department",
    company: "company", team: "team", type: "type", counterparty: "counterparty",
    value: "value", submitted: "submitted",
    priority: "priority", description: "description", relationship: "relationship",
    receivedGiven: "receivedGiven", from: "fromField", contactPerson: "contactPerson",
    biddingProcess: "biddingProcess", contractNegotiation: "contractNegotiation",
    occasion: "occasion", date: "date", instances: "instances",
    publicOfficial: "publicOfficial", substantiation: "substantiation",
  };

  for (const [key, dbField] of Object.entries(fieldMap)) {
    const val = (data as Record<string, unknown>)[key];
    if (val !== undefined) {
      updateData[dbField] = key === "description" ? sanitize(val as string) : val;
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
});

router.delete("/:id", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
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
  if (req.user!.role === "teamMember" && existing.employeeId !== req.user!.id) {
    res.status(403).json({ error: "Cannot delete another user's declaration" });
    return;
  }

  // Cascade: delete workflow instance and uploaded files before declaration
  const files = await prisma.uploadedFile.findMany({ where: { declarationId: id } });
  for (const f of files) {
    const fp = path.join(UPLOAD_DIR, f.path);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }
  await prisma.uploadedFile.deleteMany({ where: { declarationId: id } });
  await prisma.workflowInstance.deleteMany({ where: { declarationId: id } });
  await prisma.declaration.delete({ where: { id } });

  res.json({ message: "Declaration deleted" });
});

router.patch("/:id/submit", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const existing = await prisma.declaration.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Declaration not found" });
    return;
  }
  if (existing.status !== "Draft" && existing.status !== "Info Requested") {
    res.status(400).json({ error: "Only drafts can be submitted" });
    return;
  }
  if (req.user!.role === "teamMember" && existing.employeeId !== req.user!.id) {
    res.status(403).json({ error: "Cannot submit another user's declaration" });
    return;
  }

  const existingInstance = await prisma.workflowInstance.findUnique({ where: { declarationId: existing.id } });

  let workflowSteps = await createWorkflowSteps(existing.id, existing.employeeId, existing.value);

  if (existing.status === "Info Requested" && existingInstance) {
    const savedSteps = safeParseWorkflowSteps(existingInstance.steps);
    const hasReturnedStep = savedSteps.some((step) => step.status === "returned");

    if (hasReturnedStep) {
      workflowSteps = savedSteps.map((step) =>
        step.status === "returned"
          ? {
              ...step,
              status: "pending",
              decision: null,
              notes: "",
              decidedAt: null,
            }
          : step
      );
    }
  }

  const nextApprover = workflowSteps.find((step) => step.status === "pending");
  const approverName = nextApprover ? nextApprover.assigneeName : existing.approver;

  const [updated] = await prisma.$transaction([
    prisma.declaration.update({
      where: { id: existing.id },
      data: { status: "Pending", approver: approverName },
    }),
    prisma.workflowInstance.upsert({
      where: { declarationId: existing.id },
      create: { declarationId: existing.id, steps: JSON.stringify(workflowSteps) },
      update: { steps: JSON.stringify(workflowSteps) },
    }),
  ]);

  res.json(declarationResponse(updated));
});

router.patch("/:id/status", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.user!.role !== "admin") {
    res.status(403).json({ error: "Only admins can change declaration status directly" });
    return;
  }

  const id = req.params.id as string;
  const { status } = req.body;
  const validStatuses = ["Draft", "Pending", "Approved", "Declined", "Escalated", "Info Requested"];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
    return;
  }

  const existing = await prisma.declaration.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Declaration not found" });
    return;
  }

  const updated = await prisma.declaration.update({
    where: { id },
    data: { status },
  });

  res.json(declarationResponse(updated));
});

export default router;
