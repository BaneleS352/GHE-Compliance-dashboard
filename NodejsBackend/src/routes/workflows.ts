import { Router, Response } from "express";
import { prisma } from "../config/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";
import { getCurrentStep, WorkflowStep } from "../services/workflowService";

const router = Router();

type StepStatus = "pending" | "approved" | "declined" | "returned";

function toStepStatus(decision: string): StepStatus {
  if (decision === "decline" || decision === "reject") return "declined";
  if (decision === "return" || decision === "info") return "returned";
  return "approved";
}

function safeParseSteps(data: string): WorkflowStep[] {
  try { return JSON.parse(data); } catch { return []; }
}

// GET /api/workflows/pending — pending approvals for current user
router.get("/pending", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const instances = await prisma.workflowInstance.findMany();
  const userId = req.user!.id;
  const pending: any[] = [];

  for (const inst of instances) {
    const steps: WorkflowStep[] = safeParseSteps(inst.steps);
    const pendingStep = steps.find((s) => s.status === "pending" && s.assignee === userId);
    if (pendingStep) {
      const declaration = await prisma.declaration.findUnique({ where: { id: inst.declarationId } });
      if (declaration) {
        pending.push({
          declaration: {
            id: declaration.id,
            employee: declaration.employee,
            employeeId: declaration.employeeId,
            department: declaration.department,
            type: declaration.type,
            counterparty: declaration.counterparty,
            value: declaration.value,
            submitted: declaration.submitted,
            status: declaration.status,
            priority: declaration.priority,
          },
          step: pendingStep,
        });
      }
    }
  }

  res.json(pending);
});

// GET /api/workflows/instances/:declarationId — workflow timeline
router.get("/instances/:declarationId", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
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
  if (req.user!.role !== "admin" && !isAssignee && !isOwner) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  res.json({ declarationId: instance.declarationId, steps });
});

// POST /api/workflows/approve — approve/decline a step
const approveSchema = {
  declarationId: { type: "string", required: true },
  decision: { type: "string", required: true },
  notes: { type: "string", required: false },
};

router.post("/approve", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { declarationId, decision, notes } = req.body;
  const dbOptions = await prisma.approvalOption.findMany({ select: { value: true } });
  const validDecisions = dbOptions.length > 0
    ? dbOptions.map((o) => o.value)
    : ["return", "accept", "org", "foundation", "decline", "reject", "info", "escalate"];

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

  const steps: WorkflowStep[] = safeParseSteps(instance.steps);
  const currentStepIndex = steps.findIndex((s) => s.status === "pending" && s.assignee === req.user!.id);

  if (currentStepIndex === -1) {
    res.status(403).json({ error: "You do not have a pending approval step for this declaration" });
    return;
  }

  // Self-approval guard: step assignee cannot be the declaration owner
  if (steps[currentStepIndex].assignee === declaration.employeeId) {
    res.status(403).json({ error: "Cannot self-approve your own declaration" });
    return;
  }

  // Step order enforcement: all prior steps must be resolved before current step
  const currentOrder = steps[currentStepIndex].order || 0;
  const hasPriorPending = steps.some((s) => (s.order || 0) < currentOrder && s.status === "pending");
  if (hasPriorPending) {
    res.status(403).json({ error: "Earlier steps must be completed first" });
    return;
  }

  // Race condition: update step status atomically — only if still pending
  const now = new Date().toISOString();
  const newStepStatus = toStepStatus(decision);

  const freshInstance = await prisma.workflowInstance.findUnique({ where: { declarationId } });
  if (!freshInstance) {
    res.status(404).json({ error: "Workflow instance not found" });
    return;
  }

  const freshSteps: WorkflowStep[] = safeParseSteps(freshInstance.steps);
  const freshStep = freshSteps[currentStepIndex];
  if (!freshStep || freshStep.status !== "pending") {
    res.status(403).json({ error: "Step has already been processed" });
    return;
  }

  freshSteps[currentStepIndex] = {
    ...freshSteps[currentStepIndex],
    status: newStepStatus,
    decision,
    notes: notes || "",
    decidedAt: now,
  };

  let newStatus: string;
  if (decision === "decline" || decision === "reject") {
    newStatus = "Declined";
  } else if (decision === "return" || decision === "info") {
    newStatus = "Info Requested";
  } else {
    const nextPending = freshSteps.find((s) => s.status === "pending");
    newStatus = nextPending ? "Pending" : "Approved";
  }

  const nextStep = freshSteps.find((s) => s.status === "pending");
  const nextApproverName = nextStep?.assigneeName || "";

  await prisma.$transaction([
    prisma.workflowInstance.update({
      where: { declarationId },
      data: { steps: JSON.stringify(freshSteps) },
    }),
    prisma.declaration.update({
      where: { id: declarationId },
      data: {
        status: newStatus,
        approver: nextApproverName || declaration.approver,
      },
    }),
  ]);

  res.json({
    declarationId,
    newStatus,
    currentStep: freshSteps[currentStepIndex],
    workflowSteps: freshSteps,
  });
});

export default router;
