import { prisma } from "../config/prisma";
import { parseDateSafe } from "../services/normalization";

export interface VerifyDrift {
  scope: string;
  id: string;
  detail: string;
}

export interface VerifyResult {
  ok: boolean;
  checked: Record<string, number>;
  drifts: VerifyDrift[];
}

/**
 * Phase 5 readiness gate: asserts the relational read model is equivalent to
 * the legacy JSON/text columns. Run with `npm run db:verify`.
 * Exit 0 = no drift (safe to plan the retirement migration); exit 1 = drift.
 */
export async function verifyNormalization(): Promise<VerifyResult> {
  const drifts: VerifyDrift[] = [];
  const checked: Record<string, number> = {
    rules: 0, instances: 0, instanceSteps: 0, declarations: 0, files: 0,
  };

  // Workflow rule defs: rows vs JSON.
  const rules = await prisma.workflowRule.findMany();
  for (const r of rules) {
    checked.rules++;
    let defs: any[];
    try {
      defs = JSON.parse(r.steps);
      if (!Array.isArray(defs)) throw new Error("not an array");
    } catch {
      drifts.push({ scope: "rule", id: r.id, detail: "legacy JSON is corrupt" });
      continue;
    }
    const rows = await (prisma as any).workflowRuleStep.findMany({
      where: { ruleId: r.id }, orderBy: { order: "asc" },
    });
    if (rows.length !== defs.length) {
      drifts.push({ scope: "rule", id: r.id, detail: `row count ${rows.length} != json defs ${defs.length}` });
      continue;
    }
    defs.forEach((d: any, i: number) => {
      const row = rows[i];
      if (row.order !== d.order || row.role !== d.role || row.label !== d.label) {
        drifts.push({ scope: "rule", id: r.id, detail: `step ${i} differs (rows vs json)` });
      }
    });
  }

  // Workflow instances: rows vs JSON.
  const instances = await prisma.workflowInstance.findMany();
  const ruleIds = new Set(rules.map((r) => r.id));
  for (const inst of instances) {
    checked.instances++;
    // Every recorded rule must exist (database-enforced going forward; this
    // catches pre-constraint data on databases that predate 0002_rule_fk).
    if ((inst as any).ruleId && !ruleIds.has((inst as any).ruleId)) {
      drifts.push({ scope: "instance", id: inst.declarationId, detail: `ruleId ${(inst as any).ruleId} references a missing rule` });
    }
    let steps: any[];
    try {
      steps = JSON.parse(inst.steps);
      if (!Array.isArray(steps)) throw new Error("not an array");
    } catch {
      drifts.push({ scope: "instance", id: inst.declarationId, detail: "legacy JSON is corrupt" });
      continue;
    }
    const rows = await (prisma as any).workflowInstanceStep.findMany({
      where: { instanceId: inst.declarationId }, orderBy: { stepOrder: "asc" },
    });
    if (rows.length !== steps.length) {
      drifts.push({ scope: "instance", id: inst.declarationId, detail: `row count ${rows.length} != json steps ${steps.length}` });
      continue;
    }
    // FK SetNull semantics: deleting a user nulls row links while legacy JSON
    // keeps the historical id. A null row link is expected (not drift) when the
    // referenced user no longer exists.
    const referencedIds = [...new Set(
      steps.flatMap((s: any) => [s.assignee, s.decidedById]).filter((v: any) => typeof v === "string" && v),
    )] as string[];
    const existingUsers = referencedIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: referencedIds } }, select: { id: true } })
      : [];
    const liveIds = new Set(existingUsers.map((u) => u.id));
    const assigneeMatches = (rowAssignee: string | null, jsonAssignee: string | null): boolean => {
      if ((rowAssignee || "") === (jsonAssignee || "")) return true;
      return rowAssignee === null && !!jsonAssignee && !liveIds.has(jsonAssignee);
    };
    steps.forEach((s: any, i: number) => {
      checked.instanceSteps++;
      const row = rows[i];
      const decidedAt = s.decidedAt ? parseDateSafe(s.decidedAt)?.toISOString() ?? null : null;
      const rowDecided = row.decidedAt ? new Date(row.decidedAt).toISOString() : null;
      const same =
        row.stepOrder === s.order &&
        row.role === s.role &&
        row.label === s.label &&
        assigneeMatches(row.assigneeId, s.assignee) &&
        row.assigneeName === (s.assigneeName || "Unknown") &&
        row.status === s.status &&
        (row.decision ?? null) === (s.decision ?? null) &&
        (row.notes ?? "") === (s.notes ?? "") &&
        rowDecided === decidedAt;
      if (!same) {
        drifts.push({ scope: "instance-step", id: `${inst.declarationId}#${s.order}`, detail: "row differs from json" });
      }
    });
  }

  // Declarations: snapshot/detail/timestamps/counterparty/approver mirrors.
  // The canonical current-approver link must track the legacy approver
  // reference (null when the target user no longer exists — FK SetNull).
  const allUsers = await prisma.user.findMany({ select: { id: true } });
  const allUserIds = new Set(allUsers.map((u) => u.id));
  const declarations = await prisma.declaration.findMany();
  for (const d of declarations) {
    checked.declarations++;
    const expectedCurrent = d.approverId && allUserIds.has(d.approverId) ? d.approverId : null;
    if ((d.currentApproverUserId ?? null) !== expectedCurrent) {
      drifts.push({ scope: "declaration", id: d.id, detail: `currentApproverUserId ${d.currentApproverUserId} != approverId ${d.approverId}` });
    }
    const snap = await (prisma as any).declarationSnapshot.findUnique({ where: { declarationId: d.id } });
    if (!snap) {
      drifts.push({ scope: "declaration", id: d.id, detail: "missing snapshot" });
    } else if (snap.declarerName !== d.employee || snap.department !== d.department) {
      drifts.push({ scope: "declaration", id: d.id, detail: "snapshot differs from declaration" });
    }
    const detail = await (prisma as any).declarationDetail.findUnique({ where: { declarationId: d.id } });
    if (!detail) {
      drifts.push({ scope: "declaration", id: d.id, detail: "missing detail" });
    } else if (detail.description !== d.description || detail.contactPerson !== d.contactPerson) {
      drifts.push({ scope: "declaration", id: d.id, detail: "detail differs from declaration" });
    }
    const eventDate = parseDateSafe(d.date)?.toISOString() ?? null;
    const rowEvent = d.eventDate ? new Date(d.eventDate).toISOString() : null;
    // Compare by day: legacy text is a calendar date, stored DateTime is UTC midnight.
    // Unparseable legacy text is a *rejected value* (listed in the backfill
    // report), not drift — but then the column must be null, never a guess.
    const dateTextInvalid = !!d.date && String(d.date).trim() !== "" && eventDate === null;
    if (dateTextInvalid) {
      if (rowEvent !== null) {
        drifts.push({ scope: "declaration", id: d.id, detail: `eventDate ${rowEvent} set from invalid date text ${d.date}` });
      }
    } else if ((eventDate?.slice(0, 10) ?? null) !== (rowEvent?.slice(0, 10) ?? null)) {
      drifts.push({ scope: "declaration", id: d.id, detail: `eventDate ${rowEvent} != date text ${d.date}` });
    }
    if (d.counterparty) {
      const cp = d.counterpartyId
        ? await (prisma as any).counterparty.findUnique({ where: { id: d.counterpartyId } })
        : null;
      if (!cp) {
        drifts.push({ scope: "declaration", id: d.id, detail: "missing counterparty link" });
      } else if (cp.name !== d.counterparty) {
        drifts.push({ scope: "declaration", id: d.id, detail: `counterparty ${cp.name} != ${d.counterparty}` });
      }
    }
  }

  // Files: every linked UploadedFile has a join row.
  const files = await prisma.uploadedFile.findMany({ where: { declarationId: { not: null } } });
  for (const f of files) {
    checked.files++;
    const link = await (prisma as any).declarationFile.findUnique({ where: { fileId: f.id } });
    if (!link || link.declarationId !== f.declarationId) {
      drifts.push({ scope: "file", id: f.id, detail: "missing or mismatched DeclarationFile join" });
    }
  }

  return { ok: drifts.length === 0, checked, drifts };
}

export function formatVerifyResult(r: VerifyResult): string {
  const head = `checked: ${Object.entries(r.checked).map(([k, v]) => `${k}=${v}`).join(" ")}`;
  if (r.ok) return `${head}\nOK: relational model matches legacy columns (no drift)`;
  return `${head}\nDRIFT (${r.drifts.length}):\n` + r.drifts.map((d) => ` - [${d.scope}] ${d.id}: ${d.detail}`).join("\n");
}
