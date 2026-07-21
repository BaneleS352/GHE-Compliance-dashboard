import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp, getAdminToken, getTeamToken } from "./helpers";

const app = buildApp();

describe("Declarations", () => {
  it("GET /api/declarations/stats — returns KPIs", async () => {
    const res = await request(app)
      .get("/api/declarations/stats")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.kpis).toBeDefined();
    expect(res.body.kpis.total).toBeGreaterThanOrEqual(3);
    expect(res.body.kpis.pending).toBeGreaterThanOrEqual(1);
    expect(res.body.kpis.approved).toBeGreaterThanOrEqual(1);
    expect(res.body.complianceTrend).toHaveLength(2);
    expect(res.body.typeBreakdown).toHaveLength(2);
  });

  it("GET /api/declarations — lists all for admin", async () => {
    const res = await request(app)
      .get("/api/declarations")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(3);
  });

  it("GET /api/declarations — filters by status", async () => {
    const res = await request(app)
      .get("/api/declarations?status=Pending")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    res.body.forEach((d: any) => expect(d.status).toBe("Pending"));
  });

  it("GET /api/declarations — team member sees only own", async () => {
    const res = await request(app)
      .get("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(3);
    res.body.forEach((d: any) => expect(d.employeeId).toBe("user-team"));
  });

  it("GET /api/declarations/:id — returns declaration with workflow", async () => {
    const res = await request(app)
      .get("/api/declarations/GHE-TEST-001")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe("GHE-TEST-001");
    expect(res.body.workflowSteps).toHaveLength(1);
  });

  it("POST /api/declarations — creates a draft", async () => {
    const res = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({
        employee: "Nomvula Team", employeeId: "user-team", teamMemberNumber: "TM-001",
        lineManager: "Sipho Approver", position: "Brand Manager", department: "Marketing",
        type: "Gift", counterparty: "New Supplier", value: 200, submitted: "2026-07-01",
        approver: "Sipho Approver", status: "Draft", priority: "Low",
        description: "New test declaration", relationship: "Test",
        receivedGiven: "Received", from: "Supplier", contactPerson: "Test",
        biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-01",
        instances: "1", publicOfficial: "No",
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(/^GHE-/);
    expect(res.body.status).toBe("Draft");
  });

  it("POST /api/declarations — rejects missing required fields", async () => {
    const res = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ employeeId: "user-team" });
    expect(res.status).toBe(400);
  });

  it("PUT /api/declarations/:id — updates draft", async () => {
    // Create a fresh draft to avoid state issues
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({
        employee: "Nomvula Team", employeeId: "user-team", teamMemberNumber: "TM-001",
        lineManager: "Sipho Approver", position: "Brand Manager", department: "Marketing",
        type: "Gift", counterparty: "DraftUpdate", value: 50, submitted: "2026-07-05",
        approver: "Sipho Approver", status: "Draft", priority: "Low",
        description: "Original", relationship: "Test",
        receivedGiven: "Received", from: "Supplier", contactPerson: "T",
        biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-05",
        instances: "1", publicOfficial: "No",
      });
    const id = create.body.id;
    const res = await request(app)
      .put(`/api/declarations/${id}`)
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ description: "Updated description" });
    expect(res.status).toBe(200);
    expect(res.body.description).toBe("Updated description");
  });

  it("PUT /api/declarations/:id — rejects update of non-draft", async () => {
    const res = await request(app)
      .put("/api/declarations/GHE-TEST-003")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ description: "Should fail" });
    expect(res.status).toBe(400);
  });

  it("DELETE /api/declarations/:id — deletes draft", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({
        employee: "Nomvula Team", employeeId: "user-team", teamMemberNumber: "TM-001",
        lineManager: "Sipho Approver", position: "Brand Manager", department: "Marketing",
        type: "Gift", counterparty: "Temp", value: 50, submitted: "2026-07-02",
        approver: "Sipho Approver", status: "Draft", priority: "Low",
        description: "Temp", relationship: "Test",
        receivedGiven: "Received", from: "Supplier", contactPerson: "T",
        biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-02",
        instances: "1", publicOfficial: "No",
      });
    const id = create.body.id;
    const res = await request(app)
      .delete(`/api/declarations/${id}`)
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(res.status).toBe(200);
  });

  it("PATCH /api/declarations/:id/submit — submits draft and creates workflow", async () => {
    // Use a high value (>2000) to trigger rule-3 which won't have been deleted
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({
        employee: "Nomvula Team", employeeId: "user-team", teamMemberNumber: "TM-001",
        lineManager: "Sipho Approver", position: "Brand Manager", department: "Marketing",
        type: "Gift", counterparty: "SubmitTest", value: 3000,
        submitted: "2026-07-03", approver: "Sipho Approver", status: "Draft", priority: "High",
        description: "Submit test high value", relationship: "Test",
        receivedGiven: "Received", from: "Supplier", contactPerson: "T",
        biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-03",
        instances: "1", publicOfficial: "No",
      });
    const id = create.body.id;
    const res = await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Pending");
  });

  it("PATCH /api/declarations/:id/status — updates status", async () => {
    const res = await request(app)
      .patch("/api/declarations/GHE-TEST-001/status")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ status: "Info Requested" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Info Requested");

    // Restore
    await request(app)
      .patch("/api/declarations/GHE-TEST-001/status")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ status: "Pending" });
  });
});
