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

  // ── NEW: JWT / Token Attacks ──────────────────────
  it("GET /api/auth/me — JWT with alg: none", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer eyJhbGciOiJub25lIn0.eyJpZCI6InVzZXItYWRtaW4iLCJyb2xlIjoiYWRtaW4ifQ.");
    expect(res.status).toBe(401);
  });

  it("GET /api/auth/me — JWT signed with different secret", async () => {
    const jwt = require("jsonwebtoken");
    const fake = jwt.sign({ id: "user-admin", role: "admin" }, "wrong-secret");
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${fake}`);
    expect(res.status).toBe(401);
  });

  it("GET /api/auth/me — JWT with manipulated role in payload", async () => {
    const jwt = require("jsonwebtoken");
    const tampered = jwt.sign({ id: "user-team", role: "admin" }, "wrong-secret");
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${tampered}`);
    expect(res.status).toBe(401);
  });

  it("GET /api/auth/me — Bearer token with trailing whitespace (accepted, trimmed)", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${getAdminToken()}   `);
    // Server trims whitespace; 200 means token is still valid
    expect(res.status).toBe(200);
  });

  it("GET /api/auth/me — multiple Authorization headers", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .set("Authorization", "Bearer invalidtoken");
    expect(res.status).toBe(401);
  });

  // ── NEW: Content-Type / Body Attacks ──────────────
  it("POST /api/auth/login — URL-encoded body (accepted by Express urlencoded middleware)", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/x-www-form-urlencoded")
      .send("email=admin@test.com&password=password");
    // Express urlencoded middleware parses it — Zod validates it — login succeeds
    expect(res.status).toBe(200);
  });

  it("POST /api/auth/login — null body", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send(null);
    expect(res.status).toBe(400);
  });

  it("POST /api/declarations — empty JSON object (IDOR check runs first, returns 403)", async () => {
    const res = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({});
    // IDOR check (employeeId mismatch) fires before Zod validation
    expect(res.status).toBe(403);
  });

  it("POST /api/declarations — array instead of object (IDOR check runs first)", async () => {
    const res = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send([{ employee: "Test" }]);
    expect(res.status).toBe(403);
  });

  it("POST /api/declarations — null values for required fields (IDOR check first)", async () => {
    const res = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({
        employee: null, employeeId: null, department: null, type: null,
        counterparty: null, value: null, description: null,
      });
    expect(res.status).toBe(403);
  });

  it("POST /api/declarations — value is zero", async () => {
    const res = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({
        employee: "Nomvula Team", employeeId: "user-team", teamMemberNumber: "TM-001",
        lineManager: "Sipho Approver", position: "Brand Manager", department: "Marketing",
        type: "Gift", counterparty: "ZeroVal", value: 0,
        submitted: "2026-07-01", approver: "Sipho Approver", status: "Draft", priority: "Low",
        description: "Zero value test", relationship: "Test",
        receivedGiven: "Received", from: "Supplier", contactPerson: "T",
        biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-01",
        instances: "1", publicOfficial: "No",
      });
    // Zero is allowed per schema (nonnegative)
    expect(res.status).toBe(201);
    expect(res.body.value).toBe(0);
  });

  // ── NEW: Prisma Operator Injection ─────────────────
  it("GET /api/admin/users — Prisma operator injection in search", async () => {
    // Prisma's contains with special regex characters
    const res = await request(app)
      .get("/api/admin/users?search=.+")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("GET /api/declarations — filter with special characters in status", async () => {
    const res = await request(app)
      .get("/api/declarations?status=Pending%00")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
  });

  // ── NEW: Deeply Nested / DoS Attempts ─────────────
  it("POST /api/declarations — deeply nested JSON (500 levels, IDOR check first)", async () => {
    let deep: any = {};
    let ptr = deep;
    for (let i = 0; i < 500; i++) { ptr[i] = {}; ptr = ptr[i]; }
    const res = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send(deep);
    expect(res.status).toBe(403);
  });

  it("POST /api/declarations — extremely large array in files field", async () => {
    const res = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({
        employee: "Nomvula Team", employeeId: "user-team", teamMemberNumber: "TM-001",
        lineManager: "Sipho Approver", position: "Brand Manager", department: "Marketing",
        type: "Gift", counterparty: "BigArr", value: 100,
        submitted: "2026-07-01", approver: "Sipho Approver", status: "Draft", priority: "Low",
        description: "Large array", relationship: "Test",
        receivedGiven: "Received", from: "Supplier", contactPerson: "T",
        biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-01",
        instances: "1", publicOfficial: "No",
        files: new Array(10000).fill("x"),
      });
    expect(res.status).toBe(201); // Should still accept despite large array
  });

  // ── NEW: Unicode / Encoding Attacks ───────────────
  it("POST /api/declarations — unicode right-to-left override in description", async () => {
    const res = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({
        employee: "Nomvula Team", employeeId: "user-team", teamMemberNumber: "TM-001",
        lineManager: "Sipho Approver", position: "Brand Manager", department: "Marketing",
        type: "Gift", counterparty: "Unicode", value: 100,
        submitted: "2026-07-01", approver: "Sipho Approver", status: "Draft", priority: "Low",
        description: "Access granted \u202E[pay-roll-elift] veroD", relationship: "Test",
        receivedGiven: "Received", from: "Supplier", contactPerson: "T",
        biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-01",
        instances: "1", publicOfficial: "No",
      });
    expect(res.status).toBe(201);
  });

  it("POST /api/declarations — null byte injection", async () => {
    const res = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({
        employee: "Nomvula Team", employeeId: "user-team", teamMemberNumber: "TM-001",
        lineManager: "Sipho Approver", position: "Brand Manager", department: "Marketing",
        type: "Gift", counterparty: "NullByte\u0000test", value: 100,
        submitted: "2026-07-01", approver: "Sipho Approver", status: "Draft", priority: "Low",
        description: "Null byte test", relationship: "Test",
        receivedGiven: "Received", from: "Supplier", contactPerson: "T",
        biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-01",
        instances: "1", publicOfficial: "No",
      });
    expect(res.status).toBe(201);
  });

  // ── NEW: Workflow Edge Cases ──────────────────────
  it("POST /api/workflows/approve — invalid decision value", async () => {
    const res = await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getApproverToken()}`)
      .send({ declarationId: "GHE-TEST-001", decision: "nuclear-launch" });
    expect(res.status).toBe(400);
  });

  it("POST /api/workflows/approve — teamMember tries to approve", async () => {
    const res = await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ declarationId: "GHE-TEST-001", decision: "accept" });
    expect(res.status).toBe(403);
  });

  it("POST /api/workflows/approve — approve non-existent declaration", async () => {
    const res = await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getApproverToken()}`)
      .send({ declarationId: "GHE-NONEXIST", decision: "accept" });
    expect(res.status).toBe(404);
  });

  // ── NEW: Declaration Status Edge Cases ─────────────
  it("PATCH /api/declarations/:id/status — invalid status string", async () => {
    const res = await request(app)
      .patch("/api/declarations/GHE-TEST-001/status")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ status: "FlyingPig" });
    expect(res.status).toBe(400);
  });

  it("PATCH /api/declarations/:id/status — empty status", async () => {
    const res = await request(app)
      .patch("/api/declarations/GHE-TEST-001/status")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ status: "" });
    expect(res.status).toBe(400);
  });

  // ── NEW: HTTP Method Abuse ─────────────────────────
  it("POST /api/declarations/:id — POST on specific resource (should be 404)", async () => {
    const res = await request(app)
      .post("/api/declarations/GHE-TEST-001")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(404);
  });

  it("PATCH /api/declarations — PATCH on collection (no ID)", async () => {
    const res = await request(app)
      .patch("/api/declarations")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(404);
  });

  it("PUT /api/declarations — PUT on collection (no ID)", async () => {
    const res = await request(app)
      .put("/api/declarations")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({});
    expect(res.status).toBe(404);
  });

  // ── NEW: IDOR / Permission Escalation ─────────────
  it("PUT /api/declarations/:id — teamMember edits non-owned declaration (already approved)", async () => {
    // GHE-TEST-003 is "Approved" — status check returns 400 before IDOR check
    const res = await request(app)
      .put("/api/declarations/GHE-TEST-003")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ description: "tampered" });
    expect(res.status).toBe(400);
  });

  it("DELETE /api/declarations/:id — teamMember deletes non-owned declaration (already approved)", async () => {
    // GHE-TEST-003 is "Approved" — status check returns 400 before IDOR check
    const res = await request(app)
      .delete("/api/declarations/GHE-TEST-003")
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(res.status).toBe(400);
  });

  it("GET /api/declarations — teamMember sees only their own declarations", async () => {
    const res = await request(app)
      .get("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // Team member should only see their own declarations
    for (const d of res.body) {
      expect(d.employeeId).toBe("user-team");
    }
  });

  // ── NEW: Admin Edge Cases ──────────────────────────
  it("POST /api/admin/users — missing required fields", async () => {
    const res = await request(app)
      .post("/api/admin/users")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ role: "teamMember" });
    expect(res.status).toBe(400);
  });

  it("POST /api/admin/users — very long name (10k chars)", async () => {
    const res = await request(app)
      .post("/api/admin/users")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({
        name: "x".repeat(10000), email: "longname@test.com", role: "teamMember",
        department: "IT", position: "Tester",
      });
    expect(res.status).toBe(201);
    // Cleanup to avoid leaking into other tests
    await request(app)
      .delete("/api/admin/users/" + res.body.id)
      .set("Authorization", `Bearer ${getAdminToken()}`);
  });

  it("DELETE /api/admin/users/:id — non-existent user", async () => {
    const res = await request(app)
      .delete("/api/admin/users/user-nonexistent")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(404);
  });

  // ── NEW: Report Edge Cases ─────────────────────────
  it("GET /api/reports/status-breakdown — invalid date range", async () => {
    const res = await request(app)
      .get("/api/reports/status-breakdown?startDate=9999-99-99&endDate=invalid")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    // Should still return 200 with empty/valid data (dates are strings, no crash)
    expect(res.status).toBe(200);
  });

  it("GET /api/reports/list — combined filters", async () => {
    const res = await request(app)
      .get("/api/reports/list?department=Marketing&status=Pending")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    for (const d of res.body) {
      expect(d.department).toBe("Marketing");
      expect(d.status).toBe("Pending");
    }
  });

  it("GET /api/reports/list — non-existent department", async () => {
    const res = await request(app)
      .get("/api/reports/list?department=DepartmentOfImaginaryFriends")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  // ── NEW: File Route Edge Cases ─────────────────────
  it("GET /api/files/:id — non-existent file returns 404", async () => {
    const res = await request(app)
      .get("/api/files/nonexistent-file-id")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(404);
  });

  // ── NEW: CORS / Header Edge Cases ──────────────────
  it("OPTIONS /api/health — CORS preflight (Express returns 204 by default)", async () => {
    const res = await request(app)
      .options("/api/health")
      .set("Origin", "http://evil.com")
      .set("Access-Control-Request-Method", "GET");
    // Express returns 204 No Content for OPTIONS when no handler matches
    expect(res.status).toBe(204);
  });
});
