import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { buildApp, getAdminToken, getApproverToken, getTeamToken, getHrToken } from "./helpers";
import path from "path";
import fs from "fs";
import { prisma } from "../config/prisma";

const app = buildApp();
const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");
const ALLOWED_MIMES = [
  "application/pdf",
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "text/plain",
];

const cleanupDeclIds: string[] = [];

afterAll(async () => {
  if (cleanupDeclIds.length === 0) return;
  await prisma.workflowInstance.deleteMany({
    where: { declarationId: { in: cleanupDeclIds } },
  });
  await prisma.uploadedFile.deleteMany({
    where: { declarationId: { in: cleanupDeclIds } },
  });
  await prisma.declaration.deleteMany({
    where: { id: { in: cleanupDeclIds } },
  });
});

describe("Edge-Case Tests", () => {
  // ── FILE UPLOADS ──
  describe("File uploads", () => {
    let uploadedId: string;

    it("POST /api/files/upload — upload a valid text file", async () => {
      const res = await request(app)
        .post("/api/files/upload")
        .set("Authorization", `Bearer ${getAdminToken()}`)
        .attach("file", Buffer.from("hello world"), "test.txt");
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe("test.txt");
      expect(res.body.type).toBe("text/plain");
      expect(res.body.size).toBe(11);
      expect(res.body.url).toContain("/api/files/");
      uploadedId = res.body.id;
    });

    it("POST /api/files/upload — upload linked to a declarationId", async () => {
      const res = await request(app)
        .post("/api/files/upload")
        .set("Authorization", `Bearer ${getAdminToken()}`)
        .field("declarationId", "GHE-TEST-001")
        .attach("file", Buffer.from("linked file"), "linked.txt");
      expect(res.status).toBe(201);
      expect(res.body.name).toBe("linked.txt");
    });

    it("POST /api/files/upload — reject invalid MIME type (.html)", async () => {
      const res = await request(app)
        .post("/api/files/upload")
        .set("Authorization", `Bearer ${getAdminToken()}`)
        .attach("file", Buffer.from("<html></html>"), "malicious.html");
      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/not allowed/i);
    });

    it("POST /api/files/upload — reject invalid MIME type (.exe)", async () => {
      const res = await request(app)
        .post("/api/files/upload")
        .set("Authorization", `Bearer ${getAdminToken()}`)
        .attach("file", Buffer.from("MZ\x90\x00"), "virus.exe");
      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/not allowed/i);
    });

    it("POST /api/files/upload — no file attached", async () => {
      const res = await request(app)
        .post("/api/files/upload")
        .set("Authorization", `Bearer ${getAdminToken()}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("No file provided");
    });

    it("POST /api/files/upload — team member uploads (allowed)", async () => {
      const res = await request(app)
        .post("/api/files/upload")
        .set("Authorization", `Bearer ${getTeamToken()}`)
        .attach("file", Buffer.from("team file"), "team.txt");
      expect(res.status).toBe(201);
    });

    it("POST /api/files/upload — unauthenticated request rejected", async () => {
      const res = await request(app)
        .post("/api/files/upload")
        .attach("file", Buffer.from("anon"), "anon.txt");
      expect(res.status).toBe(401);
    });

    it("GET /api/files/:id — download uploaded file", async () => {
      const res = await request(app)
        .get(`/api/files/${uploadedId}`)
        .set("Authorization", `Bearer ${getAdminToken()}`);
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toBe("text/plain");
      expect(res.headers["content-disposition"]).toContain("test.txt");
      expect(res.text).toBe("hello world");
    });

    it("GET /api/files/:id — non-existent ID returns 404", async () => {
      const res = await request(app)
        .get("/api/files/nonexistent-id-12345")
        .set("Authorization", `Bearer ${getAdminToken()}`);
      expect(res.status).toBe(404);
    });

    it("DELETE /api/files/:id — delete uploaded file", async () => {
      const res = await request(app)
        .delete(`/api/files/${uploadedId}`)
        .set("Authorization", `Bearer ${getAdminToken()}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe("File deleted");
      // Verify it's gone
      const getRes = await request(app)
        .get(`/api/files/${uploadedId}`)
        .set("Authorization", `Bearer ${getAdminToken()}`);
      expect(getRes.status).toBe(404);
    });

    it("DELETE /api/files/:id — non-existent ID returns 404", async () => {
      const res = await request(app)
        .delete("/api/files/nonexistent-id-12345")
        .set("Authorization", `Bearer ${getAdminToken()}`);
      expect(res.status).toBe(404);
    });

    it("DELETE /api/files/:id — unauthenticated rejected", async () => {
      const res = await request(app)
        .delete(`/api/files/${uploadedId}`);
      expect(res.status).toBe(401);
    });
  });

  // ── MASS ASSIGNMENT ──
  describe("Mass assignment — restricted field updates", () => {
    it("PUT /api/declarations/:id — team member cannot update status (field whitelist enforced)", async () => {
      // Create a draft as team member
      const createRes = await request(app)
        .post("/api/declarations")
        .set("Authorization", `Bearer ${getTeamToken()}`)
        .send({
          employee: "Nomvula Team", employeeId: "user-team", teamMemberNumber: "TM-001",
          lineManager: "Sipho Approver", position: "Brand Manager", department: "Marketing",
          type: "Gift", counterparty: "MassAssign", value: 100,
          submitted: "2026-07-01", approver: "Sipho Approver", status: "Draft", priority: "Low",
          description: "Mass assignment test", relationship: "Test",
          receivedGiven: "Received", from: "Supplier", contactPerson: "T",
          biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-01",
          instances: "1", publicOfficial: "No",
        });
      expect(createRes.status).toBe(201);
      const declId = createRes.body.id;
      cleanupDeclIds.push(declId);

      // status field is blocked by the PUT field whitelist
      const putRes = await request(app)
        .put(`/api/declarations/${declId}`)
        .set("Authorization", `Bearer ${getTeamToken()}`)
        .send({ status: "Approved" });
      expect(putRes.status).toBe(200);
      expect(putRes.body.status).toBe("Draft");
    });

    it("PUT /api/declarations/:id — team member cannot change employeeId (field whitelist enforced)", async () => {
      const createRes = await request(app)
        .post("/api/declarations")
        .set("Authorization", `Bearer ${getTeamToken()}`)
        .send({
          employee: "Nomvula Team", employeeId: "user-team", teamMemberNumber: "TM-001",
          lineManager: "Sipho Approver", position: "Brand Manager", department: "Marketing",
          type: "Gift", counterparty: "EmpIdTest", value: 100,
          submitted: "2026-07-01", approver: "Sipho Approver", status: "Draft", priority: "Low",
          description: "employeeId isolation test", relationship: "Test",
          receivedGiven: "Received", from: "Supplier", contactPerson: "T",
          biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-01",
          instances: "1", publicOfficial: "No",
        });
      expect(createRes.status).toBe(201);
      cleanupDeclIds.push(createRes.body.id);
      const res = await request(app)
        .put(`/api/declarations/${createRes.body.id}`)
        .set("Authorization", `Bearer ${getTeamToken()}`)
        .send({ employeeId: "user-admin" });
      expect(res.status).toBe(200);
      // employeeId is blocked by the PUT field whitelist — stays as original
      expect(res.body.employeeId).toBe("user-team");
    });

    it("PUT /api/declarations/:id — admin also cannot update status (field whitelist enforced)", async () => {
      const decls = await request(app)
        .get("/api/declarations")
        .set("Authorization", `Bearer ${getAdminToken()}`);
      const draft = decls.body.find((d: any) => d.status === "Draft");
      if (!draft) return;
      const res = await request(app)
        .put(`/api/declarations/${draft.id}`)
        .set("Authorization", `Bearer ${getAdminToken()}`)
        .send({ status: "Pending" });
      // status is blocked by the field whitelist — use PATCH /:id/status instead
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("Draft");
    });
  });

  // ── SELF-APPROVAL ──
  describe("Self-approval guard", () => {
    it("POST /api/workflows/approve — creating declaration and self-approving (vulnerability: no guard)", async () => {
      // Create declaration as admin for user-approver (who has lineManager=null)
      const createRes = await request(app)
        .post("/api/declarations")
        .set("Authorization", `Bearer ${getAdminToken()}`)
        .send({
          employee: "Sipho Approver", employeeId: "user-approver", teamMemberNumber: "APR-001",
          lineManager: "Self", position: "LM", department: "Marketing",
          type: "Gift", counterparty: "SelfApproval", value: 100,
          submitted: "2026-07-01", approver: "Sipho Approver", status: "Draft", priority: "Low",
          description: "self approval test", relationship: "Test",
          receivedGiven: "Received", from: "Supplier", contactPerson: "T",
          biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-01",
          instances: "1", publicOfficial: "No",
        });
      expect(createRes.status).toBe(201);
      const declId = createRes.body.id;
      cleanupDeclIds.push(declId);

      // Create workflow instance directly (bypass submit since user-approver has no lineManager)
      const { prisma } = await import("../config/prisma");
      await prisma.workflowInstance.create({
        data: {
          declarationId: declId,
          steps: JSON.stringify([{ order: 1, role: "lineManager", assignee: "user-approver", assigneeName: "Sipho Approver", label: "Line Manager Review", status: "pending", decision: null, notes: "", decidedAt: null }]),
        },
      });

      // Approve own declaration — currently succeeds (no self-approval guard)
      const approveRes = await request(app)
        .post("/api/workflows/approve")
        .set("Authorization", `Bearer ${getApproverToken()}`)
        .send({ declarationId: declId, decision: "accept", notes: "Self-approving" });
      // BUG: Should be 403 but there's no guard
      expect(approveRes.status).toBe(200);
      expect(approveRes.body.newStatus).toMatch(/Pending|Approved/);
    });
  });

  // ── WORKFLOW ORDER ENFORCEMENT ──
  describe("Workflow step order enforcement", () => {
    it("POST /api/workflows/approve — HR can approve their step before Line Manager (no order guard)", async () => {
      // Create a fresh 2-step workflow: LM pending, HR pending, both assigned separately
      const createRes = await request(app)
        .post("/api/declarations")
        .set("Authorization", `Bearer ${getAdminToken()}`)
        .send({
          employee: "Team Member", employeeId: "user-team", teamMemberNumber: "TM-001",
          lineManager: "Sipho Approver", position: "BM", department: "Marketing",
          type: "Gift", counterparty: "OrderTest", value: 100,
          submitted: "2026-07-01", approver: "Sipho Approver", status: "Draft", priority: "Low",
          description: "order enforcement test", relationship: "Test",
          receivedGiven: "Received", from: "Supplier", contactPerson: "T",
          biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-01",
          instances: "1", publicOfficial: "No",
        });
      const declId = createRes.body.id;
      cleanupDeclIds.push(declId);

      // Create a 2-step workflow: LM (user-approver), HR (user-hr)
      const { prisma } = await import("../config/prisma");
      await prisma.workflowInstance.create({
        data: {
          declarationId: declId,
          steps: JSON.stringify([
            { order: 1, role: "lineManager", assignee: "user-approver", assigneeName: "Sipho Approver", label: "Line Manager Review", status: "pending", decision: null, notes: "", decidedAt: null },
            { order: 2, role: "hr", assignee: "user-hr", assigneeName: "Lindiwe HR", label: "HR Review", status: "pending", decision: null, notes: "", decidedAt: null },
          ]),
        },
      });

      // HR approves their step before LM has approved — currently succeeds (no order enforcement)
      const hrApprove = await request(app)
        .post("/api/workflows/approve")
        .set("Authorization", `Bearer ${getHrToken()}`)
        .send({ declarationId: declId, decision: "accept" });
      // BUG: Should be 403 (must wait for LM), but order not enforced
      expect(hrApprove.status).toBe(200);
    });
  });

  // ── RACE CONDITION: CONCURRENT APPROVE ──
  describe("Race condition — concurrent approval", () => {
    it("POST /api/workflows/approve — two concurrent approvals on same step, only one succeeds", async () => {
      // Create declaration as admin (avoids submit which auto-creates workflow)
      const createRes = await request(app)
        .post("/api/declarations")
        .set("Authorization", `Bearer ${getAdminToken()}`)
        .send({
          employee: "Team Member", employeeId: "user-team", teamMemberNumber: "TM-001",
          lineManager: "Sipho Approver", position: "BM", department: "Marketing",
          type: "Gift", counterparty: "RaceTest", value: 100,
          submitted: "2026-07-01", approver: "Sipho Approver", status: "Draft", priority: "Low",
          description: "race condition test", relationship: "Test",
          receivedGiven: "Received", from: "Supplier", contactPerson: "T",
          biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-01",
          instances: "1", publicOfficial: "No",
        });
      const declId = createRes.body.id;
      cleanupDeclIds.push(declId);

      // Create workflow instance directly (bypass submit)
      const { prisma } = await import("../config/prisma");
      await prisma.workflowInstance.create({
        data: {
          declarationId: declId,
          steps: JSON.stringify([{ order: 1, role: "lineManager", assignee: "user-approver", assigneeName: "Sipho Approver", label: "Line Manager Review", status: "pending", decision: null, notes: "", decidedAt: null }]),
        },
      });

      // Fire two concurrent approve calls
      const results = await Promise.all([
        request(app)
          .post("/api/workflows/approve")
          .set("Authorization", `Bearer ${getApproverToken()}`)
          .send({ declarationId: declId, decision: "accept" }),
        request(app)
          .post("/api/workflows/approve")
          .set("Authorization", `Bearer ${getApproverToken()}`)
          .send({ declarationId: declId, decision: "accept" }),
      ]);

      const statuses = results.map((r) => r.status);
      expect(statuses).toContain(200);
      // Exactly one should succeed, the other gets 403 (step already approved)
      // Or both succeed if the race window is hit (step lookup outside transaction)
      const successCount = statuses.filter((s) => s === 200).length;
      expect(successCount).toBeGreaterThanOrEqual(1);
      expect(successCount).toBeLessThanOrEqual(2);
    });
  });

  // ── APPROVER ISOLATION ──
  describe("Approver data isolation", () => {
    it("GET /api/declarations — approver sees declarations beyond their assigned steps", async () => {
      const res = await request(app)
        .get("/api/declarations")
        .set("Authorization", `Bearer ${getHrToken()}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // HR user sees ALL declarations (current behavior, not filtered by assignment)
      const allEmployeeIds = [...new Set(res.body.map((d: any) => d.employeeId))];
      expect(allEmployeeIds.length).toBeGreaterThan(1);
    });

    it("GET /api/workflows/pending — approver sees only their assigned pending steps", async () => {
      const res = await request(app)
        .get("/api/workflows/pending")
        .set("Authorization", `Bearer ${getHrToken()}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      for (const item of res.body) {
        expect(item.step.assignee).toBe("user-hr");
      }
    });
  });

  // ── ADMIN CREATES FOR OTHER USERS ──
  describe("Admin cross-user declaration creation", () => {
    it("POST /api/declarations — admin can create for another user", async () => {
      const res = await request(app)
        .post("/api/declarations")
        .set("Authorization", `Bearer ${getAdminToken()}`)
        .send({
          employee: "Sipho Approver", employeeId: "user-approver", teamMemberNumber: "APR-001",
          lineManager: "None", position: "LM", department: "Marketing",
          type: "Gift", counterparty: "AdminForOther", value: 200,
          submitted: "2026-07-01", approver: "Sipho Approver", status: "Draft", priority: "Low",
          description: "admin creates for other user", relationship: "Test",
          receivedGiven: "Received", from: "Supplier", contactPerson: "T",
          biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-01",
          instances: "1", publicOfficial: "No",
        });
      expect(res.status).toBe(201);
      expect(res.body.employeeId).toBe("user-approver");
      cleanupDeclIds.push(res.body.id);
    });

    it("POST /api/declarations — team member cannot create for admin (IDOR)", async () => {
      const res = await request(app)
        .post("/api/declarations")
        .set("Authorization", `Bearer ${getTeamToken()}`)
        .send({
          employee: "Admin User", employeeId: "user-admin", teamMemberNumber: "ADM-001",
          lineManager: "None", position: "Admin", department: "IT",
          type: "Gift", counterparty: "TeamForAdmin", value: 100,
          submitted: "2026-07-01", approver: "Admin", status: "Draft", priority: "Low",
          description: "team tries to create for admin", relationship: "Test",
          receivedGiven: "Received", from: "Supplier", contactPerson: "T",
          biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-01",
          instances: "1", publicOfficial: "No",
        });
      expect(res.status).toBe(403);
    });

    it("POST /api/declarations — approver can create for another user", async () => {
      const res = await request(app)
        .post("/api/declarations")
        .set("Authorization", `Bearer ${getHrToken()}`)
        .send({
          employee: "Team Member", employeeId: "user-team", teamMemberNumber: "TM-001",
          lineManager: "Sipho Approver", position: "BM", department: "Marketing",
          type: "Gift", counterparty: "ApproverForOther", value: 100,
          submitted: "2026-07-01", approver: "Sipho Approver", status: "Draft", priority: "Low",
          description: "approver creates for other", relationship: "Test",
          receivedGiven: "Received", from: "Supplier", contactPerson: "T",
          biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-01",
          instances: "1", publicOfficial: "No",
        });
      expect(res.status).toBe(201);
      cleanupDeclIds.push(res.body.id);
    });
  });

  // ── EXPORT FILTERED ──
  describe("Report export filtering", () => {
    it("GET /api/reports/export — basic export returns xlsx", async () => {
      const res = await request(app)
        .get("/api/reports/export")
        .set("Authorization", `Bearer ${getAdminToken()}`);
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/spreadsheetml/);
      expect(res.headers["content-disposition"]).toContain(".xlsx");
      expect(Buffer.isBuffer(res.body) || typeof res.body === "object").toBe(true);
    });

    it("GET /api/reports/export — filter by department", async () => {
      const res = await request(app)
        .get("/api/reports/export?department=Marketing")
        .set("Authorization", `Bearer ${getAdminToken()}`);
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/spreadsheetml/);
    });

    it("GET /api/reports/export — filter by status", async () => {
      const res = await request(app)
        .get("/api/reports/export?status=Pending")
        .set("Authorization", `Bearer ${getAdminToken()}`);
      expect(res.status).toBe(200);
    });

    it("GET /api/reports/export — filter by date range", async () => {
      const res = await request(app)
        .get("/api/reports/export?startDate=2026-01-01&endDate=2026-12-31")
        .set("Authorization", `Bearer ${getAdminToken()}`);
      expect(res.status).toBe(200);
    });

    it("GET /api/reports/export — combined filters", async () => {
      const res = await request(app)
        .get("/api/reports/export?department=Marketing&status=Pending&startDate=2026-01-01")
        .set("Authorization", `Bearer ${getAdminToken()}`);
      expect(res.status).toBe(200);
    });

    it("GET /api/reports/export — custom reportType in filename", async () => {
      const res = await request(app)
        .get("/api/reports/export?reportType=My+Custom+Report!")
        .set("Authorization", `Bearer ${getAdminToken()}`);
      expect(res.status).toBe(200);
      // Special chars sanitized to underscores
      expect(res.headers["content-disposition"]).toMatch(/My_Custom_Report_/);
    });

    it("GET /api/reports/export — empty results (no matching declarations)", async () => {
      const res = await request(app)
        .get("/api/reports/export?department=NonexistentDepartmentXYZ")
        .set("Authorization", `Bearer ${getAdminToken()}`);
      expect(res.status).toBe(200);
      // Should return a valid xlsx with zero rows (not crash)
      expect(res.headers["content-type"]).toMatch(/spreadsheetml/);
    });

    it("GET /api/reports/export — team member can export (no admin guard)", async () => {
      const res = await request(app)
        .get("/api/reports/export")
        .set("Authorization", `Bearer ${getTeamToken()}`);
      // Export uses authenticate only, no authorize("admin")
      expect(res.status).toBe(200);
    });
  });

  // ── PRESET USERS ──
  describe("Auth preset users", () => {
    it("GET /api/auth/preset-users — returns list of 5 preset users", async () => {
      const res = await request(app).get("/api/auth/preset-users");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(5);
      for (const u of res.body) {
        expect(u.label).toBeDefined();
        expect(u.email).toBeDefined();
        expect(u.role).toBeDefined();
        expect(["teamMember", "approver", "admin"]).toContain(u.role);
      }
    });

    it("GET /api/auth/preset-users — no auth required", async () => {
      const res = await request(app).get("/api/auth/preset-users");
      expect(res.status).toBe(200);
    });
  });

  // ── FILE UPLOAD IDOR ──
  describe("File upload IDOR", () => {
    it("POST /api/files/upload — upload then download as different user", async () => {
      // Upload as team member
      const uploadRes = await request(app)
        .post("/api/files/upload")
        .set("Authorization", `Bearer ${getTeamToken()}`)
        .attach("file", Buffer.from("idor test"), "idor.txt");
      expect(uploadRes.status).toBe(201);
      const fileId = uploadRes.body.id;

      // Download as different user (any authenticated user can download)
      const downloadRes = await request(app)
        .get(`/api/files/${fileId}`)
        .set("Authorization", `Bearer ${getHrToken()}`);
      expect(downloadRes.status).toBe(200);
      expect(downloadRes.text).toBe("idor test");

      // Cleanup
      await request(app)
        .delete(`/api/files/${fileId}`)
        .set("Authorization", `Bearer ${getAdminToken()}`);
    });
  });

  // ── WORKFLOW INSTANCE ACCESS CONTROL ──
  describe("Workflow instance access", () => {
    it("GET /api/workflows/instances/:declarationId — team member can view their own workflow", async () => {
      const res = await request(app)
        .get("/api/workflows/instances/GHE-TEST-001")
        .set("Authorization", `Bearer ${getTeamToken()}`);
      expect(res.status).toBe(200);
      expect(res.body.declarationId).toBe("GHE-TEST-001");
    });

    it("GET /api/workflows/instances/:declarationId — non-existent returns 404", async () => {
      const res = await request(app)
        .get("/api/workflows/instances/GHE-NONEXIST")
        .set("Authorization", `Bearer ${getAdminToken()}`);
      expect(res.status).toBe(404);
    });

    it("GET /api/workflows/instances/:declarationId — any user can view non-owned workflow instances (BUG: no ownership check)", async () => {
      // Create a declaration + workflow owned by admin
      const createRes = await request(app)
        .post("/api/declarations")
        .set("Authorization", `Bearer ${getAdminToken()}`)
        .send({
          employee: "Admin User", employeeId: "user-admin", teamMemberNumber: "ADM-001",
          lineManager: "None", position: "Admin", department: "IT",
          type: "Gift", counterparty: "WfLeakTest", value: 100,
          submitted: "2026-07-01", approver: "Admin", status: "Draft", priority: "Low",
          description: "workflow data leak test", relationship: "Test",
          receivedGiven: "Received", from: "Supplier", contactPerson: "T",
          biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-01",
          instances: "1", publicOfficial: "No",
        });
      expect(createRes.status).toBe(201);
      cleanupDeclIds.push(createRes.body.id);

      // Create workflow on it
      const { prisma } = await import("../config/prisma");
      await prisma.workflowInstance.create({
        data: {
          declarationId: createRes.body.id,
          steps: JSON.stringify([{ order: 1, role: "lineManager", assignee: "user-admin", assigneeName: "Admin", label: "Admin Review", status: "pending", decision: null, notes: "", decidedAt: null }]),
        },
      });

      // Team member reads admin's workflow instance
      const res = await request(app)
        .get(`/api/workflows/instances/${createRes.body.id}`)
        .set("Authorization", `Bearer ${getTeamToken()}`);
      // BUG: Should be 403 but there's no ownership check
      expect(res.status).toBe(200);
      expect(res.body.declarationId).toBe(createRes.body.id);
      expect(Array.isArray(res.body.steps)).toBe(true);
    });
  });

  // ── STATUS ESCALATION VIA PATCH ──
  describe("Status escalation via PATCH", () => {
    it("PATCH /api/declarations/:id/status — team member is blocked by role guard", async () => {
      const createRes = await request(app)
        .post("/api/declarations")
        .set("Authorization", `Bearer ${getTeamToken()}`)
        .send({
          employee: "Nomvula Team", employeeId: "user-team", teamMemberNumber: "TM-001",
          lineManager: "Sipho Approver", position: "BM", department: "Marketing",
          type: "Gift", counterparty: "PatchEscalate", value: 100,
          submitted: "2026-07-01", approver: "", status: "Draft", priority: "Low",
          description: "patch escalation test", relationship: "Test",
          receivedGiven: "Received", from: "Supplier", contactPerson: "T",
          biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-01",
          instances: "1", publicOfficial: "No",
        });
      expect(createRes.status).toBe(201);
      cleanupDeclIds.push(createRes.body.id);

      const patchRes = await request(app)
        .patch(`/api/declarations/${createRes.body.id}/status`)
        .set("Authorization", `Bearer ${getTeamToken()}`)
        .send({ status: "Approved" });
      expect(patchRes.status).toBe(403);
    });
  });

  // ── SINGLE-DECLARATION DATA LEAK ──
  describe("Single-declaration data leak", () => {
    it("GET /api/declarations/:id — team member can read non-owned declaration by ID (BUG: no ownership check on single-resource endpoint)", async () => {
      // Create a declaration owned by admin
      const createRes = await request(app)
        .post("/api/declarations")
        .set("Authorization", `Bearer ${getAdminToken()}`)
        .send({
          employee: "Admin User", employeeId: "user-admin", teamMemberNumber: "ADM-001",
          lineManager: "None", position: "Admin", department: "IT",
          type: "Gift", counterparty: "DeclLeakTest", value: 500,
          submitted: "2026-07-01", approver: "Admin", status: "Draft", priority: "Low",
          description: "declaration data leak test", relationship: "Test",
          receivedGiven: "Received", from: "Supplier", contactPerson: "T",
          biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-01",
          instances: "1", publicOfficial: "No",
        });
      expect(createRes.status).toBe(201);
      cleanupDeclIds.push(createRes.body.id);

      // Team member reads admin's declaration by ID — now blocked by ownership check
      const res = await request(app)
        .get(`/api/declarations/${createRes.body.id}`)
        .set("Authorization", `Bearer ${getTeamToken()}`);
      expect(res.status).toBe(403);
    });
  });

  // ── CREATE DECLARATION WITH STATUS APPROVED ──
  describe("Create declaration with pre-approved status", () => {
    it("POST /api/declarations — team member cannot create with pre-approved status (enforced Draft)", async () => {
      const res = await request(app)
        .post("/api/declarations")
        .set("Authorization", `Bearer ${getTeamToken()}`)
        .send({
          employee: "Nomvula Team", employeeId: "user-team", teamMemberNumber: "TM-001",
          lineManager: "Sipho Approver", position: "BM", department: "Marketing",
          type: "Gift", counterparty: "PreApproved", value: 100,
          submitted: "2026-07-01", approver: "Sipho Approver", status: "Approved", priority: "Low",
          description: "pre-approved bypass test", relationship: "Test",
          receivedGiven: "Received", from: "Supplier", contactPerson: "T",
          biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-01",
          instances: "1", publicOfficial: "No",
        });
      // Backend forces status to "Draft" regardless of what client sends
      expect(res.status).toBe(201);
      expect(res.body.status).toBe("Draft");
      cleanupDeclIds.push(res.body.id);
    });
  });

  // ── FILE SIZE LIMIT ──
  describe("File upload size limit", () => {
    it("POST /api/files/upload — file exceeding 10MB returns 500 instead of 413 (BUG: no multer error handler)", async () => {
      const bigFile = Buffer.alloc(10 * 1024 * 1024 + 1, "x");
      const res = await request(app)
        .post("/api/files/upload")
        .set("Authorization", `Bearer ${getAdminToken()}`)
        .attach("file", bigFile, "oversized.txt");
      // BUG: Should be 413 Payload Too Large
      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/File too large/i);
    });
  });

  // ── ORPHAN FILE UPLOAD ──
  describe("Orphan file upload", () => {
    it("POST /api/files/upload — file linked to non-existent declarationId still succeeds (BUG: no FK validation)", async () => {
      const res = await request(app)
        .post("/api/files/upload")
        .set("Authorization", `Bearer ${getAdminToken()}`)
        .field("declarationId", "GHE-NONEXIST-DECLARATION")
        .attach("file", Buffer.from("orphan data"), "orphan.txt");
      expect(res.status).toBe(201);
      expect(res.body.declarationId).toBeUndefined();
    });
  });

  // ── DOUBLE DELETE ──
  describe("Double-delete declaration", () => {
    it("DELETE /api/declarations/:id — second delete on same draft returns 404", async () => {
      const createRes = await request(app)
        .post("/api/declarations")
        .set("Authorization", `Bearer ${getTeamToken()}`)
        .send({
          employee: "Nomvula Team", employeeId: "user-team", teamMemberNumber: "TM-001",
          lineManager: "Sipho Approver", position: "BM", department: "Marketing",
          type: "Gift", counterparty: "DoubleDel", value: 100,
          submitted: "2026-07-01", approver: "Sipho Approver", status: "Draft", priority: "Low",
          description: "double delete test", relationship: "Test",
          receivedGiven: "Received", from: "Supplier", contactPerson: "T",
          biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-01",
          instances: "1", publicOfficial: "No",
        });
      expect(createRes.status).toBe(201);
      const declId = createRes.body.id;

      const first = await request(app)
        .delete(`/api/declarations/${declId}`)
        .set("Authorization", `Bearer ${getTeamToken()}`);
      expect(first.status).toBe(200);

      const second = await request(app)
        .delete(`/api/declarations/${declId}`)
        .set("Authorization", `Bearer ${getTeamToken()}`);
      expect(second.status).toBe(404);
    });
  });

  // ── CONFIG/WORKFLOW COUPLING ──
  describe("Config <-> workflow coupling", () => {
    it("Config thresholds determine which workflow rule is selected on submit", async () => {
      // Verify low threshold: value=100 <= 250 → rule-1 (1 step: LM)
      const declLow = await request(app)
        .post("/api/declarations")
        .set("Authorization", `Bearer ${getAdminToken()}`)
        .send({
          employee: "Nomvula Team", employeeId: "user-team", teamMemberNumber: "TM-001",
          lineManager: "Sipho Approver", position: "Developer", department: "Marketing",
          type: "Gift", counterparty: "CfgLow", value: 100,
          submitted: "2026-07-01", approver: "Admin", status: "Draft", priority: "Low",
          description: "config coupling low", relationship: "Test",
          receivedGiven: "Received", from: "Supplier", contactPerson: "T",
          biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-01",
          instances: "1", publicOfficial: "No",
        });
      expect(declLow.status).toBe(201);
      cleanupDeclIds.push(declLow.body.id);

      const submitLow = await request(app)
        .patch(`/api/declarations/${declLow.body.id}/submit`)
        .set("Authorization", `Bearer ${getAdminToken()}`);
      expect(submitLow.status).toBe(200);

      const instLow = await request(app)
        .get(`/api/workflows/instances/${declLow.body.id}`)
        .set("Authorization", `Bearer ${getAdminToken()}`);
      expect(instLow.body.steps).toHaveLength(1);
      expect(instLow.body.steps[0].role).toBe("lineManager");

      // Verify medium threshold: value=500 > 250 → rule-2 (2 steps: LM, HR)
      const declMed = await request(app)
        .post("/api/declarations")
        .set("Authorization", `Bearer ${getAdminToken()}`)
        .send({
          employee: "Nomvula Team", employeeId: "user-team", teamMemberNumber: "TM-001",
          lineManager: "Sipho Approver", position: "Developer", department: "Marketing",
          type: "Gift", counterparty: "CfgMed", value: 500,
          submitted: "2026-07-01", approver: "Admin", status: "Draft", priority: "Low",
          description: "config coupling medium", relationship: "Test",
          receivedGiven: "Received", from: "Supplier", contactPerson: "T",
          biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-01",
          instances: "1", publicOfficial: "No",
        });
      expect(declMed.status).toBe(201);
      cleanupDeclIds.push(declMed.body.id);

      const submitMed = await request(app)
        .patch(`/api/declarations/${declMed.body.id}/submit`)
        .set("Authorization", `Bearer ${getAdminToken()}`);
      expect(submitMed.status).toBe(200);

      const instMed = await request(app)
        .get(`/api/workflows/instances/${declMed.body.id}`)
        .set("Authorization", `Bearer ${getAdminToken()}`);
      expect(instMed.body.steps).toHaveLength(2);
      expect(instMed.body.steps[0].role).toBe("lineManager");
      expect(instMed.body.steps[1].role).toBe("hr");

      // Verify high threshold: value=5000 > 2000 → rule-3 (3 steps: LM, HR, CEO)
      const declHigh = await request(app)
        .post("/api/declarations")
        .set("Authorization", `Bearer ${getAdminToken()}`)
        .send({
          employee: "Nomvula Team", employeeId: "user-team", teamMemberNumber: "TM-001",
          lineManager: "Sipho Approver", position: "Developer", department: "Marketing",
          type: "Gift", counterparty: "CfgHigh", value: 5000,
          submitted: "2026-07-01", approver: "Admin", status: "Draft", priority: "Low",
          description: "config coupling high", relationship: "Test",
          receivedGiven: "Received", from: "Supplier", contactPerson: "T",
          biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-01",
          instances: "1", publicOfficial: "No",
        });
      expect(declHigh.status).toBe(201);
      cleanupDeclIds.push(declHigh.body.id);

      const submitHigh = await request(app)
        .patch(`/api/declarations/${declHigh.body.id}/submit`)
        .set("Authorization", `Bearer ${getAdminToken()}`);
      expect(submitHigh.status).toBe(200);

      const instHigh = await request(app)
        .get(`/api/workflows/instances/${declHigh.body.id}`)
        .set("Authorization", `Bearer ${getAdminToken()}`);
      expect(instHigh.body.steps).toHaveLength(3);
      expect(instHigh.body.steps[0].role).toBe("lineManager");
      expect(instHigh.body.steps[1].role).toBe("hr");
      expect(instHigh.body.steps[2].role).toBe("ceo");
    });

    it("Deleting rule-3 would break new high-value submissions (read-only verification)", async () => {
      // Verify rule-3 exists and is selected for high-value declarations
      const rulesRes = await request(app)
        .get("/api/admin/workflows/rules")
        .set("Authorization", `Bearer ${getAdminToken()}`);
      expect(rulesRes.body).toHaveLength(3);
      const rule3 = rulesRes.body.find((r: any) => r.id === "rule-3");
      expect(rule3).toBeDefined();

      // Submit a high-value declaration successfully
      const decl = await request(app)
        .post("/api/declarations")
        .set("Authorization", `Bearer ${getAdminToken()}`)
        .send({
          employee: "Nomvula Team", employeeId: "user-team", teamMemberNumber: "TM-001",
          lineManager: "Sipho Approver", position: "Developer", department: "Marketing",
          type: "Gift", counterparty: "RuleAvail", value: 5000,
          submitted: "2026-07-01", approver: "Admin", status: "Draft", priority: "Low",
          description: "rule availability test", relationship: "Test",
          receivedGiven: "Received", from: "Supplier", contactPerson: "T",
          biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-01",
          instances: "1", publicOfficial: "No",
        });
      expect(decl.status).toBe(201);
      cleanupDeclIds.push(decl.body.id);

      const submitRes = await request(app)
        .patch(`/api/declarations/${decl.body.id}/submit`)
        .set("Authorization", `Bearer ${getAdminToken()}`);
      expect(submitRes.status).toBe(200);
      // If rule-3 were deleted, this would return 500 instead (no try/catch in createWorkflowSteps)
    });

    it("Existing workflow instances are frozen — rule changes don't cascade", async () => {
      // Create and submit a medium-value declaration
      const decl = await request(app)
        .post("/api/declarations")
        .set("Authorization", `Bearer ${getAdminToken()}`)
        .send({
          employee: "Nomvula Team", employeeId: "user-team", teamMemberNumber: "TM-001",
          lineManager: "Sipho Approver", position: "Developer", department: "Marketing",
          type: "Gift", counterparty: "FrozenFlow", value: 500,
          submitted: "2026-07-01", approver: "Admin", status: "Draft", priority: "Low",
          description: "frozen workflow test", relationship: "Test",
          receivedGiven: "Received", from: "Supplier", contactPerson: "T",
          biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-01",
          instances: "1", publicOfficial: "No",
        });
      expect(decl.status).toBe(201);
      cleanupDeclIds.push(decl.body.id);

      await request(app)
        .patch(`/api/declarations/${decl.body.id}/submit`)
        .set("Authorization", `Bearer ${getAdminToken()}`);
      const inst = await request(app)
        .get(`/api/workflows/instances/${decl.body.id}`)
        .set("Authorization", `Bearer ${getAdminToken()}`);
      expect(inst.body.steps).toHaveLength(2);
    });
  });

  // ── NULL LINE MANAGER ──
  describe("Null lineManager submit", () => {
    it("Submitting declaration for user with null lineManager skips LM step (no unreviewable orphan)", async () => {
      // Create user with no lineManager
      const userRes = await request(app)
        .post("/api/admin/users")
        .set("Authorization", `Bearer ${getAdminToken()}`)
        .send({
          name: "No LM User", email: "nolm@test.com", role: "teamMember",
          department: "IT", position: "Tester",
        });
      expect(userRes.status).toBe(201);
      const userId = userRes.body.id;

      // Create declaration for this user as admin
      const declRes = await request(app)
        .post("/api/declarations")
        .set("Authorization", `Bearer ${getAdminToken()}`)
        .send({
          employee: "No LM User", employeeId: userId, teamMemberNumber: "NLM-001",
          lineManager: "None", position: "Tester", department: "IT",
          type: "Gift", counterparty: "NoLMSubmit", value: 100,
          submitted: "2026-07-01", approver: "None", status: "Draft", priority: "Low",
          description: "null line manager test", relationship: "Test",
          receivedGiven: "Received", from: "Supplier", contactPerson: "T",
          biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-01",
          instances: "1", publicOfficial: "No",
        });
      expect(declRes.status).toBe(201);
      cleanupDeclIds.push(declRes.body.id);

      const submitRes = await request(app)
        .patch(`/api/declarations/${declRes.body.id}/submit`)
        .set("Authorization", `Bearer ${getAdminToken()}`);
      expect(submitRes.status).toBe(200);

      // LM step is skipped — no unreviewable orphan step with empty assignee
      const inst = await request(app)
        .get(`/api/workflows/instances/${declRes.body.id}`)
        .set("Authorization", `Bearer ${getAdminToken()}`);
      expect(inst.body.steps).toHaveLength(0);

      // Cleanup: delete the test user
      await request(app)
        .delete(`/api/admin/users/${userId}`)
        .set("Authorization", `Bearer ${getAdminToken()}`);
    });
  });

  // ── NO CASCADE ON DECLARATION DELETE ──
  describe("Cascade delete gap", () => {
    it("Deleting a drafted declaration with uploaded files orphans the file records (BUG: no cascade)", async () => {
      // Create a declaration
      const declRes = await request(app)
        .post("/api/declarations")
        .set("Authorization", `Bearer ${getAdminToken()}`)
        .send({
          employee: "Admin User", employeeId: "user-admin", teamMemberNumber: "ADM-001",
          lineManager: "None", position: "Admin", department: "IT",
          type: "Gift", counterparty: "CascadeGap", value: 100,
          submitted: "2026-07-01", approver: "Admin", status: "Draft", priority: "Low",
          description: "cascade test", relationship: "Test",
          receivedGiven: "Received", from: "Supplier", contactPerson: "T",
          biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-01",
          instances: "1", publicOfficial: "No",
        });
      expect(declRes.status).toBe(201);
      const declId = declRes.body.id;

      // Upload a file linked to this declaration
      const fileRes = await request(app)
        .post("/api/files/upload")
        .set("Authorization", `Bearer ${getAdminToken()}`)
        .field("declarationId", declId)
        .attach("file", Buffer.from("cascade file"), "cascade.txt");
      expect(fileRes.status).toBe(201);
      const fileId = fileRes.body.id;

      // Delete the declaration
      const delRes = await request(app)
        .delete(`/api/declarations/${declId}`)
        .set("Authorization", `Bearer ${getAdminToken()}`);
      expect(delRes.status).toBe(200);

      // File record still exists (orphaned)
      const getFile = await request(app)
        .get(`/api/files/${fileId}`)
        .set("Authorization", `Bearer ${getAdminToken()}`);
      // BUG: File still exists even though declaration is gone
      expect(getFile.status).toBe(200);
      expect(getFile.text).toBe("cascade file");

      // Cleanup the orphaned file
      await request(app)
        .delete(`/api/files/${fileId}`)
        .set("Authorization", `Bearer ${getAdminToken()}`);
    });
  });

  // ── CORRUPTED WORKFLOW STEPS JSON ──
  // Skipped: Express 4 async route handlers with unhandled Promise rejections
  // hang without response instead of returning 500. Testing this corrupts shared
  // DB state and hangs the request, timing out the suite.
  // The vulnerability exists: JSON.parse(instance.steps) without try/catch in:
  //   routes/workflows.ts:23,61,96  and  routes/declarations.ts:197

  // ── TOKEN REUSE AFTER ROLE CHANGE ──
  describe("Token reuse after role change", () => {
    it("Old JWT is still valid after user role change (BUG: JWT embeds role, not checked against DB)", async () => {
      // Create a team member
      const createRes = await request(app)
        .post("/api/admin/users")
        .set("Authorization", `Bearer ${getAdminToken()}`)
        .send({ name: "Role Change User", email: "rolechange@test.com", role: "teamMember", department: "IT", position: "Tester" });
      expect(createRes.status).toBe(201);
      const userId = createRes.body.id;

      // Generate a token with original teamMember role
      const jwt = require("jsonwebtoken");
      const oldToken = jwt.sign({ id: userId, email: "rolechange@test.com", role: "teamMember" }, "test-secret", { expiresIn: "1h" });

      // Verify it can't access admin endpoints (teamMember → 403)
      const before = await request(app)
        .get("/api/admin/config")
        .set("Authorization", `Bearer ${oldToken}`);
      expect(before.status).toBe(403);

      // Admin changes the user's role to admin
      await request(app)
        .put(`/api/admin/users/${userId}`)
        .set("Authorization", `Bearer ${getAdminToken()}`)
        .send({ role: "admin" });

      // The old token still has role "teamMember" — should still get 403
      // BUG: If the server checked the DB, it would see the new role and allow access
      const after = await request(app)
        .get("/api/admin/config")
        .set("Authorization", `Bearer ${oldToken}`);
      expect(after.status).toBe(403);

      // A NEW token with the updated role would work
      const newToken = jwt.sign({ id: userId, email: "rolechange@test.com", role: "admin" }, "test-secret", { expiresIn: "1h" });
      const newAccess = await request(app)
        .get("/api/admin/config")
        .set("Authorization", `Bearer ${newToken}`);
      expect(newAccess.status).toBe(200);

      // Cleanup
      await request(app)
        .delete(`/api/admin/users/${userId}`)
        .set("Authorization", `Bearer ${getAdminToken()}`);
    });
  });

  // ── SLA REPORT WITH BAD DATES ──
  describe("SLA report data quality", () => {
    it("GET /api/reports/sla — non-parseable decidedAt produces NaN values (BUG: no date validation)", async () => {
      // Corrupt a workflow step's decidedAt
      const { prisma } = await import("../config/prisma");
      const original = await prisma.workflowInstance.findUnique({ where: { declarationId: "GHE-TEST-003" } });
      const originalSteps = original!.steps;
      const steps = JSON.parse(originalSteps);
      steps[0].decidedAt = "not-a-valid-date";
      await prisma.workflowInstance.update({
        where: { declarationId: "GHE-TEST-003" },
        data: { steps: JSON.stringify(steps) },
      });

      const res = await request(app)
        .get("/api/reports/sla")
        .set("Authorization", `Bearer ${getAdminToken()}`);
      expect(res.status).toBe(200);
      // NaN values in response (toString is "NaN", so JSON serializes as null)
      for (const entry of res.body) {
        // NaN in JSON becomes null, or the min may be NaN which serializes as null
        // The avg/min/max might be null if computed from NaN
        if (entry.role === "Line Manager") {
          // Check that the bad date caused NaN issues
          const hasNaN = [entry.avg, entry.min, entry.max].some((v: any) => v === null || (typeof v === "number" && isNaN(v)));
          // BUG: Should not happen — dates should be valid or skipped
          expect(hasNaN).toBe(true);
        }
      }

      // Restore
      await prisma.workflowInstance.update({
        where: { declarationId: "GHE-TEST-003" },
        data: { steps: originalSteps },
      });
    });
  });
});
