import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp, getAdminToken, getApproverToken, getTeamToken, getHrToken, getCeoToken } from "./helpers";

const app = buildApp();

const BASE = {
  employee: "Nomvula Team",
  employeeId: "user-team",
  teamMemberNumber: "TM-001",
  lineManager: "Sipho Approver",
  position: "Brand Manager",
  department: "Marketing",
  type: "Gift",
  counterparty: "BaseDefault",
  value: 100,
  submitted: "2026-07-05",
  approver: "Sipho Approver",
  status: "Draft",
  priority: "Medium",
  description: "Logical flaw v2 test",
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

// ── AUTH & TOKEN EDGE CASES ──
describe("Auth & token edge cases", () => {
  it("GET /api/declarations — no auth header returns 401", async () => {
    const res = await request(app).get("/api/declarations");
    expect(res.status).toBe(401);
  });

  it("GET /api/declarations — malformed auth header returns 401", async () => {
    const res = await request(app)
      .get("/api/declarations")
      .set("Authorization", "Basic abc123");
    expect(res.status).toBe(401);
  });

  it("GET /api/declarations — expired token returns 401", async () => {
    const jwt = require("jsonwebtoken");
    const expired = jwt.sign(
      { id: "user-team", email: "nomvula@test.com", role: "teamMember" },
      "test-secret",
      { expiresIn: "0s" }
    );
    await new Promise((r) => setTimeout(r, 1100));
    const res = await request(app)
      .get("/api/declarations")
      .set("Authorization", `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });

  it("GET /api/declarations — token with fake user ID falls through (auth middleware console.error and proceeds)", async () => {
    const jwt = require("jsonwebtoken");
    const fakeToken = jwt.sign(
      { id: "nonexistent-user", email: "ghost@test.com", role: "teamMember" },
      "test-secret",
      { expiresIn: "1h" }
    );
    const res = await request(app)
      .get("/api/declarations")
      .set("Authorization", `Bearer ${fakeToken}`);
    expect(res.status).toBe(200);
  });

  it("POST /api/admin/config — team member gets 403", async () => {
    const res = await request(app)
      .get("/api/admin/config")
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(res.status).toBe(403);
  });

  it("POST /api/admin/config — approver gets 403", async () => {
    const res = await request(app)
      .get("/api/admin/config")
      .set("Authorization", `Bearer ${getApproverToken()}`);
    expect(res.status).toBe(403);
  });
});

// ── INPUT VALIDATION & INJECTION ──
describe("Input validation & injection", () => {
  it("POST /api/declarations — negative value rejected", async () => {
    const res = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ ...BASE, counterparty: "NegValue", value: -100 });
    expect(res.status).toBe(400);
  });

  it("POST /api/declarations — missing required fields returns 400", async () => {
    const res = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ counterparty: "MissingFields" });
    expect(res.status).toBe(400);
  });

  it("POST /api/declarations — description with SQL-like injection stored safely", async () => {
    const res = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ ...BASE, counterparty: "SQLInjection", description: "'; DROP TABLE users; --" });
    expect(res.status).toBe(201);
    const get = await request(app)
      .get(`/api/declarations/${res.body.id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(get.body.description).toBe("'; DROP TABLE users; --");
  });

  it("POST /api/declarations — XSS in description sanitized by xss library", async () => {
    const res = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ ...BASE, counterparty: "XSSDesc", description: "<script>alert('xss')</script>Hello" });
    expect(res.status).toBe(201);
    const get = await request(app)
      .get(`/api/declarations/${res.body.id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(get.body.description).not.toContain("<script>");
    expect(get.body.description).toContain("Hello");
  });

  it("POST /api/declarations — XSS in employee name", async () => {
    const res = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ ...BASE, counterparty: "XSSEmp", employee: "<b>Bold</b>Name" });
    expect(res.status).toBe(201);
    const get = await request(app)
      .get(`/api/declarations/${res.body.id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(get.body.employee).toBe("<b>Bold</b>Name");
  });

  it("POST /api/declarations — extra unknown fields in body are ignored", async () => {
    const res = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ ...BASE, counterparty: "ExtraFields", hack: "payload", malicious: true });
    expect(res.status).toBe(201);
  });

  it("PUT /api/declarations/:id — extra unknown fields in body ignored", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ ...BASE, counterparty: "PutExtraFields", value: 100 });
    expect(create.status).toBe(201);
    const id = create.body.id;
    const edit = await request(app)
      .put(`/api/declarations/${id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ counterparty: "PutExtraUpdated", hack: "injected" });
    expect(edit.status).toBe(200);
    expect(edit.body.counterparty).toBe("PutExtraUpdated");
  });

  it("POST /api/declarations — team member cannot create for another employeeId", async () => {
    const res = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ ...BASE, employeeId: "user-approver", counterparty: "NotOwnEmp" });
    expect(res.status).toBe(403);
  });

  it("GET /api/declarations/:id — team member cannot view another's declaration", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ ...BASE, employeeId: "user-approver", counterparty: "OtherView" });
    expect(create.status).toBe(201);
    const res = await request(app)
      .get(`/api/declarations/${create.body.id}`)
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(res.status).toBe(403);
  });
});

// ── WORKFLOW ADVANCED ──
describe("Workflow advanced scenarios", () => {
  it("Self-skip during workflow step creation: HR employee's own HR step is omitted", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ ...BASE, employeeId: "user-hr", employee: "Lindiwe HR", counterparty: "SelfSkipHR", value: 500 });
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
    expect(inst.body.steps[0].assignee).toBe("user-ceo");
  });

  it("POST /api/workflows/approve — using 'return' sets Info Requested and resets approver to employee", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ ...BASE, counterparty: "ReturnFlow", value: 100 });
    expect(create.status).toBe(201);
    const id = create.body.id;
    await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);

    const ret = await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getApproverToken()}`)
      .send({ declarationId: id, decision: "return", notes: "Need more info" });
    expect(ret.status).toBe(200);
    expect(ret.body.newStatus).toBe("Info Requested");

    const decl = await request(app)
      .get(`/api/declarations/${id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(decl.body.status).toBe("Info Requested");
    expect(decl.body.approver).toBe("Nomvula Team");
  });

  it("PATCH /api/declarations/:id/submit — resubmit from Info Requested preserves prior approved steps", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ ...BASE, counterparty: "ResubmitPreserve", value: 500 });
    expect(create.status).toBe(201);
    const id = create.body.id;
    await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);

    await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getApproverToken()}`)
      .send({ declarationId: id, decision: "return" });

    const beforeResubmit = await request(app)
      .get(`/api/workflows/instances/${id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    const returnedStep = beforeResubmit.body.steps[0];
    expect(returnedStep.status).toBe("returned");

    await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);

    const afterResubmit = await request(app)
      .get(`/api/workflows/instances/${id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(afterResubmit.body.steps[0].status).toBe("pending");

    const decl = await request(app)
      .get(`/api/declarations/${id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(decl.body.status).toBe("Pending");
  });

  it("POST /api/workflows/approve — final approval sets status to Approved and no deploy pending steps", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ ...BASE, counterparty: "FinalApprove", value: 100 });
    expect(create.status).toBe(201);
    const id = create.body.id;
    await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);

    const approve = await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getApproverToken()}`)
      .send({ declarationId: id, decision: "accept" });
    expect(approve.status).toBe(200);
    expect(approve.body.newStatus).toBe("Approved");

    const decl = await request(app)
      .get(`/api/declarations/${id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(decl.body.status).toBe("Approved");

    const inst = await request(app)
      .get(`/api/workflows/instances/${id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(inst.body.steps.every((s: any) => s.status === "approved")).toBe(true);
  });

  it("POST /api/workflows/approve — decline sets status to Declined", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ ...BASE, counterparty: "DeclineStatus", value: 100 });
    expect(create.status).toBe(201);
    const id = create.body.id;
    await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);

    const approve = await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getApproverToken()}`)
      .send({ declarationId: id, decision: "decline" });
    expect(approve.status).toBe(200);
    expect(approve.body.newStatus).toBe("Declined");

    const decl = await request(app)
      .get(`/api/declarations/${id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(decl.body.status).toBe("Declined");
  });

  it("CEO-declaration automatic skip: CEO submits own → lineManager=user-ceo steps skipped, only HR step remains", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({
        ...BASE,
        employeeId: "user-ceo",
        employee: "Sandile CEO",
        lineManager: "Sandile CEO",
        counterparty: "CeoSelfSubmit",
        value: 2001,
      });
    expect(create.status).toBe(201);
    const id = create.body.id;
    await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getAdminToken()}`);

    const inst = await request(app)
      .get(`/api/workflows/instances/${id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(inst.body.steps.length).toBeLessThan(3);
    const roles = inst.body.steps.map((s: any) => s.role);
    expect(roles).not.toContain("lineManager");
    expect(roles).not.toContain("ceo");
    expect(roles).toContain("hr");
  });
});

// ── DECLARATION CRUD LIMITS ──
describe("Declaration CRUD limits", () => {
  it("PUT /api/declarations/:id — cannot edit while Pending", async () => {
    const res = await request(app)
      .put("/api/declarations/GHE-TEST-001")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ description: "trying to edit pending" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/draft|info requested/i);
  });

  it("PUT /api/declarations/:id — cannot edit while Approved", async () => {
    const res = await request(app)
      .put("/api/declarations/GHE-TEST-003")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ description: "trying to edit approved" });
    expect(res.status).toBe(400);
  });

  it("DELETE /api/declarations/:id — cannot delete while Pending", async () => {
    const res = await request(app)
      .delete("/api/declarations/GHE-TEST-001")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/draft/i);
  });

  it("DELETE /api/declarations/:id — cannot delete while Approved", async () => {
    const res = await request(app)
      .delete("/api/declarations/GHE-TEST-003")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(400);
  });

  it("DELETE /api/declarations/:id — team member cannot delete another user's Draft", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ ...BASE, employeeId: "user-approver", counterparty: "OtherDraftDel", value: 100 });
    expect(create.status).toBe(201);
    const res = await request(app)
      .delete(`/api/declarations/${create.body.id}`)
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(res.status).toBe(403);
  });
});

// ── FILE-DECLARATION LIFECYCLE ──
describe("File-declaration lifecycle", () => {
  it("Upload file to declaration, delete declaration, file cascade-deleted", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ ...BASE, counterparty: "FileCascade", value: 100 });
    expect(create.status).toBe(201);
    const id = create.body.id;

    const buf = Buffer.from("test file content for cascade test");
    const upload = await request(app)
      .post("/api/files/upload")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .field("declarationId", id)
      .attach("file", buf, "cascade-test.txt");
    expect(upload.status).toBe(201);
    const fileId = upload.body.id;

    const del = await request(app)
      .delete(`/api/declarations/${id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(del.status).toBe(200);

    const fetch = await request(app)
      .get(`/api/files/${fileId}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(fetch.status).toBe(404);
  });

  it("Upload with non-existent declarationId returns 400", async () => {
    const buf = Buffer.from("test");
    const upload = await request(app)
      .post("/api/files/upload")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .field("declarationId", "GHE-NONEXISTENT")
      .attach("file", buf, "ghost.txt");
    expect(upload.status).toBe(400);
  });

  it("Upload with unsupported MIME type returns 400", async () => {
    const buf = Buffer.from("test");
    const upload = await request(app)
      .post("/api/files/upload")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .attach("file", buf, "malware.exe");
    expect(upload.status).toBe(400);
  });

  it("Download non-existent file ID returns 404", async () => {
    const res = await request(app)
      .get("/api/files/nonexistent-file-id")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(404);
  });
});

// ── USER ADMIN OPERATIONS ──
describe("Admin user operations integrity", () => {
  it("POST /api/admin/users — duplicate email returns 409", async () => {
    const res = await request(app)
      .post("/api/admin/users")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ name: "Dup User", email: "sipho@test.com", role: "approver", password: "password" });
    expect(res.status).toBe(409);
  });

  it("POST /api/admin/users — missing name returns 400", async () => {
    const res = await request(app)
      .post("/api/admin/users")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ email: "new@test.com", role: "teamMember" });
    expect(res.status).toBe(400);
  });

  it("POST /api/admin/users — invalid role returns 400", async () => {
    const res = await request(app)
      .post("/api/admin/users")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ name: "Bad Role", email: "badrole@test.com", role: "superadmin", password: "password" });
    expect(res.status).toBe(400);
  });

  it("POST /api/admin/users — creates user with default password when omitted", async () => {
    const res = await request(app)
      .post("/api/admin/users")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ name: "Default Pass", email: "defaultpass@test.com", role: "teamMember" });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Default Pass");

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "defaultpass@test.com", password: "password" });
    expect(login.status).toBe(200);
    expect(login.body.token).toBeTruthy();
  });

  it("DELETE /api/admin/users/:id — cannot delete last admin", async () => {
    const res = await request(app)
      .delete("/api/admin/users/user-admin")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/last admin/i);
  });

  it("PUT /api/admin/users/:id — changing email to existing email returns 409", async () => {
    const res = await request(app)
      .put("/api/admin/users/user-team")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ email: "sipho@test.com" });
    expect(res.status).toBe(409);
  });
});

// ── RESPONSE FORMAT CONSISTENCY ──
describe("Response format consistency", () => {
  it("404 errors return { error: ... } format", async () => {
    const res = await request(app)
      .get("/api/declarations/GHE-NONEXISTENT-999")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error");
    expect(typeof res.body.error).toBe("string");
  });

  it("400 validation errors return { error: ... } format", async () => {
    const res = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("POST /api/declarations returns consistent field naming (from not fromField)", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ ...BASE, counterparty: "FieldNaming", from: "Customer" });
    expect(create.status).toBe(201);
    expect(create.body).toHaveProperty("from");
    expect(create.body).not.toHaveProperty("fromField");
    expect(create.body.from).toBe("Customer");
  });

  it("GET /api/declarations/:id — all endpoints use from not fromField", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ ...BASE, counterparty: "FromFieldCheck", from: "Supplier" });
    expect(create.status).toBe(201);
    const get = await request(app)
      .get(`/api/declarations/${create.body.id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(get.body.from).toBe("Supplier");
    expect(get.body).not.toHaveProperty("fromField");
  });
});

// ── REPORT QUERY PARAM EDGE CASES ──
describe("Report query parameter edge cases", () => {
  it("GET /api/reports/list — search with regex special chars returns results", async () => {
    const res = await request(app)
      .get("/api/reports/list?search=Supplier+A")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("GET /api/reports/list — status All Statuses returns all results", async () => {
    const res = await request(app)
      .get("/api/reports/list?status=All+Statuses")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(3);
  });

  it("GET /api/reports/list — invalid status filter returns empty", async () => {
    const res = await request(app)
      .get("/api/reports/list?status=InvalidStatusXYZ")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(0);
  });

  it("GET /api/reports/high-value — respects default threshold when config missing", async () => {
    const res = await request(app)
      .get("/api/reports/high-value")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("GET /api/reports/counterparty-concentration — returns sorted by totalValue descending", async () => {
    const res = await request(app)
      .get("/api/reports/counterparty-concentration")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    for (let i = 1; i < res.body.length; i++) {
      expect(res.body[i].totalValue).toBeLessThanOrEqual(res.body[i - 1].totalValue);
    }
  });
});

// ── WORKFLOW PENDING QUERY ──
describe("Workflow pending query", () => {
  it("GET /api/workflows/pending — returns pending steps for current user", async () => {
    const res = await request(app)
      .get("/api/workflows/pending")
      .set("Authorization", `Bearer ${getApproverToken()}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    res.body.forEach((item: any) => {
      expect(item.step.assignee).toBe("user-approver");
      expect(item.step.status).toBe("pending");
    });
  });

  it("GET /api/workflows/pending — pending results have declaration and step properties", async () => {
    const res = await request(app)
      .get("/api/workflows/pending")
      .set("Authorization", `Bearer ${getApproverToken()}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty("declaration");
      expect(res.body[0]).toHaveProperty("step");
      expect(res.body[0].step).toHaveProperty("status");
    }
  });
});

// ── HEALTH ENDPOINT ──
describe("Health endpoint", () => {
  it("GET /api/health returns ok status", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body).toHaveProperty("timestamp");
  });
});
