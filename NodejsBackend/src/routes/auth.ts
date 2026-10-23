import { Router, Response } from "express";
import { prisma } from "../config/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { toDbId, toJsonId } from "../services/ids";

const router = Router();

router.get("/me", authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: toDbId(req.user!.id) },
    include: { departmentRef: true },
  });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const manager = user.managerId === null
    ? null
    : await prisma.user.findUnique({ where: { id: user.managerId }, select: { name: true } });

  res.json({
    id: toJsonId(user.id),
    name: user.name,
    email: user.email,
    role: user.role,
    teamMemberNumber: user.teamMemberNumber,
    department: user.departmentRef?.name ?? "",
    position: user.position,
    // `lineManager` is a display field; resolve the authoritative FK for
    // current identity responses while preserving historical display text.
    lineManager: manager?.name ?? user.lineManager,
    managerId: user.managerId === null ? null : toJsonId(user.managerId),
    organizationId: user.organizationId === null ? null : toJsonId(user.organizationId),
  });
}));

export default router;
