import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp, getAdminToken, getTeamToken } from "../helpers";

const app = buildApp();

describe("Admin Dashboard", () => {
  it("GET /api/admin/dashboard — returns KPI counts", async () => {
    const res = await request(app)
      .get("/api/admin/dashboard")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.users).toBeGreaterThanOrEqual(5);
    expect(res.body.declarations).toBeGreaterThanOrEqual(3);
    expect(res.body.workflows).toBeGreaterThanOrEqual(3);
    expect(res.body.threshold).toBeGreaterThanOrEqual(2000);
  });

  it("GET /api/admin/dashboard — non-admin gets 403", async () => {
    const res = await request(app)
      .get("/api/admin/dashboard")
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(res.status).toBe(403);
  });
});
