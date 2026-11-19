import { afterAll, describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp, getAdminToken, getTeamToken } from "./helpers";
import { prisma } from "../config/prisma";
import { lockDeclarationRow } from "../services/normalization";

const app = buildApp();
const concurrencyDeclarationIds: string[] = [];

interface DeclarationListResponse {
  id: string;
  employee: string;
  employeeId: number;
  status: string;
}

interface DeclarationAuditResponse {
  action: string;
}

afterAll(async () => {
  for (const id of concurrencyDeclarationIds) {
    const declaration = await prisma.declaration.findUnique({ where: { id }, select: { status: true } });
    if (!declaration) continue;
    // Audit events intentionally have no declaration FK and cannot be
    // deleted. Return the race-test row to the owner's deletable draft state,
    // then use the API so cleanup appends the normal deletion event.
    if (declaration.status !== "Draft") {
      await prisma.declaration.update({ where: { id }, data: { status: "Draft" } });
    }
    const deleted = await request(app)
      .delete(`/api/declarations/${id}`)
      .set("Authorization", `Bearer ${getTeamToken()}`);
    if (deleted.status !== 200 && deleted.status !== 404) {
      throw new Error(`Concurrency declaration cleanup failed: ${deleted.status}`);
    }
  }
});

async function createConcurrencyDraft(name: string): Promise<string> {
  const created = await request(app)
    .post("/api/declarations")
    .set("Authorization", `Bearer ${getTeamToken()}`)
    .send({
      employee: "Nomvula Team", employeeId: 4, teamMemberNumber: "TM-001",
      lineManager: "Sipho Approver", position: "Brand Manager", department: "Marketing",
      type: "Gift", counterparty: name, value: 50, submitted: "2026-07-05",
      approver: "Sipho Approver", priority: "Low", description: "Original", relationship: "Test",
      receivedGiven: "Received", from: "Supplier", contactPerson: "T", biddingProcess: "No",
      occasion: "Business Meeting", date: "2026-07-05", instances: "1", publicOfficial: "No",
    });
  if (created.status !== 201) throw new Error(`Concurrency fixture creation failed: ${created.status}`);
  concurrencyDeclarationIds.push(created.body.id);
  return created.body.id as string;
}

async function waitUntilBlockedBy(pid: number): Promise<boolean> {
  const deadline = Date.now() + 3_000;
  while (Date.now() < deadline) {
    const blocked = await prisma.$queryRaw<Array<{ pid: number }>>`
      SELECT activity.pid
      FROM pg_stat_activity AS activity
      WHERE activity.pid <> pg_backend_pid()
        AND ${pid} = ANY(pg_blocking_pids(activity.pid))
    `;
    if (blocked.length > 0) return true;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return false;
}

describe("Declarations", () => {
  it("GET /api/declarations/stats — returns KPIs", async () => {
    const res = await request(app)
      .get("/api/declarations/stats")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.kpis).toBeDefined();
    expect(res.body.kpis.total).toBeGreaterThanOrEqual(3);
    expect(res.body.kpis.pending).toBeGreaterThanOrEqual(1);
    expect(res.body.kpis.approved).toBeGreaterThanOrEqual(1);
    // Live view-backed shapes (row counts vary with test execution order).
    expect(Array.isArray(res.body.complianceTrend)).toBe(true);
    expect(res.body.complianceTrend.length).toBeGreaterThan(0);
    for (const t of res.body.complianceTrend) {
      expect(t.month).toMatch(/^\d{4}-\d{2}$/);
      expect(typeof t.approved).toBe("number");
      expect(typeof t.declined).toBe("number");
    }
    expect(Array.isArray(res.body.typeBreakdown)).toBe(true);
    expect(res.body.typeBreakdown.length).toBeGreaterThan(0);
    const typeTotal = (res.body.typeBreakdown as Array<{ value: number }>).reduce((sum, item) => sum + item.value, 0);
    expect(typeTotal).toBe(res.body.kpis.total);
  });

  it("GET /api/declarations — lists all for admin", async () => {
    const res = await request(app)
      .get("/api/declarations")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(3);
  });

  it("GET /api/declarations — limit/offset paginates without double-skipping", async () => {
    const first = await request(app)
      .get("/api/declarations?limit=1&offset=0")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(first.status).toBe(200);
    expect(first.body).toHaveLength(1);
    // offset=1 must return the second row, not an empty page (the DB skip
    // and the in-memory slice previously both applied the offset).
    const second = await request(app)
      .get("/api/declarations?limit=1&offset=1")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(second.status).toBe(200);
    expect(second.body).toHaveLength(1);
    expect(second.body[0].id).not.toBe(first.body[0].id);
  });

  it("GET /api/declarations — database search composes with pagination", async () => {
    const first = await request(app).get("/api/declarations?search=Nomvula&limit=1&offset=0").set("Authorization", `Bearer ${getAdminToken()}`);
    expect(first.status).toBe(200);
    expect(first.body).toHaveLength(1);
    const second = await request(app).get("/api/declarations?search=Nomvula&limit=1&offset=1").set("Authorization", `Bearer ${getAdminToken()}`);
    expect(second.status).toBe(200);
    expect((second.body as DeclarationListResponse[]).every((declaration) => declaration.employee.toLowerCase().includes("nomvula"))).toBe(true);
  });

  it("GET /api/declarations — filters by status", async () => {
    const res = await request(app)
      .get("/api/declarations?status=Pending")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    (res.body as DeclarationListResponse[]).forEach((declaration) => expect(declaration.status).toBe("Pending"));
  });

  it("GET /api/declarations — team member sees only own", async () => {
    const res = await request(app)
      .get("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(3);
    (res.body as DeclarationListResponse[]).forEach((declaration) => expect(declaration.employeeId).toBe(4));
  });

  it("GET /api/declarations/:id — returns declaration with workflow", async () => {
    const res = await request(app)
      .get("/api/declarations/GHE-TEST-001")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe("GHE-TEST-001");
    expect(res.body.workflowSteps).toHaveLength(1);
  });

  it("POST /api/declarations — creates a draft", async () => {
    const res = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({
        employee: "Nomvula Team", employeeId: 4, teamMemberNumber: "TM-001",
        lineManager: "Sipho Approver", position: "Brand Manager", department: "Marketing",
        type: "Gift", counterparty: "New Supplier", value: 200, submitted: "2026-07-01",
        approver: "Sipho Approver", status: "Draft", priority: "High",
        description: "New test declaration", relationship: "Test",
        receivedGiven: "Received", from: "Supplier", contactPerson: "Test",
        biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-01",
        instances: "1", publicOfficial: "No",
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(/^GHE-/);
    expect(res.body.status).toBe("Draft");
    expect(res.body.priority).toBe("Low"); // Server derives priority from value/config.
  });

  it("POST /api/declarations — rejects missing required fields", async () => {
    const res = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ employeeId: 4 });
    expect(res.status).toBe(400);
  });

  it("PUT /api/declarations/:id — updates draft", async () => {
    // Create a fresh draft to avoid state issues
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({
        employee: "Nomvula Team", employeeId: 4, teamMemberNumber: "TM-001",
        lineManager: "Sipho Approver", position: "Brand Manager", department: "Marketing",
        type: "Gift", counterparty: "DraftUpdate", value: 50, submitted: "2026-07-05",
        approver: "Sipho Approver", status: "Draft", priority: "Low",
        description: "Original", relationship: "Test",
        receivedGiven: "Received", from: "Supplier", contactPerson: "T",
        biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-05",
        instances: "1", publicOfficial: "No",
      });
    const id = create.body.id;
    const res = await request(app)
      .put(`/api/declarations/${id}`)
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ description: "Updated description", value: 3000, priority: "Low" });
    expect(res.status).toBe(200);
    expect(res.body.description).toBe("Updated description");
    expect(res.body.priority).toBe("High"); // A mismatched client label cannot override the derived value.
  });

  it("PUT /api/declarations/:id — rejects update of non-draft", async () => {
    const res = await request(app)
      .put("/api/declarations/GHE-TEST-003")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({ description: "Should fail" });
    expect(res.status).toBe(400);
  });

  it("PUT /api/declarations/:id — rechecks state after waiting for a concurrent submit", async () => {
    const id = await createConcurrencyDraft("ConcurrentPut");
    const declaration = await prisma.declaration.findUniqueOrThrow({ where: { id }, select: { declarationPk: true, value: true } });
    let responseStatus: number | undefined;
    let routeDone!: Promise<void>;
    let wasBlocked = false;

    await prisma.$transaction(async (tx) => {
      await lockDeclarationRow(tx, declaration.declarationPk);
      const [{ pid }] = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
      routeDone = request(app)
        .put(`/api/declarations/${id}`)
        .set("Authorization", `Bearer ${getTeamToken()}`)
        .send({ description: "Must not edit after submit" })
        .then((response) => { responseStatus = response.status; });
      wasBlocked = await waitUntilBlockedBy(pid);
      await tx.declaration.update({ where: { declarationPk: declaration.declarationPk }, data: { status: "Pending" } });
    });

    await routeDone;
    expect(wasBlocked).toBe(true);
    expect(responseStatus).toBe(400);
    const current = await prisma.declaration.findUniqueOrThrow({ where: { id }, include: { detail: true } });
    expect(current.status).toBe("Pending");
    expect(current.detail?.description).toBe("Original");
    expect(Number(current.value)).toBe(Number(declaration.value));
  });

  it("PATCH /api/declarations/:id/submit — rejects a declaration changed while preparing workflow", async () => {
    const id = await createConcurrencyDraft("ConcurrentSubmit");
    const declaration = await prisma.declaration.findUniqueOrThrow({ where: { id }, select: { declarationPk: true, value: true } });
    let responseStatus: number | undefined;
    let routeDone!: Promise<void>;
    let wasBlocked = false;

    await prisma.$transaction(async (tx) => {
      await lockDeclarationRow(tx, declaration.declarationPk);
      const [{ pid }] = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
      routeDone = request(app)
        .patch(`/api/declarations/${id}/submit`)
        .set("Authorization", `Bearer ${getTeamToken()}`)
        .then((response) => { responseStatus = response.status; });
      wasBlocked = await waitUntilBlockedBy(pid);
      await tx.declaration.update({ where: { declarationPk: declaration.declarationPk }, data: { value: 75 } });
    });

    await routeDone;
    expect(wasBlocked).toBe(true);
    expect(responseStatus).toBe(409);
    const current = await prisma.declaration.findUniqueOrThrow({ where: { id } });
    expect(current.status).toBe("Draft");
    expect(Number(current.value)).toBe(75);
    expect(Number(current.value)).not.toBe(Number(declaration.value));
  });

  it("DELETE /api/declarations/:id — deletes draft", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({
        employee: "Nomvula Team", employeeId: 4, teamMemberNumber: "TM-001",
        lineManager: "Sipho Approver", position: "Brand Manager", department: "Marketing",
        type: "Gift", counterparty: "Temp", value: 50, submitted: "2026-07-02",
        approver: "Sipho Approver", status: "Draft", priority: "Low",
        description: "Temp", relationship: "Test",
        receivedGiven: "Received", from: "Supplier", contactPerson: "T",
        biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-02",
        instances: "1", publicOfficial: "No",
      });
    const id = create.body.id;
    const res = await request(app)
      .delete(`/api/declarations/${id}`)
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(res.status).toBe(200);
    const history = await request(app)
      .get(`/api/declarations/${id}/audit`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(history.status).toBe(200);
    expect((history.body as DeclarationAuditResponse[]).map((event) => event.action)).toEqual(expect.arrayContaining(["created", "deleted"]));
  });

  it("PATCH /api/declarations/:id/submit — submits draft and creates workflow", async () => {
    // Use a high value (>1000) to trigger rule-2 which won't have been deleted
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({
        employee: "Nomvula Team", employeeId: 4, teamMemberNumber: "TM-001",
        lineManager: "Sipho Approver", position: "Brand Manager", department: "Marketing",
        type: "Gift", counterparty: "SubmitTest", value: 3000,
        submitted: "2026-07-03", approver: "Sipho Approver", status: "Draft", priority: "High",
        description: "Submit test high value", relationship: "Test",
        receivedGiven: "Received", from: "Supplier", contactPerson: "T",
        biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-03",
        instances: "1", publicOfficial: "No",
      });
    const id = create.body.id;
    const res = await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Pending");
  });

  it("PATCH /api/declarations/:id/status — updates status", async () => {
    const res = await request(app)
      .patch("/api/declarations/GHE-TEST-001/status")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ status: "Escalated" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Escalated");

    // Restore
    await request(app)
      .patch("/api/declarations/GHE-TEST-001/status")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ status: "Pending" });
  });
});
