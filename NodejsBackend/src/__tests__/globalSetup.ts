import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { execFileSync } from "child_process";
import os from "os";
import path from "path";

// PostgreSQL is the only supported provider (Identifier Strategy cutover).
// The suite boots an embedded PostgreSQL, applies the versioned migrations,
// and seeds isolated normalized fixtures — the full suite runs against
// PostgreSQL, locally and in CI.
const PG_PORT = Number(process.env.PG_TEST_PORT || 55433);
// The embedded cluster lives outside the repo so test runs never dirty it.
const PG_DATA_DIR = process.env.PG_TEST_DATA_DIR || path.join(os.tmpdir(), "ghe-pg-test");
const PG_URL = process.env.TEST_PG_DATABASE_URL ||
  `postgresql://postgres:postgres@localhost:${PG_PORT}/ghe_test?schema=public`;

let embedded: any = null;

async function startEmbeddedPostgres(): Promise<void> {
  if (process.env.TEST_PG_DATABASE_URL) return;
  // ESM-only package: classic moduleResolution cannot resolve its types, but
  // vitest/tsx load it fine at runtime.
  // @ts-ignore
  const mod = await import("embedded-postgres");
  const EmbeddedPostgres = (mod as any).default || mod;
  embedded = new EmbeddedPostgres({
    user: "postgres",
    password: "postgres",
    port: PG_PORT,
    persistent: false,
    databaseDir: PG_DATA_DIR,
    // UTF8/C regardless of host locale: the migration SQL contains non-ASCII
    // comment text and the suite must not depend on OS locale settings.
    initdbFlags: ["-E", "UTF8", "--locale=C"],
  });
  try {
    await embedded.initialise();
    await embedded.start();
    await embedded.createDatabase("ghe_test");
  } catch (err: any) {
    throw new Error(
      "Embedded PostgreSQL failed to start (port " + PG_PORT + "). " +
        "Backend tests require PostgreSQL: free the port, or set " +
        "TEST_PG_DATABASE_URL to a dedicated PostgreSQL database. " +
        "CI runs the suite against a postgres service. Cause: " +
        (err?.message || String(err)),
    );
  }
}

export async function setup() {
  await startEmbeddedPostgres();
  process.env.DATABASE_URL = PG_URL;
  process.env.JWT_SECRET = "test-secret";

  // Invoke the LOCAL Prisma CLI directly via node instead of `npx`: on hosts
  // where npx resolves a different Prisma version, setup fails before any
  // test runs.
  let prismaBin: string;
  try {
    prismaBin = require.resolve("prisma/build/index.js");
  } catch {
    throw new Error(
      "Cannot resolve the local Prisma CLI (node_modules/prisma). " +
        "Ensure dependencies are installed (`npm install`, which runs `prisma generate` via postinstall).",
    );
  }
  // Versioned migrations (not db push): the suite runs the same migration
  // chain production deploys.
  try {
    execFileSync(
      process.execPath,
      [prismaBin, "migrate", "deploy"],
      {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: PG_URL },
        stdio: "pipe",
      },
    );
  } catch (err: any) {
    const detail =
      err?.stdout?.toString() || err?.stderr?.toString() || err?.message || String(err);
    console.error("Test database migration failed (`prisma migrate deploy`). Engine output:\n" + detail);
    throw new Error(`Test database migration failed: ${detail.split("\n")[0]}`);
  }

  const prisma = new PrismaClient();
  const hash = bcrypt.hashSync("password", 10);

  // Numeric fixture ids (shared with helpers.ts tokens).
  await prisma.user.createMany({
    data: [
      { id: 1n, name: "Admin User", email: "admin@test.com", passwordHash: hash, role: "admin", teamMemberNumber: "ADM-001", department: "IT", position: "System Admin", lineManager: null },
      { id: 2n, name: "Sipho Approver", email: "sipho@test.com", passwordHash: hash, role: "approver", teamMemberNumber: "APR-001", department: "Marketing", position: "Line Manager", lineManager: null },
      { id: 3n, name: "Lindiwe HR", email: "lindiwe@test.com", passwordHash: hash, role: "approver", teamMemberNumber: "APR-002", department: "HR", position: "Head of HR", lineManager: null },
      { id: 4n, name: "Nomvula Team", email: "nomvula@test.com", passwordHash: hash, role: "teamMember", teamMemberNumber: "TM-001", department: "Marketing", position: "Brand Manager", lineManager: "Sipho Approver" },
    ],
  });
  // Normalized user links (manager FK).
  await prisma.user.update({ where: { id: 4n }, data: { managerId: 2n } });

  await prisma.systemConfig.create({
    data: { id: "default", highValueThreshold: 1000, mediumValueThreshold: 1000, slaEscalationDays: 3, maxDeclarationsPerCounterparty: 5, emailTemplate: "Test {{ApproverName}}", notificationTemplates: "{}" },
  });

  // Workflow rules + row-only step definitions.
  await prisma.workflowRule.createMany({
    data: [
      { id: 1n, name: "Low Value", condition: "low", priority: 1 },
      { id: 2n, name: "High Value", condition: "high", priority: 2 },
    ],
  });
  await prisma.workflowRuleStep.createMany({
    data: [
      { ruleId: 1n, order: 1, role: "lineManager", label: "Line Manager Review" },
      { ruleId: 2n, order: 1, role: "lineManager", label: "Line Manager Review" },
      { ruleId: 2n, order: 2, role: "hr", label: "HR Review" },
    ],
  });

  // Counterparties (one row per name for the fixture org-less scope).
  const cpA = await prisma.counterparty.create({ data: { name: "Supplier A" } });
  const cpB = await prisma.counterparty.create({ data: { name: "Supplier B" } });
  const cpC = await prisma.counterparty.create({ data: { name: "Supplier C" } });

  // Lean declarations + snapshots + details.
  const decls = [
    {
      id: "GHE-TEST-001", type: "Gift", value: 100, status: "Pending", priority: "Low",
      eventDate: new Date("2026-01-14T00:00:00.000Z"), submittedAt: new Date("2026-01-15T00:00:00.000Z"),
      declarerUserId: 4n, currentApproverUserId: 2n, counterpartyId: cpA.id,
      snap: { declarerName: "Nomvula Team", employeeNumber: "TM-001", positionTitle: "Brand Manager", department: "Marketing", managerDisplayName: "Sipho Approver" },
      det: { description: "Test declaration", occasion: "Business Meeting", relationship: "Test", receivedGiven: "Received", fromField: "Supplier", contactPerson: "John", biddingProcess: "No", instances: "1", publicOfficial: "No" },
    },
    {
      id: "GHE-TEST-002", type: "Gift", value: 500, status: "Pending", priority: "Medium",
      eventDate: new Date("2026-01-30T00:00:00.000Z"), submittedAt: new Date("2026-02-01T00:00:00.000Z"),
      declarerUserId: 4n, currentApproverUserId: 2n, counterpartyId: cpB.id,
      snap: { declarerName: "Nomvula Team", employeeNumber: "TM-001", positionTitle: "Brand Manager", department: "Marketing", managerDisplayName: "Sipho Approver" },
      det: { description: "Second test", occasion: "Milestone", relationship: "Test", receivedGiven: "Given", fromField: "Customer", contactPerson: "Jane", biddingProcess: "No", instances: "1", publicOfficial: "No" },
    },
    {
      id: "GHE-TEST-003", type: "Hospitality", value: 3000, status: "Approved", priority: "High",
      eventDate: new Date("2026-02-28T00:00:00.000Z"), submittedAt: new Date("2026-03-01T00:00:00.000Z"),
      declarerUserId: 4n, currentApproverUserId: null, counterpartyId: cpC.id,
      snap: { declarerName: "Nomvula Team", employeeNumber: "TM-001", positionTitle: "Brand Manager", department: "Marketing", managerDisplayName: "Sipho Approver" },
      det: { description: "High value", occasion: "Other", relationship: "Test", receivedGiven: "Received", fromField: "Supplier", contactPerson: "Bob", biddingProcess: "Yes", instances: "2", publicOfficial: "No" },
    },
  ];
  const pkById = new Map<string, bigint>();
  for (const d of decls) {
    const { snap, det, ...row } = d;
    const created = await prisma.declaration.create({ data: row });
    pkById.set(d.id, created.declarationPk);
    await prisma.declarationSnapshot.create({ data: { declarationPk: created.declarationPk, ...snap } });
    await prisma.declarationDetail.create({ data: { declarationPk: created.declarationPk, ...det } });
  }

  // Workflow instances: rows only.
  const { persistWorkflowInstanceSteps } = await import("../services/normalization");
  await persistWorkflowInstanceSteps(pkById.get("GHE-TEST-001")!, [
    { order: 1, role: "lineManager", assignee: 2, assigneeName: "Sipho Approver", label: "Line Manager Review", status: "pending", decision: null, approvedAt: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null },
  ], 1n);
  await persistWorkflowInstanceSteps(pkById.get("GHE-TEST-002")!, [
    { order: 1, role: "lineManager", assignee: 2, assigneeName: "Sipho Approver", label: "Line Manager Review", status: "pending", decision: null, approvedAt: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null },
    { order: 2, role: "hr", assignee: 3, assigneeName: "Lindiwe HR", label: "HR Review", status: "pending", decision: null, approvedAt: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null },
  ], 2n);
  await persistWorkflowInstanceSteps(pkById.get("GHE-TEST-003")!, [
    { order: 1, role: "lineManager", assignee: 2, assigneeName: "Sipho Approver", label: "Line Manager Review", status: "approved", decision: "accept", approvedAt: "2026-03-02T10:00:00.000Z", notes: "OK", decidedAt: "2026-03-02T10:00:00.000Z", decidedById: null, decidedByName: null },
    { order: 2, role: "hr", assignee: 3, assigneeName: "Lindiwe HR", label: "HR Review", status: "approved", decision: "org", approvedAt: "2026-03-03T10:00:00.000Z", notes: "Approved", decidedAt: "2026-03-03T10:00:00.000Z", decidedById: null, decidedByName: null },
  ], 2n);

  await prisma.approvalOption.createMany({
    data: [
      { id: "ao-1", value: "return", label: "Return - Team member to provide additional information." },
      { id: "ao-2", value: "accept", label: "Approved - Team Member to accept the actual GHE or offered GHE in their personal capacity." },
      { id: "ao-3", value: "org", label: "Approved - Team Member to share the actual GHE or offered GHE with the Organisation Pool." },
      { id: "ao-4", value: "foundation", label: "Approved - Team Member to donate the actual GHE or offered GHE to the Hollywood Foundation." },
      { id: "ao-5", value: "decline", label: "Declined - Team Member to return the actual GHE or regret the offered GHE." },
    ],
  });

  // Explicit fixture ids must not collide with later autoincrement inserts.
  const { resetIdentitySequences } = await import("../services/normalization");
  await resetIdentitySequences(prisma);

  await prisma.$disconnect();

  // Reporting views are migration-owned; nothing else to do here.
}

export async function teardown() {
  const prisma = new PrismaClient();
  await prisma.$disconnect();
  if (embedded) {
    try {
      await embedded.stop();
    } catch {
      // Best-effort: the OS reclaims the postmaster in any case.
    }
    embedded = null;
  }
}
