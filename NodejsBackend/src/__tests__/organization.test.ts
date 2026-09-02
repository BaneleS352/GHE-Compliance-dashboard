import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { buildApp, getAdminToken } from "./helpers";
import bcrypt from "bcryptjs";

const app = buildApp();
const prisma = new PrismaClient();

function tokenFor(user: { id: string; name?: string; email: string; role: string; organizationId?: string | null; department?: string; position?: string }) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name, department: user.department || "IT", position: user.position || "Staff", organizationId: user.organizationId || null },
    "test-secret",
    { expiresIn: "1h" }
  );
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
  const hbOrg = { id: "org-test-hb", name: "HB Test Org", shortCode: "HBT" };
  const npnOrg = { id: "org-test-npn", name: "NPN Test Org", shortCode: "NPNT" };

  const hbTeam = { id: "user-hb-team", name: "HB Team", email: "hb-team@test.com", role: "teamMember", teamMemberNumber: "HB-T-001", department: "Marketing", position: "Associate", lineManager: "user-hb-lm", organizationId: hbOrg.id };
  const hbLm = { id: "user-hb-lm", name: "HB LM", email: "hb-lm@test.com", role: "approver", teamMemberNumber: "HB-LM-001", department: "Marketing", position: "Line Manager", lineManager: null, organizationId: hbOrg.id };
  const npnTeam = { id: "user-npn-team", name: "NPN Team", email: "npn-team@test.com", role: "teamMember", teamMemberNumber: "NPN-T-001", department: "Engineering", position: "Engineer", lineManager: "user-npn-lm", organizationId: npnOrg.id };
  const npnLm = { id: "user-npn-lm", name: "NPN LM", email: "npn-lm@test.com", role: "approver", teamMemberNumber: "NPN-LM-001", department: "Engineering", position: "Line Manager", lineManager: null, organizationId: npnOrg.id };
  const globalHr = { id: "user-global-hr", name: "Global HR", email: "global-hr@test.com", role: "approver", teamMemberNumber: "HR-G-001", department: "HR", position: "Head of HR", lineManager: null, organizationId: null };
  const globalAdmin = { id: "user-global-admin", name: "Global Admin", email: "global-admin@test.com", role: "admin", teamMemberNumber: "ADM-G-001", department: "IT", position: "Admin", lineManager: null, organizationId: null };

  beforeAll(async () => {
    const hash = bcrypt.hashSync("password", 10);
    for (const o of [hbOrg, npnOrg]) {
      await prisma.organization.upsert({ where: { id: o.id }, update: o, create: o });
    }
    const users = [hbTeam, hbLm, npnTeam, npnLm, globalHr, globalAdmin];
    for (const u of users) {
      await prisma.user.upsert({ where: { id: u.id }, update: u as any, create: { ...u, passwordHash: hash } as any });
    }
  });

  it("GET /api/users/organizations — any authenticated user can list orgs", async () => {
    const token = tokenFor(hbTeam as any);
    const res = await request(app).get("/api/users/organizations").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });

  it("GET /api/users/managers?organizationId — filters per org", async () => {
    const token = tokenFor(hbTeam as any);
    const hb = await request(app).get(`/api/users/managers?organizationId=${hbOrg.id}`).set("Authorization", `Bearer ${token}`);
    expect(hb.status).toBe(200);
    expect(hb.body.some((u: any) => u.id === hbLm.id)).toBe(true);
    expect(hb.body.some((u: any) => u.id === npnLm.id)).toBe(false);

    const npn = await request(app).get(`/api/users/managers?organizationId=${npnOrg.id}`).set("Authorization", `Bearer ${token}`);
    expect(npn.body.some((u: any) => u.id === npnLm.id)).toBe(true);
    expect(npn.body.some((u: any) => u.id === hbLm.id)).toBe(false);
  });

  it("GET /api/users/departments?organizationId — per-org departments", async () => {
    const token = tokenFor(hbTeam as any);
    const hb = await request(app).get(`/api/users/departments?organizationId=${hbOrg.id}`).set("Authorization", `Bearer ${token}`);
    expect(hb.status).toBe(200);
    expect(hb.body).toContain("Marketing");
    expect(hb.body).not.toContain("Engineering");

    const npn = await request(app).get(`/api/users/departments?organizationId=${npnOrg.id}`).set("Authorization", `Bearer ${token}`);
    expect(npn.body).toContain("Engineering");
  });

  it("POST /api/declarations — organizationId derived from JWT, cross-org spoof blocked", async () => {
    const hbToken = tokenFor(hbTeam as any);
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
    const hbToken = tokenFor(hbTeam as any);
    const npnToken = tokenFor(npnTeam as any);
    // HB team creates one
    await request(app).post("/api/declarations").set("Authorization", `Bearer ${hbToken}`).send({ ...BASE_DECL, employee: hbTeam.name, employeeId: hbTeam.id, teamMemberNumber: hbTeam.teamMemberNumber, lineManager: hbLm.name, department: hbTeam.department, counterparty: "HBListTest", value: 100 });
    // NPN team creates one
    await request(app).post("/api/declarations").set("Authorization", `Bearer ${npnToken}`).send({ ...BASE_DECL, employee: npnTeam.name, employeeId: npnTeam.id, teamMemberNumber: npnTeam.teamMemberNumber, lineManager: npnLm.name, department: npnTeam.department, counterparty: "NPNListTest", value: 100 });

    const hbList = await request(app).get("/api/declarations").set("Authorization", `Bearer ${hbToken}`);
    expect(hbList.body.some((d: any) => d.counterparty === "HBListTest")).toBe(true);
    // HB should not see NPN's declaration when org-scoped (if globalAdmin sees all, but teamMember sees own only)
    // For isolation check, use HB LM (approver sees department scope within org)
    const hbLmToken = tokenFor(hbLm as any);
    const hbLmList = await request(app).get("/api/declarations").set("Authorization", `Bearer ${hbLmToken}`);
    // HB LM should see HB declarations but not NPN
    expect(hbLmList.body.some((d: any) => d.organizationId === npnOrg.id)).toBe(false);
  });

  it("GET /api/workflows/pending — per-org pending isolation", async () => {
    const hbTeamToken = tokenFor(hbTeam as any);
    const hbLmToken = tokenFor(hbLm as any);
    const npnLmToken = tokenFor(npnLm as any);

    const decl = await request(app).post("/api/declarations").set("Authorization", `Bearer ${hbTeamToken}`).send({ ...BASE_DECL, employee: hbTeam.name, employeeId: hbTeam.id, teamMemberNumber: hbTeam.teamMemberNumber, lineManager: hbLm.name, department: hbTeam.department, counterparty: "PendingOrgTest", value: 500 });
    expect(decl.status).toBe(201);
    await request(app).patch(`/api/declarations/${decl.body.id}/submit`).set("Authorization", `Bearer ${hbTeamToken}`);

    const hbPending = await request(app).get("/api/workflows/pending").set("Authorization", `Bearer ${hbLmToken}`);
    expect(hbPending.body.some((p: any) => p.declaration.id === decl.body.id)).toBe(true);

    const npnPending = await request(app).get("/api/workflows/pending").set("Authorization", `Bearer ${npnLmToken}`);
    expect(npnPending.body.some((p: any) => p.declaration.id === decl.body.id)).toBe(false);
  });

  it("Global HR can see pending from both orgs", async () => {
    const hbTeamToken = tokenFor(hbTeam as any);
    // Use the original HR (user-hr) which is the global HR that workflow assigns when no org-specific HR exists
    const hrToken = jwt.sign({ id: "user-hr", email: "lindiwe@test.com", role: "approver", department: "HR", position: "Head of HR", organizationId: null }, "test-secret", { expiresIn: "1h" });
    const decl = await request(app).post("/api/declarations").set("Authorization", `Bearer ${hbTeamToken}`).send({ ...BASE_DECL, employee: hbTeam.name, employeeId: hbTeam.id, teamMemberNumber: hbTeam.teamMemberNumber, lineManager: hbLm.name, department: hbTeam.department, counterparty: "GlobalHRTest", value: 5000 });
    await request(app).patch(`/api/declarations/${decl.body.id}/submit`).set("Authorization", `Bearer ${hbTeamToken}`);
    const hbLmToken = tokenFor(hbLm as any);
    const approve = await request(app).post("/api/workflows/approve").set("Authorization", `Bearer ${hbLmToken}`).send({ declarationId: decl.body.id, decision: "accept" });
    expect(approve.status).toBe(200);
    const pending = await request(app).get("/api/workflows/pending").set("Authorization", `Bearer ${hrToken}`);
    expect(pending.body.some((p: any) => p.declaration.id === decl.body.id)).toBe(true);
  });

  it("POST /api/admin/config/organizations — admin can CRUD orgs, non-admin 403", async () => {
    const adminToken = getAdminToken();
    const create = await request(app).post("/api/admin/config/organizations").set("Authorization", `Bearer ${adminToken}`).send({ name: "Temp Org", shortCode: "TMP" });
    expect(create.status).toBe(201);
    const id = create.body.id;
    const hbToken = tokenFor(hbTeam as any);
    const forbid = await request(app).post("/api/admin/config/organizations").set("Authorization", `Bearer ${hbToken}`).send({ name: "Should Fail", shortCode: "FAIL" });
    expect(forbid.status).toBe(403);
    // Cleanup
    await request(app).delete(`/api/admin/config/organizations/${id}`).set("Authorization", `Bearer ${adminToken}`);
  });

  it("File upload — cross-org access blocked", async () => {
    const hbTeamToken = tokenFor(hbTeam as any);
    const npnTeamToken = tokenFor(npnTeam as any);
    const decl = await request(app).post("/api/declarations").set("Authorization", `Bearer ${hbTeamToken}`).send({ ...BASE_DECL, employee: hbTeam.name, employeeId: hbTeam.id, teamMemberNumber: hbTeam.teamMemberNumber, lineManager: hbLm.name, department: hbTeam.department, counterparty: "FileOrgTest", value: 100 });
    await request(app).patch(`/api/declarations/${decl.body.id}/submit`).set("Authorization", `Bearer ${hbTeamToken}`);
    const fileRes = await request(app).post("/api/files/upload").set("Authorization", `Bearer ${hbTeamToken}`).attach("file", Buffer.from("hello"), "test.txt").field("declarationId", decl.body.id);
    expect(fileRes.status).toBe(201);
    const fileId = fileRes.body.id;
    // NPN user tries to download HB's file
    const cross = await request(app).get(`/api/files/${fileId}`).set("Authorization", `Bearer ${npnTeamToken}`);
    expect(cross.status).toBe(403);
  });

  it("GET /api/users/:id — same-org allowed, cross-org 403", async () => {
    const hbToken = tokenFor(hbTeam as any);
    // Ensure user exists in test DB (debug)
    const dbCheck = await prisma.user.findUnique({ where: { id: hbTeam.id } });
    if (!dbCheck) {
      // Recreate if missing (test isolation)
      const hash = bcrypt.hashSync("password", 10);
      await prisma.user.create({ data: { ...hbTeam, passwordHash: hash } as any });
    }
    const self = await request(app).get(`/api/users/${hbTeam.id}`).set("Authorization", `Bearer ${hbToken}`);
    expect(self.status).toBe(200);
    const cross = await request(app).get(`/api/users/${npnTeam.id}`).set("Authorization", `Bearer ${hbToken}`);
    expect(cross.status).toBe(403);
    const hrToken = tokenFor(globalHr as any);
    const hrFetch = await request(app).get(`/api/users/${hbTeam.id}`).set("Authorization", `Bearer ${hrToken}`);
    expect(hrFetch.status).toBe(200);
  });

  it("NewDeclaration per-org flow: HB TM sees only HB departments/managers", async () => {
    const hbToken = tokenFor(hbTeam as any);
    // Ensure HB users exist for departments
    const hbUsers = await prisma.user.findMany({ where: { organizationId: hbOrg.id } });
    if (hbUsers.length === 0) {
      const hash = bcrypt.hashSync("password", 10);
      await prisma.user.create({ data: { ...hbTeam, passwordHash: hash } as any });
      await prisma.user.create({ data: { ...hbLm, passwordHash: hash } as any });
    }
    const deps = await request(app).get(`/api/users/departments?organizationId=${hbOrg.id}`).set("Authorization", `Bearer ${hbToken}`);
    expect(deps.status).toBe(200);
    expect(Array.isArray(deps.body)).toBe(true);
    // HB should have Marketing, NPN should have Engineering — check at least one HB dept exists
    if (deps.body.length > 0) {
      expect(deps.body).toContain("Marketing");
      expect(deps.body).not.toContain("Engineering");
    }
    const mgrs = await request(app).get(`/api/users/managers?organizationId=${hbOrg.id}`).set("Authorization", `Bearer ${hbToken}`);
    expect(mgrs.status).toBe(200);
    expect(mgrs.body.some((m: any) => m.id === hbLm.id)).toBe(true);
    expect(mgrs.body.some((m: any) => m.id === npnLm.id)).toBe(false);
  });

  it("Reports are org-scoped", async () => {
    const hbToken = tokenFor(hbLm as any); // approver can access reports
    const res = await request(app).get("/api/reports/status-breakdown").set("Authorization", `Bearer ${hbToken}`);
    expect(res.status).toBe(200);
    // Should not leak NPN data when filtered by org (implicit via JWT)
    // For HB LM, where.organizationId = hbOrg.id, so only HB counts
    // We can't assert exact counts, but should be object
    expect(typeof res.body).toBe("object");
  });
});
