import { prisma } from "../config/prisma";
import {
  parseDateSafe,
  ensureCounterparty,
  captureDeclarationSnapshot,
  syncDeclarationDetail,
  syncWorkflowRuleSteps,
  parseRuleStepDefs,
  persistWorkflowInstanceSteps,
} from "../services/normalization";
import { resolveRuleId } from "../services/workflowService";

export interface BackfillReport {
  users: { total: number; managerLinked: number; missingManagerRefs: string[]; rolesGranted: number };
  departments: { created: number; teams: number; unscopedUsers: number };
  reference: Record<string, { created: number; invalid: string[] }>;
  counterparties: { created: number; linked: number; missing: number };
  declarations: {
    total: number;
    eventDateBackfilled: number;
    submittedAtBackfilled: number;
    invalidDates: string[];
    declarerLinked: number;
    approverLinked: number;
    missingDeclarers: string[];
    missingApprovers: string[];
    snapshots: number;
    details: number;
  };
  workflows: { rules: number; ruleSteps: number; instances: number; instanceSteps: number; orphanInstances: string[]; corruptJson: string[]; ruleInferred: number };
  files: { total: number; orphanFiles: string[]; links: number };
}

const KNOWN_ROLES = ["admin", "approver", "teamMember"];

export async function backfillNormalization(): Promise<BackfillReport> {
  const report: BackfillReport = {
    users: { total: 0, managerLinked: 0, missingManagerRefs: [], rolesGranted: 0 },
    departments: { created: 0, teams: 0, unscopedUsers: 0 },
    reference: {},
    counterparties: { created: 0, linked: 0, missing: 0 },
    declarations: {
      total: 0, eventDateBackfilled: 0, submittedAtBackfilled: 0, invalidDates: [],
      declarerLinked: 0, approverLinked: 0, missingDeclarers: [], missingApprovers: [],
      snapshots: 0, details: 0,
    },
    workflows: { rules: 0, ruleSteps: 0, instances: 0, instanceSteps: 0, orphanInstances: [], corruptJson: [], ruleInferred: 0 },
    files: { total: 0, orphanFiles: [], links: 0 },
  };

  // ── Reference data ──
  for (const r of KNOWN_ROLES) {
    await (prisma as any).appRole.upsert({ where: { name: r }, create: { name: r }, update: {} });
  }

  const dropdowns = await prisma.dropdowns.findFirst();
  let dd: any = {};
  try { dd = dropdowns ? JSON.parse(dropdowns.data) : {}; } catch { dd = {}; }

  const refSpecs: { model: string; values: string[]; fromDeclarations?: string }[] = [
    { model: "refDeclarationType", values: dd.categories || ["Gift", "Hospitality", "Entertainment"] },
    { model: "refDeclarationStatus", values: ["Draft", "Pending", "Approved", "Declined", "Escalated", "Returned"] },
    { model: "refPriority", values: ["Low", "Medium", "High"] },
    { model: "refRelationshipType", values: dd.relationships || [] },
    { model: "refDirection", values: dd.receivedGiven || ["Received", "Given"] },
    { model: "refWorkflowStatus", values: ["pending", "approved", "declined", "returned", "skipped"] },
  ];
  for (const spec of refSpecs) {
    let created = 0;
    const invalid: string[] = [];
    const distinct = [...new Set(spec.values.map((v) => String(v).trim()).filter(Boolean))];
    for (const name of distinct) {
      try {
        const found = await (prisma as any)[spec.model].findUnique({ where: { name } });
        if (!found) {
          await (prisma as any)[spec.model].create({ data: { name } });
          created++;
        }
      } catch { invalid.push(name); }
    }
    report.reference[spec.model] = { created, invalid };
  }

  // ── Users: roles, departments/teams, manager FK ──
  const users = await prisma.user.findMany();
  report.users.total = users.length;
  const userIds = new Set(users.map((u) => u.id));
  const userByName = new Map(users.map((u) => [u.name, u]));

  for (const u of users) {
    const roleName = KNOWN_ROLES.includes(u.role) ? u.role : "teamMember";
    const role = await (prisma as any).appRole.findUnique({ where: { name: roleName } });
    if (role) {
      await (prisma as any).userRole.upsert({
        where: { userId_roleId: { userId: u.id, roleId: role.id } },
        create: { userId: u.id, roleId: role.id },
        update: {},
      });
      report.users.rolesGranted++;
    }
    // Department / team (org-scoped; global users recorded as unscoped).
    if (u.organizationId && u.department) {
      let dept = await (prisma as any).department.findUnique({
        where: { organizationId_name: { organizationId: u.organizationId, name: u.department } },
      });
      if (!dept) {
        dept = await (prisma as any).department.create({
          data: { organizationId: u.organizationId, name: u.department },
        });
        report.departments.created++;
      }
      await prisma.user.update({ where: { id: u.id }, data: { departmentId: dept.id } });
      // User teams: UNRESOLVED by design. The User model has no legacy team
      // field, so there is no source data to map users onto teams — teamId
      // stays null until a team-assignment workflow exists. Teams themselves
      // are still backfilled from declaration data below.
    } else if (!u.organizationId) {
      report.departments.unscopedUsers++;
    }
    // Manager FK: legacy lineManager holds a user id (seed) — resolve by id first, then by name.
    if (u.lineManager) {
      let managerId: string | null = null;
      if (userIds.has(u.lineManager)) managerId = u.lineManager;
      else if (userByName.has(u.lineManager)) managerId = userByName.get(u.lineManager)!.id;
      if (managerId && managerId !== u.id) {
        await prisma.user.update({ where: { id: u.id }, data: { managerId } });
        report.users.managerLinked++;
      } else {
        report.users.missingManagerRefs.push(`${u.id} -> ${u.lineManager}`);
      }
    }
  }

  // Declaration-scoped teams/departments for orgs (captures team names only on declarations).
  const declarations = await prisma.declaration.findMany();
  report.declarations.total = declarations.length;
  for (const d of declarations) {
    if (d.organizationId && d.department) {
      const exists = await (prisma as any).department.findUnique({
        where: { organizationId_name: { organizationId: d.organizationId, name: d.department } },
      });
      if (!exists) {
        await (prisma as any).department.create({
          data: { organizationId: d.organizationId, name: d.department },
        });
        report.departments.created++;
      }
    }
  }

  // ── Counterparties + declaration normalization ──
  const cpBefore = await (prisma as any).counterparty.count().catch(() => 0);
  for (const d of declarations) {
    const eventDate = parseDateSafe(d.date);
    const submittedAt = parseDateSafe(d.submitted);
    const declarerOk = userIds.has(d.employeeId);
    const approverOk = d.approverId ? userIds.has(d.approverId) : true;

    let cpId: string | null = d.counterpartyId || null;
    if (!cpId && d.counterparty) {
      const cp = await ensureCounterparty(d.counterparty, d.organizationId, d.contactPerson);
      if (cp) cpId = cp.id;
      else report.counterparties.missing++;
    }

    await prisma.declaration.update({
      where: { id: d.id },
      data: {
        eventDate: eventDate ?? (d.eventDate as Date | null) ?? null,
        submittedAt: submittedAt ?? (d.submittedAt as Date | null) ?? null,
        declarerUserId: declarerOk ? d.employeeId : null,
        currentApproverUserId: d.approverId && approverOk ? d.approverId : null,
        counterpartyId: cpId,
      },
    });
    if (eventDate) report.declarations.eventDateBackfilled++;
    else if (d.date && String(d.date).trim()) report.declarations.invalidDates.push(`${d.id}.date=${d.date}`);
    if (submittedAt) report.declarations.submittedAtBackfilled++;
    else if (d.submitted && String(d.submitted).trim()) report.declarations.invalidDates.push(`${d.id}.submitted=${d.submitted}`);
    if (declarerOk) report.declarations.declarerLinked++;
    else report.declarations.missingDeclarers.push(`${d.id} -> ${d.employeeId}`);
    if (d.approverId) {
      if (approverOk) report.declarations.approverLinked++;
      else report.declarations.missingApprovers.push(`${d.id} -> ${d.approverId}`);
    }

    const declarer = userByName.get(d.employee) || users.find((u) => u.id === d.employeeId);
    await captureDeclarationSnapshot(
      d.id,
      {
        name: d.employee,
        teamMemberNumber: d.teamMemberNumber,
        position: d.position,
        department: d.department,
      },
      declarer && (declarer as any).managerId
        ? users.find((u) => u.id === (declarer as any).managerId)?.name || d.lineManager
        : d.lineManager || null,
    );
    report.declarations.snapshots++;
    await syncDeclarationDetail(d.id, d);
    report.declarations.details++;
  }
  const cpAfter = await (prisma as any).counterparty.count().catch(() => 0);
  report.counterparties.created = cpAfter - cpBefore;
  report.counterparties.linked = await prisma.declaration.count({ where: { counterpartyId: { not: null } } }).catch(() => 0);

  // Declaration team links (from declaration.team text).
  for (const d of declarations) {
    if (d.organizationId && d.department && d.team) {
      const dept = await (prisma as any).department.findUnique({
        where: { organizationId_name: { organizationId: d.organizationId, name: d.department } },
      });
      if (dept) {
        const exists = await (prisma as any).team.findUnique({
          where: { departmentId_name: { departmentId: dept.id, name: d.team } },
        });
        if (!exists) {
          await (prisma as any).team.create({ data: { departmentId: dept.id, name: d.team } });
          report.departments.teams++;
        }
      }
    }
  }

  // ── Workflow rules + instances ──
  const rules = await prisma.workflowRule.findMany();
  report.workflows.rules = rules.length;
  // Role signature (e.g. "lineManager>hr") -> rule id, for inferring the
  // producing rule of historical instances whose ruleId was never recorded.
  const ruleSignatures = new Map<string, string>();
  for (const r of rules) {
    report.workflows.ruleSteps += await syncWorkflowRuleSteps(r.id);
    const rows = await (prisma as any).workflowRuleStep.findMany({
      where: { ruleId: r.id }, orderBy: { order: "asc" },
    });
    const roles = rows.length > 0
      ? rows.map((s: any) => s.role)
      : parseRuleStepDefs(r.steps).map((d) => d.role);
    ruleSignatures.set(roles.join(">"), r.id);
  }

  const instances = await prisma.workflowInstance.findMany();
  const declIds = new Set(declarations.map((d) => d.id));
  const declById = new Map(declarations.map((d) => [d.id, d]));
  for (const inst of instances) {
    if (!declIds.has(inst.declarationId)) {
      report.workflows.orphanInstances.push(inst.declarationId);
      continue;
    }
    let steps: any[];
    try {
      steps = JSON.parse(inst.steps);
      if (!Array.isArray(steps)) throw new Error("not an array");
    } catch {
      report.workflows.corruptJson.push(inst.declarationId);
      continue;
    }
    let ruleId: string | null = (inst as any).ruleId ?? null;
    if (!ruleId) {
      const sig = steps.map((s: any) => s.role).join(">");
      ruleId = ruleSignatures.get(sig) ?? null;
      if (!ruleId) {
        // Fallback: current thresholds applied to the declaration value.
        try { ruleId = await resolveRuleId(declById.get(inst.declarationId)!.value); } catch { ruleId = null; }
      }
      if (ruleId) report.workflows.ruleInferred++;
    }
    await persistWorkflowInstanceSteps(inst.declarationId, steps, ruleId);
    report.workflows.instances++;
    report.workflows.instanceSteps += steps.length;
  }

  // ── Files ──
  const files = await prisma.uploadedFile.findMany();
  report.files.total = files.length;
  for (const f of files) {
    if (f.declarationId && !declIds.has(f.declarationId)) {
      report.files.orphanFiles.push(`${f.id} -> ${f.declarationId}`);
      continue;
    }
    if (f.declarationId) {
      await (prisma as any).declarationFile.upsert({
        where: { fileId: f.id },
        create: { declarationId: f.declarationId, fileId: f.id },
        update: { declarationId: f.declarationId },
      });
      report.files.links++;
    }
  }

  return report;
}

export function formatBackfillReport(r: BackfillReport): string {
  return [
    `users: total=${r.users.total} managerLinked=${r.users.managerLinked} rolesGranted=${r.users.rolesGranted} missingManagers=${r.users.missingManagerRefs.length}`,
    `departments: created=${r.departments.created} teams=${r.departments.teams} unscopedUsers=${r.departments.unscopedUsers}`,
    ...Object.entries(r.reference).map(([k, v]) => `ref ${k}: created=${v.created} invalid=${v.invalid.length}`),
    `counterparties: created=${r.counterparties.created} linked=${r.counterparties.linked} missing=${r.counterparties.missing}`,
    `declarations: total=${r.declarations.total} eventDate=${r.declarations.eventDateBackfilled} submittedAt=${r.declarations.submittedAtBackfilled} invalidDates=${r.declarations.invalidDates.length} declarerLinked=${r.declarations.declarerLinked} approverLinked=${r.declarations.approverLinked} snapshots=${r.declarations.snapshots}`,
    `workflows: rules=${r.workflows.rules} ruleSteps=${r.workflows.ruleSteps} instances=${r.workflows.instances} steps=${r.workflows.instanceSteps} ruleInferred=${r.workflows.ruleInferred} orphans=${r.workflows.orphanInstances.length} corrupt=${r.workflows.corruptJson.length}`,
    `files: total=${r.files.total} links=${r.files.links} orphans=${r.files.orphanFiles.length}`,
  ].join("\n");
}
