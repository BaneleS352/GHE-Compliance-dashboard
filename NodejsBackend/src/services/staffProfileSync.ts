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
  constructor(readonly reason: "disabled" | "configuration" | "unavailable" | "not_found" | "ambiguous" | "identity_mismatch" | "employee_identifier_missing" | "graph_token_missing" | "graph_permission_denied" | "graph_profile_unavailable" | "branch_unmapped" | "invalid_response") {
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

async function getGraphEmployeeIdentifier(graphToken: string | undefined, expectedObjectId: string): Promise<string> {
  const token = graphToken?.trim();
  if (!token) throw new StaffProfileSyncError("graph_token_missing");
  if (token.length > 20_000 || /[\r\n]/.test(token)) throw new StaffProfileSyncError("graph_token_missing");
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") throw new StaffProfileSyncError("configuration");

  let response: Response;
  try {
    response = await fetch("https://graph.microsoft.com/v1.0/me?$select=id,employeeId", {
      headers: { accept: "application/json", authorization: `Bearer ${token}` },
      redirect: "error",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new StaffProfileSyncError("graph_profile_unavailable");
  }
  if (response.status === 401 || response.status === 403) throw new StaffProfileSyncError("graph_permission_denied");
  if (!response.ok) throw new StaffProfileSyncError("graph_profile_unavailable");

  let profile: { id?: unknown; employeeId?: unknown };
  try { profile = await response.json() as { id?: unknown; employeeId?: unknown }; }
  catch { throw new StaffProfileSyncError("invalid_response"); }
  if (text(profile.id).toLowerCase() !== expectedObjectId.toLowerCase()) {
    throw new StaffProfileSyncError("identity_mismatch");
  }
  const employeeId = text(profile.employeeId);
  if (!employeeId) throw new StaffProfileSyncError("employee_identifier_missing");
  return employeeId;
}

function parseRecord(raw: unknown): StaffRecord {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new StaffProfileSyncError("invalid_response");
  const record = raw as StaffRecord;
  return record;
}

async function fetchStaffBy(employeeId: string, queryParameter: "employeeCode" | "employeeId"): Promise<StaffRecord | null> {
  if (!config.staffProfile.enabled) throw new StaffProfileSyncError("disabled");
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") throw new StaffProfileSyncError("configuration");
  let endpoint: URL;
  try { endpoint = new URL(config.staffProfile.endpoint); } catch { throw new StaffProfileSyncError("configuration"); }
  if (endpoint.protocol !== "https:" || !config.staffProfile.allowedHosts.includes(endpoint.hostname.toLowerCase()) || endpoint.username || endpoint.password) {
    throw new StaffProfileSyncError("configuration");
  }
  if (!employeeId) throw new StaffProfileSyncError("employee_identifier_missing");
  endpoint.searchParams.set(queryParameter, employeeId);

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
  if (response.status === 404) return null;
  if (!response.ok) throw new StaffProfileSyncError("unavailable");
  let body: StaffEnvelope;
  try { body = await response.json() as StaffEnvelope; } catch { throw new StaffProfileSyncError("invalid_response"); }
  if (body.success !== true) return null;
  const records = Array.isArray(body.data) ? body.data : body.data && typeof body.data === "object" ? [body.data] : [];
  if (records.length === 0) return null;
  if (records.length !== 1) throw new StaffProfileSyncError("ambiguous");
  return parseRecord(records[0]);
}

async function fetchStaff(employeeCode: string): Promise<StaffRecord> {
  // HIS calls the returned identifier `employeeCode`; some deployments expose
  // that as the query parameter while others use `employeeId`. Try the field
  // name first, then the historical query name. Both use only the value
  // returned by Graph, and the response is still checked against it below.
  for (const parameter of ["employeeCode", "employeeId"] as const) {
    const record = await fetchStaffBy(employeeCode, parameter);
    if (record) return record;
  }
  throw new StaffProfileSyncError("not_found");
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
  graphAccessToken?: string;
}) {
  const email = getEntraEmail(input.claims);
  const existing = await prisma.user.findUnique({
    where: { providerSubject: input.providerSubject },
    select: { id: true, teamMemberNumber: true, organizationId: true },
  });

  // The Graph token is used only to ask Graph for the profile of its own
  // signed-in user. Match Graph's immutable object id to the already-validated
  // API token before trusting employeeId; never accept a browser-supplied code.
  const queryByCode = await getGraphEmployeeIdentifier(input.graphAccessToken, input.providerSubject);
  let record: StaffRecord;
  try {
    record = await fetchStaff(queryByCode);
  } catch (error) {
    if (!(error instanceof StaffProfileSyncError) || error.reason !== "not_found") throw error;

    // HIS UAT/dev may not contain every Entra user. Allow authentication with
    // a minimal local account; a later /me call will retry HIS and fill the
    // profile when a matching record becomes available. Never replace an
    // existing account's local role, enablement, or profile data here.
    if (existing) return prisma.user.findUniqueOrThrow({ where: { id: existing.id } });
    try {
      return await prisma.user.create({
        data: {
          name: text(input.claims.name) || email.split("@")[0],
          email: normalizeEmail(email),
          role: "teamMember",
          isActive: true,
          teamMemberNumber: "",
          position: "",
          providerSubject: input.providerSubject,
          providerIssuer: config.oidc.issuer,
        },
      });
    } catch (createError) {
      if ((createError as { code?: string })?.code === "P2002") throw new StaffProfileSyncError("identity_mismatch");
      throw createError;
    }
  }
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
