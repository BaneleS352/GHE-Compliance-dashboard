import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { execFileSync } from "child_process";

const TEST_DB_URL = "file:./test.db";

export async function setup() {
  process.env.DATABASE_URL = TEST_DB_URL;
  process.env.JWT_SECRET = "test-secret";

  // Invoke the LOCAL Prisma CLI directly via node instead of `npx`: on hosts
  // where npx resolves a different (or no) Prisma version, `db push` fails
  // with a schema-engine error before any test runs.
  let prismaBin: string;
  try {
    prismaBin = require.resolve("prisma/build/index.js");
  } catch {
    throw new Error(
      "Cannot resolve the local Prisma CLI (node_modules/prisma). " +
        "Ensure dependencies are installed (`npm install`, which runs `prisma generate` via postinstall).",
    );
  }
  // Surface schema-engine failures loudly: with stdio "pipe" a failed
  // `db push` otherwise aborts the run with no diagnostics and no tests run.
  try {
    execFileSync(
      process.execPath,
      [prismaBin, "db", "push", "--force-reset", "--skip-generate"],
      {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: TEST_DB_URL },
        stdio: "pipe",
      },
    );
  } catch (err: any) {
    const detail =
      err?.stdout?.toString() || err?.stderr?.toString() || err?.message || String(err);
    console.error(
      "Test database setup failed (`prisma db push --force-reset`).\n" +
        "Ensure dependencies are installed (`npm install`, which runs `prisma generate` via postinstall),\n" +
        "then re-run `npm test`. Engine output:\n" + detail,
    );
    throw new Error(`Test database setup failed: ${detail.split("\n")[0]}`);
  }

  const prisma = new PrismaClient();
  const hash = bcrypt.hashSync("password", 10);

  await prisma.user.createMany({
    data: [
      { id: "user-admin", name: "Admin User", email: "admin@test.com", passwordHash: hash, role: "admin", teamMemberNumber: "ADM-001", department: "IT", position: "System Admin", lineManager: null },
      { id: "user-approver", name: "Sipho Approver", email: "sipho@test.com", passwordHash: hash, role: "approver", teamMemberNumber: "APR-001", department: "Marketing", position: "Line Manager", lineManager: null },
      { id: "user-hr", name: "Lindiwe HR", email: "lindiwe@test.com", passwordHash: hash, role: "approver", teamMemberNumber: "APR-002", department: "HR", position: "Head of HR", lineManager: null },
      { id: "user-team", name: "Nomvula Team", email: "nomvula@test.com", passwordHash: hash, role: "teamMember", teamMemberNumber: "TM-001", department: "Marketing", position: "Brand Manager", lineManager: "user-approver" },
    ],
  });
  // Normalized user links (manager FK).
  await prisma.user.update({ where: { id: "user-team" }, data: { managerId: "user-approver" } });

  await prisma.systemConfig.create({
    data: { id: "default", highValueThreshold: 1000, mediumValueThreshold: 1000, slaEscalationDays: 3, maxDeclarationsPerCounterparty: 5, emailTemplate: "Test {{ApproverName}}", notificationTemplates: "{}" },
  });

  // Workflow rules + row-only step definitions.
  await prisma.workflowRule.createMany({
    data: [
      { id: "rule-1", name: "Low Value", condition: "low", priority: 1 },
      { id: "rule-2", name: "High Value", condition: "high", priority: 2 },
    ],
  });
  await (prisma as any).workflowRuleStep.createMany({
    data: [
      { ruleId: "rule-1", order: 1, role: "lineManager", label: "Line Manager Review" },
      { ruleId: "rule-2", order: 1, role: "lineManager", label: "Line Manager Review" },
      { ruleId: "rule-2", order: 2, role: "hr", label: "HR Review" },
    ],
  });

  // Counterparties (one row per name for the fixture org-less scope).
  const cpA = await (prisma as any).counterparty.create({ data: { name: "Supplier A" } });
  const cpB = await (prisma as any).counterparty.create({ data: { name: "Supplier B" } });
  const cpC = await (prisma as any).counterparty.create({ data: { name: "Supplier C" } });

  // Lean declarations + snapshots + details.
  const decls = [
    {
      id: "GHE-TEST-001", type: "Gift", value: 100, status: "Pending", priority: "Low",
      eventDate: new Date("2026-01-14T00:00:00.000Z"), submittedAt: new Date("2026-01-15T00:00:00.000Z"),
      declarerUserId: "user-team", currentApproverUserId: "user-approver", counterpartyId: cpA.id,
      snap: { declarerName: "Nomvula Team", employeeNumber: "TM-001", positionTitle: "Brand Manager", department: "Marketing", managerDisplayName: "Sipho Approver" },
      det: { description: "Test declaration", occasion: "Business Meeting", relationship: "Test", receivedGiven: "Received", fromField: "Supplier", contactPerson: "John", biddingProcess: "No", instances: "1", publicOfficial: "No" },
    },
    {
      id: "GHE-TEST-002", type: "Gift", value: 500, status: "Pending", priority: "Medium",
      eventDate: new Date("2026-01-30T00:00:00.000Z"), submittedAt: new Date("2026-02-01T00:00:00.000Z"),
      declarerUserId: "user-team", currentApproverUserId: "user-approver", counterpartyId: cpB.id,
      snap: { declarerName: "Nomvula Team", employeeNumber: "TM-001", positionTitle: "Brand Manager", department: "Marketing", managerDisplayName: "Sipho Approver" },
      det: { description: "Second test", occasion: "Milestone", relationship: "Test", receivedGiven: "Given", fromField: "Customer", contactPerson: "Jane", biddingProcess: "No", instances: "1", publicOfficial: "No" },
    },
    {
      id: "GHE-TEST-003", type: "Hospitality", value: 3000, status: "Approved", priority: "High",
      eventDate: new Date("2026-02-28T00:00:00.000Z"), submittedAt: new Date("2026-03-01T00:00:00.000Z"),
      declarerUserId: "user-team", currentApproverUserId: null, counterpartyId: cpC.id,
      snap: { declarerName: "Nomvula Team", employeeNumber: "TM-001", positionTitle: "Brand Manager", department: "Marketing", managerDisplayName: "Sipho Approver" },
      det: { description: "High value", occasion: "Other", relationship: "Test", receivedGiven: "Received", fromField: "Supplier", contactPerson: "Bob", biddingProcess: "Yes", instances: "2", publicOfficial: "No" },
    },
  ];
  for (const d of decls) {
    const { snap, det, ...row } = d;
    await prisma.declaration.create({ data: row });
    await (prisma as any).declarationSnapshot.create({ data: { declarationId: d.id, ...snap } });
    await (prisma as any).declarationDetail.create({ data: { declarationId: d.id, ...det } });
  }

  // Workflow instances: rows only (no JSON).
  const { persistWorkflowInstanceSteps } = await import("../services/normalization");
  await persistWorkflowInstanceSteps("GHE-TEST-001", [
    { order: 1, role: "lineManager", assignee: "user-approver", assigneeName: "Sipho Approver", label: "Line Manager Review", status: "pending", decision: null, approvedAt: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null },
  ], "rule-1");
  await persistWorkflowInstanceSteps("GHE-TEST-002", [
    { order: 1, role: "lineManager", assignee: "user-approver", assigneeName: "Sipho Approver", label: "Line Manager Review", status: "pending", decision: null, approvedAt: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null },
    { order: 2, role: "hr", assignee: "user-hr", assigneeName: "Lindiwe HR", label: "HR Review", status: "pending", decision: null, approvedAt: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null },
  ], "rule-2");
  await persistWorkflowInstanceSteps("GHE-TEST-003", [
    { order: 1, role: "lineManager", assignee: "user-approver", assigneeName: "Sipho Approver", label: "Line Manager Review", status: "approved", decision: "accept", approvedAt: "2026-03-02T10:00:00.000Z", notes: "OK", decidedAt: "2026-03-02T10:00:00.000Z", decidedById: null, decidedByName: null },
    { order: 2, role: "hr", assignee: "user-hr", assigneeName: "Lindiwe HR", label: "HR Review", status: "approved", decision: "org", approvedAt: "2026-03-03T10:00:00.000Z", notes: "Approved", decidedAt: "2026-03-03T10:00:00.000Z", decidedById: null, decidedByName: null },
  ], "rule-2");

  await prisma.approvalOption.createMany({
    data: [
      { id: "ao-1", value: "return", label: "Return - Team member to provide additional information." },
      { id: "ao-2", value: "accept", label: "Approved - Team Member to accept the actual GHE or offered GHE in their personal capacity." },
      { id: "ao-3", value: "org", label: "Approved - Team Member to share the actual GHE or offered GHE with the Organisation Pool." },
      { id: "ao-4", value: "foundation", label: "Approved - Team Member to donate the actual GHE or offered GHE to the Hollywood Foundation." },
      { id: "ao-5", value: "decline", label: "Declined - Team Member to return the actual GHE or regret the offered GHE." },
    ],
  });

  await prisma.$disconnect();

  // Reporting views (SQLite) are created lazily by reportingViews; nothing else to do here.
}

export async function teardown() {
  const prisma = new PrismaClient();
  // Can't easily delete all tables, so just disconnect
  await prisma.$disconnect();
}
