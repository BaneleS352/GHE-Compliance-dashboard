/**
 * PostgreSQL integration checks (worker).
 *
 * Runs INSIDE a process whose Prisma client was generated for the
 * `postgresql` provider with DATABASE_URL pointing at a dedicated,
 * disposable PostgreSQL database. Invoked by `pg-integration.ts`
 * (orchestrator), which swaps the provider, migrates, then restores the
 * SQLite workflow. Also runs in CI (see
 * .github/workflows/postgres-normalization.yml).
 *
 * Covers every scoped reporting view plus FK enforcement and the
 * backfill/verify gates. Exits 0 on success, 1 with diagnostics otherwise.
 */
import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma";
import { backfillNormalization, formatBackfillReport } from "./backfill-normalization";
import { verifyNormalization, formatVerifyResult } from "./verify-normalization";
import {
  ensureReportingViews,
  viewStatusSummary,
  viewMonthly,
  viewTypeBreakdown,
  viewCounterparty,
  viewHighValue,
  viewSlaRows,
  viewCurrentSteps,
} from "../services/reportingViews";
import { writeWorkflowStepsTx } from "../services/normalization";

const failures: string[] = [];
let checks = 0;

function check(name: string, cond: boolean, detail?: string) {
  checks++;
  if (cond) {
    console.log(`ok   - ${name}`);
  } else {
    failures.push(name);
    console.log(`FAIL - ${name}${detail ? `: ${detail}` : ""}`);
  }
}

function equiv(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function wipe() {
  const p: any = prisma;
  await p.workflowInstanceStep.deleteMany();
  await p.workflowInstance.deleteMany();
  await p.declarationFile.deleteMany();
  await p.uploadedFile.deleteMany();
  await p.declarationSnapshot.deleteMany();
  await p.declarationDetail.deleteMany();
  await p.declaration.deleteMany();
  await p.counterpartyContact.deleteMany();
  await p.counterparty.deleteMany();
  await p.workflowRuleStep.deleteMany();
  await p.workflowRule.deleteMany();
  await p.userRole.deleteMany();
  await p.user.deleteMany();
  await p.team.deleteMany();
  await p.department.deleteMany();
  await p.organizationSetting.deleteMany();
  await p.organization.deleteMany();
  await p.systemConfig.deleteMany();
}

async function main() {
  const url = process.env.DATABASE_URL || "";
  if (!url.startsWith("postgres")) {
    console.error("pg-integration-checks requires DATABASE_URL pointing at PostgreSQL");
    process.exit(2);
  }
  console.log(`PostgreSQL integration checks against ${url.replace(/:[^:@/]+@/, ":***@")}`);

  await wipe();

  const hash = bcrypt.hashSync("password", 4);
  const p: any = prisma;
  for (const org of [
    { id: "pg-org-a", name: "PG Org A", shortCode: "PGA" },
    { id: "pg-org-b", name: "PG Org B", shortCode: "PGB" },
  ]) {
    await p.organization.create({ data: org });
  }
  const users = [
    { id: "pg-lm-a", name: "PG LM A", email: "pg-lm-a@x.test", role: "approver", teamMemberNumber: "PG-1", department: "Sales", position: "Line Manager", organizationId: "pg-org-a" },
    { id: "pg-hr-a", name: "PG HR A", email: "pg-hr-a@x.test", role: "approver", teamMemberNumber: "PG-2", department: "HR", position: "Head of HR", organizationId: "pg-org-a" },
    { id: "pg-tm-a", name: "PG TM A", email: "pg-tm-a@x.test", role: "teamMember", teamMemberNumber: "PG-3", department: "Sales", position: "Rep", lineManager: "pg-lm-a", organizationId: "pg-org-a" },
    { id: "pg-lm-b", name: "PG LM B", email: "pg-lm-b@x.test", role: "approver", teamMemberNumber: "PG-4", department: "Sales", position: "Line Manager", organizationId: "pg-org-b" },
    { id: "pg-tm-b", name: "PG TM B", email: "pg-tm-b@x.test", role: "teamMember", teamMemberNumber: "PG-5", department: "Sales", position: "Rep", lineManager: "pg-lm-b", organizationId: "pg-org-b" },
  ];
  for (const u of users) await p.user.create({ data: { ...u, passwordHash: hash } });
  await p.systemConfig.create({
    data: { id: "default", highValueThreshold: 1000, mediumValueThreshold: 1000, slaEscalationDays: 3, maxDeclarationsPerCounterparty: 5, emailTemplate: "t", notificationTemplates: "{}" },
  });
  for (const r of [
    { id: "rule-1", name: "Low", condition: "low", priority: 1, steps: JSON.stringify([{ order: 1, role: "lineManager", label: "Line Manager Review" }]) },
    { id: "rule-2", name: "High", condition: "high", priority: 2, steps: JSON.stringify([{ order: 1, role: "lineManager", label: "Line Manager Review" }, { order: 2, role: "hr", label: "HR Review" }]) },
  ]) {
    await p.workflowRule.create({ data: r });
  }

  const decls = [
    { id: "PG-2026-0001", org: "pg-org-a", emp: "pg-tm-a", tm: "PG TM A", status: "Pending", type: "Gift", cp: "Acme", value: 100, date: "2026-01-10", submitted: "2026-01-11" },
    { id: "PG-2026-0002", org: "pg-org-a", emp: "pg-tm-a", tm: "PG TM A", status: "Approved", type: "Hospitality", cp: "Acme", value: 5000, date: "2026-02-10", submitted: "2026-02-11" },
    { id: "PG-2026-0003", org: "pg-org-a", emp: "pg-tm-a", tm: "PG TM A", status: "Declined", type: "Gift", cp: "Globex", value: 50, date: "2026-02-12", submitted: "2026-02-13" },
    { id: "PG-2026-0004", org: "pg-org-b", emp: "pg-tm-b", tm: "PG TM B", status: "Pending", type: "Entertainment", cp: "Initech", value: 9000, date: "2026-03-01", submitted: "2026-03-02" },
  ];
  for (const d of decls) {
    await p.declaration.create({
      data: {
        id: d.id, employee: d.tm, employeeId: d.emp, teamMemberNumber: "PG-X", lineManager: "PG LM",
        position: "Rep", department: "Sales", type: d.type, counterparty: d.cp, value: d.value,
        submitted: d.submitted, approver: "PG LM", status: d.status, priority: "Low",
        description: "pg fixture", relationship: "Supplier", receivedGiven: "Received",
        fromField: "Supplier", contactPerson: "C", biddingProcess: "No",
        occasion: "Business Meeting", date: d.date, instances: "1", publicOfficial: "No",
        organizationId: d.org,
      },
    });
  }
  // Instances: one 2-step (LM approved, HR pending) in org A, one 1-step pending in org B.
  await writeWorkflowStepsTx(
    p, "PG-2026-0002",
    [
      { order: 1, role: "lineManager", assignee: "pg-lm-a", assigneeName: "PG LM A", label: "Line Manager Review", status: "approved", decision: "accept", approvedAt: "2026-02-12T10:00:00.000Z", notes: "ok", decidedAt: "2026-02-12T10:00:00.000Z", decidedById: "pg-lm-a", decidedByName: "PG LM A" },
      { order: 2, role: "hr", assignee: "pg-hr-a", assigneeName: "PG HR A", label: "HR Review", status: "pending", decision: null, approvedAt: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null },
    ] as any,
    "rule-2",
  );
  await writeWorkflowStepsTx(
    p, "PG-2026-0001",
    [
      { order: 1, role: "lineManager", assignee: "pg-lm-a", assigneeName: "PG LM A", label: "Line Manager Review", status: "pending", decision: null, approvedAt: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null },
    ] as any,
    "rule-1",
  );
  await writeWorkflowStepsTx(
    p, "PG-2026-0004",
    [
      { order: 1, role: "lineManager", assignee: "pg-lm-b", assigneeName: "PG LM B", label: "Line Manager Review", status: "pending", decision: null, approvedAt: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null },
      { order: 2, role: "hr", assignee: "pg-hr-a", assigneeName: "PG HR A", label: "HR Review", status: "pending", decision: null, approvedAt: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null },
    ] as any,
    "rule-2",
  );

  // Backfill + verify gates on PostgreSQL.
  const bf = await backfillNormalization();
  console.log(formatBackfillReport(bf));
  check("backfill links all declarations", bf.declarations.total === 4 && bf.declarations.snapshots === 4);
  const vr = await verifyNormalization();
  console.log(formatVerifyResult(vr));
  check("verify reports zero drift", vr.ok, formatVerifyResult(vr));

  await ensureReportingViews();

  // 1. Status summary, org-scoped.
  const expectedA: Record<string, number> = {};
  for (const d of decls.filter((d) => d.org === "pg-org-a")) expectedA[d.status] = (expectedA[d.status] || 0) + 1;
  check("view status summary org A", equiv(await viewStatusSummary("pg-org-a"), expectedA), JSON.stringify(await viewStatusSummary("pg-org-a")));
  check("view status summary org B", equiv(await viewStatusSummary("pg-org-b"), { Pending: 1 }));
  const global = await viewStatusSummary(undefined);
  check("view status summary global", global !== null && global.Pending === 2 && global.Approved === 1 && global.Declined === 1);

  // 2. Monthly volume/outcomes.
  const monthlyA = await viewMonthly("pg-org-a");
  check("view monthly org A", Array.isArray(monthlyA) && monthlyA.length === 2, JSON.stringify(monthlyA));
  const feb = (monthlyA as any[]).find((m) => m.month === "2026-02");
  check("view monthly Feb outcomes", !!feb && Number(feb.count) === 2 && Number(feb.approved) === 1 && Number(feb.declined) === 1, JSON.stringify(feb));

  // 3. Type breakdown.
  const typesA = await viewTypeBreakdown("pg-org-a");
  const gift = (typesA as any[]).find((t) => t.type === "Gift");
  check("view type breakdown org A", !!gift && Number(gift.count) === 2 && Number(gift.totalValue) === 150, JSON.stringify(typesA));

  // 4. Current step + pending assignee, org-scoped.
  const curA = (await viewCurrentSteps("pg-org-a")) as any[];
  check("view current steps org A", Array.isArray(curA) && curA.length === 2, JSON.stringify(curA));
  const hrPending = curA.find((s) => s.role === "hr");
  check("view current step HR assignee", !!hrPending && hrPending.assigneeId === "pg-hr-a", JSON.stringify(hrPending));
  const curB = (await viewCurrentSteps("pg-org-b")) as any[];
  check("view current steps org B isolated", Array.isArray(curB) && curB.length === 2 && curB.every((s) => ["pg-lm-b", "pg-hr-a"].includes(s.assigneeId)), JSON.stringify(curB));

  // 5. SLA rows from relational steps.
  const sla = (await viewSlaRows()) as any[];
  check("view SLA rows present", Array.isArray(sla) && sla.length === 1 && sla[0].role === "lineManager", JSON.stringify(sla));

  // 6. Counterparty concentration, org-scoped.
  const cpA = await viewCounterparty("pg-org-a");
  const acme = cpA?.find((c) => c.counterparty === "Acme");
  check("view counterparty org A", !!acme && acme.count === 2 && acme.totalValue === 5100, JSON.stringify(cpA));
  const cpB = await viewCounterparty("pg-org-b");
  check("view counterparty org B isolated", !!cpB && cpB.length === 1 && cpB[0].counterparty === "Initech", JSON.stringify(cpB));

  // 7. High-value declarations, org-scoped + threshold.
  const hvA = (await viewHighValue("pg-org-a", 1000)) as any[];
  check("view high-value org A threshold", Array.isArray(hvA) && hvA.length === 1 && hvA[0].counterparty === "Acme" && Number(hvA[0].value) === 5000, JSON.stringify(hvA));

  // FK enforcement: bogus ruleId must fail; rule delete nulls instance ruleId.
  let fkBlocked = false;
  try {
    await p.workflowInstance.create({ data: { declarationId: "PG-2026-0003", steps: "[]", ruleId: "rule-missing" } });
  } catch {
    fkBlocked = true;
  }
  check("FK blocks unknown ruleId", fkBlocked);
  await p.workflowRule.delete({ where: { id: "rule-1" } });
  const orphan = await p.workflowInstance.findUnique({ where: { declarationId: "PG-2026-0001" } });
  check("rule delete SET NULLs instance ruleId", (orphan as any)?.ruleId === null, JSON.stringify((orphan as any)?.ruleId));

  console.log(`\n${checks - failures.length}/${checks} checks passed`);
  if (failures.length > 0) {
    console.error(`FAILED: ${failures.join("; ")}`);
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
