import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp, getAdminToken, getTeamToken } from "../helpers";

const app = buildApp();

describe("Admin Config", () => {
  it("GET /api/admin/config — returns system config", async () => {
    const res = await request(app)
      .get("/api/admin/config")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.highValueThreshold).toBe(1000);
    expect(res.body.slaEscalationDays).toBe(3);
  });

  it("PUT /api/admin/config — updates config", async () => {
    const res = await request(app)
      .put("/api/admin/config")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ highValueThreshold: 5000, mediumValueThreshold: 500, slaEscalationDays: 5, maxDeclarationsPerCounterparty: 10, emailTemplate: "New template" });
    expect(res.status).toBe(200);
    expect(res.body.highValueThreshold).toBe(5000);
  });

  it("PUT /api/admin/config — rejects invalid body", async () => {
    const res = await request(app)
      .put("/api/admin/config")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ highValueThreshold: "not-a-number" });
    expect(res.status).toBe(400);
  });

  it("GET /api/admin/config/dropdowns — returns dropdowns", async () => {
    const res = await request(app)
      .get("/api/admin/config/dropdowns")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.departments).toContain("Marketing");
    expect(res.body.categories).toContain("Gift");
  });

  it("PUT /api/admin/config/dropdowns — retired (410), GET serves master data", async () => {
    const res = await request(app)
      .put("/api/admin/config/dropdowns")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ departments: ["Marketing", "IT", "Finance"] });
    expect(res.status).toBe(410);
  });

  it("PUT /api/admin/config/dropdowns — retired for empty arrays too", async () => {
    const res = await request(app)
      .put("/api/admin/config/dropdowns")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ departments: [] });
    expect(res.status).toBe(410);
  });

  it("GET /api/admin/config/approval-options — returns options", async () => {
    const res = await request(app)
      .get("/api/admin/config/approval-options")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    // Parallel files may add temporary options; assert the seeded core set
    // is present rather than an absolute count.
    const values = res.body.map((o: any) => o.value);
    for (const v of ["return", "accept", "org", "foundation", "decline"]) {
      expect(values).toContain(v);
    }
  });

  it("POST /api/admin/config/approval-options — creates a new option", async () => {
    const before = await request(app)
      .get("/api/admin/config/approval-options")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    const res = await request(app)
      .post("/api/admin/config/approval-options")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ id: "test-opt", value: "test-value", label: "Test Label" });
    expect(res.status).toBe(201);
    expect(res.body.value).toBe("test-value");
    expect(res.body.label).toBe("Test Label");

    const getRes = await request(app)
      .get("/api/admin/config/approval-options")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(getRes.body).toHaveLength(before.body.length + 1);
  });

  it("POST /api/admin/config/approval-options — rejects duplicate id", async () => {
    const res = await request(app)
      .post("/api/admin/config/approval-options")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ id: "test-opt", value: "dup", label: "Duplicate" });
    expect(res.status).toBe(409);
  });

  it("POST /api/admin/config/approval-options — rejects malformed identifiers", async () => {
    const bad = await request(app)
      .post("/api/admin/config/approval-options")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ id: "not an id!", value: "x", label: "X" });
    expect(bad.status).toBe(400);
    const long = await request(app)
      .post("/api/admin/config/approval-options")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ id: "ok-id", value: "v".repeat(65), label: "X" });
    expect(long.status).toBe(400);
  });

  it("PUT /api/admin/config/approval-options/:id — updates an option", async () => {
    const res = await request(app)
      .put("/api/admin/config/approval-options/test-opt")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ value: "updated-value", label: "Updated Label" });
    expect(res.status).toBe(200);
    expect(res.body.value).toBe("updated-value");
    expect(res.body.label).toBe("Updated Label");
  });

  it("PUT /api/admin/config/approval-options/:id — 404 for non-existent id", async () => {
    const res = await request(app)
      .put("/api/admin/config/approval-options/nonexistent")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ value: "x", label: "X" });
    expect(res.status).toBe(404);
  });

  it("DELETE /api/admin/config/approval-options/:id — deletes an option", async () => {
    const before = await request(app)
      .get("/api/admin/config/approval-options")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    const delRes = await request(app)
      .delete("/api/admin/config/approval-options/test-opt")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(delRes.status).toBe(200);

    const getRes = await request(app)
      .get("/api/admin/config/approval-options")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(getRes.body).toHaveLength(before.body.length - 1);
    expect(getRes.body.some((o: any) => o.id === "test-opt")).toBe(false);
  });

  it("DELETE /api/admin/config/approval-options/:id — 404 for non-existent", async () => {
    const res = await request(app)
      .delete("/api/admin/config/approval-options/nonexistent")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(404);
  });

  it("Approval-options — non-admin gets 403", async () => {
    const res = await request(app)
      .post("/api/admin/config/approval-options")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ id: "x", value: "x", label: "X" });
    expect(res.status).toBe(403);
  });

  it("Approval-options POST — missing fields return 400", async () => {
    const res = await request(app)
      .post("/api/admin/config/approval-options")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ value: "no-id" });
    expect(res.status).toBe(400);
  });

  it("Approval-options PUT — missing fields return 400", async () => {
    const res = await request(app)
      .put("/api/admin/config/approval-options/accept")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ value: "" });
    expect(res.status).toBe(400);
  });

  it("Config endpoints — non-admin gets 403", async () => {
    const res = await request(app)
      .get("/api/admin/config")
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(res.status).toBe(403);
  });
});
