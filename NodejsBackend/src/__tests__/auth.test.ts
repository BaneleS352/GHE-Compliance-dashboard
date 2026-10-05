import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp, getAdminToken, getTeamToken, testToken } from "./helpers";

const app = buildApp();

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
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.role).toBe("teamMember");
    expect(res.body.department).toBe("Marketing");
    expect(res.body.id).toBe(4);
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
