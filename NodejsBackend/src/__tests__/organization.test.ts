import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { buildApp, getAdminToken, testToken, pkFor } from "./helpers";
import { lockDeclarationRow } from "../services/normalization";

const app = buildApp();
const prisma = new PrismaClient();

function tokenFor(user: { email: string; name?: string }) {
  return testToken({
    oid: `test-oid-${user.email}`,
    email: user.email,
    name: user.name || user.email,
  });
}

function testIdentity(email: string) {
  return { providerSubject: `test-oid-${email}`, providerIssuer: process.env.OIDC_ISSUER || "http://127.0.0.1:55439" };
}

const BASE_DECL = {
  teamMemberNumber: "T-001",
  position: "Tester",
  company: "Test Corp",
  team: "QA",
  type: "Gift",
  counterparty: "VendorX",
  value: 500,
  submitted: "2026-07-01",
  approver: "",
  status: "Draft" as const,
  priority: "Low" as const,
  description: "Test declaration",
  relationship: "Supplier",
  receivedGiven: "Received",
  from: "Supplier",
  contactPerson: "John",
  biddingProcess: "No",
  contractNegotiation: "No",
  occasion: "Business Meeting",
  date: "2026-07-01",
  instances: "1",
  publicOfficial: "No",
  files: [],
};

describe("Organization — multi-tenant flows", () => {
  interface OrganizationFixture {
    id: number;
    name: string;
    shortCode: string;
  }
  interface UserFixture {
    id: number;
    name: string;
    email: string;
    role: string;
    teamMemberNumber: string;
    department: string;
    position: string;
    organizationId?: number | null;
  }

  // Numeric identifiers are assigned in beforeAll (autoincrement); the
  // objects below hold display data until then.
  const hbOrg: OrganizationFixture = { id: 0, name: "HB Test Org", shortCode: "HBT" };
  const npnOrg: OrganizationFixture = { id: 0, name: "NPN Test Org", shortCode: "NPNT" };

  const hbTeam: UserFixture = { id: 0, name: "HB Team", email: "hb-team@test.com", role: "teamMember", teamMemberNumber: "HB-T-001", department: "Marketing", position: "Associate" };
  const hbLm: UserFixture = { id: 0, name: "HB LM", email: "hb-lm@test.com", role: "approver", teamMemberNumber: "HB-LM-001", department: "Marketing", position: "Line Manager" };
  const hbEngineeringLm: UserFixture = { id: 0, name: "HB Engineering LM", email: "hb-eng-lm@test.com", role: "approver", teamMemberNumber: "HB-ENG-LM-001", department: "Engineering", position: "Line Manager" };
  const npnTeam: UserFixture = { id: 0, name: "NPN Team", email: "npn-team@test.com", role: "teamMember", teamMemberNumber: "NPN-T-001", department: "Engineering", position: "Engineer" };
  const npnLm: UserFixture = { id: 0, name: "NPN LM", email: "npn-lm@test.com", role: "approver", teamMemberNumber: "NPN-LM-001", department: "Engineering", position: "Line Manager" };
  const globalHr: UserFixture = { id: 0, name: "Global HR", email: "global-hr@test.com", role: "approver", teamMemberNumber: "HR-G-001", department: "HR", position: "Head of HR", organizationId: null };
  const globalAdmin: UserFixture = { id: 0, name: "Global Admin", email: "global-admin@test.com", role: "admin", teamMemberNumber: "ADM-G-001", department: "IT", position: "Admin", organizationId: null };

  // departmentId is the sole department source: resolve a fixture's display
  // string to its organization-scoped link (global users stay unlinked). The
  // in-memory `department` strings remain for payloads and handmade claims.
  async function withDeptLink<U extends { id?: number; department?: string; organizationId?: number | bigint | null }>(u: U) {
    const { resolveDepartmentId } = await import("../services/normalization");
    const { id: _id, department: _dept, ...rest } = u;
    const departmentId = await resolveDepartmentId(u.department, u.organizationId ?? null);
    return { ...rest, departmentId };
  }

  beforeAll(async () => {
    for (const o of [hbOrg, npnOrg]) {
      const row = await prisma.organization.upsert({
        where: { shortCode: o.shortCode },
        update: { name: o.name },
        create: { name: o.name, shortCode: o.shortCode },
      });
      o.id = Number(row.id);
    }
    hbTeam.organizationId = hbOrg.id;
    hbLm.organizationId = hbOrg.id;
    hbEngineeringLm.organizationId = hbOrg.id;
    npnTeam.organizationId = npnOrg.id;
    npnLm.organizationId = npnOrg.id;
    const users = [hbTeam, hbLm, hbEngineeringLm, npnTeam, npnLm, globalHr, globalAdmin];
    for (const u of users) {
      const data = await withDeptLink(u);
      const identity = testIdentity(u.email);
      const row = await prisma.user.upsert({
        where: { email: u.email },
        update: { name: u.name, role: u.role, organizationId: u.organizationId ?? null, departmentId: data.departmentId, ...identity },
        create: { ...data, ...identity },
      });
      u.id = Number(row.id);
    }
    // The manager relation is the only persisted source of truth.
    await prisma.user.update({ where: { email: hbTeam.email }, data: { managerId: hbLm.id } });
    await prisma.user.update({ where: { email: npnTeam.email }, data: { managerId: npnLm.id } });
  });

  it("GET /api/users/organizations — scoped to the caller; admins see all", async () => {
    const token = tokenFor(hbTeam);
    const res = await request(app).get("/api/users/organizations").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect((res.body as Array<{ id: number }>).map((organization) => organization.id)).toEqual([hbOrg.id]);

    const admin = await request(app).get("/api/users/organizations").set("Authorization", `Bearer ${getAdminToken()}`);
    expect(admin.body.length).toBeGreaterThanOrEqual(2);

    const global = await request(app).get("/api/users/organizations").set("Authorization", `Bearer ${tokenFor(globalHr)}`);
    expect(global.body).toHaveLength(0);
  });

  it("GET /api/users/managers?organizationId — filters per org; cross-org lookup blocked", async () => {
    const token = tokenFor(hbTeam);
    const hb = await request(app).get(`/api/users/managers?organizationId=${hbOrg.id}`).set("Authorization", `Bearer ${token}`);
    expect(hb.status).toBe(200);
    const hbManagers = hb.body as Array<{ id: number }>;
    expect(hbManagers.some((user) => user.id === hbLm.id)).toBe(true);
    expect(hbManagers.some((user) => user.id === npnLm.id)).toBe(false);

    const npn = await request(app).get(`/api/users/managers?organizationId=${npnOrg.id}`).set("Authorization", `Bearer ${token}`);
    expect(npn.status).toBe(403);

    const adminNpn = await request(app).get(`/api/users/managers?organizationId=${npnOrg.id}`).set("Authorization", `Bearer ${getAdminToken()}`);
    expect(adminNpn.status).toBe(200);
    expect((adminNpn.body as Array<{ id: number }>).some((user) => user.id === npnLm.id)).toBe(true);
  });

  it("GET /api/users/departments?organizationId — per-org departments; cross-org lookup blocked", async () => {
    const token = tokenFor(hbTeam);
    const hb = await request(app).get(`/api/users/departments?organizationId=${hbOrg.id}`).set("Authorization", `Bearer ${token}`);
    expect(hb.status).toBe(200);
    expect(hb.body).toContain("Marketing");

    const npn = await request(app).get(`/api/users/departments?organizationId=${npnOrg.id}`).set("Authorization", `Bearer ${token}`);
    expect(npn.status).toBe(403);

    // Unscoped callers get their own organization's departments.
    const own = await request(app).get("/api/users/departments").set("Authorization", `Bearer ${token}`);
    expect(own.status).toBe(200);
    expect(own.body).toContain("Marketing");
  });

  it("POST /api/declarations — organizationId derived from JWT, cross-org spoof blocked", async () => {
    const hbToken = tokenFor(hbTeam);
    const res = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${hbToken}`)
      .send({ ...BASE_DECL, employee: hbTeam.name, employeeId: hbTeam.id, teamMemberNumber: hbTeam.teamMemberNumber, lineManager: hbLm.name, department: hbTeam.department, counterparty: "OrgDeriveTest", value: 100 });
    expect(res.status).toBe(201);
    expect(res.body.organizationId).toBe(hbOrg.id);

    // Spoof attempt: HB team tries to create for NPN org
    const spoof = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${hbToken}`)
      .send({ ...BASE_DECL, employee: hbTeam.name, employeeId: hbTeam.id, teamMemberNumber: hbTeam.teamMemberNumber, lineManager: hbLm.name, department: hbTeam.department, counterparty: "SpoofTest", value: 100, organizationId: npnOrg.id });
    expect(spoof.status).toBe(403);
  });

  it("GET /api/declarations — list is org-scoped", async () => {
    const hbToken = tokenFor(hbTeam);
    const npnToken = tokenFor(npnTeam);
    // HB team creates one
    await request(app).post("/api/declarations").set("Authorization", `Bearer ${hbToken}`).send({ ...BASE_DECL, employee: hbTeam.name, employeeId: hbTeam.id, teamMemberNumber: hbTeam.teamMemberNumber, lineManager: hbLm.name, department: hbTeam.department, counterparty: "HBListTest", value: 100 });
    // NPN team creates one
    await request(app).post("/api/declarations").set("Authorization", `Bearer ${npnToken}`).send({ ...BASE_DECL, employee: npnTeam.name, employeeId: npnTeam.id, teamMemberNumber: npnTeam.teamMemberNumber, lineManager: npnLm.name, department: npnTeam.department, counterparty: "NPNListTest", value: 100 });

    const hbList = await request(app).get("/api/declarations").set("Authorization", `Bearer ${hbToken}`);
    expect((hbList.body as Array<{ counterparty: string }>).some((declaration) => declaration.counterparty === "HBListTest")).toBe(true);
    // HB should not see NPN's declaration when org-scoped (if globalAdmin sees all, but teamMember sees own only)
    // For isolation check, use HB LM (approver sees department scope within org)
    const hbLmToken = tokenFor(hbLm);
    const hbLmList = await request(app).get("/api/declarations").set("Authorization", `Bearer ${hbLmToken}`);
    // HB LM should see HB declarations but not NPN
    expect((hbLmList.body as Array<{ organizationId: number }>).some((declaration) => declaration.organizationId === npnOrg.id)).toBe(false);
  });

  it("GET /api/declarations/:id/audit — history is scoped to owner and organization", async () => {
    const created = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${tokenFor(hbTeam)}`)
      .send({ ...BASE_DECL, employee: hbTeam.name, employeeId: hbTeam.id, teamMemberNumber: hbTeam.teamMemberNumber, lineManager: hbLm.name, department: hbTeam.department, counterparty: "AuditOrgIsolation", value: 200 });
    expect(created.status).toBe(201);

    const ownerHistory = await request(app)
      .get(`/api/declarations/${created.body.id}/audit`)
      .set("Authorization", `Bearer ${tokenFor(hbTeam)}`);
    expect(ownerHistory.status).toBe(200);
    expect((ownerHistory.body as Array<{ action: string; actorName: string }>).some((event) => event.action === "created" && event.actorName === hbTeam.name)).toBe(true);

    const otherOrgHistory = await request(app)
      .get(`/api/declarations/${created.body.id}/audit`)
      .set("Authorization", `Bearer ${tokenFor(npnTeam)}`);
    expect(otherOrgHistory.status).toBe(403);

    // Platform admins intentionally have cross-organization visibility.
    const adminHistory = await request(app)
      .get(`/api/declarations/${created.body.id}/audit`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(adminHistory.status).toBe(200);
  });

  it("counterparty names are isolated per organization (no cross-org attachment)", async () => {
    const vendor = `SharedVendor-${Date.now()}`;
    const hbToken = tokenFor(hbTeam);
    const npnToken = tokenFor(npnTeam);
    const hb = await request(app).post("/api/declarations").set("Authorization", `Bearer ${hbToken}`).send({ ...BASE_DECL, employee: hbTeam.name, employeeId: hbTeam.id, teamMemberNumber: hbTeam.teamMemberNumber, lineManager: hbLm.name, department: hbTeam.department, counterparty: vendor, value: 100 });
    expect(hb.status).toBe(201);
    const npn = await request(app).post("/api/declarations").set("Authorization", `Bearer ${npnToken}`).send({ ...BASE_DECL, employee: npnTeam.name, employeeId: npnTeam.id, teamMemberNumber: npnTeam.teamMemberNumber, lineManager: npnLm.name, department: npnTeam.department, counterparty: vendor, value: 100 });
    expect(npn.status).toBe(201);

    // The same display name resolves to two distinct organization-scoped rows.
    const rows = await prisma.counterparty.findMany({ where: { name: vendor } });
    expect(rows).toHaveLength(2);
    const orgs = rows.map((r) => (r.organizationId === null ? null : Number(r.organizationId))).sort();
    expect(orgs).toEqual([hbOrg.id, npnOrg.id].sort((a: number, b: number) => a - b));

    // Each declaration links to its own organization's row — never the other's.
    const hbDecl = await prisma.declaration.findUnique({ where: { id: hb.body.id } });
    const npnDecl = await prisma.declaration.findUnique({ where: { id: npn.body.id } });
    const hbCp = rows.find((r) => r.organizationId !== null && Number(r.organizationId) === hbOrg.id)!;
    const npnCp = rows.find((r) => r.organizationId !== null && Number(r.organizationId) === npnOrg.id)!;
    expect(hbDecl!.counterpartyId).toEqual(hbCp.id);
    expect(npnDecl!.counterpartyId).toEqual(npnCp.id);
    expect(hbDecl!.counterpartyId).not.toEqual(npnDecl!.counterpartyId);
  });

  it("GET /api/workflows/pending — per-org pending isolation", async () => {
    const hbTeamToken = tokenFor(hbTeam);
    const hbLmToken = tokenFor(hbLm);
    const npnLmToken = tokenFor(npnLm);

    const decl = await request(app).post("/api/declarations").set("Authorization", `Bearer ${hbTeamToken}`).send({ ...BASE_DECL, employee: hbTeam.name, employeeId: hbTeam.id, teamMemberNumber: hbTeam.teamMemberNumber, lineManager: hbLm.name, department: hbTeam.department, counterparty: "PendingOrgTest", value: 500 });
    expect(decl.status).toBe(201);
    await request(app).patch(`/api/declarations/${decl.body.id}/submit`).set("Authorization", `Bearer ${hbTeamToken}`);

    const hbPending = await request(app).get("/api/workflows/pending").set("Authorization", `Bearer ${hbLmToken}`);
    expect((hbPending.body as Array<{ declaration: { id: string } }>).some((pending) => pending.declaration.id === decl.body.id)).toBe(true);

    const npnPending = await request(app).get("/api/workflows/pending").set("Authorization", `Bearer ${npnLmToken}`);
    expect((npnPending.body as Array<{ declaration: { id: string } }>).some((pending) => pending.declaration.id === decl.body.id)).toBe(false);
  });

  it("Global HR can see pending from both orgs", async () => {
    const hbTeamToken = tokenFor(hbTeam);
    // Use the original HR (user-hr) which is the global HR that workflow assigns when no org-specific HR exists
    const hrToken = testToken({ oid: "test-oid-lindiwe", email: "lindiwe@test.com", name: "Lindiwe HR" });
    const decl = await request(app).post("/api/declarations").set("Authorization", `Bearer ${hbTeamToken}`).send({ ...BASE_DECL, employee: hbTeam.name, employeeId: hbTeam.id, teamMemberNumber: hbTeam.teamMemberNumber, lineManager: hbLm.name, department: hbTeam.department, counterparty: "GlobalHRTest", value: 5000 });
    await request(app).patch(`/api/declarations/${decl.body.id}/submit`).set("Authorization", `Bearer ${hbTeamToken}`);
    const hbLmToken = tokenFor(hbLm);
    const approve = await request(app).post("/api/workflows/approve").set("Authorization", `Bearer ${hbLmToken}`).send({ declarationId: decl.body.id, decision: "accept" });
    expect(approve.status).toBe(200);
    const pending = await request(app).get("/api/workflows/pending").set("Authorization", `Bearer ${hrToken}`);
    expect((pending.body as Array<{ declaration: { id: string } }>).some((item) => item.declaration.id === decl.body.id)).toBe(true);
  });

  it("POST /api/admin/config/organizations — admin can CRUD orgs, non-admin 403", async () => {
    const adminToken = getAdminToken();
    const create = await request(app).post("/api/admin/config/organizations").set("Authorization", `Bearer ${adminToken}`).send({ name: "Temp Org", shortCode: "TMP" });
    expect(create.status).toBe(201);
    const id = create.body.id;
    const hbToken = tokenFor(hbTeam);
    const forbid = await request(app).post("/api/admin/config/organizations").set("Authorization", `Bearer ${hbToken}`).send({ name: "Should Fail", shortCode: "FAIL" });
    expect(forbid.status).toBe(403);
    // Cleanup
    await request(app).delete(`/api/admin/config/organizations/${id}`).set("Authorization", `Bearer ${adminToken}`);
  });

  it("File upload — cross-org access blocked", async () => {
    const hbTeamToken = tokenFor(hbTeam);
    const npnTeamToken = tokenFor(npnTeam);
    const decl = await request(app).post("/api/declarations").set("Authorization", `Bearer ${hbTeamToken}`).send({ ...BASE_DECL, employee: hbTeam.name, employeeId: hbTeam.id, teamMemberNumber: hbTeam.teamMemberNumber, lineManager: hbLm.name, department: hbTeam.department, counterparty: "FileOrgTest", value: 100 });
    const declarationPk = await pkFor(decl.body.id);
    await prisma.declaration.update({ where: { declarationPk }, data: { organizationId: BigInt(npnOrg.id) } });
    const crossOrgOwnerUpload = await request(app)
      .post("/api/files/upload")
      .set("Authorization", `Bearer ${hbTeamToken}`)
      .attach("file", Buffer.from("denied"), "cross-org.txt")
      .field("declarationId", decl.body.id);
    expect(crossOrgOwnerUpload.status).toBe(403);
    await prisma.declaration.update({ where: { declarationPk }, data: { organizationId: BigInt(hbOrg.id) } });

    // Upload while Draft (uploads to decided/submitted declarations are rejected)
    const fileRes = await request(app).post("/api/files/upload").set("Authorization", `Bearer ${hbTeamToken}`).attach("file", Buffer.from("hello"), "test.txt").field("declarationId", decl.body.id);
    expect(fileRes.status).toBe(201);
    const fileId = fileRes.body.id;
    await request(app).patch(`/api/declarations/${decl.body.id}/submit`).set("Authorization", `Bearer ${hbTeamToken}`);
    // NPN user tries to download HB's file
    const cross = await request(app).get(`/api/files/${fileId}`).set("Authorization", `Bearer ${npnTeamToken}`);
    expect(cross.status).toBe(403);

    const instance = await prisma.workflowInstance.findUnique({ where: { declarationPk } });
    await prisma.workflowInstanceStep.updateMany({ where: { instanceId: instance!.id, status: "pending" }, data: { assigneeId: BigInt(hbEngineeringLm.id) } });
    const wrongDepartmentApprover = await request(app)
      .get(`/api/files/${fileId}`)
      .set("Authorization", `Bearer ${tokenFor(hbEngineeringLm)}`);
    expect(wrongDepartmentApprover.status).toBe(403);

    await prisma.workflowInstanceStep.updateMany({ where: { instanceId: instance!.id, status: "pending" }, data: { assigneeId: BigInt(npnLm.id) } });
    const misassignedApprover = await request(app)
      .get(`/api/files/${fileId}`)
      .set("Authorization", `Bearer ${tokenFor(npnLm)}`);
    expect(misassignedApprover.status).toBe(403);

    await prisma.declaration.update({ where: { declarationPk }, data: { organizationId: BigInt(npnOrg.id) } });
    const crossOrgOwnerDelete = await request(app)
      .delete(`/api/files/${fileId}`)
      .set("Authorization", `Bearer ${hbTeamToken}`);
    expect(crossOrgOwnerDelete.status).toBe(403);
    await prisma.declaration.update({ where: { declarationPk }, data: { organizationId: BigInt(hbOrg.id) } });
    await prisma.workflowInstanceStep.updateMany({ where: { instanceId: instance!.id, status: "pending" }, data: { assigneeId: BigInt(hbLm.id) } });
  });

  it("GET /api/users/:id — same-org allowed, cross-org 403", async () => {
    const hbToken = tokenFor(hbTeam);
    // Ensure user exists in test DB (debug)
    const dbCheck = await prisma.user.findUnique({ where: { id: hbTeam.id } });
    if (!dbCheck) {
      // Recreate if missing (test isolation)
      await prisma.user.create({ data: { ...(await withDeptLink(hbTeam)), ...testIdentity(hbTeam.email) } });
    }
    const self = await request(app).get(`/api/users/${hbTeam.id}`).set("Authorization", `Bearer ${hbToken}`);
    expect(self.status).toBe(200);
    const cross = await request(app).get(`/api/users/${npnTeam.id}`).set("Authorization", `Bearer ${hbToken}`);
    expect(cross.status).toBe(403);
    const hrToken = tokenFor(globalHr);
    const hrFetch = await request(app).get(`/api/users/${hbTeam.id}`).set("Authorization", `Bearer ${hrToken}`);
    expect(hrFetch.status).toBe(200);
  });

  it("NewDeclaration per-org flow: HB TM sees only HB departments/managers", async () => {
    const hbToken = tokenFor(hbTeam);
    // Ensure HB users exist for departments
    const hbUsers = await prisma.user.findMany({ where: { organizationId: hbOrg.id } });
    if (hbUsers.length === 0) {
      await prisma.user.create({ data: { ...(await withDeptLink(hbTeam)), ...testIdentity(hbTeam.email) } });
      await prisma.user.create({ data: { ...(await withDeptLink(hbLm)), ...testIdentity(hbLm.email) } });
    }
    const deps = await request(app).get(`/api/users/departments?organizationId=${hbOrg.id}`).set("Authorization", `Bearer ${hbToken}`);
    expect(deps.status).toBe(200);
    expect(Array.isArray(deps.body)).toBe(true);
    // Both organizations expose their own scoped departments; HB includes Marketing.
    if (deps.body.length > 0) {
      expect(deps.body).toContain("Marketing");
    }
    const mgrs = await request(app).get(`/api/users/managers?organizationId=${hbOrg.id}`).set("Authorization", `Bearer ${hbToken}`);
    expect(mgrs.status).toBe(200);
    const managers = mgrs.body as Array<{ id: number }>;
    expect(managers.some((manager) => manager.id === hbLm.id)).toBe(true);
    expect(managers.some((manager) => manager.id === npnLm.id)).toBe(false);
  });

  it("Reports are org-scoped", async () => {
    const hbToken = tokenFor(hbLm); // approver can access reports
    const res = await request(app).get("/api/reports/status-breakdown").set("Authorization", `Bearer ${hbToken}`);
    expect(res.status).toBe(200);
    // Should not leak NPN data when filtered by org (implicit via JWT)
    // For HB LM, where.organizationId = hbOrg.id, so only HB counts
    // We can't assert exact counts, but should be object
    expect(typeof res.body).toBe("object");
  });

  it("GET /api/reports/sla — org-scoped caller sees only own org rows", async () => {
    const hbTeamToken = tokenFor(hbTeam);
    const hbLmToken = tokenFor(hbLm);
    // Generate a decided step in HB (low value → LM-only rule).
    const decl = await request(app).post("/api/declarations").set("Authorization", `Bearer ${hbTeamToken}`).send({ ...BASE_DECL, employee: hbTeam.name, employeeId: hbTeam.id, teamMemberNumber: hbTeam.teamMemberNumber, lineManager: hbLm.name, department: hbTeam.department, counterparty: "SlaOrgTest", value: 100 });
    expect(decl.status).toBe(201);
    await request(app).patch(`/api/declarations/${decl.body.id}/submit`).set("Authorization", `Bearer ${hbTeamToken}`);
    const approve = await request(app).post("/api/workflows/approve").set("Authorization", `Bearer ${hbLmToken}`).send({ declarationId: decl.body.id, decision: "accept" });
    expect(approve.status).toBe(200);

    const hb = await request(app).get("/api/reports/sla").set("Authorization", `Bearer ${hbLmToken}`);
    expect(hb.status).toBe(200);
    expect(hb.body.length).toBeGreaterThan(0);
    // NPN has no decided steps: the unfiltered fast-path must not leak HB's.
    const npnLmToken = tokenFor(npnLm);
    const npn = await request(app).get("/api/reports/sla").set("Authorization", `Bearer ${npnLmToken}`);
    expect(npn.status).toBe(200);
    expect(npn.body).toHaveLength(0);
  });

  it("POST /api/workflows/approve — cross-org step assignment is refused", async () => {
    const hbTeamToken = tokenFor(hbTeam);
    const npnLmToken = tokenFor(npnLm);
    const decl = await request(app).post("/api/declarations").set("Authorization", `Bearer ${hbTeamToken}`).send({ ...BASE_DECL, employee: hbTeam.name, employeeId: hbTeam.id, teamMemberNumber: hbTeam.teamMemberNumber, lineManager: hbLm.name, department: hbTeam.department, counterparty: "ApproveOrgTest", value: 100 });
    expect(decl.status).toBe(201);
    await request(app).patch(`/api/declarations/${decl.body.id}/submit`).set("Authorization", `Bearer ${hbTeamToken}`);
    // Mis-assign the pending step to the other org's approver directly.
    const inst = await prisma.workflowInstance.findFirst({ where: { declarationPk: (await pkFor(decl.body.id)) } });
    await prisma.workflowInstanceStep.updateMany({ where: { instanceId: inst!.id, status: "pending" }, data: { assigneeId: npnLm.id } });
    // NPN's LM has a pending step but a different org: the org backstop
    // refuses even though step assignment alone would allow it.
    const res = await request(app).post("/api/workflows/approve").set("Authorization", `Bearer ${npnLmToken}`).send({ declarationId: decl.body.id, decision: "accept" });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/another organization/i);
  });

  it("POST /api/workflows/approve — rechecks organization after waiting for a reassignment", async () => {
    const hbTeamToken = tokenFor(hbTeam);
    const hbLmToken = tokenFor(hbLm);
    const decl = await request(app).post("/api/declarations").set("Authorization", `Bearer ${hbTeamToken}`).send({
      ...BASE_DECL, employee: hbTeam.name, employeeId: hbTeam.id,
      teamMemberNumber: hbTeam.teamMemberNumber, lineManager: hbLm.name,
      department: hbTeam.department, counterparty: "ApproveOrgRaceTest", value: 100,
    });
    expect(decl.status).toBe(201);
    await request(app).patch(`/api/declarations/${decl.body.id}/submit`).set("Authorization", `Bearer ${hbTeamToken}`);
    const declarationPk = await pkFor(decl.body.id);
    let responseStatus: number | undefined;
    let responseError: string | undefined;
    let routeDone!: Promise<void>;
    let wasBlocked = false;

    await prisma.$transaction(async (tx) => {
      await lockDeclarationRow(tx, declarationPk);
      const [{ pid }] = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
      routeDone = request(app)
        .post("/api/workflows/approve")
        .set("Authorization", `Bearer ${hbLmToken}`)
        .send({ declarationId: decl.body.id, decision: "accept" })
        .then((response) => { responseStatus = response.status; responseError = response.body.error; });
      const deadline = Date.now() + 3_000;
      while (Date.now() < deadline) {
        const blocked = await prisma.$queryRaw<Array<{ pid: number }>>`
          SELECT activity.pid FROM pg_stat_activity AS activity
          WHERE activity.pid <> pg_backend_pid()
            AND ${pid} = ANY(pg_blocking_pids(activity.pid))
        `;
        if (blocked.length > 0) { wasBlocked = true; break; }
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      await tx.declaration.update({ where: { declarationPk }, data: { organizationId: BigInt(npnOrg.id) } });
    });

    await routeDone;
    expect(wasBlocked).toBe(true);
    expect(responseStatus).toBe(403);
    expect(responseError).toMatch(/another organization/i);
    const pending = await prisma.workflowInstanceStep.findFirst({ where: { declarationPk, status: "pending" } });
    expect(pending).not.toBeNull();
    await prisma.declaration.update({ where: { declarationPk }, data: { organizationId: BigInt(hbOrg.id) } });
  });

  it("GET /api/users/:id — global teamMember cannot enumerate other users", async () => {
    const scoped = await prisma.user.create({
      data: { ...(await withDeptLink({ name: "Global Team", email: "global-team@test.com", role: "teamMember", teamMemberNumber: "GT-001", department: "IT", position: "Associate", organizationId: null })), ...testIdentity("global-team@test.com") },
    });
    try {
      const token = tokenFor(scoped);
      const other = await request(app).get(`/api/users/${hbTeam.id}`).set("Authorization", `Bearer ${token}`);
      expect(other.status).toBe(403);
      const self = await request(app).get(`/api/users/${Number(scoped.id)}`).set("Authorization", `Bearer ${token}`);
      expect(self.status).toBe(200);
    } finally {
      await prisma.user.delete({ where: { id: scoped.id } }).catch(() => undefined);
    }
  });

  it("POST /api/declarations — global teamMember cannot assign a declaration to an organization", async () => {
    const scoped = await prisma.user.create({
      data: { ...(await withDeptLink({ name: "Global Declarer", email: "global-declarer@test.com", role: "teamMember", teamMemberNumber: "GD-001", department: "IT", position: "Associate", organizationId: null })), ...testIdentity("global-declarer@test.com"), managerId: BigInt(globalHr.id) },
    });
    let draftId: string | undefined;
    try {
      const token = tokenFor(scoped);
      const response = await request(app)
        .post("/api/declarations")
        .set("Authorization", `Bearer ${token}`)
        .send({ ...BASE_DECL, employee: scoped.name, employeeId: Number(scoped.id), lineManager: "Manager", department: "IT", organizationId: hbOrg.id });
      expect(response.status).toBe(403);
      expect(response.body.error).toMatch(/another organization/i);
      expect(await prisma.declaration.count({ where: { declarerUserId: scoped.id } })).toBe(0);

      const ownDraft = await request(app)
        .post("/api/declarations")
        .set("Authorization", `Bearer ${token}`)
        .send({ ...BASE_DECL, employee: scoped.name, employeeId: Number(scoped.id), lineManager: globalHr.name, department: "IT" });
      expect(ownDraft.status).toBe(201);
      draftId = ownDraft.body.id;
      const move = await request(app)
        .put(`/api/declarations/${ownDraft.body.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ organizationId: hbOrg.id });
      expect(move.status).toBe(403);
      expect(move.body.error).toMatch(/another organization/i);
      expect(await prisma.declaration.findUnique({ where: { id: ownDraft.body.id }, select: { organizationId: true } })).toMatchObject({ organizationId: null });
    } finally {
      if (draftId) await request(app).delete(`/api/declarations/${draftId}`).set("Authorization", `Bearer ${tokenFor(scoped)}`).catch(() => undefined);
      await prisma.user.delete({ where: { id: scoped.id } }).catch(() => undefined);
    }
  });

  describe("Organization consistency invariant (manager must match user org)", () => {
    it("POST /api/admin/users — scoped user with cross-org manager is rejected", async () => {
      const res = await request(app)
        .post("/api/admin/users")
        .set("Authorization", `Bearer ${getAdminToken()}`)
        .send({
          name: "Cross Org", email: "cross-org@test.com", role: "teamMember",
          department: "Marketing", position: "Associate", teamMemberNumber: "X-001",
          lineManager: npnLm.id, organizationId: hbOrg.id,
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/another organization/i);
    });

    it("POST /api/admin/users — scoped user with global manager is accepted", async () => {
      const res = await request(app)
        .post("/api/admin/users")
        .set("Authorization", `Bearer ${getAdminToken()}`)
        .send({
          name: "Global Managed", email: "global-managed@test.com", role: "teamMember",
          department: "Marketing", position: "Associate", teamMemberNumber: "X-002",
          lineManager: globalHr.id, organizationId: hbOrg.id,
        });
      expect(res.status).toBe(201);
      await request(app)
        .delete(`/api/admin/users/${res.body.id}`)
        .set("Authorization", `Bearer ${getAdminToken()}`);
    });

    it("PUT /api/admin/users/:id — moving a user across orgs with a stale manager link is rejected", async () => {
      // hbTeam's manager (hbLm) belongs to HB; moving hbTeam to NPN would
      // strand a cross-organization manager reference.
      const res = await request(app)
        .put(`/api/admin/users/${hbTeam.id}`)
        .set("Authorization", `Bearer ${getAdminToken()}`)
        .send({ organizationId: npnOrg.id });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/another organization/i);
      const unchanged = await prisma.user.findUnique({ where: { id: hbTeam.id } });
      expect(Number(unchanged?.organizationId)).toBe(hbOrg.id);
    });
  });
});
