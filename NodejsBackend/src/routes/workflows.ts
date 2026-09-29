import { Router, Response } from "express";
import xss from "xss";
import { prisma } from "../config/prisma";
import { authenticate, authorize, AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { WorkflowStep, declarationResponse } from "../services/workflowService";
import { writeWorkflowStepsTx, readWorkflowSteps } from "../services/normalization";
import { sendNotification } from "../services/notificationService";

const router = Router();

function sanitize(val: string): string {
  return xss(val, { whiteList: {}, stripIgnoreTag: true });
}

type StepStatus = "pending" | "approved" | "declined" | "returned";

function toStepStatus(decision: string): StepStatus {
  if (decision === "decline") return "declined";
  if (decision === "return") return "returned";
  return "approved";
}

function safeParseSteps(data: string): WorkflowStep[] {
  try { return JSON.parse(data); } catch { return []; }
}

/** Rows-first step read; legacy JSON cache is the fallback. */
async function loadSteps(declarationId: string, jsonFallback: string): Promise<WorkflowStep[]> {
  const rows = await readWorkflowSteps(declarationId);
  if (rows) return rows;
  return safeParseSteps(jsonFallback);
}

function findActionablePendingStep(steps: WorkflowStep[], userId: string): WorkflowStep | null {
  const pending = steps.filter((s) => s.status === "pending");
  for (const step of pending) {
    const order = step.order || 0;
    const hasPriorUnapproved = steps.some((s) => (s.order || 0) < order && s.status !== "approved" && s.status !== "skipped");
    if (!hasPriorUnapproved && step.assignee === userId) return step;
  }
  return null;
}

// GET /api/workflows/pending — pending approvals for current user (org-scoped, DB-filtered)
router.get("/pending", authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const userOrg = (req.user as any)?.organizationId as string | undefined;
  const limitRaw = req.query.limit as string | undefined;
  const offsetRaw = req.query.offset as string | undefined;
  const limit = limitRaw ? Math.min(Math.max(parseInt(limitRaw, 10) || 50, 1), 100) : undefined;
  const offset = offsetRaw ? Math.max(parseInt(offsetRaw, 10) || 0, 0) : 0;

  // Direct step query: only this user's pending steps — no full-declaration
  // prefetch, no full instance scan, no per-instance sequential reads.
  // Sibling steps (for actionability) and declarations are batch-fetched.
  try {
    const mySteps: any[] = await (prisma as any).workflowInstanceStep.findMany({
      where: { status: "pending", assigneeId: userId },
      select: { declarationId: true },
    });
    const declIds: string[] = [...new Set(mySteps.map((s: any) => s.declarationId as string))];
    if (declIds.length === 0) {
      res.json([]);
      return;
    }
    const [allRows, declarations] = await Promise.all([
      (prisma as any).workflowInstanceStep.findMany({
        where: { declarationId: { in: declIds } },
        orderBy: [{ declarationId: "asc" }, { stepOrder: "asc" }],
      }),
      prisma.declaration.findMany({ where: { id: { in: declIds } } }),
    ]);
    const toStep = (r: any): WorkflowStep => ({
      order: r.stepOrder, role: r.role, assignee: r.assigneeId || "",
      assigneeName: r.assigneeName, label: r.label, status: r.status,
      decision: r.decision ?? null,
      approvedAt: r.status === "approved" && r.decidedAt ? new Date(r.decidedAt).toISOString() : null,
      notes: r.notes ?? "", decidedAt: r.decidedAt ? new Date(r.decidedAt).toISOString() : null,
      decidedById: r.decidedById ?? null, decidedByName: r.decidedByName ?? null,
    });
    const stepsByDecl = new Map<string, WorkflowStep[]>();
    for (const r of allRows) {
      const arr = stepsByDecl.get(r.declarationId) || [];
      arr.push(toStep(r));
      stepsByDecl.set(r.declarationId, arr);
    }
    const declMap = new Map(declarations.map((d) => [d.id, d]));
    const pending: any[] = [];
    for (const declId of declIds) {
      const steps = stepsByDecl.get(declId) || [];
      const pendingStep = findActionablePendingStep(steps, userId);
      if (!pendingStep) continue;
      const declaration = declMap.get(declId) as any;
      if (!declaration) continue;
      // Org isolation: skip cross-org pending (defense-in-depth, HR mis-assignment fallback)
      if (userOrg && declaration.organizationId && declaration.organizationId !== userOrg) continue;
      pending.push({ declaration: declarationResponse(declaration), step: pendingStep });
    }
    const paged = limit !== undefined ? pending.slice(offset, offset + limit) : pending;
    res.json(paged);
    return;
  } catch (err: any) {
    // Pre-migration databases have no step table — fall back to the legacy
    // instance scan below. Any other error propagates as a 500.
    const missingTable =
      err?.code === "P2021" ||
      /no such table|does not exist|undefined table/i.test(err?.message || "");
    if (!missingTable) throw err;
  }

  // Legacy fallback (pre-migration databases without relational step rows).
  const pending: any[] = [];

  // DB-level org filter: only fetch declarations for user's org (if any)
  const orgDeclWhere: any = {};
  if (userOrg) orgDeclWhere.organizationId = userOrg;
  const orgDeclarations = await prisma.declaration.findMany({ where: orgDeclWhere, select: { id: true } });
  const orgDeclIds = new Set(orgDeclarations.map((d) => d.id));
  const instances = await prisma.workflowInstance.findMany({
    where: orgDeclIds.size > 0 ? { declarationId: { in: Array.from(orgDeclIds) } } : undefined,
  });
  const declIds = instances.map((inst) => inst.declarationId);
  const declarations = declIds.length > 0
    ? await prisma.declaration.findMany({ where: { id: { in: declIds } } })
    : [];
  const declMap = new Map(declarations.map((d) => [d.id, d]));

  for (const inst of instances) {
    const steps: WorkflowStep[] = await loadSteps(inst.declarationId, inst.steps);
    const pendingStep = findActionablePendingStep(steps, userId);
    if (pendingStep) {
      const declaration = declMap.get(inst.declarationId) as any;
      if (declaration) {
        // Org isolation: skip cross-org pending (defense-in-depth, HR mis-assignment fallback)
        if (userOrg && declaration.organizationId && declaration.organizationId !== userOrg) continue;
        pending.push({
          declaration: declarationResponse(declaration),
          step: pendingStep,
        });
      }
    }
  }

  // Pagination (only if limit requested; keeps backwards compat for existing tests)
  const paged = limit !== undefined ? pending.slice(offset, offset + limit) : pending;
  res.json(paged);
}));

// GET /api/workflows/instances/:declarationId — workflow timeline
router.get("/instances/:declarationId", authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const declarationId = req.params.declarationId as string;
  const instance = await prisma.workflowInstance.findUnique({
    where: { declarationId },
  });
  if (!instance) {
    res.status(404).json({ error: "Workflow instance not found" });
    return;
  }

  const declaration = await prisma.declaration.findUnique({ where: { id: declarationId } });
  const steps: WorkflowStep[] = await loadSteps(instance.declarationId, instance.steps);
  const isAssignee = steps.some((s) => s.assignee === req.user!.id);
  const isOwner = declaration?.employeeId === req.user!.id;
  
  // FIX: Declaration owners should always be able to view their own workflow timeline
  if (req.user!.role !== "admin" && !isAssignee && !isOwner) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  res.json({ declarationId: instance.declarationId, steps });
}));

// POST /api/workflows/approve — approve/decline a step
router.post("/approve", authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { declarationId, decision, notes } = req.body;
  const dbOptions = await prisma.approvalOption.findMany({ select: { value: true } });
  const validDecisions = dbOptions.length > 0
    ? dbOptions.map((o) => o.value)
    : ["return", "accept", "org", "foundation", "decline"];

  if (!declarationId || !decision) {
    res.status(400).json({ error: "declarationId and decision are required" });
    return;
  }
  if (!validDecisions.includes(decision)) {
    res.status(400).json({ error: `Invalid decision. Must be one of: ${validDecisions.join(", ")}` });
    return;
  }

  const declaration = await prisma.declaration.findUnique({ where: { id: declarationId } });
  if (!declaration) {
    res.status(404).json({ error: "Declaration not found" });
    return;
  }

  const instance = await prisma.workflowInstance.findUnique({ where: { declarationId } });
  if (!instance) {
    res.status(404).json({ error: "Workflow instance not found" });
    return;
  }

  if (!["approver", "admin"].includes(req.user!.role)) {
    res.status(403).json({ error: "Only approvers and admins can approve workflow steps" });
    return;
  }

  // Atomic step update — read, check, and write within a single transaction.
  // Relational step rows are the source of truth; the JSON column is a
  // write-through cache kept until the Phase 5 retirement migration.
  const now = new Date().toISOString();
  const newStepStatus = toStepStatus(decision);

  let freshSteps: WorkflowStep[];
  let newStatus: string;
  let resultStepIndex: number;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const instance = await tx.workflowInstance.findUnique({ where: { declarationId } });
      if (!instance) throw Object.assign(new Error("Workflow instance not found"), { statusCode: 404 });

      let steps: WorkflowStep[];
      try {
        const rows = await (tx as any).workflowInstanceStep.findMany({
          where: { instanceId: declarationId },
          orderBy: { stepOrder: "asc" },
        });
        steps = rows.length > 0
          ? rows.map((r: any) => ({
              order: r.stepOrder, role: r.role, assignee: r.assigneeId || "",
              assigneeName: r.assigneeName, label: r.label, status: r.status,
              decision: r.decision ?? null,
              approvedAt: r.status === "approved" && r.decidedAt ? new Date(r.decidedAt).toISOString() : null,
              notes: r.notes ?? "", decidedAt: r.decidedAt ? new Date(r.decidedAt).toISOString() : null,
              decidedById: r.decidedById ?? null, decidedByName: r.decidedByName ?? null,
            }))
          : safeParseSteps(instance.steps);
      } catch {
        steps = safeParseSteps(instance.steps);
      }
      const currentStepIndex = steps.findIndex((s) => s.status === "pending" && s.assignee === req.user!.id);

      if (currentStepIndex === -1) throw Object.assign(new Error("You do not have a pending approval step for this declaration"), { statusCode: 403 });

      const step = steps[currentStepIndex];
      if (step.status !== "pending") throw Object.assign(new Error("Step has already been processed"), { statusCode: 403 });

      // Self-approval guard
      if (step.assignee === declaration.employeeId) throw Object.assign(new Error("Cannot self-approve your own declaration"), { statusCode: 403 });

      // Step order enforcement
      const currentOrder = step.order || 0;
      const hasPriorUnapproved = steps.some((s) => (s.order || 0) < currentOrder && s.status !== "approved" && s.status !== "skipped");
      if (hasPriorUnapproved) throw Object.assign(new Error("Earlier steps must be approved first"), { statusCode: 403 });

      steps[currentStepIndex] = {
        ...steps[currentStepIndex],
        status: newStepStatus,
        decision,
        // Free text is sanitized like every other user-supplied field on the
        // declaration paths — step notes persist into JSON + rows.
        notes: sanitize(String(notes || "")),
        decidedAt: now,
        decidedById: req.user!.id,
        decidedByName: req.user!.name,
        approvedAt: newStepStatus === "approved" ? now : steps[currentStepIndex].approvedAt,
      };

      let statusStr: string;
      let nextApproverName = "";
      let nextApproverId = "";
      if (decision === "decline") {
        statusStr = "Declined";
      } else if (decision === "return") {
        statusStr = "Returned";
      } else {
        const nextPending = steps.find((s) => s.status === "pending");
        statusStr = nextPending ? "Pending" : "Approved";
        nextApproverName = nextPending?.assigneeName || "";
        nextApproverId = nextPending?.assignee || "";
      }
      const declarationApprover =
        decision === "return"
          ? declaration.employee
          : nextApproverName || declaration.approver;
      const declarationApproverId =
        decision === "return"
          ? declaration.employeeId
          : nextApproverId || declaration.approverId;
      // The canonical current-approver relation tracks the legacy approver
      // reference in the SAME transaction — never leave it pointing at the
      // previous person. Null when the target user no longer exists (the
      // legacy string columns keep the history; FK SetNull enforces this).
      let currentApproverUserId: string | null = null;
      if (declarationApproverId) {
        const u = await tx.user.findUnique({ where: { id: declarationApproverId }, select: { id: true } });
        if (u) currentApproverUserId = u.id;
      }

      // Full row sync in the SAME transaction: JSON cache and authoritative
      // rows commit atomically (no best-effort second write). The recorded
      // rule is left untouched — approvals never reselect the rule.
      await writeWorkflowStepsTx(tx, declarationId, steps);
      await tx.declaration.update({
        where: { id: declarationId },
        data: { status: statusStr, approver: declarationApprover, approverId: declarationApproverId, currentApproverUserId },
      });

      return { newStatus: statusStr, freshSteps: steps, stepIndex: currentStepIndex };
    });
    freshSteps = result.freshSteps;
    newStatus = result.newStatus;
    resultStepIndex = result.stepIndex;
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : "Internal server error" });
    return;
  }

  // Rows were already synced inside the transaction above — respond directly.

  res.json({
    declarationId,
    newStatus,
    currentStep: freshSteps[resultStepIndex],
    workflowSteps: freshSteps,
  });
  const ownerId = declaration.employeeId;
  if (newStatus === "Returned") void sendNotification("declarationReturned", declarationId, ownerId, decision);
  else if (newStatus === "Declined") void sendNotification("declarationDeclined", declarationId, ownerId, decision);
  else if (newStatus === "Approved") void sendNotification("declarationApproved", declarationId, ownerId, decision);
  else {
    const next = freshSteps.find((s) => s.status === "pending");
    if (next) void sendNotification(next.role === "hr" ? "hrApproval" : "managerApproval", declarationId, next.assignee, decision);
  }
}));

export default router;
