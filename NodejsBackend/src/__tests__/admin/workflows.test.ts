import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp, getAdminToken, getTeamToken } from "../helpers";

const app = buildApp();

describe("Admin Workflow Rules", () => {
  it("GET /api/admin/workflows/rules — lists rules", async () => {
    const res = await request(app)
      .get("/api/admin/workflows/rules")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    // Order-independent: other suites manage their own rules; the two seed
    // rules must always be present with row-backed step arrays.
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    const rule1 = res.body.find((r: any) => r.id === 1);
    expect(rule1).toBeDefined();
    expect(rule1.steps).toBeInstanceOf(Array);
    expect(res.body[0].steps).toBeDefined();
    expect(res.body[0].steps).toBeInstanceOf(Array);
  });

  it("POST /api/admin/workflows/rules — creates rule", async () => {
    const res = await request(app)
      .post("/api/admin/workflows/rules")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ name: "Test Rule", condition: "custom", priority: 10, steps: [{ order: 1, role: "lineManager", label: "Test Review" }] });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Test Rule");
    expect(res.body.steps).toHaveLength(1);
  });

  it("PUT /api/admin/workflows/rules/:id — updates rule name", async () => {
    // Operate on the suite-owned rule, never on the shared seed rules.
    const list = await request(app)
      .get("/api/admin/workflows/rules")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    const owned = list.body.find((r: any) => r.name === "Test Rule");
    expect(owned).toBeDefined();
    const res = await request(app)
      .put(`/api/admin/workflows/rules/${owned.id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ name: "Updated Rule Name" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Updated Rule Name");
  });

  it("DELETE /api/admin/workflows/rules/:id — deletes rule", async () => {
    const list = await request(app)
      .get("/api/admin/workflows/rules")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    const owned = list.body.find((r: any) => r.name === "Updated Rule Name");
    expect(owned).toBeDefined();
    const res = await request(app)
      .delete(`/api/admin/workflows/rules/${owned.id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);

    // Verify deleted
    const list2 = await request(app)
      .get("/api/admin/workflows/rules")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(list2.body.find((r: any) => r.id === owned.id)).toBeUndefined();
    // Shared seed rules are untouched.
    expect(list2.body.find((r: any) => r.id === 1)).toBeDefined();
    expect(list2.body.find((r: any) => r.id === 2)).toBeDefined();
  });

  it("Workflow rules — non-admin gets 403", async () => {
    const res = await request(app)
      .get("/api/admin/workflows/rules")
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(res.status).toBe(403);
  });
});
