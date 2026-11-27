import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import request from "supertest";
import XLSX from "xlsx";
import { prisma } from "../config/prisma";
import { buildApp, pkFor, testToken } from "./helpers";
import type {
  CounterpartyConcentrationItem,
  HighValueDeclarationItem,
  SlaBreakdownItem,
} from "../services/reports";

const app = buildApp();
const organizationIds: bigint[] = [];
const userIds: bigint[] = [];
const declarationIds: string[] = [];
const counterpartyNames: string[] = [];

interface OrganizationFixture {
  organizationId: bigint;
  teamMemberId: bigint;
  approverId: bigint;
  teamToken: string;
  approverToken: string;
  teamMemberNumber: string;
  department: string;
  counterparty: string;
  employee: string;
  declarationId: string;
  value: number;
}

interface ReportListResponse {
  id: string;
  employee: string;
}

function identity(email: string) {
  return {
    providerSubject: `test-oid-${email}`,
    providerIssuer: process.env.OIDC_ISSUER || "http://127.0.0.1:55439",
  };
}

function tokenFor(email: string, name: string): string {
  return testToken({ oid: `test-oid-${email}`, email, name });
}

async function createOrganizationFixture(label: string): Promise<Omit<OrganizationFixture, "declarationId" | "value">> {
  const tag = randomUUID().slice(0, 8);
  const organization = await prisma.organization.create({
    data: { name: `Phase 3 ${label} ${tag}`, shortCode: `P3-${label}-${tag}` },
  });
  organizationIds.push(organization.id);
  const department = `P3-${label}-Dept-${tag}`;
  const departmentRow = await prisma.department.create({
    data: { organizationId: organization.id, name: department },
  });
  const teamEmail = `p3-${label.toLowerCase()}-team-${tag}@test.com`;
  const approverEmail = `p3-${label.toLowerCase()}-approver-${tag}@test.com`;
  const teamMemberNumber = `P3-${label}-TM-${tag}`;
  const teamMember = await prisma.user.create({
    data: {
      name: `Phase 3 ${label} Team`,
      email: teamEmail,
      role: "teamMember",
      teamMemberNumber,
      position: "Compliance Specialist",
      organizationId: organization.id,
      departmentId: departmentRow.id,
      ...identity(teamEmail),
    },
  });
  userIds.push(teamMember.id);
  const approver = await prisma.user.create({
    data: {
      name: `Phase 3 ${label} Approver`,
      email: approverEmail,
      role: "approver",
      teamMemberNumber: `P3-${label}-APR-${tag}`,
      position: "Line Manager",
      organizationId: organization.id,
      departmentId: departmentRow.id,
      ...identity(approverEmail),
    },
  });
  userIds.push(approver.id);
  await prisma.user.update({ where: { id: teamMember.id }, data: { managerId: approver.id } });
  return {
    organizationId: organization.id,
    teamMemberId: teamMember.id,
    approverId: approver.id,
    teamToken: tokenFor(teamEmail, teamMember.name),
    approverToken: tokenFor(approverEmail, approver.name),
    teamMemberNumber,
    department,
    counterparty: `P3-${label}-Vendor-${tag}`,
    employee: teamMember.name,
  };
}

async function createFixtureDeclaration(
  fixture: Omit<OrganizationFixture, "declarationId" | "value">,
  value: number,
): Promise<string> {
  const created = await request(app)
    .post("/api/declarations")
    .set("Authorization", `Bearer ${fixture.teamToken}`)
    .send({
      employee: fixture.employee,
      employeeId: Number(fixture.teamMemberId),
      teamMemberNumber: fixture.teamMemberNumber,
      lineManager: "Phase 3 Approver",
      position: "Compliance Specialist",
      department: fixture.department,
      type: "Gift",
      counterparty: fixture.counterparty,
      value,
      submitted: "2026-08-01",
      approver: "Phase 3 Approver",
      priority: "High",
      description: "Phase 3 organization report isolation",
      relationship: "Supplier",
      receivedGiven: "Received",
      from: "Supplier",
      contactPerson: "Phase 3",
      biddingProcess: "No",
      occasion: "Business Meeting",
      date: "2026-08-01",
      instances: "1",
      publicOfficial: "No",
    });
  expect(created.status).toBe(201);
  declarationIds.push(created.body.id);
  counterpartyNames.push(fixture.counterparty);
  return created.body.id as string;
}

async function createReportReader(tag: string) {
  const organization = await prisma.organization.create({
    data: { name: `Phase 3 Scale ${tag}`, shortCode: `P3S-${tag}` },
  });
  const email = `p3-scale-${tag}@test.com`;
  const user = await prisma.user.create({
    data: {
      name: `Phase 3 Scale Reader ${tag}`,
      email,
      role: "approver",
      teamMemberNumber: `P3S-${tag}`,
      position: "Report Reader",
      organizationId: organization.id,
      ...identity(email),
    },
  });
  return { organization, user, token: tokenFor(email, user.name) };
}

afterAll(async () => {
  await prisma.declaration.deleteMany({ where: { id: { in: declarationIds } } });
  await prisma.emailOutbox.deleteMany({ where: { declarationId: { in: declarationIds } } });
  await prisma.counterparty.deleteMany({ where: { name: { in: counterpartyNames } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });
});

describe("Phase 3 organization report and timeline isolation", () => {
  let fixtureA: OrganizationFixture;
  let fixtureB: OrganizationFixture;

  beforeAll(async () => {
    const config = await prisma.systemConfig.findFirst();
    const threshold = Number(config?.highValueThreshold ?? 1000);
    const baseA = await createOrganizationFixture("A");
    const baseB = await createOrganizationFixture("B");
    const declarationA = await createFixtureDeclaration(baseA, threshold + 500);
    const declarationB = await createFixtureDeclaration(baseB, threshold + 900);
    const submitted = await request(app)
      .patch(`/api/declarations/${declarationB}/submit`)
      .set("Authorization", `Bearer ${baseB.teamToken}`);
    expect(submitted.status).toBe(200);
    fixtureA = { ...baseA, declarationId: declarationA, value: threshold + 500 };
    fixtureB = { ...baseB, declarationId: declarationB, value: threshold + 900 };
  });

  it("denies another organization's workflow timeline even for a misassigned approver", async () => {
    const declarationPk = await pkFor(fixtureB.declarationId);
    const instance = await prisma.workflowInstance.findUniqueOrThrow({ where: { declarationPk } });
    const pending = await prisma.workflowInstanceStep.findFirstOrThrow({
      where: { instanceId: instance.id, status: "pending" },
    });
    await prisma.workflowInstanceStep.update({
      where: { id: pending.id },
      data: { assigneeId: fixtureA.approverId, assigneeName: "Phase 3 A Approver" },
    });

    const denied = await request(app)
      .get(`/api/workflows/instances/${fixtureB.declarationId}`)
      .set("Authorization", `Bearer ${fixtureA.approverToken}`);
    expect(denied.status).toBe(403);
    expect(denied.body.error).toMatch(/another organization/i);
    expect(denied.body).not.toHaveProperty("steps");

    await prisma.workflowInstanceStep.update({
      where: { id: pending.id },
      data: { assigneeId: fixtureB.approverId, assigneeName: "Phase 3 B Approver" },
    });
    const allowed = await request(app)
      .get(`/api/workflows/instances/${fixtureB.declarationId}`)
      .set("Authorization", `Bearer ${fixtureB.approverToken}`);
    expect(allowed.status).toBe(200);
    expect(allowed.body.steps.length).toBeGreaterThan(0);
  });

  it("isolates status totals in both the view and filtered aggregation paths", async () => {
    for (const fixture of [fixtureA, fixtureB]) {
      const ownStatus = fixture === fixtureA ? "Draft" : "Pending";
      const otherStatus = fixture === fixtureA ? "Pending" : "Draft";
      const unfiltered = await request(app)
        .get("/api/reports/status-breakdown")
        .set("Authorization", `Bearer ${fixture.approverToken}`);
      expect(unfiltered.status).toBe(200);
      expect(unfiltered.body).toEqual({ [ownStatus]: 1 });

      const filtered = await request(app)
        .get(`/api/reports/status-breakdown?status=${ownStatus}`)
        .set("Authorization", `Bearer ${fixture.approverToken}`);
      expect(filtered.status).toBe(200);
      expect(filtered.body).toEqual({ [ownStatus]: 1 });

      const otherOrgStatus = await request(app)
        .get(`/api/reports/status-breakdown?status=${otherStatus}`)
        .set("Authorization", `Bearer ${fixture.approverToken}`);
      expect(otherOrgStatus.status).toBe(200);
      expect(otherOrgStatus.body).toEqual({});
    }
  });

  it("isolates counterparty totals in both the view and batched aggregation paths", async () => {
    for (const fixture of [fixtureA, fixtureB]) {
      const expected = [{
        counterparty: fixture.counterparty,
        count: 1,
        totalValue: fixture.value,
        avgValue: fixture.value,
      }];
      const unfiltered = await request(app)
        .get("/api/reports/counterparty-concentration")
        .set("Authorization", `Bearer ${fixture.approverToken}`);
      expect(unfiltered.status).toBe(200);
      expect(unfiltered.body as CounterpartyConcentrationItem[]).toEqual(expected);

      const filtered = await request(app)
        .get(`/api/reports/counterparty-concentration?department=${encodeURIComponent(fixture.department)}`)
        .set("Authorization", `Bearer ${fixture.approverToken}`);
      expect(filtered.status).toBe(200);
      expect(filtered.body as CounterpartyConcentrationItem[]).toEqual(expected);
      expect(JSON.stringify(filtered.body)).not.toContain(fixture === fixtureA ? fixtureB.counterparty : fixtureA.counterparty);
    }
  });

  it("isolates high-value employee and supplier aggregates", async () => {
    for (const fixture of [fixtureA, fixtureB]) {
      const response = await request(app)
        .get("/api/reports/high-value")
        .set("Authorization", `Bearer ${fixture.approverToken}`);
      expect(response.status).toBe(200);
      const rows = response.body as HighValueDeclarationItem[];
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        employee: fixture.employee,
        declarationCount: 1,
        totalValue: fixture.value,
        averageValue: fixture.value,
        totalGift: fixture.value,
        totalHospitality: 0,
        totalEntertainment: 0,
        mostFrequentSupplier: fixture.counterparty,
      });
      expect(JSON.stringify(rows)).not.toContain(fixture === fixtureA ? fixtureB.employee : fixtureA.employee);
    }
  });
});

describe("Phase 3 report scale boundaries", () => {
  it("paginates and aggregates beyond the 500-row report fetch batch", async () => {
    const tag = randomUUID().slice(0, 8);
    const { organization, user, token } = await createReportReader(tag);
    try {
      const config = await prisma.systemConfig.findFirst();
      const threshold = Number(config?.highValueThreshold ?? 1000);
      const count = 501;
      const baseValue = Math.floor(threshold) + 1001;
      const totalValue = count * baseValue + (count * (count - 1)) / 2;
      const department = `P3-Batch-Dept-${tag}`;
      const employee = `P3 Batch Employee ${tag}`;
      const counterparty = `P3 Batch Vendor ${tag}`;
      const counterpartyRow = await prisma.counterparty.create({
        data: { name: counterparty, organizationId: organization.id },
      });
      const eventDate = new Date("2026-01-01T00:00:00.000Z");
      await prisma.declaration.createMany({
        data: Array.from({ length: count }, (_, index) => ({
          id: `GHE-P3-BATCH-${tag}-${String(index).padStart(4, "0")}`,
          type: "Gift",
          value: baseValue + index,
          status: "Approved",
          priority: "High",
          organizationId: organization.id,
          declarerUserId: user.id,
          counterpartyId: counterpartyRow.id,
          eventDate,
          submittedAt: new Date(eventDate.getTime() + index * 1000),
        })),
      });
      const declarations = await prisma.declaration.findMany({
        where: { organizationId: organization.id },
        orderBy: { declarationPk: "asc" },
        select: { declarationPk: true, id: true },
      });
      expect(declarations).toHaveLength(count);
      await prisma.declarationSnapshot.createMany({
        data: declarations.map((declaration) => ({
          declarationPk: declaration.declarationPk,
          declarerName: employee,
          employeeNumber: `P3-BATCH-${tag}`,
          positionTitle: "Batch Fixture",
          department,
          managerDisplayName: "P3 Batch Manager",
        })),
      });
      // Each declaration needs its own instance because declarationPk is unique.
      await prisma.workflowInstance.createMany({
        data: declarations.map((declaration) => ({ declarationPk: declaration.declarationPk })),
      });
      const instances = await prisma.workflowInstance.findMany({
        where: { declarationPk: { in: declarations.map((row) => row.declarationPk) } },
        select: { id: true, declarationPk: true },
      });
      const instanceByPk = new Map(instances.map((row) => [String(row.declarationPk), row.id]));
      await prisma.workflowInstanceStep.createMany({
        data: declarations.map((declaration, index) => ({
          instanceId: instanceByPk.get(String(declaration.declarationPk))!,
          declarationPk: declaration.declarationPk,
          stepOrder: 1,
          role: "lineManager",
          label: "Batch Line Manager Review",
          assigneeId: user.id,
          assigneeName: user.name,
          status: "approved",
          decision: "accept",
          decidedAt: new Date(eventDate.getTime() + index * 24 * 60 * 60_000),
          decidedById: user.id,
          decidedByName: user.name,
        })),
      });

      const departmentQuery = encodeURIComponent(department);
      const firstPage = await request(app)
        .get(`/api/reports/list?department=${departmentQuery}&limit=10000&offset=0`)
        .set("Authorization", `Bearer ${token}`);
      const secondPage = await request(app)
        .get(`/api/reports/list?department=${departmentQuery}&limit=10000&offset=500`)
        .set("Authorization", `Bearer ${token}`);
      expect(firstPage.status).toBe(200);
      expect(secondPage.status).toBe(200);
      const firstRows = firstPage.body as ReportListResponse[];
      const secondRows = secondPage.body as ReportListResponse[];
      expect(firstRows).toHaveLength(500);
      expect(secondRows).toHaveLength(1);
      expect(new Set([...firstRows, ...secondRows].map((row) => row.id)).size).toBe(count);

      const counterpartyReport = await request(app)
        .get(`/api/reports/counterparty-concentration?department=${departmentQuery}`)
        .set("Authorization", `Bearer ${token}`);
      expect(counterpartyReport.status).toBe(200);
      expect(counterpartyReport.body as CounterpartyConcentrationItem[]).toEqual([{
        counterparty,
        count,
        totalValue,
        avgValue: Math.round((totalValue / count) * 100) / 100,
      }]);

      const highValueReport = await request(app)
        .get("/api/reports/high-value")
        .set("Authorization", `Bearer ${token}`);
      expect(highValueReport.status).toBe(200);
      const highValueRows = highValueReport.body as HighValueDeclarationItem[];
      expect(highValueRows).toHaveLength(1);
      expect(highValueRows[0]).toMatchObject({
        employee,
        declarationCount: count,
        totalValue,
        averageValue: Math.round((totalValue / count) * 100) / 100,
        totalGift: totalValue,
        mostFrequentSupplier: counterparty,
      });

      const slaReport = await request(app)
        .get(`/api/reports/sla?department=${departmentQuery}`)
        .set("Authorization", `Bearer ${token}`);
      expect(slaReport.status).toBe(200);
      expect(slaReport.body as SlaBreakdownItem[]).toEqual([{
        role: "Line Manager",
        avg: 250,
        min: 0,
        max: 500,
        count,
      }]);
    } finally {
      await prisma.declaration.deleteMany({ where: { organizationId: organization.id } });
      await prisma.counterparty.deleteMany({ where: { organizationId: organization.id } });
      await prisma.user.deleteMany({ where: { organizationId: organization.id } });
      await prisma.organization.delete({ where: { id: organization.id } });
    }
  }, 30_000);

  it("rejects exports above 5,000 rows and exports exactly 5,000 rows", async () => {
    const tag = randomUUID().slice(0, 8);
    const { organization, user, token } = await createReportReader(tag);
    try {
      const total = 5001;
      const prefix = `GHE-P3-EXPORT-${tag}`;
      // One bulk insert keeps the exact boundary test fast; snapshots are not
      // required by the export contract and would add no boundary coverage.
      await prisma.declaration.createMany({
        data: Array.from({ length: total }, (_, index) => ({
          id: `${prefix}-${String(index).padStart(4, "0")}`,
          type: "Gift",
          value: 100,
          status: index < 5000 ? "Pending" : "Draft",
          priority: "Low",
          organizationId: organization.id,
          declarerUserId: user.id,
          eventDate: new Date("2026-01-01T00:00:00.000Z"),
          submittedAt: new Date("2026-01-01T00:00:00.000Z"),
        })),
      });

      const tooLarge = await request(app)
        .get("/api/reports/export")
        .set("Authorization", `Bearer ${token}`);
      expect(tooLarge.status).toBe(413);
      expect(tooLarge.body.error).toMatch(/5,000 declaration limit/i);

      const atLimit = await request(app)
        .get("/api/reports/export?status=Pending")
        .set("Authorization", `Bearer ${token}`)
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => callback(null, Buffer.concat(chunks)));
          res.on("error", callback);
        });
      expect(atLimit.status).toBe(200);
      expect(atLimit.headers["content-type"]).toContain("spreadsheetml.sheet");
      const bytes = Buffer.isBuffer(atLimit.body) ? atLimit.body : Buffer.from(atLimit.body as Uint8Array);
      const workbook = XLSX.read(bytes, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
      expect(rows.filter((row) => typeof row[0] === "string" && row[0].startsWith(prefix))).toHaveLength(5000);
      expect(rows).toContainEqual(["Records", "5000"]);
    } finally {
      await prisma.declaration.deleteMany({ where: { organizationId: organization.id } });
      await prisma.user.deleteMany({ where: { organizationId: organization.id } });
      await prisma.organization.delete({ where: { id: organization.id } });
    }
  }, 60_000);
});
