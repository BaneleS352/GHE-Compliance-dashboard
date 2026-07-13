import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp, getAdminToken, getTeamToken } from "../helpers";

const app = buildApp();

describe("Admin Users", () => {
  it("GET /api/admin/users — lists all users", async () => {
    const res = await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(5);
  });

  it("GET /api/admin/users — filters by role", async () => {
    const res = await request(app)
      .get("/api/admin/users?role=Administrator")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
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
      .get("/api/admin/users/user-admin")
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
    expect(res.body.id).toMatch(/^USR-/);
    expect(res.body.email).toBe("new@test.com");
  });

  it("POST /api/admin/users — rejects duplicate email", async () => {
    const res = await request(app)
      .post("/api/admin/users")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ name: "Dup", email: "admin@test.com", role: "teamMember" });
    expect(res.status).toBe(409);
  });

  it("PUT /api/admin/users/:id — updates user", async () => {
    const res = await request(app)
      .put("/api/admin/users/user-team")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ name: "Updated Name", department: "Finance" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Updated Name");
    expect(res.body.department).toBe("Finance");
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
        .delete("/api/admin/users/user-admin")
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
