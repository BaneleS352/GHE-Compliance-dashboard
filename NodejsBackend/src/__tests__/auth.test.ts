import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp } from "./helpers";

const app = buildApp();

describe("Auth", () => {
  it("POST /api/auth/login — success", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@test.com", password: "password" });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe("admin@test.com");
    expect(res.body.user.role).toBe("admin");
  });

  it("POST /api/auth/login — wrong password returns 401", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@test.com", password: "wrong" });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid email or password");
  });

  it("POST /api/auth/login — unknown email returns 401", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "noone@test.com", password: "password" });
    expect(res.status).toBe(401);
  });

  it("POST /api/auth/login — validation error returns 400", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "bad", password: "" });
    expect(res.status).toBe(400);
  });

  it("GET /api/auth/me — returns user from token", async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@test.com", password: "password" });
    const token = login.body.token;

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe("admin@test.com");
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
});
