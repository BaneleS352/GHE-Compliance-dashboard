import { describe, it, expect } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { buildApp, getAdminToken, getTeamToken, getApproverToken } from "./helpers";
import { backfillNormalization } from "../scripts/backfill-normalization";
import { verifyNormalization } from "../scripts/verify-normalization";
import { readWorkflowSteps } from "../services/normalization";
import { viewStatusSummary, viewCounterparty, viewSlaRows } from "../services/reportingViews";

const app = buildApp();
const prisma = new PrismaClient();

describe("Database normalization (goal)", () => {
  it("backfill is idempotent and links legacy rows to relational tables", async () => {
    const first = await backfillNormalization();
    const second = await backfillNormalization();
    expect(first.declarations.total).toBeGreaterThan(0);
    expect(first.declarations.snapshots).toBe(first.declarations.total);
    expect(first.workflows.ruleSteps).toBeGreaterThanOrEqual(3);
    expect(first.workflows.instanceSteps).toBeGreaterThan(0);
    // Idempotent: second run creates no new counterparties and same totals.
    expect(second.counterparties.created).toBe(0);
    expect(second.declarations.total).toBe(first.declarations.total);

    const snapCount = await (prisma as any).declarationSnapshot.count();
    expect(snapCount).toBe(first.declarations.total);
    const roleCount = await (prisma as any).userRole.count();
    expect(roleCount).toBeGreaterThanOrEqual(4);
  });

  it("creating a declaration mirrors snapshot, detail, timestamps and counterparty", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({
        employee: "Nomvula Team", employeeId: "user-team", teamMemberNumber: "TM-001",
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
    expect(create.body).not.toHaveProperty("declarerUserId");
    expect(create.body).not.toHaveProperty("counterpartyId");

    // Give the fire-and-forget mirror a moment, then verify relational rows.
    await new Promise((r) => setTimeout(r, 250));
    const decl = await prisma.declaration.findUnique({ where: { id } });
    expect(decl).not.toBeNull();
    expect(decl!.eventDate).not.toBeNull();
    expect(decl!.submittedAt).not.toBeNull();
    expect(decl!.declarerUserId).toBe("user-team");
    expect(decl!.counterpartyId).not.toBeNull();
    const snap = await (prisma as any).declarationSnapshot.findUnique({ where: { declarationId: id } });
    expect(snap?.declarerName).toBe("Nomvula Team");
    const detail = await (prisma as any).declarationDetail.findUnique({ where: { declarationId: id } });
    expect(detail?.contactPerson).toBe("Nora");

    await prisma.declaration.delete({ where: { id } }).catch(() => undefined);
  });

  it("submit + approve persist relational workflow steps mirroring JSON", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send({
        employee: "Nomvula Team", employeeId: "user-team", teamMemberNumber: "TM-001",
        lineManager: "Sipho Approver", position: "Brand Manager", department: "Marketing",
        type: "Hospitality", counterparty: "Step Mirror Co", value: 5000, submitted: "2026-04-11",
        status: "Draft", priority: "High", description: "two step flow",
        relationship: "Supplier", receivedGiven: "Received", from: "Supplier",
        contactPerson: "Sam", biddingProcess: "No", occasion: "Milestone",
        date: "2026-04-10", instances: "1", publicOfficial: "No",
      });
    const id = create.body.id;
    const submit = await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(submit.status).toBe(200);

    let rows = await (prisma as any).workflowInstanceStep.findMany({
      where: { declarationId: id }, orderBy: { stepOrder: "asc" },
    });
    expect(rows.length).toBe(2);
    expect(rows[0].assigneeId).toBe("user-approver");

    // Relational read matches the legacy JSON source of truth.
    const viaRelational = await readWorkflowSteps(id);
    const inst = await prisma.workflowInstance.findUnique({ where: { declarationId: id } });
    expect(viaRelational).toEqual(JSON.parse(inst!.steps));

    const approve = await request(app)
      .post("/api/workflows/approve")
      .set("Authorization", `Bearer ${getApproverToken()}`)
      .send({ declarationId: id, decision: "accept", notes: "looks good" });
    expect(approve.status).toBe(200);
    await new Promise((r) => setTimeout(r, 250));
    rows = await (prisma as any).workflowInstanceStep.findMany({
      where: { declarationId: id }, orderBy: { stepOrder: "asc" },
    });
    expect(rows[0].status).toBe("approved");
    expect(rows[0].decision).toBe("accept");
  });

  it("reporting views agree with legacy aggregations (result equivalence)", async () => {
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

  it("db:verify gate passes — relational model matches legacy columns", async () => {
    await backfillNormalization();
    const result = await verifyNormalization();
    expect(result.drifts).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.checked.instances).toBeGreaterThan(0);
    expect(result.checked.declarations).toBeGreaterThan(0);
  });

  it("admin rule changes sync relational rule steps", async () => {
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
    await new Promise((r) => setTimeout(r, 250));
    const steps = await (prisma as any).workflowRuleStep.findMany({ where: { ruleId: created.body.id } });
    expect(steps.length).toBe(2);
    await request(app)
      .delete(`/api/admin/workflows/rules/${created.body.id}`)
      .set("Authorization", `Bearer ${getAdminToken()}`);
  });
});
