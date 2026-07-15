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

// GET /api/workflows/pending — pending approvals for current user
router.get("/pending", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const instances = await prisma.workflowInstance.findMany();
  const userId = req.user!.id;
  const pending: any[] = [];

  for (const inst of instances) {
    const steps: WorkflowStep[] = JSON.parse(inst.steps);
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

  res.json({ declarationId: instance.declarationId, steps: JSON.parse(instance.steps) });
});

// POST /api/workflows/approve — approve/decline a step
const approveSchema = {
  declarationId: { type: "string", required: true },
  decision: { type: "string", required: true },
  notes: { type: "string", required: false },
};

router.post("/approve", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { declarationId, decision, notes } = req.body;
  const validDecisions = ["return", "accept", "org", "foundation", "decline", "reject", "info", "escalate"];

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

  const steps: WorkflowStep[] = JSON.parse(instance.steps);
  const currentStepIndex = steps.findIndex((s) => s.status === "pending" && s.assignee === req.user!.id);

  if (currentStepIndex === -1) {
    res.status(403).json({ error: "You do not have a pending approval step for this declaration" });
    return;
  }

  const newStepStatus = toStepStatus(decision);
  steps[currentStepIndex] = {
    ...steps[currentStepIndex],
    status: newStepStatus,
    decision,
    notes: notes || "",
    decidedAt: new Date().toISOString(),
  };

  // Determine new declaration status
  let newStatus: string;

  if (decision === "decline" || decision === "reject") {
    newStatus = "Declined";
  } else if (decision === "return" || decision === "info") {
    newStatus = "Info Requested";
  } else {
    // approved — check if there are more pending steps
    const nextPending = steps.find((s) => s.status === "pending");
    if (nextPending) {
      newStatus = "Pending";
    } else {
      newStatus = "Approved";
    }
  }

  const nextStep = steps.find((s) => s.status === "pending");
  const nextApproverName = nextStep?.assigneeName || "";

  await prisma.$transaction([
    prisma.workflowInstance.update({
      where: { declarationId },
      data: { steps: JSON.stringify(steps) },
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
    currentStep: steps[currentStepIndex],
    workflowSteps: steps,
  });
});

export default router;
