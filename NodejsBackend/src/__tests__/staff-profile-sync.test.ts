import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { config } from "../config/env";
import { prisma } from "../config/prisma";
import { syncStaffProfile } from "../services/staffProfileSync";

const subject = "9b441a7e-722c-4ba2-905e-22b48c478e92";
const issuer = config.oidc.issuer;
const email = "staff-sync-fixture@example.test";
const objectResponseEmail = "staff-sync-object@example.test";
let organizationId: bigint;
let fetchStub: ReturnType<typeof vi.fn>;
let tlsOverride: string | undefined;

function staffRecord(overrides: Record<string, unknown> = {}) {
  return {
    employeeCode: "22680",
    fUllName: "Ndaedzo Mukhuba",
    email,
    departmentName: "IT Software & Development",
    fK_DepartmemntID: 0,
    employmentStatus: "Active",
    employmentType: "Permanent",
    jobTitle: "Software Technical Lead",
    managerEmployeeCode: "MGR-1",
    managerFullName: "Test Manager",
    branchName: "BET",
    terminationDate: "0001-01-01T00:00:00",
    ...overrides,
  };
}

function mockResponses(data: unknown[], options: { employeeId?: string; graphId?: string } = {}) {
  fetchStub.mockClear();
  fetchStub.mockImplementation(async (input: URL | string) => {
    const url = new URL(String(input));
    const body = url.hostname === "graph.microsoft.com"
      ? { id: options.graphId ?? subject, employeeId: options.employeeId ?? "22680" }
      : { success: true, data };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
}

describe("HIS staff profile sync", () => {
  beforeAll(async () => {
    tlsOverride = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    config.staffProfile.enabled = true;
    config.staffProfile.branchOrganizationMap = { BET: "BET" };
    const organization = await prisma.organization.upsert({
      where: { shortCode: "BET" },
      update: { name: "Betsoftware" },
      create: { name: "Betsoftware", shortCode: "BET" },
    });
    organizationId = organization.id;
    await prisma.user.create({ data: {
      name: "Test Manager", email: "staff-sync-manager@example.test", role: "approver",
      teamMemberNumber: "MGR-1", position: "Software Technical Lead", organizationId,
    } });
    fetchStub = vi.fn();
    vi.stubGlobal("fetch", fetchStub);
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    if (tlsOverride === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    else process.env.NODE_TLS_REJECT_UNAUTHORIZED = tlsOverride;
    await prisma.user.deleteMany({ where: { email: { in: [email, objectResponseEmail, "staff-sync-manager@example.test"] } } });
    await prisma.department.deleteMany({ where: { organizationId, name: "Compliance" } });
    await prisma.$disconnect();
  });

  it("creates a first-login profile only after a unique employee-code HIS result", async () => {
    mockResponses([staffRecord()]);
    const created = await syncStaffProfile({
      providerSubject: subject,
      claims: { email, oid: subject },
      graphAccessToken: "graph-token",
    });

    expect(fetchStub).toHaveBeenCalledTimes(2);
    const graphUrl = new URL(fetchStub.mock.calls[0][0] as string);
    expect(graphUrl.href).toBe("https://graph.microsoft.com/v1.0/me?$select=id,employeeId");
    expect(fetchStub.mock.calls[0][1].headers.authorization).toBe("Bearer graph-token");
    const requestUrl = new URL(fetchStub.mock.calls[1][0] as string);
    expect(requestUrl.searchParams.get("employeeId")).toBe("22680");
    expect(requestUrl.searchParams.has("name")).toBe(false);
    expect(created).toMatchObject({
      providerSubject: subject,
      providerIssuer: issuer,
      email,
      name: "Ndaedzo Mukhuba",
      teamMemberNumber: "22680",
      position: "Software Technical Lead",
      staffBranchCode: "BET",
      staffEmploymentStatus: "Active",
      staffEmploymentType: "Permanent",
      organizationId,
      role: "teamMember",
      managerId: expect.any(BigInt),
    });
    expect(created.staffProfileSyncedAt).toBeInstanceOf(Date);
  });

  it("refreshes HIS-owned fields without changing local role or application enablement", async () => {
    const existing = await prisma.user.findUniqueOrThrow({ where: { providerSubject: subject } });
    await prisma.user.update({ where: { id: existing.id }, data: { role: "approver", isActive: false } });
    mockResponses([staffRecord({ fUllName: "Ndaedzo Updated", jobTitle: "Principal Engineer", departmentName: "Compliance" })]);

    const refreshed = await syncStaffProfile({ providerSubject: subject, claims: { email, oid: subject }, graphAccessToken: "graph-token" });

    const requestUrl = new URL(fetchStub.mock.calls[1][0] as string);
    expect(requestUrl.searchParams.get("employeeId")).toBe("22680");
    expect(refreshed).toMatchObject({
      role: "approver",
      isActive: false,
      name: "Ndaedzo Updated",
      position: "Principal Engineer",
      staffEmploymentStatus: "Active",
      organizationId,
    });
    expect(refreshed.managerId).toBe(existing.managerId);
    expect(refreshed.staffProfileSyncedAt!.getTime()).toBeGreaterThanOrEqual(existing.staffProfileSyncedAt!.getTime());
  });

  it("rejects ambiguous and identity-mismatched HIS results without creating a profile", async () => {
    const otherSubject = "d2760938-d9b2-4f67-8c9d-7a8fca3b7f56";
    mockResponses([staffRecord(), staffRecord({ employeeCode: "22681" })], { graphId: otherSubject });
    await expect(syncStaffProfile({ providerSubject: otherSubject, claims: { email, oid: otherSubject }, graphAccessToken: "graph-token" }))
      .rejects.toMatchObject({ reason: "ambiguous" });
    expect(await prisma.user.findUnique({ where: { providerSubject: otherSubject } })).toBeNull();

    mockResponses([staffRecord({ employeeCode: "OTHER-CODE" })], { graphId: otherSubject });
    await expect(syncStaffProfile({ providerSubject: otherSubject, claims: { email, oid: otherSubject }, graphAccessToken: "graph-token" }))
      .rejects.toMatchObject({ reason: "identity_mismatch" });
    expect(await prisma.user.findUnique({ where: { providerSubject: otherSubject } })).toBeNull();
  });

  it("accepts the documented single-object HIS envelope and normalizes the no-termination sentinel", async () => {
    const objectSubject = "731e983f-1d5d-4560-bcf8-c735e25bd8c8";
    fetchStub.mockClear();
    fetchStub.mockImplementation(async (input: URL | string) => {
      const url = new URL(String(input));
      const body = url.hostname === "graph.microsoft.com"
        ? { id: objectSubject, employeeId: "22681" }
        : { success: true, data: staffRecord({ email: objectResponseEmail, employeeCode: "22681", fullName: "Object Contract User", fUllName: undefined, managerEmployeeCode: "" }) };
      return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    });

    const created = await syncStaffProfile({ providerSubject: objectSubject, claims: { email: objectResponseEmail, oid: objectSubject }, graphAccessToken: "graph-token" });

    expect(created.name).toBe("Object Contract User");
    expect(created.staffTerminationDate).toBeNull();
  });

  it("requires Graph to return an employeeId for the same signed-in user", async () => {
    const missingClaimSubject = "a622fa27-381c-4ceb-9bf1-85e6650f4cd9";
    mockResponses([], { graphId: missingClaimSubject, employeeId: "" });
    await expect(syncStaffProfile({ providerSubject: missingClaimSubject, claims: { email: objectResponseEmail, oid: missingClaimSubject }, graphAccessToken: "graph-token" }))
      .rejects.toMatchObject({ reason: "employee_identifier_missing" });
    expect(fetchStub).toHaveBeenCalledOnce();
    expect(await prisma.user.findUnique({ where: { providerSubject: missingClaimSubject } })).toBeNull();
  });

  it("does not query HIS if the Graph profile belongs to another Entra object", async () => {
    const mismatchSubject = "8cf4fa3f-5dc8-4ce9-9876-f1d6caa9e194";
    mockResponses([staffRecord()], { graphId: subject });
    await expect(syncStaffProfile({ providerSubject: mismatchSubject, claims: { email: objectResponseEmail, oid: mismatchSubject }, graphAccessToken: "graph-token" }))
      .rejects.toMatchObject({ reason: "identity_mismatch" });
    expect(fetchStub).toHaveBeenCalledOnce();
    expect(await prisma.user.findUnique({ where: { providerSubject: mismatchSubject } })).toBeNull();
  });
});
