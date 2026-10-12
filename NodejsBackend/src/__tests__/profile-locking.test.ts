import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { buildApp, getAdminToken, testToken } from "./helpers";

const app = buildApp();
const prisma = new PrismaClient();

// Self-contained fixtures: parallel test files mutate the shared fixture
// users, so profile-locking proves its contract on dedicated users.
const managed = { id: 0, token: "" };
const unmanaged = { id: 0, token: "" };

const BASE = {
  teamMemberNumber: "PL-001",
  position: "Tester",
  type: "Gift",
  counterparty: "ProfileLockBase",
  value: 100,
  submitted: "2026-07-05",
  approver: "PL Manager",
  priority: "Low",
  description: "Profile locking test",
  relationship: "Supplier",
  receivedGiven: "Received",
  from: "Supplier",
  contactPerson: "T",
  biddingProcess: "No",
  occasion: "Business Meeting",
  date: "2026-07-05",
  instances: "1",
  publicOfficial: "No",
};

function tokenFor(id: number, email: string): string {
  return testToken({ oid: `test-oid-${email}`, email, name: "PL User" });
}

describe("Phase 1 — profile-owned declaration identity", () => {
  beforeAll(async () => {
    const org = await prisma.organization.upsert({
      where: { shortCode: "PLT" },
      update: { name: "Profile Lock Org" },
      create: { name: "Profile Lock Org", shortCode: "PLT" },
    });
    const { resolveDepartmentId } = await import("../services/normalization");
    const deptId = await resolveDepartmentId("ProfileDept", org.id);

    const lm = await prisma.user.upsert({
      where: { email: "pl-manager@test.com" },
      update: { name: "PL Manager", departmentId: deptId, organizationId: org.id },
      create: {
        name: "PL Manager", email: "pl-manager@test.com",
        role: "approver", teamMemberNumber: "PL-LM-001", position: "Line Manager",
        departmentId: deptId, organizationId: org.id,
      },
    });
    const tm = await prisma.user.upsert({
      where: { email: "pl-managed@test.com" },
      update: { name: "PL Managed", departmentId: deptId, managerId: lm.id, lineManager: lm.name, organizationId: org.id },
      create: {
        name: "PL Managed", email: "pl-managed@test.com",
        role: "teamMember", teamMemberNumber: "PL-TM-001", position: "Tester",
        departmentId: deptId, managerId: lm.id, lineManager: lm.name, organizationId: org.id,
      },
    });
    managed.id = Number(tm.id);
    managed.token = tokenFor(managed.id, "pl-managed@test.com");

    const bare = await prisma.user.upsert({
      where: { email: "pl-bare@test.com" },
      update: { departmentId: null, managerId: null, lineManager: null },
      create: {
        name: "PL Bare", email: "pl-bare@test.com",
        role: "teamMember", teamMemberNumber: "PL-TM-002", position: "Tester",
        departmentId: null, managerId: null, lineManager: null,
      },
    });
    unmanaged.id = Number(bare.id);
    unmanaged.token = tokenFor(unmanaged.id, "pl-bare@test.com");
  });

  it("ignores crafted company/department/manager and persists profile values", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${managed.token}`)
      .send({
        ...BASE,
        employee: "PL Managed",
        employeeId: managed.id,
        lineManager: "Evil Manager",
        department: "Evil Dept",
        company: "Evil Corp",
        counterparty: "ProfileLockA",
      });
    expect(create.status).toBe(201);
    const id = create.body.id as string;

    const get = await request(app)
      .get(`/api/declarations/${id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(get.status).toBe(200);
    expect(get.body.department).toBe("ProfileDept");
    expect(get.body.lineManager).toBe("PL Manager");
  });

  it("ignores self-service identity edits on draft updates", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${managed.token}`)
      .send({
        ...BASE,
        employee: "PL Managed",
        employeeId: managed.id,
        lineManager: "PL Manager",
        department: "ProfileDept",
        counterparty: "ProfileLockB",
      });
    expect(create.status).toBe(201);
    const id = create.body.id as string;

    const put = await request(app)
      .put(`/api/declarations/${id}`)
      .set("Authorization", `Bearer ${managed.token}`)
      .send({ lineManager: "Evil Manager 2", department: "Evil Dept 2" });
    expect(put.status).toBe(200);

    const get = await request(app)
      .get(`/api/declarations/${id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(get.body.lineManager).toBe("PL Manager");
    expect(get.body.department).toBe("ProfileDept");
  });

  it("rejects self-service creation when the team-member profile has no manager", async () => {
    const res = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${unmanaged.token}`)
      .send({
        ...BASE,
        employee: "PL Bare",
        employeeId: unmanaged.id,
        lineManager: "Nobody",
        department: "Nowhere",
        counterparty: "ProfileLockC",
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Incomplete profile/i);
  });
});
