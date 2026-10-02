import { Router, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { authenticate, authorize, AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { parseIdParam, toDbId, toJsonId } from "../services/ids";

const router = Router();

router.get("/managers", authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const orgRaw = req.query.organizationId as string | undefined;
  const where: Prisma.UserWhereInput = { position: { contains: "Line Manager" } };
  const callerOrg = req.user?.organizationId ?? undefined;
  if (req.user!.role !== "admin") {
    // Lookup endpoints enforce caller scope: query parameters are not an
    // authorization boundary. Non-admins see their own organization only
    // (global callers see global managers only); cross-organization lookup
    // is an explicit admin capability.
    if (orgRaw !== undefined) {
      const orgPk = parseIdParam(orgRaw);
      if (orgPk === null) {
        res.status(400).json({ error: "Invalid organizationId" });
        return;
      }
      const callerPk = callerOrg === undefined || callerOrg === null ? null : toDbId(callerOrg);
      if ((orgPk === null) !== (callerPk === null) || (orgPk !== null && callerPk !== null && orgPk !== callerPk)) {
        res.status(403).json({ error: "Cannot look up managers from another organization" });
        return;
      }
      where.organizationId = orgPk;
    } else if (callerOrg !== undefined && callerOrg !== null) {
      where.organizationId = toDbId(callerOrg);
    } else {
      where.organizationId = null;
    }
  } else if (orgRaw !== undefined) {
    const orgPk = parseIdParam(orgRaw);
    if (orgPk === null) {
      res.status(400).json({ error: "Invalid organizationId" });
      return;
    }
    where.organizationId = orgPk;
  }
  // Global managers (organizationId null) are visible to all orgs
  const managers = await prisma.user.findMany({
    where,
    select: { id: true, name: true, email: true, position: true, departmentRef: { select: { name: true } }, organizationId: true },
    orderBy: { name: "asc" },
  });
  res.json(managers.map((m) => ({
    id: toJsonId(m.id),
    name: m.name,
    email: m.email,
    position: m.position,
    department: m.departmentRef?.name ?? "",
    organizationId: m.organizationId === null ? null : toJsonId(m.organizationId),
  })));
}));

// Per-org departments from the Department master data (for NewDeclaration filtering)
router.get("/departments", authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const orgRaw = req.query.organizationId as string | undefined;
  const callerOrg = req.user?.organizationId ?? undefined;
  let effectiveRaw = orgRaw;
  if (req.user!.role !== "admin") {
    // Caller-scoped like /managers above: non-admins cannot enumerate
    // another organization's departments.
    if (orgRaw !== undefined) {
      const orgPk = parseIdParam(orgRaw);
      if (orgPk === null) {
        res.status(400).json({ error: "Invalid organizationId" });
        return;
      }
      const callerPk = callerOrg === undefined || callerOrg === null ? null : toDbId(callerOrg);
      if (callerPk === null || orgPk !== callerPk) {
        res.status(403).json({ error: "Cannot look up departments from another organization" });
        return;
      }
    } else if (callerOrg !== undefined && callerOrg !== null) {
      effectiveRaw = String(toJsonId(toDbId(callerOrg)));
    } else {
      // Global caller without a scope: nothing organization-scoped to show.
      res.json([]);
      return;
    }
  }
  if (effectiveRaw === undefined) {
    const departments = await prisma.department.findMany({ select: { name: true }, orderBy: { name: "asc" } }).catch(() => []);
    const names = departments.map((d) => d.name);
    if (names.length > 0) { res.json(names); return; }
    const users = await prisma.user.findMany({ select: { departmentRef: { select: { name: true } } } });
    res.json(Array.from(new Set(users.map((u) => u.departmentRef?.name).filter((n): n is string => Boolean(n)))).sort());
    return;
  }
  const orgPk = parseIdParam(orgRaw);
  if (orgPk === null) {
    res.status(400).json({ error: "Invalid organizationId" });
    return;
  }
  const departments = await prisma.department.findMany({
    where: { organizationId: orgPk },
    select: { name: true },
    orderBy: { name: "asc" },
  }).catch(() => []);
  let names = departments.map((d) => d.name);
  if (names.length === 0) {
    const users = await prisma.user.findMany({ where: { organizationId: orgPk }, select: { departmentRef: { select: { name: true } } } });
    names = Array.from(new Set(users.map((u) => u.departmentRef?.name).filter((n): n is string => Boolean(n)))).sort();
  }
  res.json(names);
}));

router.get("/organizations", authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  // Ordinary callers receive only their own organization; cross-organization
  // enumeration is an explicit admin capability.
  if (req.user!.role !== "admin") {
    const callerOrg = req.user?.organizationId ?? undefined;
    if (callerOrg === undefined || callerOrg === null) {
      res.json([]);
      return;
    }
    const org = await prisma.organization.findUnique({ where: { id: toDbId(callerOrg) } });
    res.json(org ? [{ id: toJsonId(org.id), name: org.name, shortCode: org.shortCode }] : []);
    return;
  }
  const orgs = await prisma.organization.findMany({ orderBy: { name: "asc" } });
  res.json(orgs.map((o) => ({ id: toJsonId(o.id), name: o.name, shortCode: o.shortCode })));
}));

router.get("/:id", authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const userPk = parseIdParam(req.params.id);
  if (userPk === null) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: userPk }, include: { departmentRef: true } });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  // Least-privilege: allow admin, self, or same-org members (needed for NewDeclarationScreen lineManager lookup)
  const callerOrg = req.user?.organizationId ?? undefined;
  if (req.user!.role !== "admin" && toDbId(req.user!.id) !== userPk && callerOrg !== undefined && callerOrg !== null && user.organizationId !== null && toDbId(callerOrg) !== user.organizationId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  // Global callers (no org) are allowed to fetch any user (HR/Admin global)
  // No additional check needed for !callerOrg
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
