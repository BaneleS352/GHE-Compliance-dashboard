import { describe, it, expect } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { buildApp, getAdminToken, getApproverToken, getTeamToken, getHrToken } from "./helpers";
import { prisma } from "../config/prisma";

const app = buildApp();

describe("Workflow regressions", () => {
  it("supports the real Kabelo → James return and value increase flow", async () => {
    // No hardcoded ids: explicit numeric fixtures above the identity sequence
    // would collide with auto-assigned ids from other suites sharing this
    // database. Upsert by email (auto ids) and sign tokens from the rows.
    const sign = (u: { id: bigint; email: string; role: string; department: string; position: string }) =>
      jwt.sign({ id: Number(u.id), email: u.email, role: u.role, department: u.department, position: u.position }, "test-secret", { expiresIn: "1h" });
    const james = await prisma.user.upsert({ where: { email: "james@npn.co.za" }, update: { name: "James van Wyk", role: "approver", teamMemberNumber: "NPN-10001", department: "Engineering", position: "Line Manager", lineManager: null }, create: { name: "James van Wyk", email: "james@npn.co.za", passwordHash: "test", role: "approver", teamMemberNumber: "NPN-10001", department: "Engineering", position: "Line Manager", lineManager: null } });
    const kabelo = await prisma.user.upsert({ where: { email: "kabelo@npn.co.za" }, update: { name: "Kabelo Molefe", role: "teamMember", teamMemberNumber: "NPN-20001", department: "Engineering", position: "Software Engineer", lineManager: "James van Wyk", managerId: james.id }, create: { name: "Kabelo Molefe", email: "kabelo@npn.co.za", passwordHash: "test", role: "teamMember", teamMemberNumber: "NPN-20001", department: "Engineering", position: "Software Engineer", lineManager: "James van Wyk", managerId: james.id } });
    await prisma.user.upsert({ where: { email: "aisha@npn.co.za" }, update: { name: "Aisha Patel", role: "approver", teamMemberNumber: "NPN-10002", department: "HR", position: "Head of HR", lineManager: null }, create: { name: "Aisha Patel", email: "aisha@npn.co.za", passwordHash: "test", role: "approver", teamMemberNumber: "NPN-10002", department: "HR", position: "Head of HR", lineManager: null } });
    const kabeloToken = sign(kabelo);
    const jamesToken = sign(james);
    const create = await request(app).post("/api/declarations").set("Authorization", `Bearer ${kabeloToken}`).send({ employee: "Kabelo Molefe", employeeId: Number(kabelo.id), teamMemberNumber: "NPN-20001", lineManager: "James van Wyk", position: "Software Engineer", department: "Engineering", type: "Gift", counterparty: "ActualUserFlow", value: 100, submitted: "2026-09-01", status: "Draft", priority: "Low", description: "Actual user flow", relationship: "Supplier", receivedGiven: "Received", from: "Supplier", contactPerson: "Test", biddingProcess: "No", occasion: "Business Meeting", date: "2026-09-01", instances: "1", publicOfficial: "No" });
    const id = create.body.id;
    await request(app).patch(`/api/declarations/${id}/submit`).set("Authorization", `Bearer ${kabeloToken}`);
    await request(app).post("/api/workflows/approve").set("Authorization", `Bearer ${jamesToken}`).send({ declarationId: id, decision: "return" });
    const save = await request(app).put(`/api/declarations/${id}`).set("Authorization", `Bearer ${kabeloToken}`).send({ value: 1200 });
    expect(save.status).toBe(200);
    const workflow = await request(app).get(`/api/workflows/instances/${id}`).set("Authorization", `Bearer ${kabeloToken}`);
    expect(workflow.body.steps.map((step: any) => step.role)).toEqual(["lineManager", "hr"]);
    expect(workflow.body.steps[1].status).toBe("pending");
    const resubmit = await request(app).patch(`/api/declarations/${id}/submit`).set("Authorization", `Bearer ${kabeloToken}`);
    expect(resubmit.status).toBe(200);
  });

  it("adds HR when a returned low-value declaration becomes high-value", async () => {
    const create = await request(app).post("/api/declarations").set("Authorization", `Bearer ${getTeamToken()}`).send({
      employee: "Nomvula Team", employeeId: 4, teamMemberNumber: "TM-001", lineManager: "Sipho Approver", position: "Brand Manager", department: "Marketing",
      type: "Gift", counterparty: "ThresholdCrossing", value: 100, submitted: "2026-07-05", approver: "Sipho Approver", status: "Draft", priority: "Low", description: "Threshold crossing test", relationship: "Test", receivedGiven: "Received", from: "Supplier", contactPerson: "T", biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-05", instances: "1", publicOfficial: "No",
    });
    const id = create.body.id;

    await request(app).patch(`/api/declarations/${id}/submit`).set("Authorization", `Bearer ${getTeamToken()}`);
    await request(app).post("/api/workflows/approve").set("Authorization", `Bearer ${getApproverToken()}`).send({ declarationId: id, decision: "return" });
    await request(app).put(`/api/declarations/${id}`).set("Authorization", `Bearer ${getTeamToken()}`).send({ value: 1500 });
    const afterSave = await request(app).get(`/api/workflows/instances/${id}`).set("Authorization", `Bearer ${getAdminToken()}`);
    expect(afterSave.body.steps.map((step: any) => step.role)).toEqual(["lineManager", "hr"]);
    const resubmit = await request(app).patch(`/api/declarations/${id}/submit`).set("Authorization", `Bearer ${getTeamToken()}`);

    expect(resubmit.status).toBe(200);
    const workflow = await request(app).get(`/api/workflows/instances/${id}`).set("Authorization", `Bearer ${getAdminToken()}`);
    expect(workflow.body.steps.map((step: any) => step.role)).toEqual(["lineManager", "hr"]);
    expect(workflow.body.steps[1].status).toBe("pending");
  });

  it("shows downstream approvers only when their step is actionable", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({
        employee: "Nomvula Team", employeeId: 4, teamMemberNumber: "TM-001",
        lineManager: "Sipho Approver", position: "Brand Manager", department: "Marketing",
        type: "Gift", counterparty: "PendingVisibility", value: 1500,
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

  it("preserves completed approvals when a returned declaration is resubmitted", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({
        employee: "Nomvula Team", employeeId: 4, teamMemberNumber: "TM-001",
        lineManager: "Sipho Approver", position: "Brand Manager", department: "Marketing",
        type: "Gift", counterparty: "ResubmitPreserve", value: 1500,
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
