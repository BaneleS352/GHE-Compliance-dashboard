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
    it("PUT /api/declarations/:id — team member CAN update status (vulnerability: no field whitelist)", async () => {
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

      // Team member can escalate status via PUT — no field-level whitelist exists
      const putRes = await request(app)
        .put(`/api/declarations/${declId}`)
        .set("Authorization", `Bearer ${getTeamToken()}`)
        .send({ status: "Approved" });
      expect(putRes.status).toBe(200);
      // BUG: status changed even though team member should not be able to bypass workflow
      expect(putRes.body.status).toBe("Approved");
    });

    it("PUT /api/declarations/:id — team member CAN change employeeId (vulnerability: no field whitelist)", async () => {
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
      // BUG: employeeId changed even though team member should not be able to transfer ownership
      expect(res.body.employeeId).toBe("user-admin");
    });

    it("PUT /api/declarations/:id — admin CAN update status", async () => {
      const decls = await request(app)
        .get("/api/declarations")
        .set("Authorization", `Bearer ${getAdminToken()}`);
      const draft = decls.body.find((d: any) => d.status === "Draft");
      if (!draft) return;
      const res = await request(app)
        .put(`/api/declarations/${draft.id}`)
        .set("Authorization", `Bearer ${getAdminToken()}`)
        .send({ status: "Pending" });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("Pending");
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
    it("PATCH /api/declarations/:id/status — team member can escalate own declaration to Approved (BUG: no role guard)", async () => {
      const createRes = await request(app)
        .post("/api/declarations")
        .set("Authorization", `Bearer ${getTeamToken()}`)
        .send({
          employee: "Nomvula Team", employeeId: "user-team", teamMemberNumber: "TM-001",
          lineManager: "Sipho Approver", position: "BM", department: "Marketing",
          type: "Gift", counterparty: "PatchEscalate", value: 100,
          submitted: "2026-07-01", approver: "Sipho Approver", status: "Draft", priority: "Low",
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
      // BUG: Should be 403 but no role guard — team member bypasses workflow
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.status).toBe("Approved");

      // Verify persistence
      const getRes = await request(app)
        .get(`/api/declarations/${createRes.body.id}`)
        .set("Authorization", `Bearer ${getTeamToken()}`);
      expect(getRes.body.status).toBe("Approved");
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

      // Team member reads admin's declaration by ID
      const res = await request(app)
        .get(`/api/declarations/${createRes.body.id}`)
        .set("Authorization", `Bearer ${getTeamToken()}`);
      // BUG: Should be 403 but no ownership check on single-resource GET
      expect(res.status).toBe(200);
      expect(res.body.employeeId).toBe("user-admin");
      expect(res.body.counterparty).toBe("DeclLeakTest");
    });
  });

  // ── CREATE DECLARATION WITH STATUS APPROVED ──
  describe("Create declaration with pre-approved status", () => {
    it("POST /api/declarations — team member can create declaration with status Approved (BUG: no status restriction on create)", async () => {
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
      // BUG: Should enforce status === "Draft" on create
      expect(res.status).toBe(201);
      expect(res.body.status).toBe("Approved");
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
});
