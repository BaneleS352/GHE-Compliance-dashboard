import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp, getAdminToken, getApproverToken, getTeamToken } from "./helpers";

const app = buildApp();

describe("Breaking / Negative / Edge-Case Tests", () => {
  // ── Auth ──────────────────────────────────────────────
  it("POST /api/auth/login — SQL injection in email (rejected by Zod)", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "' OR 1=1 --", password: "' OR '1'='1" });
    expect(res.status).toBe(400);
  });

  it("POST /api/auth/login — XSS in email field (rejected by Zod)", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "<script>alert('xss')</script>@test.com", password: "test" });
    expect(res.status).toBe(400);
  });

  it("POST /api/auth/login — extremely long email (passes Zod, fails lookup)", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "a".repeat(10000) + "@test.com", password: "password" });
    expect(res.status).toBe(401);
  });

  it("POST /api/auth/login — missing password field", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@test.com" });
    expect(res.status).toBe(400);
  });

  it("POST /api/auth/login — array instead of string", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: ["admin@test.com"], password: "password" });
    expect(res.status).toBe(400);
  });

  it("GET /api/auth/me — expired-format token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InVzZXItYWRtaW4iLCJyb2xlIjoiYWRtaW4iLCJleHAiOjEwMDAwMDAwMDB9.invalid");
    expect(res.status).toBe(401);
  });

  it("GET /api/auth/me — malformed Authorization header", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Basic YWRtaW46cGFzc3dvcmQ=");
    expect(res.status).toBe(401);
  });

  it("GET /api/auth/me — empty token string", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer ");
    expect(res.status).toBe(401);
  });

  // ── Declarations ──────────────────────────────────────
  it("POST /api/declarations — negative value", async () => {
    const res = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({
        employee: "Nomvula Team", employeeId: "user-team", teamMemberNumber: "TM-001",
        lineManager: "Sipho Approver", position: "Brand Manager", department: "Marketing",
        type: "Gift", counterparty: "NegTest", value: -100,
        submitted: "2026-07-01", approver: "Sipho Approver", status: "Draft", priority: "Low",
        description: "Negative value", relationship: "Test",
        receivedGiven: "Received", from: "Supplier", contactPerson: "T",
        biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-01",
        instances: "1", publicOfficial: "No",
      });
    expect(res.status).toBe(400);
  });

  it("POST /api/declarations — Infinity value", async () => {
    const res = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({
        employee: "Nomvula Team", employeeId: "user-team", teamMemberNumber: "TM-001",
        lineManager: "Sipho Approver", position: "Brand Manager", department: "Marketing",
        type: "Gift", counterparty: "InfTest", value: Infinity,
        submitted: "2026-07-01", approver: "Sipho Approver", status: "Draft", priority: "Low",
        description: "Infinity value", relationship: "Test",
        receivedGiven: "Received", from: "Supplier", contactPerson: "T",
        biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-01",
        instances: "1", publicOfficial: "No",
      });
    expect(res.status).toBe(400);
  });

  it("POST /api/declarations — XSS injection in description (stored as-is, no sanitization)", async () => {
    const res = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({
        employee: "Nomvula Team", employeeId: "user-team", teamMemberNumber: "TM-001",
        lineManager: "Sipho Approver", position: "Brand Manager", department: "Marketing",
        type: "Gift", counterparty: "XssTest", value: 100,
        submitted: "2026-07-01", approver: "Sipho Approver", status: "Draft", priority: "Low",
        description: "<script>document.body.innerHTML='hacked'</script>", relationship: "Test",
        receivedGiven: "Received", from: "Supplier", contactPerson: "T",
        biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-01",
        instances: "1", publicOfficial: "No",
      });
    expect(res.status).toBe(201);
    // XSS tags are stripped by server-side sanitization
    expect(res.body.description).not.toContain("<script>");
    expect(res.body.description).toBe("document.body.innerHTML='hacked'");
  });

  it("POST /api/declarations — extremely long description (exceeds 10k max)", async () => {
    const res = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({
        employee: "Nomvula Team", employeeId: "user-team", teamMemberNumber: "TM-001",
        lineManager: "Sipho Approver", position: "Brand Manager", department: "Marketing",
        type: "Gift", counterparty: "LongDesc", value: 100,
        submitted: "2026-07-01", approver: "Sipho Approver", status: "Draft", priority: "Low",
        description: "x".repeat(10001), relationship: "Test",
        receivedGiven: "Received", from: "Supplier", contactPerson: "T",
        biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-01",
        instances: "1", publicOfficial: "No",
      });
    expect(res.status).toBe(400);
  });

  it("POST /api/declarations — JSON prototype pollution attempt", async () => {
    const res = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ "__proto__": { "admin": true }, "constructor": { "prototype": { "isAdmin": true } },
        employee: "Nomvula Team", employeeId: "user-team", teamMemberNumber: "TM-001",
        lineManager: "Sipho Approver", position: "Brand Manager", department: "Marketing",
        type: "Gift", counterparty: "ProtoTest", value: 100,
        submitted: "2026-07-01", approver: "Sipho Approver", status: "Draft", priority: "Low",
        description: "prototype pollution", relationship: "Test",
        receivedGiven: "Received", from: "Supplier", contactPerson: "T",
        biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-01",
        instances: "1", publicOfficial: "No",
      });
    expect(res.status).toBe(201);
  });

  it("POST /api/declarations — non-numeric value sent as string 'abc'", async () => {
    const res = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({
        employee: "Nomvula Team", employeeId: "user-team", teamMemberNumber: "TM-001",
        lineManager: "Sipho Approver", position: "Brand Manager", department: "Marketing",
        type: "Gift", counterparty: "TypeTest", value: "abc",
        submitted: "2026-07-01", approver: "Sipho Approver", status: "Draft", priority: "Low",
        description: "Type confusion", relationship: "Test",
        receivedGiven: "Received", from: "Supplier", contactPerson: "T",
        biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-01",
        instances: "1", publicOfficial: "No",
      });
    expect(res.status).toBe(400);
  });

  it("POST /api/declarations — submitting for another user (IDOR)", async () => {
    const res = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({
        employee: "Admin User", employeeId: "user-admin", teamMemberNumber: "ADM-001",
        lineManager: "Sipho Approver", position: "Brand Manager", department: "Marketing",
        type: "Gift", counterparty: "IdorTest", value: 100,
        submitted: "2026-07-01", approver: "Sipho Approver", status: "Draft", priority: "Low",
        description: "IDOR attempt", relationship: "Test",
        receivedGiven: "Received", from: "Supplier", contactPerson: "T",
        biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-01",
        instances: "1", publicOfficial: "No",
      });
    expect(res.status).toBe(403);
  });

  it("GET /api/declarations/GHE-TEST-999 — non-existent ID", async () => {
    const res = await request(app)
      .get("/api/declarations/GHE-TEST-999")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(404);
  });

  it("PUT /api/declarations/GHE-TEST-999 — update non-existent", async () => {
    const res = await request(app)
      .put("/api/declarations/GHE-TEST-999")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ description: "ghost" });
    expect(res.status).toBe(404);
  });

  it("DELETE /api/declarations/GHE-TEST-999 — delete non-existent", async () => {
    const res = await request(app)
      .delete("/api/declarations/GHE-TEST-999")
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(res.status).toBe(404);
  });

  it("DELETE /api/declarations — wrong method (no ID)", async () => {
    const res = await request(app)
      .delete("/api/declarations")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(404);
  });

  it("PATCH /api/declarations/:id/submit — submit already-submitted declaration", async () => {
    const res = await request(app)
      .patch("/api/declarations/GHE-TEST-002/submit")
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(res.status).toBe(400);
  });

  it("POST /api/declarations — description exceeds 10000 max length", async () => {
    const res = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({
        employee: "Nomvula Team", employeeId: "user-team", teamMemberNumber: "TM-001",
        lineManager: "Sipho Approver", position: "Brand Manager", department: "Marketing",
        type: "Gift", counterparty: "BigPayload", value: 100,
        submitted: "2026-07-01", approver: "Sipho Approver", status: "Draft", priority: "Low",
        description: "x".repeat(10001), relationship: "Test",
        receivedGiven: "Received", from: "Supplier", contactPerson: "T",
        biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-01",
        instances: "1", publicOfficial: "No",
      });
    expect(res.status).toBe(400);
  });

  // ── Workflows ─────────────────────────────────────────
  it("POST /api/workflows/approve — empty declarationId", async () => {
    const res = await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getApproverToken()}`)
      .send({ declarationId: "", decision: "accept" });
    expect(res.status).toBe(400);
  });

  it("POST /api/workflows/approve — missing notes still works", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({
        employee: "Nomvula Team", employeeId: "user-team", teamMemberNumber: "TM-001",
        lineManager: "Sipho Approver", position: "Brand Manager", department: "Marketing",
        type: "Gift", counterparty: "NoNotesTest", value: 1000,
        submitted: "2026-07-05", approver: "Sipho Approver", status: "Draft", priority: "Medium",
        description: "No notes test", relationship: "Test",
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
      .send({ declarationId: id, decision: "accept" });
    expect(res.status).toBe(200);
  });

  // ── Admin ─────────────────────────────────────────────
  it("POST /api/admin/users — duplicate email", async () => {
    const res = await request(app)
      .post("/api/admin/users")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({
        name: "Duplicate", email: "admin@test.com", role: "teamMember",
        department: "IT", position: "Tester",
      });
    expect(res.status).toBe(409);
  });

  it("POST /api/admin/users — invalid role", async () => {
    const res = await request(app)
      .post("/api/admin/users")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({
        name: "Bad Role", email: "bad@role.com", role: "superadmin",
        department: "IT", position: "Tester",
      });
    expect(res.status).toBe(400);
  });

  it("GET /api/admin/users?search=__proto__ — noop search", async () => {
    const res = await request(app)
      .get("/api/admin/users?search=__proto__")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it("PUT /api/admin/config — string instead of number for threshold", async () => {
    const res = await request(app)
      .put("/api/admin/config")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ highValueThreshold: "five-thousand" });
    expect(res.status).toBe(400);
  });

  it("PUT /api/admin/config — negative threshold", async () => {
    const res = await request(app)
      .put("/api/admin/config")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ highValueThreshold: -1 });
    expect(res.status).toBe(400);
  });

  it("DELETE /api/admin/users/user-admin — deleting last admin", async () => {
    const res = await request(app)
      .delete("/api/admin/users/user-admin")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(400);
  });

  // ── Protection checks ─────────────────────────────────
  it("Protected endpoint — no token at all", async () => {
    const res = await request(app).get("/api/declarations");
    expect(res.status).toBe(401);
  });

  it("Protected endpoint — token with wrong role (teamMember on admin)", async () => {
    const res = await request(app)
      .get("/api/admin/dashboard")
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(res.status).toBe(403);
  });

  it("Protected endpoint — expired token format", async () => {
    const res = await request(app)
      .get("/api/declarations")
      .set("Authorization", "Bearer eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InVzZXItYWRtaW4iLCJyb2xlIjoiYWRtaW4iLCJleHAiOjE1MDAwMDAwMDB9.invalidsig");
    expect(res.status).toBe(401);
  });

  it("Non-existent route — returns 404", async () => {
    const res = await request(app)
      .get("/api/nonexistent/route")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(404);
  });

  it("Health check — always accessible", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  // ── Stress: rapid fire ────────────────────────────────
  it("Rapid sequential requests — 20 in a row", async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        request(app)
          .post("/api/declarations")
          .set("Authorization", `Bearer ${getTeamToken()}`)
          .send({
            employee: "Nomvula Team", employeeId: "user-team", teamMemberNumber: "TM-001",
            lineManager: "Sipho Approver", position: "Brand Manager", department: "Marketing",
            type: "Gift", counterparty: `Rapid${i}`, value: 10 + i,
            submitted: "2026-07-01", approver: "Sipho Approver", status: "Draft", priority: "Low",
            description: `Rapid fire ${i}`, relationship: "Test",
            receivedGiven: "Received", from: "Supplier", contactPerson: "T",
            biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-01",
            instances: "1", publicOfficial: "No",
          })
      )
    );
    const statuses = results.map((r) => r.status);
    expect(statuses.every((s) => s === 201)).toBe(true);
  });

  it("Large query param — SQL injection in filter", async () => {
    const res = await request(app)
      .get("/api/declarations?status=Pending' OR 1=1 --")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
