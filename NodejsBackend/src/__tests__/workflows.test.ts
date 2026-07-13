import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp, getAdminToken, getApproverToken, getTeamToken } from "./helpers";

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
});
