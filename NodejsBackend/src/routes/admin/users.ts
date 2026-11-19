import { Router, Response } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { config } from "../../config/env";
import { authenticate, authorize, AuthRequest } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/asyncHandler";
import { parseIdParam, toDbId, toJsonId } from "../../services/ids";
import { managerOrgViolation } from "../../services/orgConsistency";
import { resolveDepartmentId } from "../../services/normalization";

const router = Router();

/** User row with its department link for display derivation. */
type UserWithDepartment = Prisma.UserGetPayload<{ include: { departmentRef: true; manager: true } }>;

function userResponse(u: UserWithDepartment) {
  return {
    id: toJsonId(u.id),
    name: u.name,
    email: u.email,
    role: u.role,
    isActive: u.isActive,
    teamMemberNumber: u.teamMemberNumber,
    // Display only: departmentId -> Department.name is the sole source.
    department: u.departmentRef?.name ?? "",
    position: u.position,
    // Display only: managerId -> User.name is the sole persisted source.
    lineManager: u.manager?.name ?? "",
    organizationId: u.organizationId === null || u.organizationId === undefined ? null : toJsonId(u.organizationId),
  };
}

// GET /api/admin/users
router.get("/", authenticate, authorize("admin"), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { search, role } = req.query;
  const take = Math.min(Math.max(Number.parseInt(String(req.query.limit ?? "100"), 10) || 100, 1), 500);
  const skip = Math.max(Number.parseInt(String(req.query.offset ?? "0"), 10) || 0, 0);

  const where: Prisma.UserWhereInput = {};

  if (role && role !== "All Roles") {
    const roleMap: Record<string, string> = {
      "Administrator": "admin",
      "Approver": "approver",
      "Team Member": "teamMember",
    };
    where.role = roleMap[String(role)] || String(role);
  }

  if (search) {
    const q = String(search).trim().slice(0, 100);
    const numeric = /^\d+$/.test(q.trim()) ? toDbId(q.trim()) : null;
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      ...(numeric !== null ? [{ id: numeric }] : []),
    ];
  }

  const users = await prisma.user.findMany({ where, orderBy: { name: "asc" }, take, skip, include: { departmentRef: true, manager: true } });

  res.json(users.map(userResponse));
}));

// GET /api/admin/users/:id
router.get("/:id", authenticate, authorize("admin"), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const userPk = parseIdParam(req.params.id);
  if (userPk === null) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: userPk }, include: { departmentRef: true, manager: true } });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(userResponse(user));
}));

const managerInput = z.union([z.string(), z.number().int()], { error: () => "Expected a user reference" });

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["teamMember", "approver", "admin"]),
  // DTO resolver input (not stored): resolves to departmentId through the
  // organization-scoped Department master data (created when missing).
  department: z.string().optional().default(""),
  teamMemberNumber: z.string().optional().default(""),
  position: z.string().optional().default(""),
  lineManager: managerInput.nullable().optional().default(null),
  organizationId: z.union([z.number().int(), z.string().regex(/^\d+$/)], { error: () => "Expected a numeric identifier" }).nullable().optional().default(null),
});

/**
 * Resolve the authoritative managerId FK from a lineManager DTO input.
 * Accepts a numeric user id (as number or string) or display name.
 */
async function resolveManagerId(lineManager: string | number | null | undefined): Promise<bigint | null> {
  if (lineManager === null || lineManager === undefined) return null;
  if (typeof lineManager === "number") {
    const found = await prisma.user.findUnique({ where: { id: toDbId(lineManager) }, select: { id: true } });
    return found ? found.id : null;
  }
  const trimmed = String(lineManager).trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) {
    const found = await prisma.user.findUnique({ where: { id: toDbId(trimmed) }, select: { id: true } });
    if (found) return found.id;
  }
  const byName = await prisma.user.findFirst({ where: { name: trimmed }, select: { id: true } });
  return byName ? byName.id : null;
}

// POST /api/admin/users — creates a credential-less user. Authentication is
// provider-managed (Entra ID); the database stores identity and role only.
router.post("/", authenticate, authorize("admin"), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const data = parsed.data;
  const existingEmail = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
  if (existingEmail) {
    res.status(409).json({ error: "A user with this email already exists" });
    return;
  }

  const orgPk = data.organizationId === null || data.organizationId === undefined ? null : toDbId(data.organizationId);
  if (orgPk !== null) {
    const orgExists = await prisma.organization.findUnique({ where: { id: orgPk } });
    if (!orgExists) {
      res.status(400).json({ error: "Invalid organizationId" });
      return;
    }
  }

  const managerPk = await resolveManagerId(data.lineManager);
  // Organization consistency: a scoped user must not reference a manager
  // from another organization (global managers are allowed).
  const violation = await managerOrgViolation(managerPk, orgPk);
  if (violation) {
    res.status(400).json({ error: violation });
    return;
  }
  // departmentId is the sole department source: the `department` DTO string
  // resolves to the organization-scoped master row (created when missing).
  const departmentPk = await resolveDepartmentId(data.department, orgPk);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email.toLowerCase(),
      role: data.role,
      teamMemberNumber: data.teamMemberNumber,
      departmentId: departmentPk,
      position: data.position,
      managerId: managerPk,
      organizationId: orgPk,
    },
    include: { departmentRef: true, manager: true },
  });

  res.status(201).json(userResponse(user));
}));

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(["teamMember", "approver", "admin"]).optional(),
  isActive: z.boolean().optional(),
  department: z.string().optional(),
  teamMemberNumber: z.string().optional(),
  position: z.string().optional(),
  lineManager: managerInput.nullable().optional(),
  organizationId: z.union([z.number().int(), z.string().regex(/^\d+$/)], { error: () => "Expected a numeric identifier" }).nullable().optional(),
});

const identityLinkSchema = z.object({
  providerSubject: z.string().uuid(),
  // Reference to the tenant administrator's independently verified identity
  // record (ticket/case ID); do not send identity documents to this API.
  evidenceReference: z.string().trim().min(8).max(200),
});

// POST /api/admin/users/:id/identity-link
// Links only a currently unlinked local account. The tenant administrator
// must verify the subject against the Entra directory before calling this.
router.post("/:id/identity-link", authenticate, authorize("admin"), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const userPk = parseIdParam(req.params.id);
  const parsed = identityLinkSchema.safeParse(req.body);
  if (userPk === null || !parsed.success) {
    res.status(400).json({ error: "Invalid identity link request" });
    return;
  }
  const actorPk = toDbId(req.user!.id);
  try {
    const linked = await prisma.$transaction(async (tx) => {
      const result = await tx.user.updateMany({
        where: { id: userPk, providerSubject: null },
        data: { providerSubject: parsed.data.providerSubject.toLowerCase(), providerIssuer: config.oidc.issuer },
      });
      if (result.count !== 1) return false;
      await tx.identityLinkAudit.create({ data: {
        targetUserId: userPk,
        actorUserId: actorPk,
        actorType: "admin",
        actorLabel: null,
        providerIssuer: config.oidc.issuer,
        providerSubject: parsed.data.providerSubject.toLowerCase(),
        evidenceReference: parsed.data.evidenceReference,
      } });
      return true;
    });
    if (!linked) {
      res.status(409).json({ error: "User is missing or already has a provider identity link" });
      return;
    }
    res.status(204).end();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      res.status(409).json({ error: "Provider identity is already linked to another user" });
      return;
    }
    throw error;
  }
}));

// PUT /api/admin/users/:id
router.put("/:id", authenticate, authorize("admin"), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const userPk = parseIdParam(req.params.id);
  if (userPk === null) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const existing = await prisma.user.findUnique({ where: { id: userPk } });
  if (!existing) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const data = parsed.data;
  if (data.email) {
    const dup = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
    if (dup && dup.id !== userPk) {
      res.status(409).json({ error: "A user with this email already exists" });
      return;
    }
  }

  const updateData: Prisma.UserUncheckedUpdateInput = {};
  let resolvedManager: bigint | null | undefined;
  // Effective organization first: department resolution and the manager
  // consistency check both depend on the post-update org.
  const nextOrg: bigint | null =
    data.organizationId === undefined ? existing.organizationId : data.organizationId === null ? null : toDbId(data.organizationId);
  if (data.name !== undefined) updateData.name = data.name;
  if (data.email !== undefined) updateData.email = data.email.toLowerCase();
  if (data.role !== undefined) updateData.role = data.role;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  // departmentId is the sole department source: the `department` DTO string
  // resolves to the organization-scoped master row (created when missing).
  if (data.department !== undefined) updateData.departmentId = await resolveDepartmentId(data.department, nextOrg);
  if (data.teamMemberNumber !== undefined) updateData.teamMemberNumber = data.teamMemberNumber;
  if (data.position !== undefined) updateData.position = data.position;
  if (data.lineManager !== undefined) {
    resolvedManager = await resolveManagerId(data.lineManager);
    updateData.managerId = resolvedManager;
  }
  if (data.organizationId !== undefined) {
    if (nextOrg !== null) {
      const orgExists = await prisma.organization.findUnique({ where: { id: nextOrg } });
      if (!orgExists) {
        res.status(400).json({ error: "Invalid organizationId" });
        return;
      }
    }
    updateData.organizationId = nextOrg;
  }
  // Organization consistency on the effective (post-update) links: moving a
  // user or their manager across organizations must not strand a cross-org
  // manager reference.
  const nextManager: bigint | null =
    resolvedManager !== undefined ? resolvedManager : existing.managerId;
  const updateViolation = await managerOrgViolation(nextManager, nextOrg);
  if (updateViolation) {
    res.status(400).json({ error: updateViolation });
    return;
  }

  const updateResult = await prisma.$transaction(async (tx) => {
    // Role and enablement changes can remove the last usable administrator.
    // Lock the admin set in a stable order so concurrent changes cannot both
    // observe the same count and leave the application without an active admin.
    if (data.role !== undefined || data.isActive !== undefined) {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "role" = 'admin' ORDER BY "id" FOR UPDATE`;
      const current = await tx.user.findUnique({ where: { id: userPk } });
      if (!current) return { kind: "not_found" as const };
      const removesActiveAdmin = current.role === "admin" && current.isActive &&
        ((data.role !== undefined && data.role !== "admin") || data.isActive === false);
      if (removesActiveAdmin) {
        const activeAdmins = await tx.user.count({ where: { role: "admin", isActive: true } });
        if (activeAdmins <= 1) return { kind: "last_admin" as const };
      }
    }
    const user = await tx.user.update({ where: { id: userPk }, data: updateData, include: { departmentRef: true, manager: true } });
    return { kind: "updated" as const, user };
  });

  if (updateResult.kind === "not_found") {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (updateResult.kind === "last_admin") {
    res.status(400).json({ error: "Cannot disable or demote the last active admin user" });
    return;
  }

  res.json(userResponse(updateResult.user));
}));

// DELETE /api/admin/users/:id
router.delete("/:id", authenticate, authorize("admin"), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const userPk = parseIdParam(req.params.id);
  if (userPk === null) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const deleteResult = await prisma.$transaction(async (tx) => {
    // Serialize last-admin checks, approval assignment via the user FK, and
    // concurrent deletions. A failed pending-step query aborts the transaction
    // instead of being treated as proof that no pending step exists.
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "role" = 'admin' ORDER BY "id" FOR UPDATE`;
    const rows = await tx.$queryRaw<Array<{ id: bigint }>>`
      SELECT "id" FROM "User" WHERE "id" = ${userPk} FOR UPDATE
    `;
    if (rows.length === 0) return { kind: "not_found" as const };
    const user = await tx.user.findUnique({ where: { id: userPk }, select: { role: true, isActive: true } });
    if (!user) return { kind: "not_found" as const };

    const identityAudit = await tx.identityLinkAudit.findFirst({
      where: { OR: [{ targetUserId: userPk }, { actorUserId: userPk }] },
      select: { id: true },
    });
    if (identityAudit) return { kind: "identity_audit" as const };

    if (user.role === "admin") {
      const adminCount = await tx.user.count({ where: { role: "admin" } });
      const activeAdminCount = user.isActive
        ? await tx.user.count({ where: { role: "admin", isActive: true } })
        : adminCount;
      if (adminCount <= 1 || (user.isActive && activeAdminCount <= 1)) {
        return { kind: "last_admin" as const };
      }
    }

    const pending = await tx.workflowInstanceStep.findFirst({
      where: { assigneeId: userPk, status: "pending" },
      select: { instanceId: true },
    });
    if (pending) return { kind: "pending_approval" as const };

    await tx.user.delete({ where: { id: userPk } });
    return { kind: "deleted" as const };
  });

  if (deleteResult.kind === "not_found") {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (deleteResult.kind === "identity_audit") {
    res.status(400).json({ error: "Cannot delete a user with identity-link audit history; disable the account instead" });
    return;
  }
  if (deleteResult.kind === "last_admin") {
    res.status(400).json({ error: "Cannot delete the last admin user" });
    return;
  }
  if (deleteResult.kind === "pending_approval") {
    res.status(400).json({ error: "Cannot delete user with active pending approvals" });
    return;
  }

  res.json({ message: "User deleted" });
}));

export default router;
