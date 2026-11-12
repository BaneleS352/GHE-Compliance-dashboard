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

function mockResponse(data: unknown[]) {
  fetchStub.mockImplementation(async () => new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { "content-type": "application/json" },
  }));
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
    mockResponse([staffRecord()]);
    const created = await syncStaffProfile({
      providerSubject: subject,
      claims: { email, oid: subject, employeeid: "22680" },
    });

    expect(fetchStub).toHaveBeenCalledOnce();
    const requestUrl = new URL(fetchStub.mock.calls[0][0] as string);
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
    mockResponse([staffRecord({ fUllName: "Ndaedzo Updated", jobTitle: "Principal Engineer", departmentName: "Compliance" })]);

    const refreshed = await syncStaffProfile({ providerSubject: subject, claims: { email, oid: subject } });

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
    mockResponse([staffRecord(), staffRecord({ employeeCode: "22681" })]);
    await expect(syncStaffProfile({ providerSubject: otherSubject, claims: { email, oid: otherSubject, employeeid: "22680" } }))
      .rejects.toMatchObject({ reason: "ambiguous" });
    expect(await prisma.user.findUnique({ where: { providerSubject: otherSubject } })).toBeNull();

    mockResponse([staffRecord({ employeeCode: "OTHER-CODE" })]);
    await expect(syncStaffProfile({ providerSubject: otherSubject, claims: { email, oid: otherSubject, employeeid: "22680" } }))
      .rejects.toMatchObject({ reason: "identity_mismatch" });
    expect(await prisma.user.findUnique({ where: { providerSubject: otherSubject } })).toBeNull();
  });

  it("accepts the documented single-object HIS envelope and normalizes the no-termination sentinel", async () => {
    const objectSubject = "731e983f-1d5d-4560-bcf8-c735e25bd8c8";
    fetchStub.mockImplementation(async () => new Response(JSON.stringify({
      success: true,
      data: staffRecord({ email: objectResponseEmail, employeeCode: "22681", fullName: "Object Contract User", fUllName: undefined, managerEmployeeCode: "" }),
    }), { status: 200, headers: { "content-type": "application/json" } }));

    const created = await syncStaffProfile({ providerSubject: objectSubject, claims: { email: objectResponseEmail, oid: objectSubject, employeeid: "22681" } });

    expect(created.name).toBe("Object Contract User");
    expect(created.staffTerminationDate).toBeNull();
  });

  it("requires the configured Entra employee identifier claim for first login", async () => {
    const missingClaimSubject = "a622fa27-381c-4ceb-9bf1-85e6650f4cd9";
    await expect(syncStaffProfile({ providerSubject: missingClaimSubject, claims: { email: objectResponseEmail, oid: missingClaimSubject } }))
      .rejects.toMatchObject({ reason: "employee_identifier_missing" });
    expect(fetchStub).toHaveBeenCalledTimes(5);
    expect(await prisma.user.findUnique({ where: { providerSubject: missingClaimSubject } })).toBeNull();
  });
});
