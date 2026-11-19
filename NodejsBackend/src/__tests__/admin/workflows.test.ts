import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp, getAdminToken, getTeamToken } from "../helpers";

const app = buildApp();

interface WorkflowRuleResponse {
  id: number;
  name: string;
  steps: Array<{ order: number; role: string; label: string }>;
}

describe("Admin Workflow Rules", () => {
  it("GET /api/admin/workflows/rules — lists rules", async () => {
    const res = await request(app)
      .get("/api/admin/workflows/rules")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    // Order-independent: other suites manage their own rules; the two seed
    // rules must always be present with row-backed step arrays.
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    const rules = res.body as WorkflowRuleResponse[];
    const rule1 = rules.find((rule) => rule.id === 1);
    if (!rule1) throw new Error("Seed workflow rule 1 is missing");
    expect(rule1.steps).toBeInstanceOf(Array);
    expect(rules[0].steps).toBeDefined();
    expect(rules[0].steps).toBeInstanceOf(Array);
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
    const owned = (list.body as WorkflowRuleResponse[]).find((rule) => rule.name === "Test Rule");
    if (!owned) throw new Error("The workflow rule created by this test is missing");
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
    const owned = (list.body as WorkflowRuleResponse[]).find((rule) => rule.name === "Updated Rule Name");
    if (!owned) throw new Error("The workflow rule updated by this test is missing");
    const res = await request(app)
      .delete(`/api/admin/workflows/rules/${owned.id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);

    // Verify deleted
    const list2 = await request(app)
      .get("/api/admin/workflows/rules")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    const remainingRules = list2.body as WorkflowRuleResponse[];
    expect(remainingRules.find((rule) => rule.id === owned.id)).toBeUndefined();
    // Shared seed rules are untouched.
    expect(remainingRules.find((rule) => rule.id === 1)).toBeDefined();
    expect(remainingRules.find((rule) => rule.id === 2)).toBeDefined();
  });

  it("Workflow rules — non-admin gets 403", async () => {
    const res = await request(app)
      .get("/api/admin/workflows/rules")
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(res.status).toBe(403);
  });
});
