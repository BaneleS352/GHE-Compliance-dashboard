import { describe, it, expect } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { buildApp, getAdminToken, testToken } from "./helpers";

const app = buildApp();
const prisma = new PrismaClient();

// Authentication is provider-managed (Entra ID): there is no password login
// route. These tests pin the remaining identity contract — GET /api/auth/me
// resolves the local user from a validated bearer token.
describe("Auth", () => {
  it("password login route is removed", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@test.com", password: "password" });
    expect(res.status).toBe(404);
  });

  it("preset-users route is removed", async () => {
    const res = await request(app).get("/api/auth/preset-users");
    expect(res.status).toBe(404);
  });

  it("GET /api/auth/me — returns the resolved local user", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe("admin@test.com");
    expect(res.body.role).toBe("admin");
    expect(typeof res.body.id).toBe("number");
    expect(res.body).not.toHaveProperty("passwordHash");
  });

  it("GET /api/auth/me — role and display data come from the database row", async () => {
    const department = await prisma.department.findFirstOrThrow({ where: { name: "Marketing" } });
    const identity = "10000000-0000-4000-8000-000000000021";
    const user = await prisma.user.create({ data: {
      name: "Auth Display Fixture",
      email: "auth-display-fixture@test.com",
      role: "teamMember",
      teamMemberNumber: "AUTH-DISPLAY",
      departmentId: department.id,
      position: "Fixture Position",
      providerSubject: identity,
      providerIssuer: process.env.OIDC_ISSUER || "http://127.0.0.1:55439",
    } });
    try {
      const token = testToken({ oid: identity, email: user.email, name: "Untrusted Token Name" });
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        role: "teamMember",
        department: "Marketing",
        id: Number(user.id),
        name: "Auth Display Fixture",
        position: "Fixture Position",
        teamMemberNumber: "AUTH-DISPLAY",
      });
    } finally {
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  it("GET /api/auth/me — no token returns 401", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("GET /api/auth/me — invalid token returns 401", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer invalid");
    expect(res.status).toBe(401);
  });

  it("GET /api/auth/me — token signed by an unknown key returns 401", async () => {
    const token = testToken({
      oid: "test-oid-admin",
      email: "admin@test.com",
      name: "Admin User",
      iss: "http://127.0.0.1:9",
    });
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);
    // Unknown issuer: signature cannot chain to the configured JWKS.
    expect(res.status).toBe(401);
  });
});
