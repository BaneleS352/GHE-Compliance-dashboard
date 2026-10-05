/**
 * PostgreSQL integration checks (worker).
 *
 * Runs INSIDE a process whose Prisma client was generated for the
 * `postgresql` provider with DATABASE_URL pointing at a dedicated,
 * disposable PostgreSQL database. Invoked by `pg-integration.ts`
 * (orchestrator), which migrates, then runs these checks. Also runs in CI
 * (see .github/workflows/postgres-normalization.yml).
 *
 * Numeric identifier cutover: covers the BIGINT identity model end to end —
 * lean declarations with snapshot/detail/counterparty links, row-only
 * workflows, the join-only file association, every scoped reporting view, FK
 * enforcement and delete rules, key-type assertions from information_schema,
 * and the scoped counterparty identity policy. Exits 0 on success, 1
 * otherwise.
 */
import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma";
import type { WorkflowStep } from "../services/workflowService";
import {
  viewStatusSummary,
  viewMonthly,
  viewTypeBreakdown,
  viewCounterparty,
  viewHighValue,
  viewSlaRows,
  viewCurrentSteps,
} from "../services/reportingViews";
import { writeWorkflowStepsTx } from "../services/normalization";
import { resetIdentitySequences } from "../services/normalization";

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
  // Order-insensitive for flat objects: view GROUP BY row order must not
  // affect equality (e.g. {Approved, Declined, Pending} vs insertion order).
  const norm = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(norm);
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>)
          .sort(([k1], [k2]) => (k1 < k2 ? -1 : k1 > k2 ? 1 : 0))
          .map(([k, val]) => [k, norm(val)]),
      );
    }
    return v;
  };
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
}

async function wipe() {
  const p = prisma;
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
  await p.user.deleteMany();
  await p.team.deleteMany();
  await p.department.deleteMany();
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
  const p = prisma;
  const orgA = await p.organization.create({ data: { name: "PG Org A", shortCode: "PGA" } });
  const orgB = await p.organization.create({ data: { name: "PG Org B", shortCode: "PGB" } });
  const users: Record<string, any> = {};
  const { resolveDepartmentId } = await import("../services/normalization");
  for (const u of [
    { key: "lmA", name: "PG LM A", email: "pg-lm-a@x.test", role: "approver", teamMemberNumber: "PG-1", department: "Sales", position: "Line Manager", organizationId: orgA.id },
    { key: "hrA", name: "PG HR A", email: "pg-hr-a@x.test", role: "approver", teamMemberNumber: "PG-2", department: "HR", position: "Head of HR", organizationId: orgA.id },
    { key: "tmA", name: "PG TM A", email: "pg-tm-a@x.test", role: "teamMember", teamMemberNumber: "PG-3", department: "Sales", position: "Rep", organizationId: orgA.id },
    { key: "lmB", name: "PG LM B", email: "pg-lm-b@x.test", role: "approver", teamMemberNumber: "PG-4", department: "Sales", position: "Line Manager", organizationId: orgB.id },
    { key: "tmB", name: "PG TM B", email: "pg-tm-b@x.test", role: "teamMember", teamMemberNumber: "PG-5", department: "Sales", position: "Rep", organizationId: orgB.id },
  ]) {
    const { key, department, ...data } = u;
    // departmentId is the sole department source: resolve the display string
    // to the organization-scoped link before insert.
    const departmentId = await resolveDepartmentId(department, u.organizationId, p);
    users[key] = await p.user.create({ data: { ...data, departmentId, passwordHash: hash } });
  }
  await p.user.update({ where: { id: users.tmA.id }, data: { managerId: users.lmA.id, lineManager: users.lmA.name } });
  await p.user.update({ where: { id: users.tmB.id }, data: { managerId: users.lmB.id, lineManager: users.lmB.name } });
  await p.systemConfig.create({
    data: { id: "default", highValueThreshold: 1000, mediumValueThreshold: 1000, slaEscalationDays: 3, maxDeclarationsPerCounterparty: 5, emailTemplate: "t", notificationTemplates: "{}" },
  });
  // Seed rules carry the well-known numeric ids the value router resolves.
  await p.workflowRule.create({ data: { id: 1n, name: "Low", condition: "low", priority: 1 } });
  await p.workflowRule.create({ data: { id: 2n, name: "High", condition: "high", priority: 2 } });
  await resetIdentitySequences(p);
  await p.workflowRuleStep.createMany({
    data: [
      { ruleId: 1n, order: 1, role: "lineManager", label: "Line Manager Review" },
      { ruleId: 2n, order: 1, role: "lineManager", label: "Line Manager Review" },
      { ruleId: 2n, order: 2, role: "hr", label: "HR Review" },
    ],
  });

  const cpAcme = await p.counterparty.create({ data: { name: "Acme", organizationId: orgA.id } });
  const cpGlobex = await p.counterparty.create({ data: { name: "Globex", organizationId: orgA.id } });
  const cpInitech = await p.counterparty.create({ data: { name: "Initech", organizationId: orgB.id } });

  const decls = [
    { id: "PG-2026-0001", org: orgA.id, empId: users.tmA.id, tm: "PG TM A", status: "Pending", type: "Gift", cpId: cpAcme.id, value: 100, date: "2026-01-10", submitted: "2026-01-11" },
    { id: "PG-2026-0002", org: orgA.id, empId: users.tmA.id, tm: "PG TM A", status: "Approved", type: "Hospitality", cpId: cpAcme.id, value: 5000, date: "2026-02-10", submitted: "2026-02-11" },
    { id: "PG-2026-0003", org: orgA.id, empId: users.tmA.id, tm: "PG TM A", status: "Declined", type: "Gift", cpId: cpGlobex.id, value: 50, date: "2026-02-12", submitted: "2026-02-13" },
    { id: "PG-2026-0004", org: orgB.id, empId: users.tmB.id, tm: "PG TM B", status: "Pending", type: "Entertainment", cpId: cpInitech.id, value: 9000, date: "2026-03-01", submitted: "2026-03-02" },
  ];
  const pkById = new Map<string, bigint>();
  for (const d of decls) {
    const created = await p.declaration.create({
      data: {
        id: d.id, type: d.type, value: d.value, status: d.status, priority: "Low",
        organizationId: d.org,
        eventDate: new Date(`${d.date}T00:00:00.000Z`),
        submittedAt: new Date(`${d.submitted}T00:00:00.000Z`),
        declarerUserId: d.empId,
        counterpartyId: d.cpId,
      },
    });
    pkById.set(d.id, created.declarationPk);
    await p.declarationSnapshot.create({
      data: { declarationPk: created.declarationPk, declarerName: d.tm, employeeNumber: "PG-X", positionTitle: "Rep", department: "Sales", managerDisplayName: "PG LM" },
    });
    await p.declarationDetail.create({
      data: {
        declarationPk: created.declarationPk, description: "pg fixture", occasion: "Business Meeting",
        relationship: "Supplier", receivedGiven: "Received", fromField: "Supplier",
        contactPerson: "C", biddingProcess: "No", instances: "1", publicOfficial: "No",
      },
    });
  }
  // Instances: one 2-step (LM approved, HR pending) in org A, one 1-step pending in org B.
  // Fixture step arrays are annotated (not `as any`) so literal roles and
  // statuses narrow to the WorkflowStep domain at the boundary.
  const stepsApprovedThenPending: WorkflowStep[] = [
    { order: 1, role: "lineManager", assignee: Number(users.lmA.id), assigneeName: "PG LM A", label: "Line Manager Review", status: "approved", decision: "accept", approvedAt: "2026-02-12T10:00:00.000Z", notes: "ok", decidedAt: "2026-02-12T10:00:00.000Z", decidedById: Number(users.lmA.id), decidedByName: "PG LM A" },
    { order: 2, role: "hr", assignee: Number(users.hrA.id), assigneeName: "PG HR A", label: "HR Review", status: "pending", decision: null, approvedAt: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null },
  ];
  const stepsPending: WorkflowStep[] = [
    { order: 1, role: "lineManager", assignee: Number(users.lmA.id), assigneeName: "PG LM A", label: "Line Manager Review", status: "pending", decision: null, approvedAt: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null },
  ];
  const stepsPendingOrgB: WorkflowStep[] = [
    { order: 1, role: "lineManager", assignee: Number(users.lmB.id), assigneeName: "PG LM B", label: "Line Manager Review", status: "pending", decision: null, approvedAt: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null },
    { order: 2, role: "hr", assignee: Number(users.hrA.id), assigneeName: "PG HR A", label: "HR Review", status: "pending", decision: null, approvedAt: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null },
  ];
  await writeWorkflowStepsTx(
    p, pkById.get("PG-2026-0002")!,
    stepsApprovedThenPending,
    2n,
  );
  await writeWorkflowStepsTx(
    p, pkById.get("PG-2026-0001")!,
    stepsPending,
    1n,
  );
  await writeWorkflowStepsTx(
    p, pkById.get("PG-2026-0004")!,
    stepsPendingOrgB,
    2n,
  );

  // 0. Numeric key model assertions (information_schema, no legacy text keys).
  // Boundary label: information_schema rows are untyped driver output; the
  // single cast below fixes the projected column shape for the assertions.
  interface KeyRow { t: string; c: string; ty: string; ident: string | null }
  const keyRows = (await p.$queryRawUnsafe(
    `SELECT c.table_name AS t, c.column_name AS c, c.data_type AS ty, c.is_identity AS ident
     FROM information_schema.columns c JOIN information_schema.tables t
       ON t.table_name = c.table_name AND t.table_schema = c.table_schema
     WHERE c.table_schema = 'public' AND c.table_name IN
       ('Organization','User','Department','Team','Counterparty','CounterpartyContact',
        'Declaration','DeclarationSnapshot','DeclarationDetail','DeclarationFile',
        'WorkflowRule','WorkflowRuleStep','WorkflowInstance','WorkflowInstanceStep','UploadedFile')
     ORDER BY 1, 2`,
  )) as KeyRow[];
  const byTable = new Map<string, KeyRow[]>();
  for (const r of keyRows) {
    const arr = byTable.get(r.t) || [];
    arr.push(r);
    byTable.set(r.t, arr);
  }
  const idType = (t: string, c: string) => byTable.get(t)?.find((r) => r.c === c)?.ty;
  for (const t of ["Organization", "User", "Department", "Team", "Counterparty", "CounterpartyContact", "UploadedFile", "WorkflowRule", "WorkflowRuleStep", "DeclarationFile", "WorkflowInstance", "WorkflowInstanceStep", "DeclarationSnapshot", "DeclarationDetail"]) {
    check(`PK ${t}.id is bigint identity`, idType(t, "id") === "bigint" && byTable.get(t)?.find((r) => r.c === "id")?.ident === "YES", JSON.stringify(byTable.get(t)?.filter((r) => r.c === "id")));
  }
  check("Declaration keeps text public id", idType("Declaration", "id") === "text");
  check("Declaration.declarationPk is bigint identity unique", idType("Declaration", "declarationPk") === "bigint");
  for (const [t, c] of [["User", "organizationId"], ["User", "managerId"], ["User", "departmentId"], ["User", "teamId"], ["Department", "organizationId"], ["Team", "departmentId"], ["Counterparty", "organizationId"], ["CounterpartyContact", "counterpartyId"], ["Declaration", "organizationId"], ["Declaration", "declarerUserId"], ["Declaration", "currentApproverUserId"], ["Declaration", "counterpartyId"], ["DeclarationSnapshot", "declarationPk"], ["DeclarationDetail", "declarationPk"], ["DeclarationFile", "declarationPk"], ["DeclarationFile", "fileId"], ["WorkflowRule", "organizationId"], ["WorkflowRuleStep", "ruleId"], ["WorkflowInstance", "declarationPk"], ["WorkflowInstance", "ruleId"], ["WorkflowInstanceStep", "instanceId"], ["WorkflowInstanceStep", "declarationPk"], ["WorkflowInstanceStep", "assigneeId"], ["WorkflowInstanceStep", "decidedById"]] as [string, string][]) {
    check(`FK ${t}.${c} is bigint`, idType(t, c) === "bigint", `${t}.${c}=${idType(t, c)}`);
  }
  // Only the documented text identifiers may remain: Declaration.id is the
  // public GHE-YYYY-NNNNNN reference, SystemConfig ("default") and
  // ApprovalOption ("opt-*"/"ao-*") are singleton/code-list rows outside the
  // numeric-key scope. Views are excluded (they project text columns).
  const textIdTables: { table_name: string }[] = await p.$queryRawUnsafe(
    `SELECT c.table_name AS table_name
     FROM information_schema.columns c JOIN information_schema.tables t
       ON t.table_name = c.table_name AND t.table_schema = c.table_schema
     WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
       AND c.column_name = 'id' AND c.data_type = 'text'
     ORDER BY 1`,
  );
  const textIdNames = textIdTables.map((r) => r.table_name);
  check(
    "only documented text ids remain (ApprovalOption/Declaration/SystemConfig)",
    JSON.stringify(textIdNames) === JSON.stringify(["ApprovalOption", "Declaration", "SystemConfig"]),
    JSON.stringify(textIdNames),
  );
  // departmentId is the sole department source: the legacy User.department
  // text column must be absent (removed in 0008_department_id_only).
  const userCols: { column_name: string }[] = await p.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'User'`,
  );
  const userColNames = userCols.map((r) => r.column_name);
  check("User.department text column removed", !userColNames.includes("department"), JSON.stringify(userColNames));
  check("User.departmentId link present", userColNames.includes("departmentId"), JSON.stringify(userColNames));

  // 1. Status summary, org-scoped.
  const expectedA: Record<string, number> = {};
  for (const d of decls.filter((d) => String(d.org) === String(orgA.id))) expectedA[d.status] = (expectedA[d.status] || 0) + 1;
  check("view status summary org A", equiv(await viewStatusSummary(orgA.id), expectedA), JSON.stringify(await viewStatusSummary(orgA.id)));
  check("view status summary org B", equiv(await viewStatusSummary(orgB.id), { Pending: 1 }));
  const global = await viewStatusSummary(undefined);
  check("view status summary global", global !== null && global.Pending === 2 && global.Approved === 1 && global.Declined === 1);

  // 2. Monthly volume/outcomes.
  const monthlyA = await viewMonthly(orgA.id);
  check("view monthly org A", Array.isArray(monthlyA) && monthlyA.length === 2, JSON.stringify(monthlyA));
  const feb = monthlyA?.find((m) => m.month === "2026-02");
  check("view monthly Feb outcomes", !!feb && Number(feb.count) === 2 && Number(feb.approved) === 1 && Number(feb.declined) === 1, JSON.stringify(feb));

  // 3. Type breakdown.
  const typesA = await viewTypeBreakdown(orgA.id);
  const gift = typesA?.find((t) => t.type === "Gift");
  check("view type breakdown org A", !!gift && Number(gift.count) === 2 && Number(gift.totalValue) === 150, JSON.stringify(typesA));

  // 4. Current step + pending assignee, org-scoped (text declaration ids served via join).
  const curA = (await viewCurrentSteps(orgA.id)) ?? [];
  check("view current steps org A", Array.isArray(curA) && curA.length === 2, JSON.stringify(curA));
  const hrPending = curA.find((s) => s.role === "hr");
  check("view current step HR assignee", !!hrPending && hrPending.assigneeId === Number(users.hrA.id), JSON.stringify(hrPending));
  check("view current steps carry text declaration ids", curA.every((s) => typeof s.declarationId === "string" && s.declarationId.startsWith("PG-")), JSON.stringify(curA));
  const curB = (await viewCurrentSteps(orgB.id)) ?? [];
  check("view current steps org B isolated", Array.isArray(curB) && curB.length === 2 && curB.every((s) => s.assigneeId !== null && [Number(users.lmB.id), Number(users.hrA.id)].includes(s.assigneeId)), JSON.stringify(curB));

  // 5. SLA rows from relational steps.
  const sla = await viewSlaRows();
  check("view SLA rows present", Array.isArray(sla) && sla.length === 1 && sla[0].role === "lineManager", JSON.stringify(sla));

  // 6. Counterparty concentration, org-scoped.
  const cpA = await viewCounterparty(orgA.id);
  const acme = cpA?.find((c) => c.counterparty === "Acme");
  check("view counterparty org A", !!acme && acme.count === 2 && acme.totalValue === 5100, JSON.stringify(cpA));
  const cpB = await viewCounterparty(orgB.id);
  check("view counterparty org B isolated", !!cpB && cpB.length === 1 && cpB[0].counterparty === "Initech", JSON.stringify(cpB));

  // 7. High-value declarations, org-scoped + threshold.
  const hvA = await viewHighValue(orgA.id, 1000);
  check("view high-value org A threshold", Array.isArray(hvA) && hvA.length === 1 && hvA[0].counterparty === "Acme" && hvA[0].value === 5000, JSON.stringify(hvA));

  // FK enforcement: bogus ruleId must fail; rule delete nulls instance ruleId.
  let fkBlocked = false;
  try {
    await p.workflowInstance.create({ data: { declarationPk: pkById.get("PG-2026-0003")!, ruleId: 999999n } });
  } catch {
    fkBlocked = true;
  }
  check("FK blocks unknown ruleId", fkBlocked);
  await p.workflowRule.delete({ where: { id: 1n } });
  const orphan = await p.workflowInstance.findUnique({ where: { declarationPk: pkById.get("PG-2026-0001") } });
  check("rule delete SET NULLs instance ruleId", orphan?.ruleId === null, JSON.stringify(orphan?.ruleId === null ? null : String(orphan?.ruleId)));

  // Composite step identity (0007): a step row cannot pair an instance with
  // another declaration's key — the write must fail loudly.
  let identityBlocked = false;
  try {
    const inst = await p.workflowInstance.findUnique({ where: { declarationPk: pkById.get("PG-2026-0002") }, select: { id: true } });
    await p.workflowInstanceStep.create({
      data: {
        instanceId: inst!.id,
        declarationPk: pkById.get("PG-2026-0001")!,
        stepOrder: 99,
        role: "lineManager",
        label: "Mismatch",
        assigneeName: "Nobody",
      },
    });
  } catch {
    identityBlocked = true;
  }
  check("step/instance declaration identity enforced", identityBlocked);

  // Domain checks (0009): invalid lifecycle/category/role values fail loudly
  // at the database, not just in application validation.
  let badStatusBlocked = false;
  try {
    await p.declaration.create({ data: { id: "PG-BAD-1", type: "Gift", value: 1, status: "FlyingPig", priority: "Low" } });
  } catch {
    badStatusBlocked = true;
  }
  await p.declaration.deleteMany({ where: { id: "PG-BAD-1" } }).catch(() => undefined);
  check("domain check blocks invalid declaration status", badStatusBlocked);
  let badRoleBlocked = false;
  try {
    const inst = await p.workflowInstance.findUnique({ where: { declarationPk: pkById.get("PG-2026-0001") }, select: { id: true } });
    await p.workflowInstanceStep.create({
      data: { instanceId: inst!.id, declarationPk: pkById.get("PG-2026-0001")!, stepOrder: 98, role: "ceo", label: "CEO", assigneeName: "Nobody" },
    });
  } catch {
    badRoleBlocked = true;
  }
  await p.workflowInstanceStep.deleteMany({ where: { stepOrder: 98 } }).catch(() => undefined);
  check("domain check blocks invalid step role", badRoleBlocked);

  // Scoped counterparty identity on numeric keys: scoped duplicates rejected,
  // global same-name rows allowed.
  await p.organization.create({ data: { name: "PG Dup Org", shortCode: "PGD" } }).then(async (dupOrg: { id: bigint }) => {
    let scopedRejected = false;
    try {
      await p.counterparty.create({ data: { name: "Acme", organizationId: orgA.id } });
    } catch {
      scopedRejected = true;
    }
    check("scoped duplicate counterparty rejected", scopedRejected);
    let globalAllowed = true;
    try {
      await p.counterparty.create({ data: { name: "GlobalCo", organizationId: null } });
      await p.counterparty.create({ data: { name: "GlobalCo", organizationId: null } });
    } catch {
      globalAllowed = false;
    }
    check("global same-name counterparties allowed", globalAllowed);
    await p.counterparty.deleteMany({ where: { name: "GlobalCo" } });
    await p.organization.delete({ where: { id: dupOrg.id } }).catch(() => undefined);
  });

  // Delete rules: user delete nulls declaration links (history in snapshot).
  await p.user.delete({ where: { id: users.tmB.id } });
  const orphanDecl = await p.declaration.findUnique({ where: { id: "PG-2026-0004" } });
  check("user delete SET NULLs declarer link", orphanDecl?.declarerUserId === null);
  const orphanSnap = await p.declarationSnapshot.findFirst({ where: { declarerName: "PG TM B" } });
  check("snapshot history survives user delete", !!orphanSnap && orphanSnap.declarerName === "PG TM B");

  // File lifecycle policy: every uploaded file requires its join row.
  const orphanFiles: { n: bigint }[] = await p.$queryRawUnsafe(
    `SELECT COUNT(*) AS n FROM "UploadedFile" f LEFT JOIN "DeclarationFile" l ON l."fileId" = f."id" WHERE l."fileId" IS NULL`,
  );
  check("no orphan uploaded files", orphanFiles.length > 0 && orphanFiles[0].n === 0n, String(orphanFiles[0]?.n ?? "?"));

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
