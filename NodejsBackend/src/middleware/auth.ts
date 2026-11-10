import { Request, Response, NextFunction } from "express";
import { createRemoteJWKSet, jwtVerify, type JWTPayload, errors as joseErrors } from "jose";
import { config } from "../config/env";
import { prisma } from "../config/prisma";
import { toDbId, toJsonId } from "../services/ids";
import { resolveDepartmentId } from "../services/normalization";
import { logAuthDiagnostic } from "./authDiagnostics";
import { Prisma } from "@prisma/client";

const tenantAuthority = config.oidc.authority.replace(/\/v2\.0$/, "");
const authorityUrl = new URL(tenantAuthority);
const isLoopbackTestIssuer = ["localhost", "127.0.0.1", "[::1]"].includes(authorityUrl.hostname);
const jwks = createRemoteJWKSet(
  new URL(`${tenantAuthority}/discovery/v2.0/keys`),
  // The local test issuer creates a fresh signing key each time it starts.
  // Refresh immediately on an unknown kid there; retain jose's default
  // cooldown for Entra/other providers to limit unnecessary JWKS requests.
  isLoopbackTestIssuer ? { cooldownDuration: 0 } : undefined,
);

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

type EntraClaims = JWTPayload & {
  oid?: string;
  preferred_username?: string;
  email?: string;
  name?: string;
  roles?: string[];
  azp?: string;
  scp?: string;
  upn?: string;
  department?: string;
  position?: string;
  jobTitle?: string;
  organization?: string;
  org?: string;
  organizationId?: number | string;
  orgId?: number | string;
  employeeNumber?: string | number;
  employee_number?: string | number;
  employeeId?: string | number;
  employee_id?: string | number;
  teamMemberNumber?: string | number;
  groups?: string[];
};

function jwtValidationFailureReason(error: unknown): string {
  if (error instanceof joseErrors.JWSSignatureVerificationFailed) return "signature_invalid";
  if (error instanceof joseErrors.JWTExpired) return "token_expired";
  if (error instanceof joseErrors.JWTClaimValidationFailed) {
    if (error.claim === "iss") return error.reason === "mismatch" || error.reason === "check_failed" ? "issuer_mismatch" : "issuer_invalid";
    if (error.claim === "aud") return error.reason === "mismatch" || error.reason === "check_failed" ? "audience_mismatch" : "audience_invalid";
    if (error.claim === "exp") return "expiration_claim_invalid";
    if (error.claim === "iat") return "issued_at_claim_invalid";
    return "required_claim_validation_failed";
  }
  if (error instanceof joseErrors.JWTInvalid) return "token_format_invalid";
  return "jwt_validation_failed";
}

async function autoProvisionUser(providerSubject: string, payload: EntraClaims) {
  // Determine profile fields from signed claims (display data only).
  const name =
    (typeof payload.name === "string" && payload.name.trim()) ||
    (typeof payload.preferred_username === "string" && payload.preferred_username.trim()) ||
    providerSubject;

  let email = "";
  if (typeof payload.email === "string" && payload.email.includes("@")) email = payload.email;
  else if (typeof payload.preferred_username === "string" && payload.preferred_username.includes("@")) email = payload.preferred_username;
  else if (typeof payload.upn === "string" && payload.upn.includes("@")) email = payload.upn;
  if (!email) email = `${providerSubject}@unprovisioned.local`;
  email = email.toLowerCase();

  // Organization from trusted claims (numeric id or name/shortCode). Never
  // from email. Unavailable -> null (pending admin completion).
  let orgPk: bigint | null = null;
  for (const key of ["organizationId", "orgId"]) {
    const v = (payload as Record<string, unknown>)[key];
    if (v === undefined || v === null) continue;
    const n = typeof v === "number" ? v : (typeof v === "string" && /^\d+$/.test(v) ? Number(v) : NaN);
    if (Number.isFinite(n)) {
      const org = await prisma.organization.findUnique({ where: { id: toDbId(n) } });
      if (org) { orgPk = org.id; break; }
    }
  }
  if (orgPk === null) {
    const orgNameRaw = (payload as Record<string, unknown>).organization ?? (payload as Record<string, unknown>).org;
    const orgName = typeof orgNameRaw === "string" ? orgNameRaw.trim() : "";
    if (orgName) {
      const org = await prisma.organization.findFirst({ where: { OR: [{ name: orgName }, { shortCode: orgName }] } });
      if (org) orgPk = org.id;
    }
  }

  const position =
    (typeof payload.position === "string" && payload.position.trim()) ||
    (typeof payload.jobTitle === "string" && payload.jobTitle.trim()) ||
    "";

  const deptName =
    typeof payload.department === "string" ? payload.department.trim() : "";

  // Employee/team-member number from trusted claims only.
  let teamMemberNumber = "";
  for (const key of ["teamMemberNumber", "employeeNumber", "employee_number", "employeeId", "employee_id"]) {
    const v = (payload as Record<string, unknown>)[key];
    if (typeof v === "string" && v.trim()) { teamMemberNumber = v.trim(); break; }
    if (typeof v === "number" && Number.isFinite(v)) { teamMemberNumber = String(v); break; }
  }

  let departmentPk: bigint | null = null;
  if (deptName && orgPk !== null) {
    departmentPk = await resolveDepartmentId(deptName, orgPk);
  }

  try {
    const created = await prisma.user.create({
      data: {
        name,
        email,
        role: "teamMember",
        teamMemberNumber,
        departmentId: departmentPk,
        position,
        managerId: null,
        organizationId: orgPk,
        providerSubject,
        providerIssuer: config.oidc.issuer,
        isActive: true,
      },
      select: { id: true, name: true, email: true, role: true, position: true, organizationId: true, providerSubject: true, providerIssuer: true, isActive: true, departmentRef: { select: { name: true } } },
    });
    return created;
  } catch (e) {
    // Unique constraint collision (subject or email already exists): do not
    // link or overwrite; re-read by subject in case of a race.
    if ((e as { code?: string })?.code === "P2002") {
      const existing = await prisma.user.findUnique({ where: { providerSubject }, select: { id: true, name: true, email: true, role: true, position: true, organizationId: true, providerSubject: true, providerIssuer: true, isActive: true, departmentRef: { select: { name: true } } } });
      return existing ?? null;
    }
    throw e;
  }
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    logAuthDiagnostic(res, "bearer_header", "failure", "missing_or_malformed");
    res.status(401).json({ error: "Missing or invalid authorization header" });
    return;
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    logAuthDiagnostic(res, "bearer_header", "failure", "empty_token");
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
      logAuthDiagnostic(res, "required_claims", "failure", "oid_missing");
      res.status(401).json({ error: "Token is missing the Entra object identifier" });
      return;
    }
    if (!payload.azp || !config.oidc.allowedClientIds.includes(payload.azp)) {
      logAuthDiagnostic(res, "client_allowlist", "failure", "client_not_allowed");
      res.status(401).json({ error: "Token was issued to an untrusted client application" });
      return;
    }
    const scopes = typeof payload.scp === "string" ? payload.scp.split(/\s+/) : [];
    if (!scopes.includes(config.oidc.requiredScope)) {
      logAuthDiagnostic(res, "delegated_scope", "failure", "required_scope_missing");
      res.status(401).json({ error: "Token does not include the required delegated API scope" });
      return;
    }
    const decoded = { providerSubject: payload.oid.toLowerCase() };
    try {
      let dbUser = await prisma.user.findUnique({ where: { providerSubject: decoded.providerSubject }, select: { id: true, name: true, email: true, role: true, position: true, organizationId: true, providerSubject: true, providerIssuer: true, isActive: true, departmentRef: { select: { name: true } } } });
      if (!dbUser) {
        // Safe first-login provisioning: create a least-privilege local account
        // keyed only by the immutable Entra object ID. Profile fields may be
        // populated from signed claims; organization/employee number come from
        // trusted claims when present and are otherwise left for an admin.
        // Admin/approver roles are never granted from claims.
        dbUser = await autoProvisionUser(decoded.providerSubject, payload);
        if (!dbUser) {
          logAuthDiagnostic(res, "local_identity_lookup", "failure", "identity_not_provisioned");
          res.status(403).json({ error: "Authenticated user is not provisioned in the application" });
          return;
        }
      }
      if (!dbUser.isActive) {
        logAuthDiagnostic(res, "local_identity_lookup", "failure", "account_disabled");
        res.status(403).json({ error: "Application account is disabled" });
        return;
      }
      // Resolve only by immutable subject, then bind that subject to the
      // configured single issuer. Email is mutable display data only.
      if (dbUser.providerSubject !== decoded.providerSubject || dbUser.providerIssuer !== config.oidc.issuer) {
        logAuthDiagnostic(res, "local_identity_lookup", "failure", "provider_link_mismatch");
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
      logAuthDiagnostic(res, "local_identity_lookup", "failure", "database_unavailable");
      res.status(503).json({ error: "Auth service unavailable" });
      return;
    }
    logAuthDiagnostic(res, "authentication", "success");
    next();
  } catch (error) {
    if (error instanceof joseErrors.JWKSNoMatchingKey) {
      // The JWKS endpoint was reachable, but it does not publish the key that
      // signed this token. This is an invalid/stale token, not an outage.
      logAuthDiagnostic(res, "jwks_verification", "failure", "signing_key_not_found");
      res.status(401).json({ error: "Token signing key is not recognized; sign in again" });
      return;
    }
    if (error instanceof joseErrors.JWKSTimeout || error instanceof joseErrors.JWKSInvalid) {
      logAuthDiagnostic(res, "jwks_verification", "failure", error instanceof joseErrors.JWKSTimeout ? "provider_keys_timeout" : "provider_keys_invalid");
      res.status(503).json({ error: "Identity provider keys are temporarily unavailable" });
      return;
    }
    if (error instanceof TypeError || (error instanceof Error && /fetch|network|timeout|socket|ECONN/i.test(error.message))) {
      logAuthDiagnostic(res, "jwks_verification", "failure", "provider_unreachable");
      res.status(503).json({ error: "Identity provider is temporarily unavailable" });
      return;
    }
    logAuthDiagnostic(res, "jwt_validation", "failure", jwtValidationFailureReason(error));
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
