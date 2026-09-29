import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { authenticate, authorize, AuthRequest } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/asyncHandler";
import { syncWorkflowRuleSteps, parseRuleStepDefs } from "../../services/normalization";

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

  // Awaited (not fire-and-forget): submissions resolve rules from these
  // rows, so responding before they exist would build workflows from stale
  // JSON; a sync failure is loud (500) rather than silently dropped.
  await syncWorkflowRuleSteps(rule.id);

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
    // Guard against stranding in-flight approvals: only roles ADDED or
    // REMOVED by this edit are checked (pure renames/reorders of existing
    // roles cannot strand anyone), and only against instances produced by
    // THIS rule (plus untracked pre-rule-FK history, conservatively).
    const oldDefs = await (prisma as any).workflowRuleStep.findMany({ where: { ruleId: id }, select: { role: true } });
    const oldRoles: string[] = oldDefs.length > 0
      ? oldDefs.map((s: any) => s.role)
      : parseRuleStepDefs(existing.steps).map((d) => d.role);
    const newRoles: string[] = data.steps.map((s) => s.role);
    const changedRoles = new Set([
      ...newRoles.filter((r) => !oldRoles.includes(r)),
      ...oldRoles.filter((r) => !newRoles.includes(r)),
    ]);
    for (const role of changedRoles) {
      let blocker: string | null = null;
      const roleFilter = role as "lineManager" | "hr";
      try {
        const rows = await (prisma as any).workflowInstanceStep.findMany({
          where: { role: roleFilter, status: "pending" },
          select: { declarationId: true },
        });
        if (rows.length > 0) {
          const insts = await prisma.workflowInstance.findMany({
            where: { declarationId: { in: rows.map((r: any) => r.declarationId) } },
            select: { declarationId: true, ruleId: true },
          });
          // Same-rule instances block; untracked (null ruleId) history blocks
          // conservatively since its producing rule is unknown.
          const hit = insts.find((i) => (i as any).ruleId === id || (i as any).ruleId == null);
          if (hit) blocker = hit.declarationId;
        }
      } catch { blocker = null; }
      if (!blocker) {
        const instances = await prisma.workflowInstance.findMany({
          where: { OR: [{ ruleId: id }, { ruleId: null }] },
        });
        for (const inst of instances) {
          let currentSteps: any[];
          try { currentSteps = JSON.parse(inst.steps); } catch { continue; }
          const active = currentSteps.find((s) => s.role === role && s.status === "pending");
          if (active) { blocker = inst.declarationId; break; }
        }
      }
      if (blocker) {
        res.status(400).json({
          error: `Cannot change rule while role "${role}" has a pending step in workflow for declaration ${blocker}`,
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
    // Awaited for the same reason as create: readers must see synced rows.
    await syncWorkflowRuleSteps(rule.id);
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
