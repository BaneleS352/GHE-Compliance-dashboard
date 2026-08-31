import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { authenticate, authorize, AuthRequest } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/asyncHandler";

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
    maximumValue: (config as any).maximumValue ?? 1000000,
    emailTemplate: config.emailTemplate,
    notificationTemplates: config.notificationTemplates,
  });
}));

const configSchema = z.object({
  highValueThreshold: z.number().nonnegative(),
  mediumValueThreshold: z.number().nonnegative(),
  slaEscalationDays: z.number().int().nonnegative(),
  maxDeclarationsPerCounterparty: z.number().int().nonnegative(),
  maximumValue: z.number().positive().max(10000000).optional().default(1000000),
  emailTemplate: z.string(),
  notificationTemplates: z.string().optional(),
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
    maximumValue: (updated as any).maximumValue ?? 1000000,
    emailTemplate: updated.emailTemplate,
    notificationTemplates: updated.notificationTemplates,
  });
}));

// GET /api/admin/config/dropdowns — any authenticated user can read (needed for New Declaration department dropdown)
router.get("/dropdowns", authenticate, asyncHandler(async (_req: AuthRequest, res: Response): Promise<void> => {
  const dropdowns = await prisma.dropdowns.findFirst();
  if (!dropdowns) {
    res.status(404).json({ error: "Dropdowns not found" });
    return;
  }
  let parsed: any;
  try { parsed = JSON.parse(dropdowns.data); } catch { res.status(500).json({ error: "Corrupt dropdowns data" }); return; }
  res.json(parsed);
}));

const VALID_DROPDOWN_KEYS = new Set([
  "departments",
  "categories",
  "occasions",
  "receivedGiven",
  "biddingProcess",
  "publicOfficial",
  "relationships",
  "partyTypes",
]);

// PUT /api/admin/config/dropdowns
router.put("/dropdowns", authenticate, authorize("admin"), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const data = req.body;
  const unknownKeys = Object.keys(data).filter((k) => !VALID_DROPDOWN_KEYS.has(k));
  if (unknownKeys.length > 0) {
    res.status(400).json({ error: `Unknown dropdown keys: ${unknownKeys.join(", ")}` });
    return;
  }
  for (const [key, arr] of Object.entries(data)) {
    if (!Array.isArray(arr) || arr.length === 0) {
      res.status(400).json({ error: `Dropdown "${key}" must be a non-empty array` });
      return;
    }
  }

  const existing = await prisma.dropdowns.findFirst();
  if (!existing) {
    res.status(404).json({ error: "Dropdowns not found" });
    return;
  }

  let existingParsed: any = {};
  try { existingParsed = JSON.parse(existing.data); } catch {}
  const merged = { ...existingParsed, ...data };
  await prisma.dropdowns.update({
    where: { id: existing.id },
    data: { data: JSON.stringify(merged) },
  });

  res.json(merged);
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
  res.json(orgs.map((o) => ({ id: o.id, name: o.name, shortCode: o.shortCode })));
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
  res.status(201).json({ id: org.id, name: org.name, shortCode: org.shortCode });
}));

// PUT /api/admin/config/organizations/:id
router.put("/organizations/:id", authenticate, authorize("admin"), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
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
  res.json({ id: org.id, name: org.name, shortCode: org.shortCode });
}));

// DELETE /api/admin/config/organizations/:id
router.delete("/organizations/:id", authenticate, authorize("admin"), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
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
  const id = req.params.id as string;
  const org = await prisma.organization.findUnique({ where: { id } });
  if (!org) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }
  res.json({ id: org.id, name: org.name, shortCode: org.shortCode });
}));

export default router;
