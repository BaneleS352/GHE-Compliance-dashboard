import { Router, Response } from "express";
import { prisma } from "../config/prisma";
import { authenticate, authorize, AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";

const router = Router();

router.get("/managers", authenticate, asyncHandler(async (_req: AuthRequest, res: Response): Promise<void> => {
  const managers = await prisma.user.findMany({
    where: { position: { contains: "Line Manager" } },
    select: { id: true, name: true, email: true, position: true, department: true },
    orderBy: { name: "asc" },
  });
  res.json(managers);
}));

router.get("/organizations", authenticate, asyncHandler(async (_req: AuthRequest, res: Response): Promise<void> => {
  const orgs = await prisma.organization.findMany({ orderBy: { name: "asc" } });
  res.json(orgs.map((o) => ({ id: o.id, name: o.name, shortCode: o.shortCode })));
}));

router.get("/:id", authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  // Least-privilege: allow admin, self, or same-org members (needed for NewDeclarationScreen lineManager lookup)
  const callerOrg = (req.user as any)?.organizationId as string | undefined;
  if (req.user!.role !== "admin" && req.user!.id !== id && callerOrg && user.organizationId && callerOrg !== user.organizationId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  if (req.user!.role !== "admin" && req.user!.id !== id && !callerOrg) {
    // No org context — fallback to self/admin only
    const isSameOrgFallback = !user.organizationId;
    if (!isSameOrgFallback) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
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
    organizationId: user.organizationId,
  });
}));

export default router;
