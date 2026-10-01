import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/env";
import { prisma } from "../config/prisma";
import { toDbId, toJsonId } from "../services/ids";

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
    name: string;
    department?: string;
    position?: string;
    organizationId?: number | null;
  };
}

export interface JwtPayload {
  id: number;
  email: string;
  role: string;
  name: string;
  department?: string;
  position?: string;
  organizationId?: number | null;
}

/** Build the JWT payload for a user row (numeric id, JSON-safe). */
export function buildTokenPayload(u: {
  id: bigint | number;
  email: string;
  role: string;
  name: string;
  department?: string | null;
  position?: string | null;
  organizationId?: bigint | number | null;
}): JwtPayload {
  return {
    id: toJsonId(u.id),
    email: u.email,
    role: u.role,
    name: u.name,
    department: u.department ?? undefined,
    position: u.position ?? undefined,
    organizationId:
      u.organizationId === null || u.organizationId === undefined
        ? null
        : toJsonId(u.organizationId),
  };
}

export function signToken(u: Parameters<typeof buildTokenPayload>[0]): string {
  return jwt.sign(buildTokenPayload(u), config.jwtSecret, { algorithm: "HS256", expiresIn: "1h" });
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid authorization header" });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"] }) as JwtPayload;
    let dbId: bigint;
    try {
      // Legacy text identifiers (e.g. "user-admin") have no numeric mapping
      // and no compatibility lookup: they are rejected as invalid tokens.
      dbId = toDbId(decoded.id);
    } catch {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }
    try {
      const dbUser = await prisma.user.findUnique({ where: { id: dbId }, select: { role: true, department: true, position: true, organizationId: true } });
      if (!dbUser) {
        res.status(401).json({ error: "User not found" });
        return;
      }
      if (dbUser.role !== decoded.role) decoded.role = dbUser.role;
      if (dbUser.department !== decoded.department) decoded.department = dbUser.department;
      if (dbUser.position !== decoded.position) decoded.position = dbUser.position;
      const dbOrg = dbUser.organizationId === null || dbUser.organizationId === undefined ? null : toJsonId(dbUser.organizationId);
      if (dbOrg !== decoded.organizationId) decoded.organizationId = dbOrg;
    } catch {
      res.status(503).json({ error: "Auth service unavailable" });
      return;
    }
    req.user = decoded as AuthRequest["user"];
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function authorize(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    next();
  };
}
