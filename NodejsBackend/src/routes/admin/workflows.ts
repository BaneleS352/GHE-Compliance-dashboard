import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { authenticate, authorize, AuthRequest } from "../../middleware/auth";

const router = Router();

interface StepDef {
  order: number;
  role: "lineManager" | "hr" | "ceo";
  label: string;
}

// GET /api/admin/workflows/rules
router.get("/rules", authenticate, authorize("admin"), async (_req: AuthRequest, res: Response): Promise<void> => {
  const rules = await prisma.workflowRule.findMany({ orderBy: { priority: "asc" } });
  res.json(
    rules.map((r) => ({
      id: r.id,
      name: r.name,
      condition: r.condition,
      priority: r.priority,
      steps: JSON.parse(r.steps) as StepDef[],
    }))
  );
});

const ruleSchema = z.object({
  name: z.string().min(1),
  condition: z.string().min(1),
  priority: z.number().int(),
  steps: z.array(
    z.object({
      order: z.number().int(),
      role: z.enum(["lineManager", "hr", "ceo"]),
      label: z.string().min(1),
    })
  ),
});

// POST /api/admin/workflows/rules
router.post("/rules", authenticate, authorize("admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = ruleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const data = parsed.data;
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

  res.status(201).json({
    id: rule.id,
    name: rule.name,
    condition: rule.condition,
    priority: rule.priority,
    steps: data.steps,
  });
});

// PUT /api/admin/workflows/rules/:id
router.put("/rules/:id", authenticate, authorize("admin"), async (req: AuthRequest, res: Response): Promise<void> => {
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

  if (data.steps) {
    const newRoles = data.steps.map((s) => s.role);
    const instances = await prisma.workflowInstance.findMany();
    for (const inst of instances) {
      const currentSteps: any[] = JSON.parse(inst.steps);
      for (const role of newRoles) {
        const active = currentSteps.find((s) => s.role === role && s.status === "pending");
        if (active) {
          res.status(400).json({
            error: `Cannot add step with role "${role}"; it is still active in workflow for declaration ${inst.declarationId}`,
          });
          return;
        }
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

  res.json({
    id: rule.id,
    name: rule.name,
    condition: rule.condition,
    priority: rule.priority,
    steps: data.steps ? data.steps : JSON.parse(existing.steps),
  });
});

// DELETE /api/admin/workflows/rules/:id
router.delete("/rules/:id", authenticate, authorize("admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const existing = await prisma.workflowRule.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Workflow rule not found" });
    return;
  }

  await prisma.workflowRule.delete({ where: { id } });
  res.json({ message: "Workflow rule deleted" });
});

export default router;
