import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp, getAdminToken, getApproverToken, getTeamToken, getHrToken, getCeoToken } from "./helpers";

const app = buildApp();

function createDeclarationPayload(overrides: Record<string, unknown> = {}) {
  return {
    employee: "Nomvula Team", employeeId: "user-team", teamMemberNumber: "TM-001",
    lineManager: "Sipho Approver", position: "Brand Manager", department: "Marketing",
    type: "Gift", counterparty: "E2ETest", value: 1000,
    submitted: "2026-07-05", approver: "Sipho Approver", status: "Draft", priority: "Medium",
    description: "E2E test declaration", relationship: "Test",
    receivedGiven: "Received", from: "Supplier", contactPerson: "T",
    biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-05",
    instances: "1", publicOfficial: "No",
    ...overrides,
  };
}

describe("Backend E2E: Edit & Submit (Journeys 3-4)", () => {
  it("J3.7: team member can edit a returned declaration's fields", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send(createDeclarationPayload({ counterparty: "EditReturnTest" }));
    expect(create.status).toBe(201);
    const id = create.body.id;

    await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);

    await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getApproverToken()}`)
      .send({ declarationId: id, decision: "return", notes: "Need more info" });

    const edit = await request(app)
      .put(`/api/declarations/${id}`)
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ description: "Updated after return", value: 1500 });
    expect(edit.status).toBe(200);

    const get = await request(app)
      .get(`/api/declarations/${id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(get.body.description).toBe("Updated after return");
    expect(get.body.value).toBe(1500);
  });

  it("J4.2: team member can resubmit a returned declaration", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send(createDeclarationPayload({ counterparty: "ResubmitTest" }));
    expect(create.status).toBe(201);
    const id = create.body.id;

    await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);

    await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getApproverToken()}`)
      .send({ declarationId: id, decision: "return", notes: "Need more info" });

    const resubmit = await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(resubmit.status).toBe(200);
    expect(resubmit.body.status).toBe("Pending");
  });

  it("J4.4: submitting an already-Pending declaration returns error", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send(createDeclarationPayload({ counterparty: "AlreadyPendingTest" }));
    expect(create.status).toBe(201);
    const id = create.body.id;

    await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);

    const dup = await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(dup.status).toBe(400);
  });

  it("J4.5: submitting an Approved declaration returns error", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send(createDeclarationPayload({ counterparty: "AlreadyApprovedTest", value: 100 }));
    expect(create.status).toBe(201);
    const id = create.body.id;

    await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);

    await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getApproverToken()}`)
      .send({ declarationId: id, decision: "accept" });

    const resubmit = await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(resubmit.status).toBe(400);
  });
});

describe("Backend E2E: Return & Resubmit Cycle (Journey 7)", () => {
  it("J7.6: returned declaration resets workflow on resubmit", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send(createDeclarationPayload({ counterparty: "ReturnCycleTest", value: 500 }));
    expect(create.status).toBe(201);
    const id = create.body.id;

    await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);

    await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getApproverToken()}`)
      .send({ declarationId: id, decision: "return" });

    await request(app)
      .put(`/api/declarations/${id}`)
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ description: "Updated after return" });

    const resubmit = await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(resubmit.status).toBe(200);
    expect(resubmit.body.status).toBe("Pending");

    const inst = await request(app)
      .get(`/api/workflows/instances/${id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(inst.body.steps[0].status).toBe("pending");
    expect(inst.body.steps[0].decision).toBeNull();
  });

  it("J7.8: returned declaration reappears in approver's pending queue", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send(createDeclarationPayload({ counterparty: "RequeueTest", value: 100 }));
    expect(create.status).toBe(201);
    const id = create.body.id;

    await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);

    await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getApproverToken()}`)
      .send({ declarationId: id, decision: "return" });

    await request(app)
      .put(`/api/declarations/${id}`)
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ description: "Re-queued" });

    await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);

    const pending = await request(app)
      .get("/api/workflows/pending")
      .set("Authorization", `Bearer ${getApproverToken()}`);
    expect(pending.body.some((item: any) => item.declaration.id === id)).toBe(true);
  });
});

describe("Backend E2E: Full Workflow Chain (Journey 9)", () => {
  it("J9.1-9.5: full LM → HR → CEO approval chain for high-value declaration", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send(createDeclarationPayload({ counterparty: "FullChainTest", value: 3000 }));
    expect(create.status).toBe(201);
    const id = create.body.id;

    const submit = await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(submit.status).toBe(200);

    const inst1 = await request(app)
      .get(`/api/workflows/instances/${id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(inst1.body.steps).toHaveLength(3);

    const lmApprove = await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getApproverToken()}`)
      .send({ declarationId: id, decision: "accept", notes: "Approved by LM" });
    expect(lmApprove.status).toBe(200);
    expect(lmApprove.body.newStatus).toBe("Pending");

    const getAfterLm = await request(app)
      .get(`/api/declarations/${id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(getAfterLm.body.status).toBe("Pending");

    const hrApprove = await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getHrToken()}`)
      .send({ declarationId: id, decision: "org", notes: "Approved by HR" });
    expect(hrApprove.status).toBe(200);
    expect(hrApprove.body.newStatus).toBe("Pending");

    const inst2 = await request(app)
      .get(`/api/workflows/instances/${id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(inst2.body.steps[0].status).toBe("approved");
    expect(inst2.body.steps[1].status).toBe("approved");
    expect(inst2.body.steps[2].status).toBe("pending");

    const ceoApprove = await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getCeoToken()}`)
      .send({ declarationId: id, decision: "accept", notes: "Approved by CEO" });
    expect(ceoApprove.status).toBe(200);
    expect(ceoApprove.body.newStatus).toBe("Approved");

    const getFinal = await request(app)
      .get(`/api/declarations/${id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(getFinal.body.status).toBe("Approved");
  });

  it("J9.8: dashboard stats reflect completed workflow counts", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send(createDeclarationPayload({ counterparty: "StatsTest", value: 100 }));
    expect(create.status).toBe(201);
    const id = create.body.id;

    await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);

    await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getApproverToken()}`)
      .send({ declarationId: id, decision: "accept" });

    const stats = await request(app)
      .get("/api/declarations/stats")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(stats.status).toBe(200);
    expect(typeof stats.body.kpis.total).toBe("number");
    expect(typeof stats.body.kpis.approved).toBe("number");
    expect(typeof stats.body.kpis.pending).toBe("number");
  });

  it("J9.10: multi-step workflow with org + foundation decisions", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send(createDeclarationPayload({ counterparty: "MultiDecisionTest", value: 3000 }));
    expect(create.status).toBe(201);
    const id = create.body.id;

    await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);

    const lm = await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getApproverToken()}`)
      .send({ declarationId: id, decision: "org" });
    expect(lm.status).toBe(200);

    const hr = await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getHrToken()}`)
      .send({ declarationId: id, decision: "foundation" });
    expect(hr.status).toBe(200);

    const ceo = await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getCeoToken()}`)
      .send({ declarationId: id, decision: "accept" });
    expect(ceo.status).toBe(200);
    expect(ceo.body.newStatus).toBe("Approved");

    const inst = await request(app)
      .get(`/api/workflows/instances/${id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(inst.body.steps[0].decision).toBe("org");
    expect(inst.body.steps[1].decision).toBe("foundation");
    expect(inst.body.steps[2].decision).toBe("accept");
  });

  it("J9.12: admin cannot bypass step assignment — returns 403", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send(createDeclarationPayload({ counterparty: "AdminOverrideTest", value: 3000 }));
    expect(create.status).toBe(201);
    const id = create.body.id;

    await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);

    const adminApprove = await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ declarationId: id, decision: "accept", notes: "Admin overrides" });
    expect(adminApprove.status).toBe(403);
  });
});

describe("Backend E2E: Decline Terminal State (Journey 8)", () => {
  it("J8.7: declined declaration cannot be edited or resubmitted", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send(createDeclarationPayload({ counterparty: "DeclineTerminalTest" }));
    expect(create.status).toBe(201);
    const id = create.body.id;

    await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);

    await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getApproverToken()}`)
      .send({ declarationId: id, decision: "decline" });

    const edit = await request(app)
      .put(`/api/declarations/${id}`)
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ description: "Should fail" });
    expect(edit.status).toBe(400);

    const resubmit = await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(resubmit.status).toBe(400);
  });

  it("J8.8: declined declaration is removed from approver's pending queue", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send(createDeclarationPayload({ counterparty: "DeclineRemoveTest", value: 100 }));
    expect(create.status).toBe(201);
    const id = create.body.id;

    await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);

    await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getApproverToken()}`)
      .send({ declarationId: id, decision: "decline" });

    const pending = await request(app)
      .get("/api/workflows/pending")
      .set("Authorization", `Bearer ${getApproverToken()}`);
    expect(pending.body.some((item: any) => item.declaration.id === id)).toBe(false);
  });
});
