import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { config } from "../config/env";
import { authenticate, AuthRequest } from "../middleware/auth";

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

router.post("/login", loginLimiter, async (req: Request, res: Response): Promise<void> => {
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

  const valid = bcrypt.compareSync(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn as any }
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
    },
  });
});

const PRESET_USERS = [
  { label: "Team Member — Nomvula Dlamini", email: "nomvula@hb.co.za", role: "teamMember" },
  { label: "Line Manager — Sipho Nkosi", email: "sipho@hb.co.za", role: "approver" },
  { label: "HR — Lindiwe Zulu", email: "lindiwe@hb.co.za", role: "approver" },
  { label: "CEO — Sandile Shabalala", email: "sandile@hb.co.za", role: "approver" },
  { label: "Admin — System Admin", email: "admin@hb.co.za", role: "admin" },
];

router.get("/preset-users", (_req: Request, res: Response): void => {
  res.json(PRESET_USERS);
});

router.get("/me", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
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
  });
});

export default router;
