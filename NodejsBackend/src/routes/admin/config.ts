import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { authenticate, authorize, AuthRequest } from "../../middleware/auth";

const router = Router();

// GET /api/admin/config
router.get("/", authenticate, authorize("admin"), async (_req: AuthRequest, res: Response): Promise<void> => {
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
    emailTemplate: config.emailTemplate,
  });
});

const configSchema = z.object({
  highValueThreshold: z.number().nonnegative(),
  mediumValueThreshold: z.number().nonnegative(),
  slaEscalationDays: z.number().int().nonnegative(),
  maxDeclarationsPerCounterparty: z.number().int().nonnegative(),
  emailTemplate: z.string(),
});

// PUT /api/admin/config
router.put("/", authenticate, authorize("admin"), async (req: AuthRequest, res: Response): Promise<void> => {
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
    emailTemplate: updated.emailTemplate,
  });
});

// GET /api/admin/config/dropdowns
router.get("/dropdowns", authenticate, authorize("admin"), async (_req: AuthRequest, res: Response): Promise<void> => {
  const dropdowns = await prisma.dropdowns.findFirst();
  if (!dropdowns) {
    res.status(404).json({ error: "Dropdowns not found" });
    return;
  }
  res.json(JSON.parse(dropdowns.data));
});

// PUT /api/admin/config/dropdowns
router.put("/dropdowns", authenticate, authorize("admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  const data = req.body;
  // Validate: each array must be non-empty
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

  await prisma.dropdowns.update({
    where: { id: existing.id },
    data: { data: JSON.stringify(data) },
  });

  res.json(data);
});

// GET /api/admin/config/approval-options
router.get("/approval-options", authenticate, authorize("admin"), async (_req: AuthRequest, res: Response): Promise<void> => {
  const options = await prisma.approvalOption.findMany({ orderBy: { id: "asc" } });
  res.json(options.map((o) => ({ value: o.value, label: o.label })));
});

export default router;
