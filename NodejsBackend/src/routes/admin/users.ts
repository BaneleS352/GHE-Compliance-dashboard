import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { authenticate, authorize, AuthRequest } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/asyncHandler";
import { parseIdParam, toDbId, toJsonId } from "../../services/ids";
import { managerOrgViolation } from "../../services/orgConsistency";
import { resolveDepartmentId } from "../../services/normalization";

const router = Router();
const SALT_ROUNDS = 10;

/** User row with its department link for display derivation. */
type UserWithDepartment = Prisma.UserGetPayload<{ include: { departmentRef: true } }>;

function userResponse(u: UserWithDepartment) {
  return {
    id: toJsonId(u.id),
    name: u.name,
    email: u.email,
    role: u.role,
    teamMemberNumber: u.teamMemberNumber,
    // Display only: departmentId -> Department.name is the sole source.
    department: u.departmentRef?.name ?? "",
    position: u.position,
    lineManager: u.lineManager,
    organizationId: u.organizationId === null || u.organizationId === undefined ? null : toJsonId(u.organizationId),
  };
}

// GET /api/admin/users
router.get("/", authenticate, authorize("admin"), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { search, role } = req.query;

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
    const q = String(search);
    const numeric = /^\d+$/.test(q.trim()) ? toDbId(q.trim()) : null;
    where.OR = [
      { name: { contains: q } },
      { email: { contains: q } },
      ...(numeric !== null ? [{ id: numeric }] : []),
    ];
  }

  const users = await prisma.user.findMany({ where, orderBy: { name: "asc" }, include: { departmentRef: true } });

  res.json(users.map(userResponse));
}));

// GET /api/admin/users/:id
router.get("/:id", authenticate, authorize("admin"), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
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
  res.json(userResponse(user));
}));

const managerInput = z.union([z.string(), z.number().int()], { errorMap: () => ({ message: "Expected a user reference" }) });

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["teamMember", "approver", "admin"]),
  password: z.string().min(8).optional(),
  // DTO resolver input (not stored): resolves to departmentId through the
  // organization-scoped Department master data (created when missing).
  department: z.string().optional().default(""),
  teamMemberNumber: z.string().optional().default(""),
  position: z.string().optional().default(""),
  lineManager: managerInput.nullable().optional().default(null),
  organizationId: z.union([z.number().int(), z.string().regex(/^\d+$/)], { errorMap: () => ({ message: "Expected a numeric identifier" }) }).nullable().optional().default(null),
});

/**
 * Resolve the authoritative managerId FK from a lineManager input. Accepts a
 * numeric user id (as number or string) or a display name; anything else
 * leaves the FK unset while the display text is still stored.
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

const generatePassword = (): string => {
  const bytes = crypto.randomBytes(8);
  return bytes.toString("hex").slice(0, 12);
};

// POST /api/admin/users
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

  const password = data.password || generatePassword();
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
      passwordHash: bcrypt.hashSync(password, SALT_ROUNDS),
      role: data.role,
      teamMemberNumber: data.teamMemberNumber,
      departmentId: departmentPk,
      position: data.position,
      lineManager: data.lineManager === null || data.lineManager === undefined ? null : String(data.lineManager),
      managerId: managerPk,
      organizationId: orgPk,
    },
    include: { departmentRef: true },
  });

  res.status(201).json(userResponse(user));
}));

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(["teamMember", "approver", "admin"]).optional(),
  department: z.string().optional(),
  teamMemberNumber: z.string().optional(),
  position: z.string().optional(),
  lineManager: managerInput.nullable().optional(),
  organizationId: z.union([z.number().int(), z.string().regex(/^\d+$/)], { errorMap: () => ({ message: "Expected a numeric identifier" }) }).nullable().optional(),
});

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
  // departmentId is the sole department source: the `department` DTO string
  // resolves to the organization-scoped master row (created when missing).
  if (data.department !== undefined) updateData.departmentId = await resolveDepartmentId(data.department, nextOrg);
  if (data.teamMemberNumber !== undefined) updateData.teamMemberNumber = data.teamMemberNumber;
  if (data.position !== undefined) updateData.position = data.position;
  if (data.lineManager !== undefined) {
    updateData.lineManager = data.lineManager === null ? null : String(data.lineManager);
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

  const user = await prisma.user.update({ where: { id: userPk }, data: updateData, include: { departmentRef: true } });

  res.json(userResponse(user));
}));

// DELETE /api/admin/users/:id
router.delete("/:id", authenticate, authorize("admin"), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const userPk = parseIdParam(req.params.id);
  if (userPk === null) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: userPk } });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (user.role === "admin") {
    const adminCount = await prisma.user.count({ where: { role: "admin" } });
    if (adminCount <= 1) {
      res.status(400).json({ error: "Cannot delete the last admin user" });
      return;
    }
  }

  // Block deletion while the user holds a pending approval step.
  // Step rows are the only workflow state.
  const pending = await prisma.workflowInstanceStep.findFirst({
    where: { assigneeId: userPk, status: "pending" },
    select: { instanceId: true },
  }).catch(() => null);
  if (pending) {
    res.status(400).json({ error: "Cannot delete user with active pending approvals" });
    return;
  }

  await prisma.user.delete({ where: { id: userPk } });
  res.json({ message: "User deleted" });
}));

export default router;
