import { Router, Response } from "express";
import { prisma } from "../config/prisma";
import { authenticate, authorize, AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";

const router = Router();

router.get("/:id", authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  if (req.user!.role !== "admin" && req.user!.id !== id) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    teamMemberNumber: user.teamMemberNumber,
    department: user.department,
    position: user.position,
    lineManager: user.lineManager,
  });
}));

export default router;
