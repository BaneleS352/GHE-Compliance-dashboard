import { Router, Response } from "express";
import { prisma } from "../config/prisma";
import { authenticate, authorize, AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";

const router = Router();

router.get("/managers", authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const orgId = req.query.organizationId as string | undefined;
  const where: any = { position: { contains: "Line Manager" } };
  if (orgId) where.organizationId = orgId;
  // Global managers (organizationId null) are visible to all orgs
  const managers = await prisma.user.findMany({
    where,
    select: { id: true, name: true, email: true, position: true, department: true, organizationId: true },
    orderBy: { name: "asc" },
  });
  res.json(managers);
}));

// Per-org departments from the Department master data (for NewDeclaration filtering)
router.get("/departments", authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const orgId = req.query.organizationId as string | undefined;
  if (!orgId) {
    const departments = await (prisma as any).department.findMany({ select: { name: true }, orderBy: { name: "asc" } }).catch(() => []);
    const names = departments.map((d: any) => d.name);
    if (names.length > 0) { res.json(names); return; }
    const users = await prisma.user.findMany({ select: { department: true } });
    res.json(Array.from(new Set(users.map((u) => u.department).filter(Boolean))).sort());
    return;
  }
  const departments = await (prisma as any).department.findMany({
    where: { organizationId: orgId },
    select: { name: true },
    orderBy: { name: "asc" },
  }).catch(() => []);
  let names = departments.map((d: any) => d.name);
  if (names.length === 0) {
    const users = await prisma.user.findMany({ where: { organizationId: orgId }, select: { department: true } });
    names = Array.from(new Set(users.map((u) => u.department).filter(Boolean))).sort();
  }
  res.json(names);
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
  // Global callers (no org) are allowed to fetch any user (HR/Admin global)
  // No additional check needed for !callerOrg
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
