import { config } from "../config/env";
import { prisma } from "../config/prisma";
import { resolveDepartmentId } from "./normalization";
import type { EntraClaims } from "../middleware/auth";

const REQUEST_TIMEOUT_MS = 10_000;
type StaffRecord = {
  employeeCode?: unknown;
  fullName?: unknown;
  fUllName?: unknown;
  email?: unknown;
  departmentName?: unknown;
  fK_DepartmemntID?: unknown;
  employmentStatus?: unknown;
  employmentType?: unknown;
  jobTitle?: unknown;
  managerEmployeeCode?: unknown;
  managerFullName?: unknown;
  branchName?: unknown;
  terminationDate?: unknown;
};

type StaffEnvelope = { success?: unknown; data?: unknown };

export class StaffProfileSyncError extends Error {
  constructor(readonly reason: "disabled" | "configuration" | "unavailable" | "not_found" | "ambiguous" | "identity_mismatch" | "employee_identifier_missing" | "branch_unmapped" | "invalid_response") {
    super(reason);
    this.name = "StaffProfileSyncError";
  }
}

function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function getEntraEmail(claims: EntraClaims): string {
  for (const value of [claims.email, claims.preferred_username, claims.upn]) {
    if (typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return value.trim();
  }
  throw new StaffProfileSyncError("identity_mismatch");
}

function getEntraEmployeeIdentifier(claims: EntraClaims): string {
  const values = claims as Record<string, unknown>;
  for (const key of [config.staffProfile.employeeIdClaim, "employeeid", "employeeId", "employee_number", "employeeNumber", "employee_id", "teamMemberNumber"]) {
    const value = text(values[key]);
    if (value) return value;
  }
  throw new StaffProfileSyncError("employee_identifier_missing");
}

function parseRecord(raw: unknown): StaffRecord {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new StaffProfileSyncError("invalid_response");
  const record = raw as StaffRecord;
  return record;
}

async function fetchStaff(employeeId: string): Promise<StaffRecord> {
  if (!config.staffProfile.enabled) throw new StaffProfileSyncError("disabled");
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") throw new StaffProfileSyncError("configuration");
  let endpoint: URL;
  try { endpoint = new URL(config.staffProfile.endpoint); } catch { throw new StaffProfileSyncError("configuration"); }
  if (endpoint.protocol !== "https:" || !config.staffProfile.allowedHosts.includes(endpoint.hostname.toLowerCase()) || endpoint.username || endpoint.password) {
    throw new StaffProfileSyncError("configuration");
  }
  if (!employeeId) throw new StaffProfileSyncError("employee_identifier_missing");
  endpoint.searchParams.set("employeeId", employeeId);

  const headers: Record<string, string> = { accept: "application/json, */*" };
  if (config.staffProfile.token) {
    const scheme = config.staffProfile.tokenScheme;
    const value = scheme && !/^\S+\s/.test(config.staffProfile.token)
      ? `${scheme} ${config.staffProfile.token}`
      : config.staffProfile.token;
    headers[config.staffProfile.tokenHeader] = value;
  }
  let response: Response;
  try {
    response = await fetch(endpoint, { headers, redirect: "error", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch {
    throw new StaffProfileSyncError("unavailable");
  }
  if (!response.ok) throw new StaffProfileSyncError(response.status === 404 ? "not_found" : "unavailable");
  let body: StaffEnvelope;
  try { body = await response.json() as StaffEnvelope; } catch { throw new StaffProfileSyncError("invalid_response"); }
  if (body.success !== true) throw new StaffProfileSyncError("not_found");
  const records = Array.isArray(body.data) ? body.data : body.data && typeof body.data === "object" ? [body.data] : [];
  if (records.length === 0) throw new StaffProfileSyncError("not_found");
  if (records.length !== 1) throw new StaffProfileSyncError("ambiguous");
  return parseRecord(records[0]);
}

function staffField(record: StaffRecord, ...keys: (keyof StaffRecord)[]): string {
  for (const key of keys) {
    const value = text(record[key]);
    if (value) return value;
  }
  return "";
}

async function resolveOrganization(branchName: string) {
  const orgShortCode = config.staffProfile.branchOrganizationMap[branchName.trim().toUpperCase()];
  if (!orgShortCode) throw new StaffProfileSyncError("branch_unmapped");
  const organization = await prisma.organization.findUnique({ where: { shortCode: orgShortCode } });
  if (!organization) throw new StaffProfileSyncError("branch_unmapped");
  return organization;
}

async function resolveManager(employeeCode: string, organizationId: bigint): Promise<bigint | null> {
  if (!employeeCode) return null;
  const matches = await prisma.user.findMany({
    where: { teamMemberNumber: employeeCode, organizationId },
    select: { id: true },
    take: 2,
  });
  return matches.length === 1 ? matches[0].id : null;
}

/**
 * Synchronize only HIS-owned fields. Entra issuer/object id owns identity;
 * local role and isActive are never included in this write.
 */
export async function syncStaffProfile(input: {
  providerSubject: string;
  claims: EntraClaims;
}) {
  const email = getEntraEmail(input.claims);
  const existing = await prisma.user.findUnique({
    where: { providerSubject: input.providerSubject },
    select: { id: true, teamMemberNumber: true, organizationId: true },
  });

  // Entra's configured employee identifier is required on first login. Email
  // is mutable contact data and is never used to associate a person with an HIS
  // account. Once linked, the stored HIS employee code drives refreshes.
  const queryByCode = existing?.teamMemberNumber?.trim() || getEntraEmployeeIdentifier(input.claims);
  const record = await fetchStaff(queryByCode);
  const employeeCode = staffField(record, "employeeCode");
  if (!employeeCode || employeeCode !== queryByCode) throw new StaffProfileSyncError("identity_mismatch");

  const name = staffField(record, "fullName", "fUllName");
  const departmentName = staffField(record, "departmentName");
  const position = staffField(record, "jobTitle");
  const branchName = staffField(record, "branchName");
  if (!name || !employeeCode || !departmentName || !position || !branchName) {
    throw new StaffProfileSyncError("invalid_response");
  }

  const organization = await resolveOrganization(branchName);
  const departmentId = await resolveDepartmentId(departmentName, organization.id);
  if (!departmentId) throw new StaffProfileSyncError("invalid_response");
  const managerCode = staffField(record, "managerEmployeeCode");
  const managerId = await resolveManager(managerCode, organization.id);
  const managerWasProvided = Boolean(managerCode);

  const dateValue = staffField(record, "terminationDate");
  const terminationDate = dateValue && !/^0001-01-01(?:T00:00:00(?:\.0+)?)?Z?$/i.test(dateValue) ? new Date(dateValue) : null;
  const employmentStatus = staffField(record, "employmentStatus") || null;
  const employmentType = staffField(record, "employmentType") || null;

  const profileData = {
    name,
    teamMemberNumber: employeeCode,
    departmentId,
    position,
    organizationId: organization.id,
    staffBranchCode: branchName,
    staffEmploymentStatus: employmentStatus,
    staffEmploymentType: employmentType,
    staffProfileSyncedAt: new Date(),
    staffTerminationDate: terminationDate && !Number.isNaN(terminationDate.getTime()) ? terminationDate : null,
    ...(managerWasProvided ? { managerId } : existing && existing.organizationId !== organization.id ? { managerId: null } : {}),
  };

  if (existing) {
    return prisma.user.update({ where: { id: existing.id }, data: profileData });
  }

  // Create only after a unique, complete, identity-matched HIS result exists.
  // P2002 means another account already owns this email/employee code; never
  // attach the Entra subject automatically in that case.
  try {
    return await prisma.user.create({
      data: {
        ...profileData,
        email: normalizeEmail(email),
        role: "teamMember",
        isActive: true,
        providerSubject: input.providerSubject,
        providerIssuer: config.oidc.issuer,
      },
    });
  } catch (error) {
    if ((error as { code?: string })?.code === "P2002") throw new StaffProfileSyncError("identity_mismatch");
    throw error;
  }
}
