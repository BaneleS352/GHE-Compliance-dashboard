import { describe, it, expect } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { buildApp, getAdminToken, getTeamToken } from "../helpers";

const app = buildApp();
const prisma = new PrismaClient();

describe("Admin Users", () => {
  it("GET /api/admin/users — lists all users", async () => {
    const res = await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(4);
  });

  it("GET /api/admin/users — filters by role", async () => {
    const res = await request(app)
      .get("/api/admin/users?role=Administrator")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0].role).toBe("admin");
  });

  it("GET /api/admin/users — searches by name", async () => {
    const res = await request(app)
      .get("/api/admin/users?search=Nomvula")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toContain("Nomvula");
  });

  it("GET /api/admin/users/:id — returns single user", async () => {
    const res = await request(app)
      .get("/api/admin/users/1")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe("admin@test.com");
  });

  it("POST /api/admin/users — creates user", async () => {
    const res = await request(app)
      .post("/api/admin/users")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ name: "New User", email: "new@test.com", role: "teamMember", department: "IT" });
    expect(res.status).toBe(201);
    expect(typeof res.body.id).toBe("number");
    expect(res.body.email).toBe("new@test.com");
  });

  it("POST /api/admin/users — rejects duplicate email", async () => {
    const res = await request(app)
      .post("/api/admin/users")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ name: "Dup", email: "admin@test.com", role: "teamMember" });
    expect(res.status).toBe(409);
  });

  it("PUT /api/admin/users/:id — updates user and resolves the department link", async () => {
    // departmentId is the sole department source: the name resolves through
    // the organization-scoped master data, so the user must be scoped first.
    // Unscoped users cannot link and resolve to "" at creation.
    const org = await prisma.organization.create({ data: { name: "Dept Test Org", shortCode: "DTO" } });
    try {
      const scoped = await request(app)
        .put("/api/admin/users/4")
        .set("Authorization", `Bearer ${getAdminToken()}`)
        .send({ name: "Updated Name", organizationId: Number(org.id), department: "Finance" });
      expect(scoped.status).toBe(200);
      expect(scoped.body.name).toBe("Updated Name");
      expect(scoped.body.department).toBe("Finance");

      const created = await request(app)
        .post("/api/admin/users")
        .set("Authorization", `Bearer ${getAdminToken()}`)
        .send({ name: "Unscoped User", email: "unscoped-dept@test.com", role: "teamMember", department: "Finance" });
      expect(created.status).toBe(201);
      expect(created.body.department).toBe("");
      await request(app)
        .delete(`/api/admin/users/${created.body.id}`)
        .set("Authorization", `Bearer ${getAdminToken()}`);

      // Restore the shared fixture user; deleting the temp org cascade-clears
      // the link (Department FK) back to null via SetNull.
    } finally {
      await request(app)
        .put("/api/admin/users/4")
        .set("Authorization", `Bearer ${getAdminToken()}`)
        .send({ name: "Nomvula Team", organizationId: null })
        .catch(() => undefined);
      await prisma.organization.delete({ where: { id: org.id } }).catch(() => undefined);
    }
    const restored = await prisma.user.findUnique({ where: { id: 4n }, select: { name: true, organizationId: true, departmentId: true } });
    expect(restored?.name).toBe("Nomvula Team");
    expect(restored?.organizationId).toBeNull();
    expect(restored?.departmentId).toBeNull();

    // Re-link the shared fixture (TST Marketing): parallel test files assert
    // this link (auth.test.ts), so leaving it nulled makes the suite order-
    // dependent. The null state above already proved the cascade behavior.
    const tst = await prisma.organization.findUnique({ where: { shortCode: "TST" } });
    const mkt = tst
      ? await prisma.department.findFirst({ where: { name: "Marketing", organizationId: tst.id } })
      : null;
    if (mkt) {
      await prisma.user.update({
        where: { id: 4n },
        data: { name: "Nomvula Team", organizationId: null, departmentId: mkt.id },
      });
    }
  });

  it("DELETE /api/admin/users/:id — deletes user", async () => {
    const create = await request(app)
      .post("/api/admin/users")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ name: "Delete Me", email: "delete@test.com", role: "teamMember" });
    const id = create.body.id;
    const res = await request(app)
      .delete(`/api/admin/users/${id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
  });

  it("DELETE /api/admin/users — blocks deleting last admin", async () => {
    const admins = await request(app)
      .get("/api/admin/users?role=admin")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    if (admins.body.length === 1) {
      const res = await request(app)
        .delete("/api/admin/users/1")
        .set("Authorization", `Bearer ${getAdminToken()}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toContain("last admin");
    }
  });

  it("GET /api/admin/users — non-admin gets 403", async () => {
    const res = await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(res.status).toBe(403);
  });
});
