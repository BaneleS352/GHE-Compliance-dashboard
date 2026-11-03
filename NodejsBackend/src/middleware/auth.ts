import { Request, Response, NextFunction } from "express";
import { createRemoteJWKSet, jwtVerify, type JWTPayload, errors as joseErrors } from "jose";
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

type EntraClaims = JWTPayload & { oid?: string; preferred_username?: string; email?: string; name?: string; roles?: string[]; azp?: string; scp?: string };

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
      requiredClaims: ["exp", "iat", "oid"],
    });
    if (!payload.oid || typeof payload.oid !== "string") {
      res.status(401).json({ error: "Token is missing the Entra object identifier" });
      return;
    }
    if (!payload.azp || !config.oidc.allowedClientIds.includes(payload.azp)) {
      res.status(401).json({ error: "Token was issued to an untrusted client application" });
      return;
    }
    const scopes = typeof payload.scp === "string" ? payload.scp.split(/\s+/) : [];
    if (!scopes.includes(config.oidc.requiredScope)) {
      res.status(401).json({ error: "Token does not include the required delegated API scope" });
      return;
    }
    const decoded = { providerSubject: payload.oid.toLowerCase() };
    try {
      const dbUser = await prisma.user.findUnique({ where: { providerSubject: decoded.providerSubject }, select: { id: true, name: true, email: true, role: true, position: true, organizationId: true, providerSubject: true, providerIssuer: true, isActive: true, departmentRef: { select: { name: true } } } });
      if (!dbUser) {
        res.status(403).json({ error: "Authenticated user is not provisioned in the application" });
        return;
      }
      if (!dbUser.isActive) {
        res.status(403).json({ error: "Application account is disabled" });
        return;
      }
      // Resolve only by immutable subject, then bind that subject to the
      // configured single issuer. Email is mutable display data only.
      if (dbUser.providerSubject !== decoded.providerSubject || dbUser.providerIssuer !== config.oidc.issuer) {
        res.status(403).json({ error: "Provider identity does not match the linked application user" });
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
  } catch (error) {
    if (error instanceof joseErrors.JWKSNoMatchingKey || error instanceof joseErrors.JWKSTimeout || error instanceof joseErrors.JWKSInvalid) {
      res.status(503).json({ error: "Identity provider keys are temporarily unavailable" });
      return;
    }
    if (error instanceof TypeError || (error instanceof Error && /fetch|network|timeout|socket|ECONN/i.test(error.message))) {
      res.status(503).json({ error: "Identity provider is temporarily unavailable" });
      return;
    }
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
