import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { authenticate, authorize, AuthRequest } from "../../middleware/auth";

const router = Router();
const SALT_ROUNDS = 10;

// GET /api/admin/users
router.get("/", authenticate, authorize("admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  const { search, role } = req.query;

  let users = await prisma.user.findMany({ orderBy: { name: "asc" } });

  if (role && role !== "All Roles") {
    const roleMap: Record<string, string> = {
      "Administrator": "admin",
      "Approver": "approver",
      "Team Member": "teamMember",
    };
    const internalRole = roleMap[String(role)] || String(role);
    users = users.filter((u) => u.role === internalRole);
  }

  if (search) {
    const q = String(search).toLowerCase();
    users = users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q)
    );
  }

  res.json(
    users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      teamMemberNumber: u.teamMemberNumber,
      department: u.department,
      position: u.position,
      lineManager: u.lineManager,
    }))
  );
});

// GET /api/admin/users/:id
router.get("/:id", authenticate, authorize("admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
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
});

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["teamMember", "approver", "admin"]),
  department: z.string().optional().default(""),
  teamMemberNumber: z.string().optional().default(""),
  position: z.string().optional().default(""),
  lineManager: z.string().nullable().optional().default(null),
});

// POST /api/admin/users
router.post("/", authenticate, authorize("admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  const data = parsed.data;
  const existingEmail = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
  if (existingEmail) {
    res.status(409).json({ error: "A user with this email already exists" });
    return;
  }

  const id = `USR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const user = await prisma.user.create({
    data: {
      id,
      name: data.name,
      email: data.email.toLowerCase(),
      passwordHash: bcrypt.hashSync("password", SALT_ROUNDS),
      role: data.role,
      teamMemberNumber: data.teamMemberNumber,
      department: data.department,
      position: data.position,
      lineManager: data.lineManager,
    },
  });

  res.status(201).json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    teamMemberNumber: user.teamMemberNumber,
    department: user.department,
    position: user.position,
    lineManager: user.lineManager,
  });
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(["teamMember", "approver", "admin"]).optional(),
  department: z.string().optional(),
  teamMemberNumber: z.string().optional(),
  position: z.string().optional(),
  lineManager: z.string().nullable().optional(),
});

// PUT /api/admin/users/:id
router.put("/:id", authenticate, authorize("admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  const data = parsed.data;
  if (data.email) {
    const dup = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
    if (dup && dup.id !== id) {
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
  if (data.lineManager !== undefined) updateData.lineManager = data.lineManager;

  const user = await prisma.user.update({ where: { id }, data: updateData });

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
});

// DELETE /api/admin/users/:id
router.delete("/:id", authenticate, authorize("admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const user = await prisma.user.findUnique({ where: { id } });
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

  const activeWorkflows = await prisma.workflowInstance.findMany();
  const hasActive = activeWorkflows.some((w) => {
    const steps: any[] = JSON.parse(w.steps);
    return steps.some((s) => s.assignee === id && s.status === "pending");
  });
  if (hasActive) {
    res.status(400).json({ error: "Cannot delete user with active pending approvals" });
    return;
  }

  await prisma.user.delete({ where: { id } });
  res.json({ message: "User deleted" });
});

export default router;
