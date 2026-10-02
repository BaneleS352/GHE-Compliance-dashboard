import { Router, Response } from "express";
import xss from "xss";
import { prisma } from "../config/prisma";
import { authenticate, authorize, AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { WorkflowStep, declarationResponse, declarationIncludes, rowToStep } from "../services/workflowService";
import { writeWorkflowStepsTx, readWorkflowStepRows, getDeclarationPk } from "../services/normalization";
import { toDbId, toJsonId } from "../services/ids";
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

/** Step rows are the only workflow state (no JSON fallback). */
async function loadSteps(declarationPk: bigint): Promise<WorkflowStep[]> {
  return (await readWorkflowStepRows(declarationPk)) || [];
}

function findActionablePendingStep(steps: WorkflowStep[], userPk: number): WorkflowStep | null {
  const pending = steps.filter((s) => s.status === "pending");
  for (const step of pending) {
    const order = step.order || 0;
    const hasPriorUnapproved = steps.some((s) => (s.order || 0) < order && s.status !== "approved" && s.status !== "skipped");
    if (!hasPriorUnapproved && step.assignee === userPk) return step;
  }
  return null;
}

// Authoritative approval queue: the same actionable-step and organization
// rules back both the queue records and the total count, so the dashboard
// badge and queue list can never disagree.
async function fetchActionableQueue(userPk: bigint, userPkJson: number, userOrg: number | null | undefined) {
  // Direct step query: only this user's pending steps — no full-declaration
  // prefetch, no full instance scan, no per-instance sequential reads.
  // Sibling steps (for actionability) and declarations are batch-fetched.
  const mySteps = await prisma.workflowInstanceStep.findMany({
    where: { status: "pending", assigneeId: userPk },
    select: { declarationPk: true },
  });
  const pks: bigint[] = [...new Set(mySteps.map((s) => s.declarationPk))];
  if (pks.length === 0) return [];
  const [allRows, declarations] = await Promise.all([
    prisma.workflowInstanceStep.findMany({
      where: { declarationPk: { in: pks } },
      orderBy: [{ declarationPk: "asc" }, { stepOrder: "asc" }],
    }),
    prisma.declaration.findMany({ where: { declarationPk: { in: pks } }, include: declarationIncludes }),
  ]);
  const stepsByDecl = new Map<string, WorkflowStep[]>();
  for (const r of allRows) {
    const key = String(r.declarationPk);
    const arr = stepsByDecl.get(key) || [];
    arr.push(rowToStep(r));
    stepsByDecl.set(key, arr);
  }
  const declMap = new Map(declarations.map((d) => [String(d.declarationPk), d]));
  const pending: { declaration: ReturnType<typeof declarationResponse>; step: WorkflowStep }[] = [];
  for (const pk of pks) {
    const key = String(pk);
    const steps = stepsByDecl.get(key) || [];
    const pendingStep = findActionablePendingStep(steps, userPkJson);
    if (!pendingStep) continue;
    const declaration = declMap.get(key);
    if (!declaration) continue;
    // Org isolation: skip cross-org pending (defense-in-depth, HR mis-assignment fallback)
    if (userOrg !== undefined && userOrg !== null && declaration.organizationId !== null && declaration.organizationId !== toDbId(userOrg)) continue;
    pending.push({ declaration: declarationResponse(declaration), step: pendingStep });
  }
  return pending;
}

function parsePaging(req: { query: Record<string, unknown> }): { limit: number | undefined; offset: number } {
  const limitRaw = req.query.limit as string | undefined;
  const offsetRaw = req.query.offset as string | undefined;
  const limit = limitRaw ? Math.min(Math.max(parseInt(limitRaw, 10) || 50, 1), 100) : undefined;
  const offset = offsetRaw ? Math.max(parseInt(offsetRaw, 10) || 0, 0) : 0;
  return { limit, offset };
}

// GET /api/workflows/pending — pending approvals for current user (org-scoped, DB-filtered)
router.get("/pending", authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const userPk = toDbId(req.user!.id);
  const userPkJson = toJsonId(userPk);
  const userOrg = req.user?.organizationId ?? undefined;
  const { limit, offset } = parsePaging(req);
  const pending = await fetchActionableQueue(userPk, userPkJson, userOrg);
  const paged = limit !== undefined ? pending.slice(offset, offset + limit) : pending;
  res.json(paged);
}));

// GET /api/workflows/queue — authoritative queue response: records plus the
// total computed after organization scoping and actionable-step resolution.
router.get("/queue", authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const userPk = toDbId(req.user!.id);
  const userPkJson = toJsonId(userPk);
  const userOrg = req.user?.organizationId ?? undefined;
  const { limit, offset } = parsePaging(req);
  const items = await fetchActionableQueue(userPk, userPkJson, userOrg);
  const total = items.length;
  const paged = limit !== undefined ? items.slice(offset, offset + limit) : items;
  res.json({ items: paged, total });
}));

// GET /api/workflows/instances/:declarationId — workflow timeline
router.get("/instances/:declarationId", authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const declarationId = req.params.declarationId as string;
  const pk = await getDeclarationPk(declarationId);
  if (!pk) {
    res.status(404).json({ error: "Workflow instance not found" });
    return;
  }
  const instance = await prisma.workflowInstance.findUnique({
    where: { declarationPk: pk },
  });
  if (!instance) {
    res.status(404).json({ error: "Workflow instance not found" });
    return;
  }

  const declaration = await prisma.declaration.findUnique({ where: { declarationPk: pk } });
  const steps: WorkflowStep[] = await loadSteps(pk);
  const userPkJson = toJsonId(req.user!.id);
  const isAssignee = steps.some((s) => s.assignee === userPkJson);
  const isOwner = declaration?.declarerUserId === toDbId(req.user!.id);

  // FIX: Declaration owners should always be able to view their own workflow timeline
  if (req.user!.role !== "admin" && !isAssignee && !isOwner) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  res.json({ declarationId, steps });
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

  const pk = await getDeclarationPk(String(declarationId));
  if (!pk) {
    res.status(404).json({ error: "Declaration not found" });
    return;
  }
  const declaration = await prisma.declaration.findUnique({ where: { declarationPk: pk } });
  if (!declaration) {
    res.status(404).json({ error: "Declaration not found" });
    return;
  }

  const instance = await prisma.workflowInstance.findUnique({ where: { declarationPk: pk } });
  if (!instance) {
    res.status(404).json({ error: "Workflow instance not found" });
    return;
  }

  if (!["approver", "admin"].includes(req.user!.role)) {
    res.status(403).json({ error: "Only approvers and admins can approve workflow steps" });
    return;
  }

  // Atomic step update — read, check, and write within a single transaction.
  // Relational step rows are the only workflow state.
  const now = new Date().toISOString();
  const newStepStatus = toStepStatus(decision);
  const userPk = toDbId(req.user!.id);
  const userPkJson = toJsonId(userPk);

  let freshSteps: WorkflowStep[];
  let newStatus: string;
  let resultStepIndex: number;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const rows = await tx.workflowInstanceStep.findMany({
        where: { instanceId: instance.id },
        orderBy: { stepOrder: "asc" },
      });
      const steps: WorkflowStep[] = rows.map((r) => rowToStep(r));
      const currentStepIndex = steps.findIndex((s) => s.status === "pending" && s.assignee === userPkJson);

      if (currentStepIndex === -1) throw Object.assign(new Error("You do not have a pending approval step for this declaration"), { statusCode: 403 });

      const step = steps[currentStepIndex];
      if (step.status !== "pending") throw Object.assign(new Error("Step has already been processed"), { statusCode: 403 });

      // Self-approval guard
      if (step.assignee !== null && declaration.declarerUserId !== null && toDbId(step.assignee) === declaration.declarerUserId) {
        throw Object.assign(new Error("Cannot self-approve your own declaration"), { statusCode: 403 });
      }

      // Step order enforcement
      const currentOrder = step.order || 0;
      const hasPriorUnapproved = steps.some((s) => (s.order || 0) < currentOrder && s.status !== "approved" && s.status !== "skipped");
      if (hasPriorUnapproved) throw Object.assign(new Error("Earlier steps must be approved first"), { statusCode: 403 });

      steps[currentStepIndex] = {
        ...steps[currentStepIndex],
        status: newStepStatus,
        decision,
        // Free text is sanitized like every other user-supplied field on the
        // declaration paths — step notes persist into the rows.
        notes: sanitize(String(notes || "")),
        decidedAt: now,
        decidedById: userPkJson,
        decidedByName: req.user!.name,
        approvedAt: newStepStatus === "approved" ? now : steps[currentStepIndex].approvedAt,
      };

      let statusStr: string;
      let nextApproverPk: bigint | null = null;
      if (decision === "decline") {
        statusStr = "Declined";
      } else if (decision === "return") {
        statusStr = "Returned";
      } else {
        const nextPending = steps.find((s) => s.status === "pending");
        statusStr = nextPending ? "Pending" : "Approved";
        nextApproverPk = nextPending?.assignee === null || nextPending?.assignee === undefined ? null : toDbId(nextPending.assignee);
      }
      const declarationApproverPk =
        decision === "return"
          ? declaration.declarerUserId
          : nextApproverPk || declaration.currentApproverUserId;
      // The canonical current-approver relation tracks the approval in the
      // SAME transaction — never leave it pointing at the previous person.
      // Null when the target user no longer exists (FK SetNull enforces this).
      let currentApproverUserId: bigint | null = null;
      if (declarationApproverPk !== null) {
        const u = await tx.user.findUnique({ where: { id: declarationApproverPk }, select: { id: true } });
        if (u) currentApproverUserId = u.id;
      }

      // Row sync in the SAME transaction. The recorded rule is left
      // untouched — approvals never reselect the rule.
      await writeWorkflowStepsTx(tx, pk, steps);
      await tx.declaration.update({
        where: { declarationPk: pk },
        data: { status: statusStr, currentApproverUserId },
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

  res.json({
    declarationId,
    newStatus,
    currentStep: freshSteps[resultStepIndex],
    workflowSteps: freshSteps,
  });
  if (declaration.declarerUserId === null) return;
  const ownerPk = toJsonId(declaration.declarerUserId);
  if (newStatus === "Returned") void sendNotification("declarationReturned", String(declarationId), ownerPk, decision);
  else if (newStatus === "Declined") void sendNotification("declarationDeclined", String(declarationId), ownerPk, decision);
  else if (newStatus === "Approved") void sendNotification("declarationApproved", String(declarationId), ownerPk, decision);
  else {
    const next = freshSteps.find((s) => s.status === "pending");
    if (next && next.assignee !== null) void sendNotification(next.role === "hr" ? "hrApproval" : "managerApproval", String(declarationId), next.assignee, decision);
  }
}));

export default router;
