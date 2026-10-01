import { Router, Response } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { authenticate, authorize, AuthRequest } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/asyncHandler";
import { parseIdParam, toJsonId } from "../../services/ids";

const router = Router();

// GET /api/admin/config
router.get("/", authenticate, authorize("admin"), asyncHandler(async (_req: AuthRequest, res: Response): Promise<void> => {
  const config = await prisma.systemConfig.findFirst();
  if (!config) {
    res.status(404).json({ error: "System config not found" });
    return;
  }
  res.json({
    highValueThreshold: config.highValueThreshold,
    mediumValueThreshold: config.mediumValueThreshold,
    slaEscalationDays: config.slaEscalationDays,
    maxDeclarationsPerCounterparty: config.maxDeclarationsPerCounterparty,
    maximumValue: config.maximumValue ?? 1000000,
    emailTemplate: config.emailTemplate,
    notificationTemplates: config.notificationTemplates,
  });
}));

const notificationTemplateSchema = z.object({ subject: z.string().min(1), body: z.string().min(1) });
const notificationTemplatesSchema = z.object({
  managerApproval: notificationTemplateSchema,
  hrApproval: notificationTemplateSchema,
  declarationReturned: notificationTemplateSchema,
  declarationDeclined: notificationTemplateSchema,
  declarationApproved: notificationTemplateSchema,
}).strict();

const configSchema = z.object({
  highValueThreshold: z.number().nonnegative(),
  mediumValueThreshold: z.number().nonnegative(),
  slaEscalationDays: z.number().int().nonnegative(),
  maxDeclarationsPerCounterparty: z.number().int().nonnegative(),
  maximumValue: z.number().positive().max(10000000).optional().default(1000000),
  emailTemplate: z.string(),
  notificationTemplates: z.string().optional().refine((value) => {
    if (value === undefined) return true;
    try { notificationTemplatesSchema.parse(JSON.parse(value)); return true; } catch { return false; }
  }, "Invalid notification templates: all five event templates require a subject and body"),
});

// PUT /api/admin/config
router.put("/", authenticate, authorize("admin"), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = configSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const data = parsed.data;
  const existing = await prisma.systemConfig.findFirst();
  if (!existing) {
    res.status(404).json({ error: "System config not found" });
    return;
  }

  const updated = await prisma.systemConfig.update({
    where: { id: existing.id },
    data,
  });

  res.json({
    highValueThreshold: updated.highValueThreshold,
    mediumValueThreshold: updated.mediumValueThreshold,
    slaEscalationDays: updated.slaEscalationDays,
    maxDeclarationsPerCounterparty: updated.maxDeclarationsPerCounterparty,
    maximumValue: updated.maximumValue ?? 1000000,
    emailTemplate: updated.emailTemplate,
    notificationTemplates: updated.notificationTemplates,
  });
}));

// GET /api/admin/config/dropdowns — any authenticated user can read (needed for New Declaration department dropdown).
// Phase 5: served from the normalized Department master data plus the fixed
// domain value lists. The generic Dropdowns JSON table was retired in
// 0005_phase5_retirement; the response shape is unchanged.
const DOMAIN_DROPDOWNS = {
  categories: ["Gift", "Hospitality", "Entertainment"],
  occasions: ["Business Meeting", "Milestone", "Festive", "Relationship Maintenance", "Other"],
  receivedGiven: ["Received", "Given"],
  biddingProcess: ["Yes", "No", "N/A"],
  publicOfficial: ["Yes", "No"],
  relationships: ["Yes", "No"],
  partyTypes: ["Supplier", "Customer", "Team Member"],
};
router.get("/dropdowns", authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const orgRaw = req.query.organizationId as string | undefined;
  const orgPk = orgRaw !== undefined ? parseIdParam(orgRaw) : undefined;
  if (orgRaw !== undefined && orgPk === null) {
    res.status(400).json({ error: "Invalid organizationId" });
    return;
  }
  const deptWhere: Prisma.DepartmentWhereInput = orgPk === undefined || orgPk === null ? {} : { organizationId: orgPk };
  const departments = await prisma.department.findMany({
    where: deptWhere,
    select: { name: true },
    orderBy: { name: "asc" },
  }).catch(() => []);
  let names = departments.map((d) => d.name);
  if (names.length === 0) {
    // Fallback to user departments when the master table is not seeded yet.
    const users = await prisma.user.findMany({ where: orgPk !== undefined ? { organizationId: orgPk } : {}, select: { departmentRef: { select: { name: true } } } });
    names = Array.from(new Set(users.map((u) => u.departmentRef?.name).filter((n): n is string => Boolean(n)))).sort();
  }
  res.json({ departments: names, ...DOMAIN_DROPDOWNS });
}));

// PUT /api/admin/config/dropdowns — retired with the Dropdowns table.
// Departments are now master data (Department model); domain lists are fixed.
router.put("/dropdowns", authenticate, authorize("admin"), asyncHandler(async (_req: AuthRequest, res: Response): Promise<void> => {
  res.status(410).json({ error: "Dropdowns are now served from department master data and fixed domain lists and can no longer be edited via this endpoint" });
}));

// GET /api/admin/config/approval-options
router.get("/approval-options", authenticate, authorize("admin"), asyncHandler(async (_req: AuthRequest, res: Response): Promise<void> => {
  const options = await prisma.approvalOption.findMany({ orderBy: { id: "asc" } });
  res.json(options.map((o) => ({ id: o.id, value: o.value, label: o.label })));
}));

// POST /api/admin/config/approval-options
router.post("/approval-options", authenticate, authorize("admin"), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { id, value, label } = req.body;
  if (!id || !value || !label) {
    res.status(400).json({ error: "id, value, and label are required" });
    return;
  }
  const existing = await prisma.approvalOption.findUnique({ where: { id } });
  if (existing) {
    res.status(409).json({ error: "An option with this id already exists" });
    return;
  }
  const option = await prisma.approvalOption.create({ data: { id, value, label } });
  res.status(201).json({ value: option.value, label: option.label });
}));

// PUT /api/admin/config/approval-options/:id
router.put("/approval-options/:id", authenticate, authorize("admin"), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const { value, label } = req.body;
  if (!value || !label) {
    res.status(400).json({ error: "value and label are required" });
    return;
  }
  const existing = await prisma.approvalOption.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Approval option not found" });
    return;
  }
  const option = await prisma.approvalOption.update({ where: { id }, data: { value, label } });
  res.json({ value: option.value, label: option.label });
}));

// DELETE /api/admin/config/approval-options/:id
router.delete("/approval-options/:id", authenticate, authorize("admin"), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const existing = await prisma.approvalOption.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Approval option not found" });
    return;
  }
  await prisma.approvalOption.delete({ where: { id } });
  res.json({ message: "Approval option deleted" });
}));

// ── Organizations ──

const orgSchema = z.object({
  name: z.string().min(1),
  shortCode: z.string().min(1),
});

// GET /api/admin/config/organizations
router.get("/organizations", authenticate, authorize("admin"), asyncHandler(async (_req: AuthRequest, res: Response): Promise<void> => {
  const orgs = await prisma.organization.findMany({ orderBy: { name: "asc" } });
  res.json(orgs.map((o) => ({ id: toJsonId(o.id), name: o.name, shortCode: o.shortCode })));
}));

// POST /api/admin/config/organizations
router.post("/organizations", authenticate, authorize("admin"), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = orgSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const { name, shortCode } = parsed.data;
  const existing = await prisma.organization.findFirst({ where: { OR: [{ name }, { shortCode }] } });
  if (existing) {
    res.status(409).json({ error: "Organization with this name or short code already exists" });
    return;
  }
  const org = await prisma.organization.create({ data: { name, shortCode } });
  res.status(201).json({ id: toJsonId(org.id), name: org.name, shortCode: org.shortCode });
}));

// PUT /api/admin/config/organizations/:id
router.put("/organizations/:id", authenticate, authorize("admin"), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }
  const parsed = orgSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const { name, shortCode } = parsed.data;
  const existing = await prisma.organization.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }
  const conflict = await prisma.organization.findFirst({ where: { OR: [{ name }, { shortCode }], NOT: { id } } });
  if (conflict) {
    res.status(409).json({ error: "Organization with this name or short code already exists" });
    return;
  }
  const org = await prisma.organization.update({ where: { id }, data: { name, shortCode } });
  res.json({ id: toJsonId(org.id), name: org.name, shortCode: org.shortCode });
}));

// DELETE /api/admin/config/organizations/:id
router.delete("/organizations/:id", authenticate, authorize("admin"), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }
  const existing = await prisma.organization.findUnique({ where: { id }, include: { users: true, declarations: true } });
  if (!existing) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }
  if (existing.users.length > 0 || existing.declarations.length > 0) {
    res.status(400).json({ error: "Cannot delete organization with associated users or declarations" });
    return;
  }
  await prisma.organization.delete({ where: { id } });
  res.json({ message: "Organization deleted" });
}));

// GET /api/admin/config/organizations/:id
router.get("/organizations/:id", authenticate, authorize("admin"), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }
  const org = await prisma.organization.findUnique({ where: { id } });
  if (!org) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }
  res.json({ id: toJsonId(org.id), name: org.name, shortCode: org.shortCode });
}));

export default router;
