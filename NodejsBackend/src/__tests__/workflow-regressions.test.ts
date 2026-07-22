import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp, getAdminToken, getApproverToken, getTeamToken, getHrToken } from "./helpers";

const app = buildApp();

describe("Workflow regressions", () => {
  it("shows downstream approvers only when their step is actionable", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({
        employee: "Nomvula Team", employeeId: "user-team", teamMemberNumber: "TM-001",
        lineManager: "Sipho Approver", position: "Brand Manager", department: "Marketing",
        type: "Gift", counterparty: "PendingVisibility", value: 500,
        submitted: "2026-07-05", approver: "Sipho Approver", status: "Draft", priority: "Medium",
        description: "Pending visibility test", relationship: "Test",
        receivedGiven: "Received", from: "Supplier", contactPerson: "T",
        biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-05",
        instances: "1", publicOfficial: "No",
      });
    const id = create.body.id;

    await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);

    const hrBeforeLm = await request(app)
      .get("/api/workflows/pending")
      .set("Authorization", `Bearer ${getHrToken()}`);
    expect(hrBeforeLm.status).toBe(200);
    expect(hrBeforeLm.body.some((item: any) => item.declaration.id === id)).toBe(false);

    await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getApproverToken()}`)
      .send({ declarationId: id, decision: "accept" });

    const hrAfterLm = await request(app)
      .get("/api/workflows/pending")
      .set("Authorization", `Bearer ${getHrToken()}`);
    expect(hrAfterLm.status).toBe(200);
    expect(hrAfterLm.body.some((item: any) => item.declaration.id === id)).toBe(true);
  });

  it("preserves completed approvals when an info-requested declaration is resubmitted", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({
        employee: "Nomvula Team", employeeId: "user-team", teamMemberNumber: "TM-001",
        lineManager: "Sipho Approver", position: "Brand Manager", department: "Marketing",
        type: "Gift", counterparty: "ResubmitPreserve", value: 500,
        submitted: "2026-07-05", approver: "Sipho Approver", status: "Draft", priority: "Medium",
        description: "Resubmit preserve test", relationship: "Test",
        receivedGiven: "Received", from: "Supplier", contactPerson: "T",
        biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-05",
        instances: "1", publicOfficial: "No",
      });
    const id = create.body.id;

    await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);

    await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getApproverToken()}`)
      .send({ declarationId: id, decision: "accept", notes: "Approved by LM" });

    await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getHrToken()}`)
      .send({ declarationId: id, decision: "return", notes: "Need more detail" });

    const resubmit = await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(resubmit.status).toBe(200);
    expect(resubmit.body.status).toBe("Pending");
    expect(resubmit.body.approver).toBe("Lindiwe HR");

    const workflow = await request(app)
      .get(`/api/workflows/instances/${id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(workflow.status).toBe(200);
    expect(workflow.body.steps[0].status).toBe("approved");
    expect(workflow.body.steps[0].decision).toBe("accept");
    expect(workflow.body.steps[1].status).toBe("pending");
    expect(workflow.body.steps[1].decision).toBeNull();
    expect(workflow.body.steps[1].notes).toBe("");
  });
});
