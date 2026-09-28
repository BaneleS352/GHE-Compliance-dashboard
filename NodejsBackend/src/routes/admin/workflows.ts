import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { authenticate, authorize, AuthRequest } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/asyncHandler";
import { syncWorkflowRuleSteps } from "../../services/normalization";

const router = Router();

interface StepDef {
  order: number;
  role: "lineManager" | "hr";
  label: string;
}

// GET /api/admin/workflows/rules
router.get("/rules", authenticate, authorize("admin"), asyncHandler(async (_req: AuthRequest, res: Response): Promise<void> => {
  const rules = await prisma.workflowRule.findMany({ orderBy: { priority: "asc" } });
  res.json(
    await Promise.all(rules.map(async (r) => {
      // Rows-first; legacy JSON cache is the fallback.
      let s: StepDef[];
      try {
        const rows = await (prisma as any).workflowRuleStep.findMany({
          where: { ruleId: r.id },
          orderBy: { order: "asc" },
        });
        s = rows.length > 0
          ? rows.map((row: any) => ({ order: row.order, role: row.role, label: row.label }))
          : JSON.parse(r.steps);
        if (!Array.isArray(s)) s = [];
      } catch { s = []; }
      return { id: r.id, name: r.name, condition: r.condition, priority: r.priority, steps: s };
    })),
  );
}));

const ruleSchema = z.object({
  name: z.string().min(1),
  condition: z.string().min(1),
  priority: z.number().int(),
  steps: z.array(
    z.object({
      order: z.number().int(),
      role: z.enum(["lineManager", "hr"]),
      label: z.string().min(1),
    })
  ),
});

// POST /api/admin/workflows/rules
router.post("/rules", authenticate, authorize("admin"), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = ruleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const data = parsed.data;
  const existing = await prisma.workflowRule.findFirst({
    where: { name: data.name },
  });
  if (existing) {
    res.status(409).json({ error: `A workflow rule named "${data.name}" already exists` });
    return;
  }

  const id = `rule-${Date.now()}`;

  const rule = await prisma.workflowRule.create({
    data: {
      id,
      name: data.name,
      condition: data.condition,
      priority: data.priority,
      steps: JSON.stringify(data.steps),
    },
  });

  void syncWorkflowRuleSteps(rule.id).catch(() => undefined);

  res.status(201).json({
    id: rule.id,
    name: rule.name,
    condition: rule.condition,
    priority: rule.priority,
    steps: data.steps,
  });
}));

// PUT /api/admin/workflows/rules/:id
router.put("/rules/:id", authenticate, authorize("admin"), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const existing = await prisma.workflowRule.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Workflow rule not found" });
    return;
  }

  const parsed = ruleSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const data = parsed.data;

  if (data.name && data.name !== existing.name) {
    const nameConflict = await prisma.workflowRule.findFirst({
      where: { name: data.name },
    });
    if (nameConflict) {
      res.status(409).json({ error: `A workflow rule named "${data.name}" already exists` });
      return;
    }
  }

  if (data.steps) {
    const newRoles = data.steps.map((s) => s.role);
    // Guard against redefining a role that is mid-approval: check relational
    // rows first, legacy JSON cache as fallback.
    for (const role of newRoles) {
      let blocker: string | null = null;
      try {
        const row = await (prisma as any).workflowInstanceStep.findFirst({
          where: { role, status: "pending" },
          select: { declarationId: true },
        });
        if (row) blocker = row.declarationId;
      } catch { blocker = null; }
      if (!blocker) {
        const instances = await prisma.workflowInstance.findMany();
        for (const inst of instances) {
          let currentSteps: any[];
          try { currentSteps = JSON.parse(inst.steps); } catch { continue; }
          const active = currentSteps.find((s) => s.role === role && s.status === "pending");
          if (active) { blocker = inst.declarationId; break; }
        }
      }
      if (blocker) {
        res.status(400).json({
          error: `Cannot add step with role "${role}"; it is still active in workflow for declaration ${blocker}`,
        });
        return;
      }
    }
  }

  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.condition !== undefined) updateData.condition = data.condition;
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.steps !== undefined) updateData.steps = JSON.stringify(data.steps);

  const rule = await prisma.workflowRule.update({
    where: { id },
    data: updateData,
  });

  if (data.steps !== undefined) {
    void syncWorkflowRuleSteps(rule.id).catch(() => undefined);
  }

  res.json({
    id: rule.id,
    name: rule.name,
    condition: rule.condition,
    priority: rule.priority,
    steps: data.steps ? data.steps : JSON.parse(existing.steps),
  });
}));

// DELETE /api/admin/workflows/rules/:id
router.delete("/rules/:id", authenticate, authorize("admin"), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const existing = await prisma.workflowRule.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Workflow rule not found" });
    return;
  }

  await (prisma as any).workflowRuleStep.deleteMany({ where: { ruleId: id } }).catch(() => undefined);
  await prisma.workflowRule.delete({ where: { id } });
  res.json({ message: "Workflow rule deleted" });
}));

export default router;
