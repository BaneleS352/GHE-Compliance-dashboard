import { Request, Response, NextFunction } from "express";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { config } from "../config/env";
import { prisma } from "../config/prisma";
import { toJsonId } from "../services/ids";

const tenantAuthority = config.oidc.authority.replace(/\/v2\.0$/, "");
const jwks = createRemoteJWKSet(new URL(`${tenantAuthority}/discovery/v2.0/keys`));

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

type EntraClaims = JWTPayload & { oid?: string; preferred_username?: string; email?: string; name?: string; roles?: string[] };

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid authorization header" });
    return;
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    res.status(401).json({ error: "Missing or invalid authorization header" });
    return;
  }

  try {
    const { payload } = await jwtVerify<EntraClaims>(token, jwks, {
      issuer: config.oidc.issuer,
      audience: config.oidc.audience,
      algorithms: ["RS256"],
    });
    if (!payload.oid || typeof payload.oid !== "string") {
      res.status(401).json({ error: "Token is missing the Entra object identifier" });
      return;
    }
    const email = String(payload.preferred_username || payload.email || "").toLowerCase();
    if (!email) {
      res.status(401).json({ error: "Token is missing an email identity" });
      return;
    }
    const decoded = { providerSubject: payload.oid, email, name: String(payload.name || email) };
    try {
      const dbUser = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, email: true, role: true, position: true, organizationId: true, departmentRef: { select: { name: true } } } });
      if (!dbUser) {
        res.status(403).json({ error: "Authenticated user is not provisioned in the application" });
        return;
      }
      const dbDept = dbUser.departmentRef?.name;
      const user = {
        id: toJsonId(dbUser.id), email: dbUser.email, role: dbUser.role, name: dbUser.name,
        department: dbDept ?? undefined, position: dbUser.position ?? undefined,
        organizationId: dbUser.organizationId === null ? null : toJsonId(dbUser.organizationId),
      };
      req.user = user;
    } catch {
      res.status(503).json({ error: "Auth service unavailable" });
      return;
    }
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
