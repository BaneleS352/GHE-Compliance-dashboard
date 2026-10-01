import { describe, it, expect } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { buildApp, getAdminToken, getTeamToken, getApproverToken, pkFor } from "./helpers";
import { readWorkflowStepRows } from "../services/normalization";
import { toDbId, toJsonId, parseIdParam } from "../services/ids";
import { viewStatusSummary, viewCounterparty, viewSlaRows } from "../services/reportingViews";

const app = buildApp();
const prisma = new PrismaClient();

describe("Database normalization (numeric identifiers)", () => {
  it("creating a declaration writes snapshot, detail, timestamps and counterparty link", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({
        employee: "Nomvula Team", employeeId: 4, teamMemberNumber: "TM-001",
        lineManager: "Sipho Approver", position: "Brand Manager", department: "Marketing",
        type: "Gift", counterparty: "Norm Vendor", value: 250, submitted: "2026-04-10",
        status: "Draft", priority: "Low", description: "normalization mirror test",
        relationship: "Supplier", receivedGiven: "Received", from: "Supplier",
        contactPerson: "Nora", biddingProcess: "No", occasion: "Business Meeting",
        date: "2026-04-09", instances: "1", publicOfficial: "No",
      });
    expect(create.status).toBe(201);
    const id = create.body.id;
    // API contract unchanged: no relational internals leak into the response.
    expect(create.body.counterparty).toBe("Norm Vendor");
    expect(create.body.employeeId).toBe(4);
    expect(create.body).not.toHaveProperty("declarerUserId");
    expect(create.body).not.toHaveProperty("counterpartyId");

    // Writes are synchronous inside the request transaction — no wait needed.
    const decl = await prisma.declaration.findUnique({ where: { id } });
    expect(decl).not.toBeNull();
    expect(decl!.eventDate).not.toBeNull();
    expect(decl!.submittedAt).not.toBeNull();
    expect(decl!.declarerUserId).toBe(4n);
    expect(decl!.counterpartyId).not.toBeNull();
    const pk = decl!.declarationPk;
    const snap = await prisma.declarationSnapshot.findUnique({ where: { declarationPk: pk } });
    expect(snap?.declarerName).toBe("Nomvula Team");
    const detail = await prisma.declarationDetail.findUnique({ where: { declarationPk: pk } });
    expect(detail?.contactPerson).toBe("Nora");

    await prisma.declarationSnapshot.deleteMany({ where: { declarationPk: pk } }).catch(() => undefined);
    await prisma.declarationDetail.deleteMany({ where: { declarationPk: pk } }).catch(() => undefined);
    await prisma.declaration.delete({ where: { id } }).catch(() => undefined);
  });

  it("submit + approve persist relational workflow steps (rows are the only state)", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({
        employee: "Nomvula Team", employeeId: 4, teamMemberNumber: "TM-001",
        lineManager: "Sipho Approver", position: "Brand Manager", department: "Marketing",
        type: "Hospitality", counterparty: "Step Mirror Co", value: 5000, submitted: "2026-04-11",
        status: "Draft", priority: "High", description: "two step flow",
        relationship: "Supplier", receivedGiven: "Received", from: "Supplier",
        contactPerson: "Sam", biddingProcess: "No", occasion: "Milestone",
        date: "2026-04-10", instances: "1", publicOfficial: "No",
      });
    const id = create.body.id;
    const pk = await pkFor(id);
    const submit = await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(submit.status).toBe(200);

    // Canonical approver link tracks the current approver at submit.
    const decl = await prisma.declaration.findUnique({ where: { id } });
    expect((decl as any)!.currentApproverUserId).toBe(2n);

    let rows = await prisma.workflowInstanceStep.findMany({
      where: { declarationPk: pk }, orderBy: { stepOrder: "asc" },
    });
    expect(rows.length).toBe(2);
    expect(rows[0].assigneeId).toBe(2n);

    // Relational read returns the step array (no JSON cache exists).
    const viaRelational = await readWorkflowStepRows(pk);
    expect(viaRelational).not.toBeNull();
    expect(viaRelational!.length).toBe(2);
    expect(viaRelational![0].assignee).toBe(2);

    const approve = await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getApproverToken()}`)
      .send({ declarationId: id, decision: "accept", notes: "looks good" });
    expect(approve.status).toBe(200);
    rows = await prisma.workflowInstanceStep.findMany({
      where: { declarationPk: pk }, orderBy: { stepOrder: "asc" },
    });
    expect(rows[0].status).toBe("approved");
    expect(rows[0].decision).toBe("accept");

    // Canonical approver link moves to HR after the LM approval.
    const decl2 = await prisma.declaration.findUnique({ where: { id } });
    expect((decl2 as any)!.currentApproverUserId).toBe(3n);
  });

  it("reporting views agree with direct aggregations (result equivalence)", async () => {
    const where: any = {};
    const grouped = await prisma.declaration.groupBy({ by: ["status"], where, _count: { status: true } });
    const legacy: Record<string, number> = {};
    for (const g of grouped) legacy[g.status] = g._count.status;
    const fromView = await viewStatusSummary(undefined);
    expect(fromView).not.toBeNull();
    for (const [status, count] of Object.entries(legacy)) {
      expect(fromView![status]).toBe(count);
    }

    const cpView = await viewCounterparty(undefined);
    expect(cpView).not.toBeNull();
    expect(cpView!.length).toBeGreaterThan(0);
    const totals = cpView!.reduce((s, r) => s + r.count, 0);
    const declCount = await prisma.declaration.count();
    expect(totals).toBe(declCount);

    const slaRows = await viewSlaRows();
    expect(slaRows).not.toBeNull();
    expect(slaRows!.length).toBeGreaterThan(0);
  });

  it("snapshot is immutable after creation (team moves don't rewrite history)", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({
        employee: "Nomvula Team", employeeId: 4, teamMemberNumber: "TM-001",
        lineManager: "Sipho Approver", position: "Brand Manager", department: "Marketing",
        type: "Gift", counterparty: "Snapshot Co", value: 50, submitted: "2026-04-12",
        status: "Draft", priority: "Low", description: "snapshot immutability",
        relationship: "Supplier", receivedGiven: "Received", from: "Supplier",
        contactPerson: "S", biddingProcess: "No", occasion: "Business Meeting",
        date: "2026-04-11", instances: "1", publicOfficial: "No",
      });
    const id = create.body.id;
    const pk = await pkFor(id);
    // Change the user's master data — the snapshot must not follow.
    await prisma.user.update({ where: { id: 4n }, data: { department: "Engineering", position: "Principal" } });
    const snap = await prisma.declarationSnapshot.findUnique({ where: { declarationPk: pk } });
    expect(snap?.department).toBe("Marketing");
    expect(snap?.positionTitle).toBe("Brand Manager");
    await prisma.user.update({ where: { id: 4n }, data: { department: "Marketing", position: "Brand Manager" } });
    await prisma.declarationSnapshot.deleteMany({ where: { declarationPk: pk } }).catch(() => undefined);
    await prisma.declarationDetail.deleteMany({ where: { declarationPk: pk } }).catch(() => undefined);
    await prisma.declaration.delete({ where: { id } }).catch(() => undefined);
  });

  it("admin rule changes write relational rule steps in-transaction", async () => {
    const created = await request(app)
      .post("/api/admin/workflows/rules")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({
        name: `Norm Rule ${Date.now()}`, condition: "norm-test", priority: 99,
        steps: [
          { order: 1, role: "lineManager", label: "Line Manager Review" },
          { order: 2, role: "hr", label: "HR Review" },
        ],
      });
    expect(created.status).toBe(201);
    const steps = await prisma.workflowRuleStep.findMany({ where: { ruleId: toDbId(created.body.id) } });
    expect(steps.length).toBe(2);
    await request(app)
      .delete(`/api/admin/workflows/rules/${created.body.id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
  });

  it("submit records the producing rule on the workflow instance (rule FK)", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({
        employee: "Nomvula Team", employeeId: 4, teamMemberNumber: "TM-001",
        lineManager: "Sipho Approver", position: "Brand Manager", department: "Marketing",
        type: "Gift", counterparty: "Rule FK Co", value: 5000, submitted: "2026-04-12",
        status: "Draft", priority: "High", description: "rule fk test",
        relationship: "Supplier", receivedGiven: "Received", from: "Supplier",
        contactPerson: "Sam", biddingProcess: "No", occasion: "Milestone",
        date: "2026-04-11", instances: "1", publicOfficial: "No",
      });
    const id = create.body.id;
    const pk = await pkFor(id);
    await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);
    const inst = await prisma.workflowInstance.findUnique({ where: { declarationPk: pk } });
    // 5000 >= threshold 1000 → rule 2, recorded with an enforced FK.
    expect((inst as any).ruleId).toBe(2n);
  });

  it("identifier boundary converts BIGINT rows to JSON-safe numbers", async () => {
    expect(toJsonId(4n)).toBe(4);
    expect(toJsonId(4)).toBe(4);
    expect(toDbId(4)).toBe(4n);
    expect(toDbId("4")).toBe(4n);
    expect(toDbId(4n)).toBe(4n);
    expect(parseIdParam("4")).toBe(4n);
    expect(parseIdParam(4)).toBe(4n);
    expect(parseIdParam("user-admin")).toBeNull();
    expect(parseIdParam(undefined)).toBeNull();
    expect(() => toDbId("user-admin")).toThrow();
    expect(() => toJsonId(2n ** 60n)).toThrow();
  });

  it("dashboard /stats KPIs match direct aggregation (view equivalence)", async () => {
    const res = await request(app)
      .get("/api/declarations/stats")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    const { kpis, complianceTrend, typeBreakdown } = res.body;

    // Direct aggregation computed independently in the test.
    const grouped = await prisma.declaration.groupBy({ by: ["status"], _count: { status: true } });
    const legacy: Record<string, number> = {};
    for (const g of grouped) legacy[g.status] = g._count.status;
    const agg = await prisma.declaration.aggregate({ _sum: { value: true } });
    const total = await prisma.declaration.count();

    expect(kpis.total).toBe(total);
    expect(kpis.pending).toBe(legacy.Pending || 0);
    expect(kpis.approved).toBe(legacy.Approved || 0);
    expect(kpis.declined).toBe(legacy.Declined || 0);
    expect(kpis.returned).toBe(legacy.Returned || 0);
    expect(kpis.totalValue).toBe(agg._sum.value || 0);

    // View-backed trend/type shapes: numerics only, months bucketed YYYY-MM.
    expect(Array.isArray(complianceTrend)).toBe(true);
    for (const t of complianceTrend) {
      expect(t.month).toMatch(/^\d{4}-\d{2}$/);
      expect(typeof t.approved).toBe("number");
      expect(typeof t.declined).toBe("number");
    }
    expect(Array.isArray(typeBreakdown)).toBe(true);
    const typeTotal = typeBreakdown.reduce((s: number, t: any) => s + t.value, 0);
    expect(typeTotal).toBe(total);
  });
});
