import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { authenticate, authorize, AuthRequest } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/asyncHandler";
import { parseIdParam, toDbId, toJsonId } from "../../services/ids";

const router = Router();
const SALT_ROUNDS = 10;

function userResponse(u: any) {
  return {
    id: toJsonId(u.id),
    name: u.name,
    email: u.email,
    role: u.role,
    teamMemberNumber: u.teamMemberNumber,
    department: u.department,
    position: u.position,
    lineManager: u.lineManager,
    organizationId: u.organizationId === null || u.organizationId === undefined ? null : toJsonId(u.organizationId),
  };
}

// GET /api/admin/users
router.get("/", authenticate, authorize("admin"), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { search, role } = req.query;

  const where: any = {};

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
    const numeric = /^\d+$/.test(q.trim()) ? BigInt(q.trim()) : null;
    where.OR = [
      { name: { contains: q } },
      { email: { contains: q } },
      ...(numeric !== null ? [{ id: numeric }] : []),
    ];
  }

  const users = await prisma.user.findMany({ where, orderBy: { name: "asc" } });

  res.json(users.map(userResponse));
}));

// GET /api/admin/users/:id
router.get("/:id", authenticate, authorize("admin"), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
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
  res.json(userResponse(user));
}));

const managerInput = z.union([z.string(), z.number().int()], { errorMap: () => ({ message: "Expected a user reference" }) });

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["teamMember", "approver", "admin"]),
  password: z.string().min(8).optional(),
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
    const found = await prisma.user.findUnique({ where: { id: BigInt(lineManager) }, select: { id: true } });
    return found ? found.id : null;
  }
  const trimmed = String(lineManager).trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) {
    const found = await prisma.user.findUnique({ where: { id: BigInt(trimmed) }, select: { id: true } });
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

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email.toLowerCase(),
      passwordHash: bcrypt.hashSync(password, SALT_ROUNDS),
      role: data.role,
      teamMemberNumber: data.teamMemberNumber,
      department: data.department,
      position: data.position,
      lineManager: data.lineManager === null || data.lineManager === undefined ? null : String(data.lineManager),
      managerId: await resolveManagerId(data.lineManager),
      organizationId: orgPk,
    },
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

  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.email !== undefined) updateData.email = data.email.toLowerCase();
  if (data.role !== undefined) updateData.role = data.role;
  if (data.department !== undefined) updateData.department = data.department;
  if (data.teamMemberNumber !== undefined) updateData.teamMemberNumber = data.teamMemberNumber;
  if (data.position !== undefined) updateData.position = data.position;
  if (data.lineManager !== undefined) {
    updateData.lineManager = data.lineManager === null ? null : String(data.lineManager);
    updateData.managerId = await resolveManagerId(data.lineManager);
  }
  if (data.organizationId !== undefined) {
    const orgPk = data.organizationId === null ? null : toDbId(data.organizationId);
    if (orgPk !== null) {
      const orgExists = await prisma.organization.findUnique({ where: { id: orgPk } });
      if (!orgExists) {
        res.status(400).json({ error: "Invalid organizationId" });
        return;
      }
    }
    updateData.organizationId = orgPk;
  }

  const user = await prisma.user.update({ where: { id: userPk }, data: updateData });

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
  const pending = await (prisma as any).workflowInstanceStep.findFirst({
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
