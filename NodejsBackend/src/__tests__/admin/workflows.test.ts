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
    expect(res.body).toHaveLength(3);
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
    const res = await request(app)
      .put("/api/admin/workflows/rules/rule-1")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ name: "Updated Rule Name" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Updated Rule Name");
  });

  it("DELETE /api/admin/workflows/rules/:id — deletes rule", async () => {
    const res = await request(app)
      .delete("/api/admin/workflows/rules/rule-1")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);

    // Verify deleted
    const list = await request(app)
      .get("/api/admin/workflows/rules")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(list.body.find((r: any) => r.id === "rule-1")).toBeUndefined();
  });

  it("Workflow rules — non-admin gets 403", async () => {
    const res = await request(app)
      .get("/api/admin/workflows/rules")
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(res.status).toBe(403);
  });
});
