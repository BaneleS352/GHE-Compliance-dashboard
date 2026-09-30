import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { authenticate, authorize, AuthRequest } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/asyncHandler";
import { syncWorkflowRuleSteps } from "../../services/normalization";
import { parseIdParam, toDbId, toJsonId } from "../../services/ids";

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
      // Step rows are the only workflow-definition source.
      const rows = await (prisma as any).workflowRuleStep.findMany({
        where: { ruleId: r.id },
        orderBy: { order: "asc" },
      });
      const s: StepDef[] = rows.map((row: any) => ({ order: row.order, role: row.role, label: row.label }));
      return { id: toJsonId(r.id), name: r.name, condition: r.condition, priority: r.priority, steps: s };
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

  const rule = await prisma.$transaction(async (tx) => {
    const created = await tx.workflowRule.create({
      data: {
        name: data.name,
        condition: data.condition,
        priority: data.priority,
      },
    });
    // Rows are written in the same transaction: readers never see a rule
    // without its steps.
    await syncWorkflowRuleSteps(created.id, data.steps, tx);
    return created;
  });

  res.status(201).json({
    id: toJsonId(rule.id),
    name: rule.name,
    condition: rule.condition,
    priority: rule.priority,
    steps: data.steps,
  });
}));

// PUT /api/admin/workflows/rules/:id
router.put("/rules/:id", authenticate, authorize("admin"), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const rulePk = parseIdParam(req.params.id);
  if (rulePk === null) {
    res.status(404).json({ error: "Workflow rule not found" });
    return;
  }
  const existing = await prisma.workflowRule.findUnique({ where: { id: rulePk } });
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
    const oldDefs = await (prisma as any).workflowRuleStep.findMany({ where: { ruleId: rulePk }, select: { role: true } });
    const oldRoles: string[] = oldDefs.map((s: any) => s.role);
    const newRoles: string[] = data.steps.map((s) => s.role);
    const changedRoles = new Set([
      ...newRoles.filter((r) => !oldRoles.includes(r)),
      ...oldRoles.filter((r) => !newRoles.includes(r)),
    ]);
    for (const role of changedRoles) {
      const rows = await (prisma as any).workflowInstanceStep.findMany({
        where: { role: role as "lineManager" | "hr", status: "pending" },
        select: { declarationPk: true },
      });
      if (rows.length > 0) {
        const insts = await prisma.workflowInstance.findMany({
          where: { declarationPk: { in: rows.map((r: any) => r.declarationPk) } },
          select: { declarationPk: true, ruleId: true },
        });
        // Same-rule instances block; untracked (null ruleId) history blocks
        // conservatively since its producing rule is unknown.
        const hit = insts.find((i) => (i as any).ruleId === rulePk || (i as any).ruleId == null);
        if (hit) {
          const decl = await prisma.declaration.findUnique({ where: { declarationPk: (hit as any).declarationPk }, select: { id: true } });
          res.status(400).json({
            error: `Cannot change rule while role "${role}" has a pending step in workflow for declaration ${decl?.id}`,
          });
          return;
        }
      }
    }
  }

  const rule = await prisma.$transaction(async (tx) => {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.condition !== undefined) updateData.condition = data.condition;
    if (data.priority !== undefined) updateData.priority = data.priority;
    const upd = await tx.workflowRule.update({ where: { id: rulePk }, data: updateData });
    if (data.steps !== undefined) {
      await syncWorkflowRuleSteps(upd.id, data.steps, tx);
    }
    return upd;
  });

  const rows = await (prisma as any).workflowRuleStep.findMany({ where: { ruleId: rulePk }, orderBy: { order: "asc" } });
  res.json({
    id: toJsonId(rule.id),
    name: rule.name,
    condition: rule.condition,
    priority: rule.priority,
    steps: rows.map((r: any) => ({ order: r.order, role: r.role, label: r.label })),
  });
}));

// DELETE /api/admin/workflows/rules/:id
router.delete("/rules/:id", authenticate, authorize("admin"), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const rulePk = parseIdParam(req.params.id);
  if (rulePk === null) {
    res.status(404).json({ error: "Workflow rule not found" });
    return;
  }
  const existing = await prisma.workflowRule.findUnique({ where: { id: rulePk } });
  if (!existing) {
    res.status(404).json({ error: "Workflow rule not found" });
    return;
  }

  await (prisma as any).workflowRuleStep.deleteMany({ where: { ruleId: rulePk } }).catch(() => undefined);
  await prisma.workflowRule.delete({ where: { id: rulePk } });
  res.json({ message: "Workflow rule deleted" });
}));

export default router;
