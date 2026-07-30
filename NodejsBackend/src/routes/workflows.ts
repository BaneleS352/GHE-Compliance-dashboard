import { Router, Response } from "express";
import { prisma } from "../config/prisma";
import { authenticate, authorize, AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { WorkflowStep, safeJsonParse, declarationResponse } from "../services/workflowService";

const router = Router();

type StepStatus = "pending" | "approved" | "declined" | "returned";

function toStepStatus(decision: string): StepStatus {
  if (decision === "decline") return "declined";
  if (decision === "return") return "returned";
  return "approved";
}

function safeParseSteps(data: string): WorkflowStep[] {
  try { return JSON.parse(data); } catch { return []; }
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

// GET /api/workflows/pending — pending approvals for current user
router.get("/pending", authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const userRole = req.user!.role;
  const userDept = req.user!.department;
  const pending: any[] = [];

  const instances = await prisma.workflowInstance.findMany();
  const declIds = instances.map((inst) => inst.declarationId);
  const declarations = declIds.length > 0
    ? await prisma.declaration.findMany({ where: { id: { in: declIds } } })
    : [];
  const declMap = new Map(declarations.map((d) => [d.id, d]));

  for (const inst of instances) {
    const steps: WorkflowStep[] = safeParseSteps(inst.steps);
    const pendingStep = findActionablePendingStep(steps, userId);
    if (pendingStep) {
      const declaration = declMap.get(inst.declarationId);
      if (declaration) {
        if (userRole === "approver" && userDept && declaration.department !== userDept) continue;
        pending.push({
          declaration: declarationResponse(declaration),
          step: pendingStep,
        });
      }
    }
  }

  res.json(pending);
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
  const steps: WorkflowStep[] = safeParseSteps(instance.steps);
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

  // Atomic step update — read, check, and write within a single transaction
  const now = new Date().toISOString();
  const newStepStatus = toStepStatus(decision);

  let freshSteps: WorkflowStep[];
  let newStatus: string;
  let resultStepIndex: number;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const instance = await tx.workflowInstance.findUnique({ where: { declarationId } });
      if (!instance) throw Object.assign(new Error("Workflow instance not found"), { statusCode: 404 });

      const steps: WorkflowStep[] = safeParseSteps(instance.steps);
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
        notes: notes || "",
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

      await tx.workflowInstance.update({
        where: { declarationId },
        data: { steps: JSON.stringify(steps) },
      });
      await tx.declaration.update({
        where: { id: declarationId },
        data: { status: statusStr, approver: declarationApprover, approverId: declarationApproverId },
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
}));

export default router;
