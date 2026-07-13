import { Router, Response } from "express";
import { prisma } from "../../config/prisma";
import { authenticate, authorize, AuthRequest } from "../../middleware/auth";

const router = Router();

// GET /api/admin/dashboard
router.get("/", authenticate, authorize("admin"), async (_req: AuthRequest, res: Response): Promise<void> => {
  const [userCount, declarationCount, workflowRuleCount, config] = await Promise.all([
    prisma.user.count(),
    prisma.declaration.count(),
    prisma.workflowRule.count(),
    prisma.systemConfig.findFirst(),
  ]);

  res.json({
    users: userCount,
    declarations: declarationCount,
    workflows: workflowRuleCount,
    threshold: config?.highValueThreshold || 2000,
  });
});

export default router;
