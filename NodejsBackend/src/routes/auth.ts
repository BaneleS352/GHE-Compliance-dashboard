import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { config } from "../config/env";
import { authenticate, AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "Too many login attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/login", loginLimiter, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const { email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name, department: user.department, position: user.position, organizationId: user.organizationId },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn as any, algorithm: "HS256" }
  );

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      teamMemberNumber: user.teamMemberNumber,
      department: user.department,
      position: user.position,
      lineManager: user.lineManager,
      organizationId: user.organizationId,
    },
  });
}));

const PRESET_USERS = [
  { label: "HB — Team Member — Nomvula Dlamini", email: "nomvula@hb.co.za", role: "teamMember" },
  { label: "HB — Line Manager — Sipho Nkosi", email: "sipho@hb.co.za", role: "approver" },
  { label: "NPN — Team Member — Kabelo Molefe", email: "kabelo@npn.co.za", role: "teamMember" },
  { label: "NPN — Line Manager — James van Wyk", email: "james@npn.co.za", role: "approver" },
  { label: "HR — Lindiwe Zulu", email: "lindiwe@hb.co.za", role: "approver" },
  { label: "Admin — System Admin", email: "admin@hb.co.za", role: "admin" },
];

router.get("/preset-users", (_req: Request, res: Response): void => {
  res.json(PRESET_USERS);
});

router.get("/me", authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
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
    organizationId: user.organizationId,
  });
}));

export default router;
