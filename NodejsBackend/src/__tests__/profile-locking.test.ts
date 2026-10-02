import { describe, it, expect } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { buildApp, getTeamToken } from "./helpers";

const app = buildApp();
const prisma = new PrismaClient();

const BASE = {
  employee: "Nomvula Team",
  employeeId: 4,
  teamMemberNumber: "TM-001",
  lineManager: "Evil Manager",
  position: "Brand Manager",
  department: "Evil Dept",
  company: "Evil Corp",
  type: "Gift",
  counterparty: "ProfileLockA",
  value: 100,
  submitted: "2026-07-05",
  approver: "Sipho Approver",
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

describe("Phase 1 — profile-owned declaration identity", () => {
  it("ignores crafted company/department/manager and persists profile values", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send(BASE);
    expect(create.status).toBe(201);
    const id = create.body.id as string;

    const get = await request(app)
      .get(`/api/declarations/${id}`)
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(get.status).toBe(200);
    expect(get.body.department).toBe("Marketing");
    expect(get.body.lineManager).toBe("Sipho Approver");
    expect(get.body.company).toBeNull();
  });

  it("ignores self-service identity edits on draft updates", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ ...BASE, counterparty: "ProfileLockB" });
    expect(create.status).toBe(201);
    const id = create.body.id as string;

    const put = await request(app)
      .put(`/api/declarations/${id}`)
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ lineManager: "Evil Manager 2", department: "Evil Dept 2" });
    expect(put.status).toBe(200);

    const get = await request(app)
      .get(`/api/declarations/${id}`)
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(get.body.lineManager).toBe("Sipho Approver");
    expect(get.body.department).toBe("Marketing");
  });

  it("rejects creation when the declarer profile is incomplete", async () => {
    const hash = bcrypt.hashSync("password", 10);
    const row = await prisma.user.upsert({
      where: { email: "incomplete-profile@test.com" },
      update: { departmentId: null, managerId: null, lineManager: null },
      create: {
        name: "Incomplete Profile",
        email: "incomplete-profile@test.com",
        passwordHash: hash,
        role: "teamMember",
        teamMemberNumber: "TM-999",
        position: "Tester",
        departmentId: null,
        managerId: null,
        lineManager: null,
      },
    });
    const token = jwt.sign(
      { id: Number(row.id), email: row.email, role: "teamMember", name: row.name },
      "test-secret",
      { expiresIn: "1h" },
    );
    const res = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...BASE, employeeId: Number(row.id), counterparty: "ProfileLockC" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Incomplete profile/i);
  });
});
