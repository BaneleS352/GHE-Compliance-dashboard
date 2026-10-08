import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp, getAdminToken, getApproverToken, getTeamToken, getHrToken } from "./helpers";

const app = buildApp();

describe("Workflows", () => {
  it("GET /api/workflows/pending — approver sees their pending steps", async () => {
    const res = await request(app)
      .get("/api/workflows/pending")
      .set("Authorization", `Bearer ${getApproverToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    expect(res.body[0].step).toBeDefined();
    expect(res.body[0].declaration).toBeDefined();
    expect(res.body[0].step.status).toBe("pending");
  });

  it("GET /api/workflows/pending — team member has none", async () => {
    const res = await request(app)
      .get("/api/workflows/pending")
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it("GET /api/workflows/instances/:id — returns workflow timeline", async () => {
    const res = await request(app)
      .get("/api/workflows/instances/GHE-TEST-003")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.steps).toHaveLength(2);
    expect(res.body.steps[0].status).toBe("approved");
  });

  it("POST /api/workflows/approve — approves pending step", async () => {
    const res = await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getApproverToken()}`)
      .send({ declarationId: "GHE-TEST-002", decision: "accept", notes: "Approved" });
    expect(res.status).toBe(200);
    expect(res.body.newStatus).toBe("Pending"); // still has HR step
    expect(res.body.currentStep.status).toBe("approved");
  });

  it("POST /api/workflows/approve — decline sets Declined", async () => {
    const res = await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getApproverToken()}`)
      .send({ declarationId: "GHE-TEST-001", decision: "decline", notes: "Not appropriate" });
    expect(res.status).toBe(200);
    expect(res.body.newStatus).toBe("Declined");
  });

  it("POST /api/workflows/approve — return sets Returned", async () => {
    // Create and submit a fresh declaration to test return (value 1000 maps to rule-2)
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({
        employee: "Nomvula Team", employeeId: 4, teamMemberNumber: "TM-001",
        lineManager: "Sipho Approver", position: "Brand Manager", department: "Marketing",
        type: "Gift", counterparty: "ReturnTest", value: 1000,
        submitted: "2026-07-05", approver: "Sipho Approver", status: "Draft", priority: "Medium",
        description: "Return test", relationship: "Test",
        receivedGiven: "Received", from: "Supplier", contactPerson: "T",
        biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-05",
        instances: "1", publicOfficial: "No",
      });
    const id = create.body.id;
    await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);

    const res = await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getApproverToken()}`)
      .send({ declarationId: id, decision: "return", notes: "Need more info" });
    expect(res.status).toBe(200);
    expect(res.body.newStatus).toBe("Returned");
  });

  it("POST /api/workflows/approve — rejects unauthorized user", async () => {
    const res = await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ declarationId: "GHE-TEST-002", decision: "accept" });
    expect(res.status).toBe(403);
  });

  it("POST /api/workflows/approve — invalid decision returns 400", async () => {
    const res = await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getApproverToken()}`)
      .send({ declarationId: "GHE-TEST-002", decision: "invalid" });
    expect(res.status).toBe(400);
  });

  it("POST /api/workflows/approve — 'decline' decision maps to Declined", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({
        employee: "Nomvula Team", employeeId: 4, teamMemberNumber: "TM-001",
        lineManager: "Sipho Approver", position: "Brand Manager", department: "Marketing",
        type: "Gift", counterparty: "DeclineTest", value: 1000,
        submitted: "2026-07-05", approver: "Sipho Approver", status: "Draft", priority: "Medium",
        description: "Decline test", relationship: "Test",
        receivedGiven: "Received", from: "Supplier", contactPerson: "T",
        biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-05",
        instances: "1", publicOfficial: "No",
      });
    const id = create.body.id;
    await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);

    const res = await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getApproverToken()}`)
      .send({ declarationId: id, decision: "decline", notes: "Declined" });
    expect(res.status).toBe(200);
    expect(res.body.newStatus).toBe("Declined");
    expect(res.body.currentStep.decision).toBe("decline");
  });

  it("POST /api/workflows/approve — 'return' decision maps to Returned", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({
        employee: "Nomvula Team", employeeId: 4, teamMemberNumber: "TM-001",
        lineManager: "Sipho Approver", position: "Brand Manager", department: "Marketing",
        type: "Gift", counterparty: "ReturnTest", value: 1000,
        submitted: "2026-07-05", approver: "Sipho Approver", status: "Draft", priority: "Medium",
        description: "Return test", relationship: "Test",
        receivedGiven: "Received", from: "Supplier", contactPerson: "T",
        biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-05",
        instances: "1", publicOfficial: "No",
      });
    const id = create.body.id;
    await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);

    const res = await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getApproverToken()}`)
      .send({ declarationId: id, decision: "return", notes: "Need more info" });
    expect(res.status).toBe(200);
    expect(res.body.newStatus).toBe("Returned");
    expect(res.body.currentStep.decision).toBe("return");
  });

  it("POST /api/workflows/approve — 'accept' decision maps to approved", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({
        employee: "Nomvula Team", employeeId: 4, teamMemberNumber: "TM-001",
        lineManager: "Sipho Approver", position: "Brand Manager", department: "Marketing",
        type: "Gift", counterparty: "AcceptTest", value: 1000,
        submitted: "2026-07-05", approver: "Sipho Approver", status: "Draft", priority: "Medium",
        description: "Accept test", relationship: "Test",
        receivedGiven: "Received", from: "Supplier", contactPerson: "T",
        biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-05",
        instances: "1", publicOfficial: "No",
      });
    const id = create.body.id;
    await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);

    const res = await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getApproverToken()}`)
      .send({ declarationId: id, decision: "accept", notes: "Accepted" });
    expect(res.status).toBe(200);
    expect(res.body.currentStep.decision).toBe("accept");
    expect(res.body.currentStep.status).toBe("approved");
  });

  // ── Workflow Progression Tests ──

  it("Low-value declaration (rule-1): LM only — approve → fully approved", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({
        employee: "Nomvula Team", employeeId: 4, teamMemberNumber: "TM-001",
        lineManager: "Sipho Approver", position: "Brand Manager", department: "Marketing",
        type: "Gift", counterparty: "ProgLow", value: 100,
        submitted: "2026-07-05", approver: "Sipho Approver", status: "Draft", priority: "Low",
        description: "Progression low", relationship: "Test",
        receivedGiven: "Received", from: "Supplier", contactPerson: "T",
        biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-05",
        instances: "1", publicOfficial: "No",
      });
    const id = create.body.id;

    // Submit → triggers rule-1 (1 step: LM only)
    const submit = await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(submit.status).toBe(200);

    // Verify workflow has exactly 1 step (LM), no HR
    const inst1 = await request(app)
      .get(`/api/workflows/instances/${id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(inst1.body.steps).toHaveLength(1);
    expect(inst1.body.steps[0].role).toBe("lineManager");
    expect(inst1.body.steps[0].status).toBe("pending");

    // Approve LM step
    const approve = await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getApproverToken()}`)
      .send({ declarationId: id, decision: "accept" });
    expect(approve.status).toBe(200);
    expect(approve.body.newStatus).toBe("Approved");
  });

  it("Medium-value declaration (rule-2): LM approve → HR pending, HR approve → fully approved", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({
        employee: "Nomvula Team", employeeId: 4, teamMemberNumber: "TM-001",
        lineManager: "Sipho Approver", position: "Brand Manager", department: "Marketing",
        type: "Gift", counterparty: "ProgMed", value: 1500,
        submitted: "2026-07-05", approver: "Sipho Approver", status: "Draft", priority: "Medium",
        description: "Progression medium", relationship: "Test",
        receivedGiven: "Received", from: "Supplier", contactPerson: "T",
        biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-05",
        instances: "1", publicOfficial: "No",
      });
    const id = create.body.id;

    // Submit → triggers rule-2 (2 steps: LM, HR)
    const submit = await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(submit.status).toBe(200);

    // Check initial workflow has exactly 2 steps
    const inst1 = await request(app)
      .get(`/api/workflows/instances/${id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(inst1.body.steps).toHaveLength(2);
    expect(inst1.body.steps[0].role).toBe("lineManager");
    expect(inst1.body.steps[0].status).toBe("pending");
    expect(inst1.body.steps[1].role).toBe("hr");
    expect(inst1.body.steps[1].status).toBe("pending");

    // LM approves → LM: approved, HR: pending
    const lmApprove = await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getApproverToken()}`)
      .send({ declarationId: id, decision: "accept" });
    expect(lmApprove.status).toBe(200);
    expect(lmApprove.body.newStatus).toBe("Pending");

    const inst2 = await request(app)
      .get(`/api/workflows/instances/${id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(inst2.body.steps[0].status).toBe("approved");
    expect(inst2.body.steps[1].status).toBe("pending");

    // HR approves → all approved
    const hrApprove = await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getHrToken()}`)
      .send({ declarationId: id, decision: "accept" });
    expect(hrApprove.status).toBe(200);
    expect(hrApprove.body.newStatus).toBe("Approved");

    const inst3 = await request(app)
      .get(`/api/workflows/instances/${id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(inst3.body.steps[0].status).toBe("approved");
    expect(inst3.body.steps[1].status).toBe("approved");
  });

  it("High-value declaration (rule-2): LM approve → HR approve → fully approved", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({
        employee: "Nomvula Team", employeeId: 4, teamMemberNumber: "TM-001",
        lineManager: "Sipho Approver", position: "Brand Manager", department: "Marketing",
        type: "Gift", counterparty: "ProgHigh", value: 3000,
        submitted: "2026-07-05", approver: "Sipho Approver", status: "Draft", priority: "High",
        description: "Progression high", relationship: "Test",
        receivedGiven: "Received", from: "Supplier", contactPerson: "T",
        biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-05",
        instances: "1", publicOfficial: "No",
      });
    const id = create.body.id;

    // Submit → triggers rule-2 (2 steps: LM, HR)
    const submit = await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(submit.status).toBe(200);

    // Check initial workflow has exactly 2 steps
    const inst1 = await request(app)
      .get(`/api/workflows/instances/${id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(inst1.body.steps).toHaveLength(2);
    expect(inst1.body.steps[0].role).toBe("lineManager");
    expect(inst1.body.steps[1].role).toBe("hr");

    // LM approves → LM: approved, HR: pending
    const lmApprove = await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getApproverToken()}`)
      .send({ declarationId: id, decision: "accept" });
    expect(lmApprove.status).toBe(200);
    expect(lmApprove.body.newStatus).toBe("Pending");

    const inst2 = await request(app)
      .get(`/api/workflows/instances/${id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(inst2.body.steps[0].status).toBe("approved");
    expect(inst2.body.steps[1].status).toBe("pending");

    // HR approves → all approved
    const hrApprove = await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getHrToken()}`)
      .send({ declarationId: id, decision: "accept" });
    expect(hrApprove.status).toBe(200);
    expect(hrApprove.body.newStatus).toBe("Approved");

    const inst3 = await request(app)
      .get(`/api/workflows/instances/${id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(inst3.body.steps[0].status).toBe("approved");
    expect(inst3.body.steps[1].status).toBe("approved");
  });

  it("POST /api/workflows/approve — unmapped decision is rejected, never approved", async () => {
    // An admin-created option value outside the engine vocabulary passes the
    // live allow-list but must fail closed instead of becoming an approval.
    const opt = await request(app)
      .post("/api/admin/config/approval-options")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ id: "t-weird", value: "weird", label: "Weird" });
    expect(opt.status).toBe(201);
    try {
      const create = await request(app)
        .post("/api/declarations")
        .set("Authorization", `Bearer ${getTeamToken()}`)
        .send({
          employee: "Nomvula Team", employeeId: 4, teamMemberNumber: "TM-001",
          lineManager: "Sipho Approver", position: "Brand Manager", department: "Marketing",
          type: "Gift", counterparty: "WeirdDecision", value: 100, submitted: "2026-07-05",
          approver: "Sipho Approver", priority: "Low", description: "weird decision test",
          relationship: "Test", receivedGiven: "Received", from: "Supplier",
          contactPerson: "T", biddingProcess: "No", occasion: "Business Meeting",
          date: "2026-07-05", instances: "1", publicOfficial: "No",
        });
      expect(create.status).toBe(201);
      await request(app).patch(`/api/declarations/${create.body.id}/submit`).set("Authorization", `Bearer ${getTeamToken()}`);
      const res = await request(app)
        .post("/api/workflows/approve")
        .set("Authorization", `Bearer ${getApproverToken()}`)
        .send({ declarationId: create.body.id, decision: "weird" });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/no workflow mapping/i);
    } finally {
      await request(app)
        .delete("/api/admin/config/approval-options/t-weird")
        .set("Authorization", `Bearer ${getAdminToken()}`);
    }
  });

  it("PATCH /api/declarations/:id/submit — ownerless declaration is rejected, not crashed", async () => {
    // Admin-created for a nonexistent employee: declarer link stays null.
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({
        employee: "Ghost Person", employeeId: 999999, teamMemberNumber: "GH-001",
        lineManager: "Nobody", position: "Ghost", department: "Marketing",
        type: "Gift", counterparty: "GhostCo", value: 100, submitted: "2026-07-05",
        approver: "Sipho Approver", priority: "Low", description: "ghost test",
        relationship: "Test", receivedGiven: "Received", from: "Supplier",
        contactPerson: "T", biddingProcess: "No", occasion: "Business Meeting",
        date: "2026-07-05", instances: "1", publicOfficial: "No",
      });
    expect(create.status).toBe(201);
    const submit = await request(app)
      .patch(`/api/declarations/${create.body.id}/submit`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(submit.status).toBe(400);
    expect(submit.body.error).toMatch(/no linked owner/i);
  });
});
