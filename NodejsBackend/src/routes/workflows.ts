import { Router, Response } from "express";
import { Prisma } from "@prisma/client";
import xss from "xss";
import { prisma } from "../config/prisma";
import { authenticate, authorize, AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { WorkflowStep, declarationResponse, declarationIncludes, rowToStep } from "../services/workflowService";
import { writeWorkflowStepsTx, readWorkflowStepRows, getDeclarationPk } from "../services/normalization";
import { toDbId, toJsonId } from "../services/ids";
import { sendNotification } from "../services/notificationService";
import { recordDeclarationAudit } from "../services/declarationAudit";

const router = Router();

function sanitize(val: string): string {
  return xss(val, { whiteList: {}, stripIgnoreTag: true });
}

type StepStatus = "pending" | "approved" | "declined" | "returned";

/**
 * Exhaustive decision → step-status mapping. Anything not listed here is
 * rejected with 400 at the call site — an unknown decision must never
 * silently become an approval (fail closed).
 */
const DECISION_TO_STEP_STATUS: Record<string, StepStatus> = {
  accept: "approved",
  org: "approved",
  foundation: "approved",
  decline: "declined",
  return: "returned",
};

/** Step rows are the only workflow state (no JSON fallback). */
async function loadSteps(declarationPk: bigint): Promise<WorkflowStep[]> {
  return (await readWorkflowStepRows(declarationPk)) || [];
}

// Authoritative approval queue: the same actionable-step and organization
// rules back both the queue records and the total count, so the dashboard
// badge and queue list can never disagree.
async function fetchActionableQueue(userPk: bigint, userOrg: number | null | undefined, limit: number, offset: number) {
  // Resolve actionable steps in SQL so large queues are filtered and paged
  // before declaration snapshots/details are materialized in Node.
  const orgFilter = userOrg === undefined || userOrg === null
    ? Prisma.empty
    : Prisma.sql`AND (d."organizationId" IS NULL OR d."organizationId" = ${toDbId(userOrg)})`;
  const candidate = Prisma.sql`
    FROM "WorkflowInstanceStep" s
    JOIN "Declaration" d ON d."declarationPk" = s."declarationPk"
    WHERE s."status" = 'pending' AND s."assigneeId" = ${userPk}
      ${orgFilter}
      AND NOT EXISTS (
        SELECT 1 FROM "WorkflowInstanceStep" prior
        WHERE prior."instanceId" = s."instanceId"
          AND prior."stepOrder" < s."stepOrder"
          AND prior."status" NOT IN ('approved', 'skipped')
      )`;
  const [countRows, page] = await Promise.all([
    prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`SELECT COUNT(*)::bigint AS total ${candidate}`),
    prisma.$queryRaw<Array<{ id: bigint; declarationPk: bigint }>>(Prisma.sql`
      SELECT s."id", s."declarationPk" ${candidate}
      ORDER BY s."declarationPk" ASC, s."stepOrder" ASC
      LIMIT ${limit} OFFSET ${offset}`),
  ]);
  const total = Number(countRows[0]?.total ?? 0n);
  if (page.length === 0) return { items: [], total };
  const ids = page.map((row) => row.id);
  const pks = [...new Set(page.map((row) => row.declarationPk))];
  const [steps, declarations] = await Promise.all([
    prisma.workflowInstanceStep.findMany({ where: { id: { in: ids } } }),
    prisma.declaration.findMany({ where: { declarationPk: { in: pks } }, include: declarationIncludes }),
  ]);
  const stepMap = new Map(steps.map((row) => [row.id, rowToStep(row)]));
  const declarationMap = new Map(declarations.map((row) => [row.declarationPk, declarationResponse(row)]));
  const items = page.flatMap((row) => {
    const step = stepMap.get(row.id);
    const declaration = declarationMap.get(row.declarationPk);
    return step && declaration ? [{ declaration, step }] : [];
  });
  return { items, total };
}

function parsePaging(req: { query: Record<string, unknown> }): { limit: number; offset: number } {
  const limitRaw = req.query.limit as string | undefined;
  const offsetRaw = req.query.offset as string | undefined;
  const limit = limitRaw ? Math.min(Math.max(parseInt(limitRaw, 10) || 50, 1), 100) : 100;
  const offset = offsetRaw ? Math.max(parseInt(offsetRaw, 10) || 0, 0) : 0;
  return { limit, offset };
}

// GET /api/workflows/pending — pending approvals for current user (org-scoped, DB-filtered)
router.get("/pending", authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const userPk = toDbId(req.user!.id);
  const userOrg = req.user?.organizationId ?? undefined;
  const { limit, offset } = parsePaging(req);
  const result = await fetchActionableQueue(userPk, userOrg, limit, offset);
  res.json(result.items);
}));

// GET /api/workflows/queue — authoritative queue response: records plus the
// total computed after organization scoping and actionable-step resolution.
router.get("/queue", authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const userPk = toDbId(req.user!.id);
  const userOrg = req.user?.organizationId ?? undefined;
  const { limit, offset } = parsePaging(req);
  const result = await fetchActionableQueue(userPk, userOrg, limit, offset);
  res.json(result);
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
  // Organization backstop: step assignment is user-scoped, but a mis-assigned
  // cross-org step (e.g. via global fallback routing) must never become a
  // cross-org decision. Mirrors the submit/PUT/delete checks.
  const callerOrg = req.user?.organizationId ?? undefined;
  if (req.user!.role !== "admin" && callerOrg !== undefined && callerOrg !== null && declaration.organizationId !== null && declaration.organizationId !== toDbId(callerOrg)) {
    res.status(403).json({ error: "Cannot approve declaration from another organization" });
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
  const newStepStatus = DECISION_TO_STEP_STATUS[decision];
  if (!newStepStatus) {
    res.status(400).json({ error: `Decision '${decision}' has no workflow mapping` });
    return;
  }
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

      // Claim the actionable row before changing the workflow snapshot. Under
      // READ COMMITTED, concurrent approvals may both have read pending; this
      // conditional write serializes the winner and makes the loser conflict.
      const claimed = await tx.workflowInstanceStep.updateMany({
        where: { id: rows[currentStepIndex].id, status: "pending", assigneeId: userPk },
        data: { status: newStepStatus, decision, notes: sanitize(String(notes || "")), decidedAt: new Date(now), decidedById: userPk, decidedByName: req.user!.name },
      });
      if (claimed.count !== 1) throw Object.assign(new Error("Step has already been processed"), { statusCode: 409 });

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
      await recordDeclarationAudit(tx, {
        declarationPk: pk,
        declarationId: String(declarationId),
        organizationId: declaration.organizationId,
        actorUserId: req.user!.id,
        actorName: req.user!.name,
        action: "workflow_decision",
        changedFields: ["workflowSteps", "status", "currentApproverUserId"],
        oldValues: {
          status: declaration.status,
          currentApproverUserId: declaration.currentApproverUserId,
          stepOrder: step.order,
          stepStatus: step.status,
        },
        newValues: {
          status: statusStr,
          currentApproverUserId,
          stepOrder: step.order,
          decision,
          notes: sanitize(String(notes || "")),
          decidedAt: now,
        },
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
