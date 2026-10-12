import { Router, Response } from "express";
import { prisma } from "../config/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { toDbId, toJsonId } from "../services/ids";

const router = Router();

router.get("/me", authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({ where: { id: toDbId(req.user!.id) }, include: { departmentRef: true } });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({
    id: toJsonId(user.id),
    name: user.name,
    email: user.email,
    role: user.role,
    teamMemberNumber: user.teamMemberNumber,
    department: user.departmentRef?.name ?? "",
    position: user.position,
    lineManager: user.lineManager,
    organizationId: user.organizationId === null ? null : toJsonId(user.organizationId),
  });
}));

export default router;
