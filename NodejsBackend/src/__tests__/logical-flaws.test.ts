import { describe, it, expect } from "vitest";
import { prisma } from "../config/prisma";
import request from "supertest";
import { buildApp, getAdminToken, getApproverToken, getTeamToken, getHrToken } from "./helpers";

const app = buildApp();

const BASE = {
  employee: "Nomvula Team",
  employeeId: "user-team",
  teamMemberNumber: "TM-001",
  lineManager: "Sipho Approver",
  position: "Brand Manager",
  department: "Marketing",
  type: "Gift",
  submitted: "2026-07-05",
  approver: "Sipho Approver",
  status: "Draft",
  priority: "Medium",
  description: "Logical flaw test",
  relationship: "Test",
  receivedGiven: "Received",
  from: "Supplier",
  contactPerson: "T",
  biddingProcess: "No",
  occasion: "Business Meeting",
  date: "2026-07-05",
  instances: "1",
  publicOfficial: "No",
};

// ── STATE MACHINE VIOLATIONS ──
describe("State machine violations", () => {
  it("PATCH /api/declarations/:id/submit — submitting an already Approved declaration returns 400", async () => {
    const res = await request(app)
      .patch("/api/declarations/GHE-TEST-003/submit")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/draft/i);
  });

  it("PATCH /api/declarations/:id/submit — submitting an already Declined declaration returns 400", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ ...BASE, counterparty: "LogicalSubDecl", value: 500 });
    expect(create.status).toBe(201);
    const id = create.body.id;

    await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);
    await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getApproverToken()}`)
      .send({ declarationId: id, decision: "decline" });

    const resubmit = await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(resubmit.status).toBe(400);
    expect(resubmit.body.error).toMatch(/draft/i);
  });

  it("PATCH /api/declarations/:id/submit — submitting a Pending declaration returns 400", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ ...BASE, counterparty: "LogicalSubPen", value: 500 });
    expect(create.status).toBe(201);
    const id = create.body.id;

    await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);

    const secondSubmit = await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(secondSubmit.status).toBe(400);
    expect(secondSubmit.body.error).toMatch(/draft/i);
  });

  it("PUT /api/declarations/:id — editing a Declined declaration returns 400", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ ...BASE, counterparty: "LogicalEditDec", value: 500 });
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
      .send({ description: "attempted edit after decline" });
    expect(edit.status).toBe(400);
    expect(edit.body.error).toMatch(/draft|returned/i);
  });

  it("PUT /api/declarations/:id — editing an Escalated declaration returns 400", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ ...BASE, counterparty: "LogicalEditEsc", value: 500 });
    expect(create.status).toBe(201);
    const id = create.body.id;

    await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getApproverToken()}`)
      .send({ declarationId: id, decision: "accept" });

    const escalated = await request(app)
      .patch(`/api/declarations/${id}/status`)
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ status: "Escalated" });
    expect(escalated.status).toBe(200);

    const edit = await request(app)
      .put(`/api/declarations/${id}`)
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ description: "attempted edit after escalation" });
    expect(edit.status).toBe(400);
  });
});

// ── WORKFLOW INTEGRITY ──
describe("Workflow integrity", () => {
  it("POST /api/workflows/approve — approving an already approved step returns 403", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ ...BASE, counterparty: "LogicalReApprove", value: 500 });
    expect(create.status).toBe(201);
    const id = create.body.id;

    await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);

    const first = await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getApproverToken()}`)
      .send({ declarationId: id, decision: "accept" });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getApproverToken()}`)
      .send({ declarationId: id, decision: "accept" });
    expect(second.status).toBe(403);
    expect(second.body.error).toMatch(/already been processed|pending/i);
  });

  it("POST /api/workflows/approve — HR cannot approve LM's step before LM acts", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ ...BASE, counterparty: "LogicalSkipOrder", value: 500 });
    expect(create.status).toBe(201);
    const id = create.body.id;

    await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);

    const hrSkip = await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getHrToken()}`)
      .send({ declarationId: id, decision: "accept" });
    expect(hrSkip.status).toBe(403);
    expect(hrSkip.body.error).toMatch(/pending|approve/i);
  });

  it("POST /api/workflows/approve — approving a fully approved declaration returns 403/404", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ ...BASE, counterparty: "LogicalFullAppr", value: 100 });
    expect(create.status).toBe(201);
    const id = create.body.id;

    await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);

    await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getApproverToken()}`)
      .send({ declarationId: id, decision: "accept" });

    const extra = await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getApproverToken()}`)
      .send({ declarationId: id, decision: "accept" });
    expect(extra.status).toBe(403);
  });

  it("POST /api/workflows/approve — missing declarationId returns 400", async () => {
    const res = await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getApproverToken()}`)
      .send({ decision: "accept" });
    expect(res.status).toBe(400);
  });

  it("POST /api/workflows/approve — null decision returns 400", async () => {
    const res = await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getApproverToken()}`)
      .send({ declarationId: "GHE-TEST-001", decision: null });
    expect(res.status).toBe(400);
  });
});

// ── DATA CONSISTENCY ──
describe("Data consistency", () => {
  it("POST /api/declarations — creating declaration with non-existent employeeId succeeds (no FK), but submit fails", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({
        employee: "Ghost User", employeeId: "user-nonexistent", teamMemberNumber: "GHOST-001",
        lineManager: "None", position: "Unknown", department: "IT",
        type: "Gift", counterparty: "LogicalGhost", value: 100,
        submitted: "2026-07-01", approver: "Admin", status: "Draft", priority: "Low",
        description: "non-existent employeeId", relationship: "Test",
        receivedGiven: "Received", from: "Supplier", contactPerson: "T",
        biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-01",
        instances: "1", publicOfficial: "No",
      });
    expect(create.status).toBe(201);
    const id = create.body.id;

    const submit = await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(submit.status).toBe(500);
  });

  it("PATCH /api/declarations/:id/submit — admin resets Approved to Draft then resubmit creates fresh workflow steps", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ ...BASE, counterparty: "LogicalResetDraft", value: 100 });
    expect(create.status).toBe(201);
    const id = create.body.id;

    await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);

    await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getApproverToken()}`)
      .send({ declarationId: id, decision: "accept" });

    const decl = await request(app)
      .get(`/api/declarations/${id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(decl.body.status).toBe("Approved");

    const reset = await request(app)
      .patch(`/api/declarations/${id}/status`)
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ status: "Draft" });
    expect(reset.status).toBe(200);

    const resubmit = await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(resubmit.status).toBe(200);
    expect(resubmit.body.status).toBe("Pending");

    const inst = await request(app)
      .get(`/api/workflows/instances/${id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(inst.body.steps).toHaveLength(1);
    expect(inst.body.steps[0].status).toBe("pending");
  });

  it("GET /api/workflows/instances/:declarationId — admin creates decl for user-approver, team-member cannot view", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({
        employee: "Sipho Approver", employeeId: "user-approver", teamMemberNumber: "APPR-001",
        lineManager: "Sandile CEO", position: "Line Manager", department: "Marketing",
        type: "Gift", counterparty: "LogicalOtherOwner", value: 100,
        submitted: "2026-07-01", approver: "Admin", status: "Draft", priority: "Low",
        description: "other owner workflow test", relationship: "Test",
        receivedGiven: "Received", from: "Supplier", contactPerson: "T",
        biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-01",
        instances: "1", publicOfficial: "No",
      });
    expect(create.status).toBe(201);
    const id = create.body.id;

    await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getAdminToken()}`);

    const res = await request(app)
      .get(`/api/workflows/instances/${id}`)
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(res.status).toBe(403);
  });

  it("GET /api/workflows/instances/:declarationId — owner CAN view their own workflow", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ ...BASE, counterparty: "LogicalOwnWorkflow", value: 100 });
    expect(create.status).toBe(201);
    const id = create.body.id;

    await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);

    const inst = await request(app)
      .get(`/api/workflows/instances/${id}`)
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(inst.status).toBe(200);
    expect(inst.body.steps).toHaveLength(1);
  });

  it("GET /api/workflows/instances/:declarationId — non-existent declaration returns 404", async () => {
    const res = await request(app)
      .get("/api/workflows/instances/GHE-NONEXIST-INST")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(404);
  });
});

// ── EDGE CASES — REPORTS & EXPORT ──
describe("Report edge cases", () => {
  it("GET /api/reports/sla — returns empty array when no declarations match filter", async () => {
    const res = await request(app)
      .get("/api/reports/sla?department=DepartmentOfImaginaryFriends")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it("GET /api/reports/status-breakdown — returns empty object when no declarations match filter", async () => {
    const res = await request(app)
      .get("/api/reports/status-breakdown?department=DepartmentOfImaginaryFriends")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toHaveLength(0);
  });

  it("GET /api/reports/export — returns valid XLSX even with no matching data", async () => {
    const res = await request(app)
      .get("/api/reports/export?department=DepartmentOfImaginaryFriends")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("spreadsheetml");
    expect(res.headers["content-disposition"]).toContain(".xlsx");
  });

  it("GET /api/reports/list — multi-filter with no results returns empty array", async () => {
    const res = await request(app)
      .get("/api/reports/list?department=DepartmentOfImaginaryFriends&status=Approved")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it("GET /api/reports/high-value — returns empty array when threshold is above all values", async () => {
    await request(app).get("/api/reports/high-value").set("Authorization", `Bearer ${getAdminToken()}`);
    const res = await request(app)
      .get("/api/reports/high-value")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    for (const d of res.body) {
      expect(d.value).toBeGreaterThanOrEqual(2000);
    }
  });
});

// ── APPROVAL OPTIONS CONSISTENCY ──
describe("Approval option consistency", () => {
  it("POST /api/workflows/approve — decision 'org' fully approves like 'accept'", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ ...BASE, counterparty: "LogicalOrgDecision", value: 100 });
    expect(create.status).toBe(201);
    const id = create.body.id;

    await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);

    const res = await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getApproverToken()}`)
      .send({ declarationId: id, decision: "org" });
    expect(res.status).toBe(200);
    expect(res.body.newStatus).toBe("Approved");
    expect(res.body.currentStep.decision).toBe("org");
    expect(res.body.currentStep.status).toBe("approved");
  });

  it("POST /api/workflows/approve — decision 'foundation' fully approves like 'accept'", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ ...BASE, counterparty: "LogicalFndDecision", value: 100 });
    expect(create.status).toBe(201);
    const id = create.body.id;

    await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);

    const res = await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getApproverToken()}`)
      .send({ declarationId: id, decision: "foundation" });
    expect(res.status).toBe(200);
    expect(res.body.newStatus).toBe("Approved");
    expect(res.body.currentStep.decision).toBe("foundation");
    expect(res.body.currentStep.status).toBe("approved");
  });
});

// ── USER DELETION & DATA INTEGRITY ──
describe("User deletion integrity", () => {
  it("DELETE /api/admin/users/:id — delete user with owned declarations succeeds, declarations become orphaned", async () => {
    const userRes = await request(app)
      .post("/api/admin/users")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({
        name: "Orphan User", email: "orphan@test.com", role: "teamMember",
        department: "IT", position: "Tester",
      });
    expect(userRes.status).toBe(201);
    const userId = userRes.body.id;

    const declRes = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({
        employee: "Orphan User", employeeId: userId, teamMemberNumber: "ORPH-001",
        lineManager: "None", position: "Tester", department: "IT",
        type: "Gift", counterparty: "UserDeleteOrphan", value: 100,
        submitted: "2026-07-01", approver: "Admin", status: "Draft", priority: "Low",
        description: "orphan after user delete", relationship: "Test",
        receivedGiven: "Received", from: "Supplier", contactPerson: "T",
        biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-01",
        instances: "1", publicOfficial: "No",
      });
    expect(declRes.status).toBe(201);
    const declId = declRes.body.id;

    const delUser = await request(app)
      .delete(`/api/admin/users/${userId}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(delUser.status).toBe(200);

    const orphanDecl = await request(app)
      .get(`/api/declarations/${declId}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(orphanDecl.status).toBe(200);
    expect(orphanDecl.body.employeeId).toBe(userId);
  });

  it("DELETE /api/admin/users/:id — delete user with active pending approval steps is blocked", async () => {
    const lmRes = await request(app)
      .post("/api/admin/users")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({
        name: "Active Approver", email: "activeappr@test.com", role: "approver",
        department: "Marketing", position: "Manager",
      });
    expect(lmRes.status).toBe(201);
    const lmId = lmRes.body.id;

    const empRes = await request(app)
      .post("/api/admin/users")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({
        name: "Emp for Active", email: "empact@test.com", role: "teamMember",
        department: "Marketing", position: "TM", lineManager: lmId,
      });
    expect(empRes.status).toBe(201);
    const empId = empRes.body.id;

    const empToken = require("jsonwebtoken").sign(
      { id: empId, email: "empact@test.com", role: "teamMember" }, "test-secret", { expiresIn: "1h" }
    );

    const declRes = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${empToken}`)
      .send({
        ...BASE, counterparty: "UserDeleteBlocked", value: 100,
        employee: "Emp for Active", employeeId: empId,
        teamMemberNumber: "EA-001", lineManager: "Active Approver",
      });
    expect(declRes.status).toBe(201);
    const declId = declRes.body.id;

    await request(app)
      .patch(`/api/declarations/${declId}/submit`)
      .set("Authorization", `Bearer ${empToken}`);

    const delRes = await request(app)
      .delete(`/api/admin/users/${lmId}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(delRes.status).toBe(400);
    expect(delRes.body.error).toMatch(/active|pending/i);
  });

  it("DELETE /api/admin/users/:id — user with only completed approval steps CAN be deleted", async () => {
    const userRes = await request(app)
      .post("/api/admin/users")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({
        name: "Done Approver", email: "doneappr@test.com", role: "approver",
        department: "Marketing", position: "Manager",
      });
    expect(userRes.status).toBe(201);
    const userId = userRes.body.id;

    const teamRes = await request(app)
      .post("/api/admin/users")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({
        name: "Team for Done", email: "teamdone@test.com", role: "teamMember",
        department: "Marketing", position: "TM",
        lineManager: userId,
      });
    expect(teamRes.status).toBe(201);
    const teamId = teamRes.body.id;

    const declRes = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({
        ...BASE, counterparty: "UserDeleteCompleted", value: 100,
        employee: "Team for Done", employeeId: teamId,
        teamMemberNumber: "TD-001", lineManager: "Done Approver",
      });
    expect(declRes.status).toBe(201);
    const declId = declRes.body.id;

    const teamToken = require("jsonwebtoken").sign(
      { id: teamId, email: "teamdone@test.com", role: "teamMember" }, "test-secret", { expiresIn: "1h" }
    );

    await request(app)
      .patch(`/api/declarations/${declId}/submit`)
      .set("Authorization", `Bearer ${teamToken}`);

    const lmToken = require("jsonwebtoken").sign(
      { id: userId, email: "doneappr@test.com", role: "approver" }, "test-secret", { expiresIn: "1h" }
    );

    await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${lmToken}`)
      .send({ declarationId: declId, decision: "accept" });

    const delRes = await request(app)
      .delete(`/api/admin/users/${userId}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(delRes.status).toBe(200);

    await request(app)
      .delete(`/api/admin/users/${teamId}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
  });
});

// ── FILE ACCESS CONTROL GAPS ──
describe("File access control", () => {
  it("POST /api/files/upload — file without declarationId creates orphan accessible by any user", async () => {
    const upload = await request(app)
      .post("/api/files/upload")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .attach("file", Buffer.from("orphan file content"), "orphan.txt");
    // Orphan uploads are now rejected — declarationId is required
    expect(upload.status).toBe(400);
  });

  it("POST /api/files/upload — upload to own declaration, other user cannot download", async () => {
    const declRes = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ ...BASE, counterparty: "FileOwnershipTest", value: 100 });
    expect(declRes.status).toBe(201);
    const declId = declRes.body.id;

    const upload = await request(app)
      .post("/api/files/upload")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .field("declarationId", declId)
      .attach("file", Buffer.from("ownership test"), "owned.txt");
    expect(upload.status).toBe(201);
    const fileId = upload.body.id;

    const otherToken = require("jsonwebtoken").sign(
      { id: "user-approver", email: "sipho@test.com", role: "approver" }, "test-secret", { expiresIn: "1h" }
    );
    const access = await request(app)
      .get(`/api/files/${fileId}`)
      .set("Authorization", `Bearer ${otherToken}`);
    expect(access.status).toBe(403);
  });

  it("DELETE /api/files/:id — non-owner cannot delete file linked to another's declaration", async () => {
    const declRes = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({
        ...BASE, counterparty: "FileDelTest", value: 100,
        employee: "Admin User", employeeId: "user-admin",
      });
    expect(declRes.status).toBe(201);
    const declId = declRes.body.id;

    const upload = await request(app)
      .post("/api/files/upload")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .field("declarationId", declId)
      .attach("file", Buffer.from("delete test"), "delete-me.txt");
    expect(upload.status).toBe(201);
    const fileId = upload.body.id;

    const del = await request(app)
      .delete(`/api/files/${fileId}`)
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(del.status).toBe(403);
  });
});

// ── ADMIN STATUS BYPASS ──
describe("Admin status bypass", () => {
  it("PATCH /api/declarations/:id/status — admin sets Approved to Pending creating desync with workflow steps", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ ...BASE, counterparty: "StatusDesyncTest", value: 100 });
    expect(create.status).toBe(201);
    const id = create.body.id;

    await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);

    await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getApproverToken()}`)
      .send({ declarationId: id, decision: "accept" });

    const declAfter = await request(app)
      .get(`/api/declarations/${id}`)
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(declAfter.body.status).toBe("Approved");

    const adminReset = await request(app)
      .patch(`/api/declarations/${id}/status`)
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ status: "Pending" });
    expect(adminReset.status).toBe(200);

    const declDesynced = await request(app)
      .get(`/api/declarations/${id}`)
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(declDesynced.body.status).toBe("Pending");

    const inst = await request(app)
      .get(`/api/workflows/instances/${id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(inst.body.steps[0].status).toBe("approved");
  });

  it("PATCH /api/declarations/:id/status — admin cannot set Approved when pending step exists", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ ...BASE, counterparty: "StatusBypassTest", value: 100 });
    expect(create.status).toBe(201);
    const id = create.body.id;
    await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);
    const res = await request(app)
      .patch(`/api/declarations/${id}/status`)
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ status: "Approved" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/pending approval step/i);
  });

  it("PATCH /api/declarations/:id/status — admin cannot set Approved when no workflow instance exists", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ ...BASE, counterparty: "StatusBypassNoInstance", value: 100 });
    expect(create.status).toBe(201);
    const id = create.body.id;

    const res = await request(app)
      .patch(`/api/declarations/${id}/status`)
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ status: "Approved" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/workflow instance/i);
  });

  it("PATCH /api/declarations/:id/status — admin can set non-Approved/Declined statuses directly", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ ...BASE, counterparty: "StatusBypassTest", value: 100 });
    expect(create.status).toBe(201);
    const id = create.body.id;

    const res = await request(app)
      .patch(`/api/declarations/${id}/status`)
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ status: "Escalated" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Escalated");
  });
});

// ── THRESHOLD BOUNDARY ──
describe("Threshold boundary conditions", () => {
  it("Declaration with value=0 uses lowest rule (rule-1)", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({
        ...BASE, counterparty: "ZeroValueRule", value: 0,
        description: "zero value declaration",
      });
    expect(create.status).toBe(201);
    const id = create.body.id;

    await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getAdminToken()}`);

    const inst = await request(app)
      .get(`/api/workflows/instances/${id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(inst.body.steps).toHaveLength(1);
    expect(inst.body.steps[0].role).toBe("lineManager");
  });

  it("Value just below threshold (999) uses rule-1 (LM only)", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ ...BASE, counterparty: "Boundary999", value: 999 });
    expect(create.status).toBe(201);
    const id = create.body.id;

    await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);

    const inst = await request(app)
      .get(`/api/workflows/instances/${id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(inst.body.steps).toHaveLength(1);
  });

  it("Value at threshold (1000) uses rule-2 (LM + HR)", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ ...BASE, counterparty: "Boundary1000", value: 1000 });
    expect(create.status).toBe(201);
    const id = create.body.id;

    await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);

    const inst = await request(app)
      .get(`/api/workflows/instances/${id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(inst.body.steps).toHaveLength(2);
  });

});

// ── APPROVAL OPTIONS CRUD INTEGRITY ──
describe("Approval option CRUD integrity", () => {
  it("DELETE /api/admin/config/approval-options/:id — deleted option is no longer valid for new approvals", async () => {
    const opts = await request(app)
      .get("/api/admin/config/approval-options")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(opts.status).toBe(200);
    const orgOpt = opts.body.find((o: any) => o.value === "org");
    expect(orgOpt).toBeDefined();

    const delRes = await request(app)
      .delete(`/api/admin/config/approval-options/${orgOpt.id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(delRes.status).toBe(200);

    const checkOpts = await request(app)
      .get("/api/admin/config/approval-options")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(checkOpts.body.some((o: any) => o.value === "org")).toBe(false);

    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ ...BASE, counterparty: "OptDeleteTest", value: 100 });
    expect(create.status).toBe(201);
    const id = create.body.id;

    await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);

    const approve = await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getApproverToken()}`)
      .send({ declarationId: id, decision: "org" });
    expect(approve.status).toBe(400);

    await request(app)
      .post("/api/admin/config/approval-options")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ id: orgOpt.id, value: "org", label: "Organisation" });
  });

  it("PUT /api/admin/config/approval-options/:id — new option value is immediately enforceable", async () => {
    await request(app)
      .post("/api/admin/config/approval-options")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ id: "opt-quick", value: "quick-approve", label: "Quick Approve" });
    const opts = await request(app)
      .get("/api/admin/config/approval-options")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(opts.body.some((o: any) => o.value === "quick-approve")).toBe(true);

    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ ...BASE, counterparty: "OptNewTest", value: 100 });
    expect(create.status).toBe(201);
    const id = create.body.id;

    await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);

    const approve = await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getApproverToken()}`)
      .send({ declarationId: id, decision: "quick-approve" });
    expect(approve.status).toBe(200);
    expect(approve.body.currentStep.decision).toBe("quick-approve");

    await request(app)
      .delete("/api/admin/config/approval-options/opt-quick")
      .set("Authorization", `Bearer ${getAdminToken()}`);
  });
});

// ── DECLARATION EDIT FIELD MAPPING ──
describe("Declaration edit field mapping", () => {
  it("PUT /api/declarations/:id — employeeId is immutable via PUT (not in fieldMap)", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ ...BASE, counterparty: "ImmutableEmpId", value: 100 });
    expect(create.status).toBe(201);
    const id = create.body.id;

    const edit = await request(app)
      .put(`/api/declarations/${id}`)
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ employeeId: "user-admin" });
    expect(edit.status).toBe(200);

    const check = await request(app)
      .get(`/api/declarations/${id}`)
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(check.body.employeeId).toBe("user-team");
  });

  it("PUT /api/declarations/:id — from field maps to fromField in DB", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ ...BASE, counterparty: "FromFieldMap", value: 100 });
    expect(create.status).toBe(201);
    const id = create.body.id;

    const edit = await request(app)
      .put(`/api/declarations/${id}`)
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ from: "External Supplier" });
    expect(edit.status).toBe(200);

    const check = await request(app)
      .get(`/api/declarations/${id}`)
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(check.body.from).toBe("External Supplier");
  });
});

// ── CONFIG THRESHOLD CHANGE EFFECT ──
describe("Config threshold change effect", () => {
  it("Changing thresholds affects new submissions but not existing ones", async () => {
    const origConfig = await request(app)
      .get("/api/admin/config")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(origConfig.status).toBe(200);
    const { highValueThreshold: origHigh, mediumValueThreshold, slaEscalationDays, maxDeclarationsPerCounterparty, emailTemplate } = origConfig.body;

    const lowerThreshold = Math.max(origHigh - 500, 500);
    const configUpdate = await request(app)
      .put("/api/admin/config")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({
        highValueThreshold: lowerThreshold,
        mediumValueThreshold,
        slaEscalationDays,
        maxDeclarationsPerCounterparty,
        emailTemplate,
      });
    expect(configUpdate.status).toBe(200);

    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ ...BASE, counterparty: "ConfigChangeTest", value: lowerThreshold + 100 });
    expect(create.status).toBe(201);
    const id = create.body.id;

    await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);

    const inst = await request(app)
      .get(`/api/workflows/instances/${id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(inst.body.steps).toHaveLength(2);

    await request(app)
      .put("/api/admin/config")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({
        highValueThreshold: origHigh,
        mediumValueThreshold,
        slaEscalationDays,
        maxDeclarationsPerCounterparty,
        emailTemplate,
      });
  });
});

// ── DECLARATION FILES JSON FIELD ──
describe("Declaration files metadata field", () => {
  it("POST /api/declarations — files array is stored as JSON string and returned as array", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ ...BASE, counterparty: "FilesMetaTest", value: 100, files: ["file1.pdf", "file2.jpg"] });
    expect(create.status).toBe(201);
    expect(Array.isArray(create.body.files)).toBe(true);
    expect(create.body.files).toContain("file1.pdf");
  });

  it("PUT /api/declarations/:id — updating files field replaces stored metadata", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ ...BASE, counterparty: "FilesMetaUpdate", value: 100 });
    expect(create.status).toBe(201);
    const id = create.body.id;

    const edit = await request(app)
      .put(`/api/declarations/${id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ files: ["replacement.pdf"] });
    expect(edit.status).toBe(200);
    expect(edit.body.files).toEqual(["replacement.pdf"]);
  });
});

// ── DETERMINE RULE ID BOUNDARY ──
describe("determineRuleId threshold boundary", () => {
  it("determineRuleId routes a value equal to highThreshold to rule-2 (not rule-1)", async () => {
    const config = await prisma.systemConfig.findFirst();
    if (!config) throw new Error("System config not found");
    const { determineRuleId } = await import("../services/workflowService");
    const result = determineRuleId(config.highValueThreshold, config.highValueThreshold, config.mediumValueThreshold);
    expect(result).toBe("rule-2");
  });

  it("determineRuleId routes a value just below threshold to the lower rule", async () => {
    const { determineRuleId } = await import("../services/workflowService");
    expect(determineRuleId(999, 1000, 1000)).toBe("rule-1");
    expect(determineRuleId(1000, 1000, 1000)).toBe("rule-2");
  });
});

// ── ADMIN STATUS BYPASS PROTECTION ──
describe("Admin status bypass protection", () => {
  it("PATCH /api/declarations/:id/status — admin cannot set Approved if a pending step exists", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ ...BASE, counterparty: "AdminBypassTest1", value: 5000 });
    expect(create.status).toBe(201);
    const id = create.body.id;
    await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);
    const res = await request(app)
      .patch(`/api/declarations/${id}/status`)
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ status: "Approved" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/pending approval step/i);
  });

  it("PATCH /api/declarations/:id/status — admin can set Approved if all steps are already resolved", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ ...BASE, counterparty: "AdminBypassTest2", value: 5000 });
    expect(create.status).toBe(201);
    const id = create.body.id;
    await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);
    const instance = await prisma.workflowInstance.findUnique({ where: { declarationId: id } });
    const steps = JSON.parse(instance!.steps);
    for (const s of steps) {
      s.status = "approved";
      s.decision = "accept";
      s.approvedAt = new Date().toISOString();
    }
    await prisma.workflowInstance.update({ where: { declarationId: id }, data: { steps: JSON.stringify(steps) } });
    const res = await request(app)
      .patch(`/api/declarations/${id}/status`)
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ status: "Approved" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Approved");
  });
});

// ── WORKFLOW STEPS HIDDEN FROM NON-ADMINS ──
describe("Workflow step visibility", () => {
  it("GET /api/declarations/:id — approver receives full workflow steps", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ ...BASE, counterparty: "StepVisApprover", value: 5000 });
    expect(create.status).toBe(201);
    const id = create.body.id;
    await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);
    const res = await request(app)
      .get(`/api/declarations/${id}`)
      .set("Authorization", `Bearer ${getApproverToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.workflowSteps).toBeDefined();
    expect(Array.isArray(res.body.workflowSteps)).toBe(true);
  });

  it("GET /api/declarations/:id — teamMember receives stripped workflow steps (no assignee/notes)", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ ...BASE, counterparty: "StepVisMember", value: 5000 });
    expect(create.status).toBe(201);
    const id = create.body.id;
    await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);
    const res = await request(app)
      .get(`/api/declarations/${id}`)
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.workflowSteps).toBeDefined();
    expect(Array.isArray(res.body.workflowSteps)).toBe(true);
    expect(res.body.workflowSteps[0]).not.toHaveProperty("assigneeName");
    expect(res.body.workflowSteps[0]).not.toHaveProperty("assignee");
  });
});

