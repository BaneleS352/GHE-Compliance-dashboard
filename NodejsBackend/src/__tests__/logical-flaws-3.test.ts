import { describe, it, expect, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { buildApp, getAdminToken, getApproverToken, getTeamToken, getHrToken } from "./helpers";

const prisma = new PrismaClient();

const app = buildApp();

// Earlier integrity tests intentionally delete users. Re-establish the users
// needed by this file so the suite is order-independent when run as a whole.
beforeEach(async () => {
  const existing = await prisma.user.findUnique({ where: { id: "user-hr" } });
  await prisma.user.upsert({
    where: { id: "user-hr" },
    update: { name: "Lindiwe HR", role: "approver", department: "HR", position: "Head of HR", lineManager: null },
    create: { id: "user-hr", name: "Lindiwe HR", email: "lindiwe@test.com", passwordHash: existing?.passwordHash || "test", role: "approver", teamMemberNumber: "APR-002", department: "HR", position: "Head of HR", lineManager: null },
  });
  await prisma.user.upsert({
    where: { id: "user-approver" },
    update: { name: "Sipho Approver", role: "approver", department: "Marketing", position: "Line Manager", lineManager: null },
    create: { id: "user-approver", name: "Sipho Approver", email: "sipho@test.com", passwordHash: existing?.passwordHash || "test", role: "approver", teamMemberNumber: "APR-001", department: "Marketing", position: "Line Manager", lineManager: null },
  });
  await prisma.workflowRule.upsert({
    where: { id: "rule-2" },
    update: { steps: JSON.stringify([{ order: 1, role: "lineManager", label: "Line Manager Review" }, { order: 2, role: "hr", label: "HR Review" }]) },
    create: { id: "rule-2", name: "High Value", condition: "high", priority: 2, steps: JSON.stringify([{ order: 1, role: "lineManager", label: "Line Manager Review" }, { order: 2, role: "hr", label: "HR Review" }]) },
  });
  await prisma.systemConfig.update({ where: { id: "default" }, data: { highValueThreshold: 1000, mediumValueThreshold: 1000 } });
});

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
  description: "Logical flaw v3 test",
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

// ── ADMIN DASHBOARD ──
describe("Admin dashboard", () => {
  it("GET /api/admin/dashboard — returns KPIs matching seeded data", async () => {
    const res = await request(app)
      .get("/api/admin/dashboard")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("users");
    expect(res.body).toHaveProperty("declarations");
    expect(res.body).toHaveProperty("workflows");
    expect(res.body).toHaveProperty("threshold");
    expect(res.body.users).toBeGreaterThanOrEqual(4);
    expect(res.body.declarations).toBeGreaterThanOrEqual(3);
    expect(res.body.workflows).toBeGreaterThanOrEqual(2);
  });

  it("GET /api/admin/dashboard — non-admin gets 403", async () => {
    const res = await request(app)
      .get("/api/admin/dashboard")
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(res.status).toBe(403);
  });

  it("GET /api/admin/dashboard — KPI count updates after creating a declaration", async () => {
    const before = await request(app)
      .get("/api/admin/dashboard")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    const beforeCount = before.body.declarations;

    await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ ...BASE, counterparty: "DashCountTest" });

    const after = await request(app)
      .get("/api/admin/dashboard")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(after.body.declarations).toBe(beforeCount + 1);
  });
});

// ── ADMIN CONFIG CRUD ──
describe("Admin config CRUD", () => {
  it("GET /api/admin/config — returns current config", async () => {
    const res = await request(app)
      .get("/api/admin/config")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("highValueThreshold");
    expect(res.body).toHaveProperty("mediumValueThreshold");
    expect(res.body).toHaveProperty("slaEscalationDays");
    expect(res.body).toHaveProperty("maxDeclarationsPerCounterparty");
    expect(res.body).toHaveProperty("emailTemplate");
  });

  it("PUT /api/admin/config — full round-trip update and re-read", async () => {
    const orig = await request(app)
      .get("/api/admin/config")
      .set("Authorization", `Bearer ${getAdminToken()}`);

    const put = await request(app)
      .put("/api/admin/config")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({
        highValueThreshold: 9999,
        mediumValueThreshold: 111,
        slaEscalationDays: 7,
        maxDeclarationsPerCounterparty: 10,
        emailTemplate: "RoundTrip {{Name}}",
      });
    expect(put.status).toBe(200);
    expect(put.body.highValueThreshold).toBe(9999);
    expect(put.body.mediumValueThreshold).toBe(111);
    expect(put.body.maxDeclarationsPerCounterparty).toBe(10);

    const reread = await request(app)
      .get("/api/admin/config")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(reread.body.highValueThreshold).toBe(9999);
    expect(reread.body.mediumValueThreshold).toBe(111);

    await request(app)
      .put("/api/admin/config")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send(orig.body);
  });

  it("GET /api/admin/config/dropdowns — returns parsed dropdown data", async () => {
    const res = await request(app)
      .get("/api/admin/config/dropdowns")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("departments");
    expect(res.body).toHaveProperty("categories");
    expect(res.body).toHaveProperty("occasions");
    expect(Array.isArray(res.body.departments)).toBe(true);
    expect(res.body.departments).toContain("Marketing");
  });

  it("PUT /api/admin/config/dropdowns — round-trip update", async () => {
    const put = await request(app)
      .put("/api/admin/config/dropdowns")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({
        departments: ["Engineering", "Finance"],
        categories: ["Gift", "Travel"],
        occasions: ["Conference"],
        receivedGiven: ["Received"],
        biddingProcess: ["Yes"],
        publicOfficial: ["No"],
        relationships: ["Yes"],
        partyTypes: ["Vendor"],
      });
    expect(put.status).toBe(200);
    expect(put.body.departments).toContain("Engineering");

    const reread = await request(app)
      .get("/api/admin/config/dropdowns")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(reread.body.departments).toContain("Engineering");
    expect(reread.body.departments).not.toContain("Marketing");

    await request(app)
      .put("/api/admin/config/dropdowns")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({
        departments: ["Marketing", "IT", "HR"],
        categories: ["Gift", "Hospitality"],
        occasions: ["Business Meeting", "Milestone"],
        receivedGiven: ["Received", "Given"],
        biddingProcess: ["Yes", "No"],
        publicOfficial: ["Yes", "No"],
        relationships: ["Yes", "No"],
        partyTypes: ["Supplier", "Customer"],
      });
  });
});

// ── WORKFLOW RULES — STORED RULES MATCH SUBMISSION STEPS ──
describe("Admin workflow rules correspond to submission steps", () => {
  it("GET /api/admin/workflows/rules — lists all seeded rules with correct steps", async () => {
    const res = await request(app)
      .get("/api/admin/workflows/rules")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    const rule1 = res.body.find((r: any) => r.id === "rule-1");
    const rule2 = res.body.find((r: any) => r.id === "rule-2");
    expect(rule1).toBeDefined();
    expect(rule2).toBeDefined();
    expect(rule1.steps).toHaveLength(1);
    expect(rule2.steps).toHaveLength(2);
  });

  it("Submission with value 100 (rule-1) creates 1 step matching rule-1", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ ...BASE, counterparty: "Rule1Match", value: 100 });
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

  it("Submission with value 500 (rule-1) creates 1 step matching rule-1", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ ...BASE, counterparty: "Rule1Match500", value: 500 });
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
});

// ── APPROVAL NOTES PERSISTENCE ──
describe("Approval notes persistence", () => {
  it("POST /api/workflows/approve — notes field stored and returned", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ ...BASE, counterparty: "NotesTest", value: 100 });
    expect(create.status).toBe(201);
    const id = create.body.id;

    await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);

    const approve = await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getApproverToken()}`)
      .send({ declarationId: id, decision: "return", notes: "Please provide more details on the gift recipient" });
    expect(approve.status).toBe(200);
    expect(approve.body.currentStep.notes).toBe("Please provide more details on the gift recipient");
    expect(approve.body.currentStep.decision).toBe("return");
    expect(approve.body.currentStep).toHaveProperty("decidedAt");

    const inst = await request(app)
      .get(`/api/workflows/instances/${id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    const step = inst.body.steps.find((s: any) => s.status === "returned");
    expect(step.notes).toBe("Please provide more details on the gift recipient");
  });

  it("POST /api/workflows/approve — notes defaults to empty string when omitted", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ ...BASE, counterparty: "NotesOmit", value: 100 });
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
    expect(approve.body.currentStep.notes).toBe("");
  });
});

// ── DECLARATION STATS ACCURACY ──
describe("Declaration stats accuracy", () => {
  it("GET /api/declarations/stats — KPIs match seeded declarations", async () => {
    const res = await request(app)
      .get("/api/declarations/stats")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("kpis");
    expect(res.body.kpis).toHaveProperty("total");
    expect(res.body.kpis).toHaveProperty("pending");
    expect(res.body.kpis).toHaveProperty("approved");
    expect(res.body.kpis).toHaveProperty("totalValue");
    expect(res.body).toHaveProperty("complianceTrend");
    expect(res.body).toHaveProperty("typeBreakdown");
    expect(Array.isArray(res.body.complianceTrend)).toBe(true);
    expect(Array.isArray(res.body.typeBreakdown)).toBe(true);
  });

  it("GET /api/declarations/stats — KPIs update after creating and submitting", async () => {
    const before = await request(app)
      .get("/api/declarations/stats")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    const beforeTotal = before.body.kpis.total;

    await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ ...BASE, counterparty: "StatsUpdateTest" });

    const after = await request(app)
      .get("/api/declarations/stats")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(after.body.kpis.total).toBe(beforeTotal + 1);
  });
});

// ── FROM FIELD ROUND-TRIP ──
describe("From field api consistency", () => {
  it("Declaration create and GET use from not fromField", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ ...BASE, counterparty: "FromRoundTrip", from: "Customer" });
    expect(create.status).toBe(201);
    expect(create.body.from).toBe("Customer");
    expect(create.body).not.toHaveProperty("fromField");

    const get = await request(app)
      .get(`/api/declarations/${create.body.id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(get.body.from).toBe("Customer");
    expect(get.body).not.toHaveProperty("fromField");
  });

  it("Declaration PUT updates from field", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ ...BASE, counterparty: "FromPUT", from: "Supplier" });
    expect(create.status).toBe(201);
    const id = create.body.id;

    const edit = await request(app)
      .put(`/api/declarations/${id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ from: "Customer" });
    expect(edit.status).toBe(200);
    expect(edit.body.from).toBe("Customer");
    expect(edit.body).not.toHaveProperty("fromField");
  });
});

// ── PUT IGNORES NON-WHITELISTED FIELDS ──
describe("PUT ignores non-whitelisted fields", () => {
  it("PUT /api/declarations/:id — cannot change status via PUT (field whitelist)", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ ...BASE, counterparty: "MassAssignStatus", value: 100 });
    expect(create.status).toBe(201);
    const id = create.body.id;
    expect(create.body.status).toBe("Draft");

    const edit = await request(app)
      .put(`/api/declarations/${id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ status: "Approved", description: "status should not change" });
    expect(edit.status).toBe(200);
    expect(edit.body.status).toBe("Draft");
    expect(edit.body.description).toBe("status should not change");
  });

  it("PUT /api/declarations/:id — cannot change employeeId via PUT (not in fieldMap)", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ ...BASE, counterparty: "MassAssignEmpId", value: 100 });
    expect(create.status).toBe(201);
    const id = create.body.id;

    const edit = await request(app)
      .put(`/api/declarations/${id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ employeeId: "user-admin" });
    expect(edit.status).toBe(200);
    expect(edit.body.employeeId).toBe("user-team");
  });
});

// ── DECLARATION WITH NULL OPTIONAL FIELDS ──
describe("Declaration with null optional fields", () => {
  it("POST /api/declarations — missing optional fields stored as null", async () => {
    const minimal = {
      employee: "Nomvula Team",
      employeeId: "user-team",
      teamMemberNumber: "TM-001",
      lineManager: "Sipho Approver",
      position: "Brand Manager",
      department: "Marketing",
      type: "Gift",
      counterparty: "MinimalTest",
      value: 100,
      submitted: "2026-07-05",
      status: "Draft",
      priority: "Medium",
      description: "Minimal test",
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
    const res = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send(minimal);
    expect(res.status).toBe(201);
    expect(res.body.company).toBeNull();
    expect(res.body.team).toBeNull();
    expect(res.body.contractNegotiation).toBeNull();
    expect(res.body.substantiation).toBeNull();
  });
});

// ── APPROVER FIELD TRACKING THROUGH WORKFLOW ──
describe("Approver field tracking through workflow", () => {
  it("Submit sets approver to first pending step assignee name, approval updates it", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ ...BASE, counterparty: "ApproverTrack", value: 1500 });
    expect(create.status).toBe(201);
    const id = create.body.id;

    await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getAdminToken()}`);

    let decl = await request(app)
      .get(`/api/declarations/${id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(decl.body.approver).toBe("Sipho Approver");

    await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getApproverToken()}`)
      .send({ declarationId: id, decision: "accept" });

    decl = await request(app)
      .get(`/api/declarations/${id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(decl.body.approver).toBe("Lindiwe HR");
  });
});

// ── VALUE = 0 USES RULE-1 ──
describe("Value boundary — zero", () => {
  it("Declaration with value = 0 creates 1 step (rule-1)", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ ...BASE, counterparty: "ZeroValue2", value: 0 });
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
});

// ── DUPLICATE SUBMIT BLOCKED ──
describe("Duplicate submit blocked", () => {
  it("PATCH /api/declarations/:id/submit — submitting an already Pending declaration returns 400", async () => {
    const res = await request(app)
      .patch("/api/declarations/GHE-TEST-001/submit")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(400);
  });
});

// ── SUBMIT WITH NULL LINE MANAGER ──
describe("Submit with null lineManager", () => {
  it("User with null lineManager — LM step skipped, next step becomes first", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ ...BASE, employeeId: "user-admin", counterparty: "NullLM", value: 1500 });
    expect(create.status).toBe(201);
    const id = create.body.id;

    await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getAdminToken()}`);

    const inst = await request(app)
      .get(`/api/workflows/instances/${id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    // LM step is skipped (null lineManager) but recorded as "skipped"
    expect(inst.body.steps).toHaveLength(2);
    expect(inst.body.steps[0].status).toBe("skipped");
    expect(inst.body.steps[0].role).toBe("lineManager");
    expect(inst.body.steps[1].role).toBe("hr");
    expect(inst.body.steps[1].assignee).toBe("user-hr");
  });
});

// ── DELETE WORKFLOW RULE THAT IS IN USE ──
describe("Delete workflow rule in use", () => {
  afterAll(async () => {
    await prisma.workflowRule.upsert({
      where: { id: "rule-1" },
      update: { name: "Low Value", condition: "low", priority: 1, steps: JSON.stringify([{ order: 1, role: "lineManager", label: "Line Manager Review" }]) },
      create: { id: "rule-1", name: "Low Value", condition: "low", priority: 1, steps: JSON.stringify([{ order: 1, role: "lineManager", label: "Line Manager Review" }]) },
    });
    await prisma.$disconnect();
  });

  it("DELETE /api/admin/workflows/rules/:id — deleting a rule breaks new submissions relying on it", async () => {
    const del = await request(app)
      .delete("/api/admin/workflows/rules/rule-1")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(del.status).toBe(200);

    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ ...BASE, counterparty: "NoRuleTest", value: 100 });
    expect(create.status).toBe(201);
    const id = create.body.id;

    const submit = await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(submit.status).toBe(500);
  });
});

// ── CORS HEADERS ──
describe("CORS headers", () => {
  it("OPTIONS request returns Access-Control-Allow-Origin", async () => {
    const res = await request(app)
      .options("/api/health")
      .set("Origin", "http://example.com");
    expect(res.headers["access-control-allow-origin"]).toBe("*");
  });

  it("GET request includes CORS headers", async () => {
    const res = await request(app)
      .get("/api/health")
      .set("Origin", "http://example.com");
    expect(res.headers["access-control-allow-origin"]).toBe("*");
  });
});

// ── NON-EXISTENT ROUTES ──
describe("Non-existent routes", () => {
  it("GET on unknown route returns 404 with error message", async () => {
    const res = await request(app)
      .get("/api/nonexistent-route-xyz")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Not found");
  });

  it("POST on declaration collection with no body returns 400", async () => {
    const res = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({});
    expect(res.status).toBe(400);
  });
});

// ── DECLARATION LIST STATUS FILTER ──
describe("Declaration list status filter", () => {
  it("GET /api/declarations?status=Pending — returns only pending", async () => {
    const res = await request(app)
      .get("/api/declarations?status=Pending")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    res.body.forEach((d: any) => {
      expect(d.status).toBe("Pending");
    });
  });

  it("GET /api/declarations?status=Approved — returns only approved", async () => {
    const res = await request(app)
      .get("/api/declarations?status=Approved")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    res.body.forEach((d: any) => {
      expect(d.status).toBe("Approved");
    });
  });
});

// ── ADMIN STATUS PATCH ──
describe("Admin status patch", () => {
  it("PATCH /api/declarations/:id/status — admin can set status to any valid value", async () => {
    const res = await request(app)
      .patch("/api/declarations/GHE-TEST-003/status")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ status: "Pending" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Pending");

    const restore = await request(app)
      .patch("/api/declarations/GHE-TEST-003/status")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ status: "Approved" });
    expect(restore.status).toBe(200);
    expect(restore.body.status).toBe("Approved");
  });

  it("PATCH /api/declarations/:id/status — admin can set to Declined", async () => {
    const res = await request(app)
      .patch("/api/declarations/GHE-TEST-003/status")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ status: "Declined" });
    expect(res.status).toBe(200);

    const restore = await request(app)
      .patch("/api/declarations/GHE-TEST-003/status")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ status: "Approved" });
    expect(restore.status).toBe(200);
  });
});

// ── MULTIPLE FILE UPLOADS ──
describe("Multiple file uploads to same declaration", () => {
  it("Upload two files to a declaration, both accessible", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ ...BASE, counterparty: "MultiFiles", value: 100 });
    expect(create.status).toBe(201);
    const id = create.body.id;

    const f1 = await request(app)
      .post("/api/files/upload")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .field("declarationId", id)
      .attach("file", Buffer.from("file one"), "multi1.txt");
    expect(f1.status).toBe(201);

    const f2 = await request(app)
      .post("/api/files/upload")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .field("declarationId", id)
      .attach("file", Buffer.from("file two"), "multi2.txt");
    expect(f2.status).toBe(201);

    const d1 = await request(app)
      .get(`/api/files/${f1.body.id}`)
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(d1.status).toBe(200);

    const d2 = await request(app)
      .get(`/api/files/${f2.body.id}`)
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(d2.status).toBe(200);
  });
});

// ── UPLOAD FILE WITH NON-OWNED DECLARATION ──
describe("Upload file with non-owned declarationId", () => {
  it("Team member cannot upload file to another user's declaration", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ ...BASE, employeeId: "user-approver", counterparty: "OtherFileTest" });
    expect(create.status).toBe(201);
    const id = create.body.id;

    const upload = await request(app)
      .post("/api/files/upload")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .field("declarationId", id)
      .attach("file", Buffer.from("other"), "other.txt");
    expect(upload.status).toBe(403);
  });
});

// ── COUNTERPARTY WITH SPECIAL CHARACTERS ──
describe("Counterparty with special characters", () => {
  it("Counterparty with unicode characters stored and returned correctly", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ ...BASE, counterparty: "Café Zürich 日本" });
    expect(create.status).toBe(201);
    expect(create.body.counterparty).toBe("Café Zürich 日本");
  });

  it("Counterparty with very long string (500 chars) accepted", async () => {
    const long = "x".repeat(500);
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ ...BASE, counterparty: long });
    expect(create.status).toBe(201);
    expect(create.body.counterparty).toBe(long);
  });
});

afterAll(async () => {
  await prisma.systemConfig.upsert({
    where: { id: "default" },
    update: { highValueThreshold: 1000, mediumValueThreshold: 1000, slaEscalationDays: 3, maxDeclarationsPerCounterparty: 5, emailTemplate: "Test {{ApproverName}}", notificationTemplates: "{}" },
    create: { id: "default", highValueThreshold: 1000, mediumValueThreshold: 1000, slaEscalationDays: 3, maxDeclarationsPerCounterparty: 5, emailTemplate: "Test {{ApproverName}}", notificationTemplates: "{}" },
  });
  await prisma.workflowRule.upsert({
    where: { id: "rule-1" },
    update: { name: "Low Value", condition: "low", priority: 1, steps: JSON.stringify([{ order: 1, role: "lineManager", label: "Line Manager Review" }]) },
    create: { id: "rule-1", name: "Low Value", condition: "low", priority: 1, steps: JSON.stringify([{ order: 1, role: "lineManager", label: "Line Manager Review" }]) },
  });
  await prisma.$disconnect();
});
