import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp, getAdminToken, getApproverToken, getTeamToken, getHrToken, getCeoToken } from "./helpers";

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
    expect(res.body.steps).toHaveLength(3);
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

  it("POST /api/workflows/approve — return sets Info Requested", async () => {
    // Create and submit a fresh declaration to test return (value 1000 maps to rule-2)
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({
        employee: "Nomvula Team", employeeId: "user-team", teamMemberNumber: "TM-001",
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
    expect(res.body.newStatus).toBe("Info Requested");
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
        employee: "Nomvula Team", employeeId: "user-team", teamMemberNumber: "TM-001",
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

  it("POST /api/workflows/approve — 'return' decision maps to Info Requested", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({
        employee: "Nomvula Team", employeeId: "user-team", teamMemberNumber: "TM-001",
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
    expect(res.body.newStatus).toBe("Info Requested");
    expect(res.body.currentStep.decision).toBe("return");
  });

  it("POST /api/workflows/approve — 'accept' decision maps to approved", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({
        employee: "Nomvula Team", employeeId: "user-team", teamMemberNumber: "TM-001",
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
        employee: "Nomvula Team", employeeId: "user-team", teamMemberNumber: "TM-001",
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

    // Verify workflow has exactly 1 step (LM), no HR or CEO
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
        employee: "Nomvula Team", employeeId: "user-team", teamMemberNumber: "TM-001",
        lineManager: "Sipho Approver", position: "Brand Manager", department: "Marketing",
        type: "Gift", counterparty: "ProgMed", value: 500,
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

  it("High-value declaration (rule-3): LM approve → HR approved → CEO approve → fully approved", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({
        employee: "Nomvula Team", employeeId: "user-team", teamMemberNumber: "TM-001",
        lineManager: "Sipho Approver", position: "Brand Manager", department: "Marketing",
        type: "Gift", counterparty: "ProgHigh", value: 3000,
        submitted: "2026-07-05", approver: "Sipho Approver", status: "Draft", priority: "High",
        description: "Progression high", relationship: "Test",
        receivedGiven: "Received", from: "Supplier", contactPerson: "T",
        biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-05",
        instances: "1", publicOfficial: "No",
      });
    const id = create.body.id;

    // Submit → triggers rule-3 (3 steps: LM, HR, CEO)
    const submit = await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(submit.status).toBe(200);

    // Check initial workflow has exactly 3 steps
    const inst1 = await request(app)
      .get(`/api/workflows/instances/${id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(inst1.body.steps).toHaveLength(3);
    expect(inst1.body.steps[0].role).toBe("lineManager");
    expect(inst1.body.steps[1].role).toBe("hr");
    expect(inst1.body.steps[2].role).toBe("ceo");

    // LM approves → LM: approved, HR: pending, CEO: pending
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
    expect(inst2.body.steps[2].status).toBe("pending");

    // HR approves → LM: approved, HR: approved, CEO: pending
    const hrApprove = await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getHrToken()}`)
      .send({ declarationId: id, decision: "accept" });
    expect(hrApprove.status).toBe(200);
    expect(hrApprove.body.newStatus).toBe("Pending");

    const inst3 = await request(app)
      .get(`/api/workflows/instances/${id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(inst3.body.steps[0].status).toBe("approved");
    expect(inst3.body.steps[1].status).toBe("approved");
    expect(inst3.body.steps[2].status).toBe("pending");

    // CEO approves → all approved
    const ceoApprove = await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getCeoToken()}`)
      .send({ declarationId: id, decision: "accept" });
    expect(ceoApprove.status).toBe(200);
    expect(ceoApprove.body.newStatus).toBe("Approved");

    const inst4 = await request(app)
      .get(`/api/workflows/instances/${id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(inst4.body.steps[0].status).toBe("approved");
    expect(inst4.body.steps[1].status).toBe("approved");
    expect(inst4.body.steps[2].status).toBe("approved");
  });
});
