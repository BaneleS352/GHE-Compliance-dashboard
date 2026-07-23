import { useState, useEffect, useCallback } from "react";
import { ApprovalDecision } from "../../types/declaration";
import { StepView } from "../components/WorkflowTimeline";
import { fetchWorkflowInstance, approveWorkflowStep } from "../../services/api";
import { DECISION_LABELS } from "../../config/theme";

interface UseWorkflowApprovalOptions {
  declarationId: string | null;
  userId: string | null;
  onStatusUpdate?: (status: string) => void;
}

export function useWorkflowApproval({ declarationId, userId, onStatusUpdate }: UseWorkflowApprovalOptions) {
  const [wfInstance, setWfInstance] = useState<any>(null);
  const [wfLoading, setWfLoading] = useState(!!declarationId);
  const [lmDecision, setLmDecision] = useState<ApprovalDecision>(null);
  const [hrDecision, setHrDecision] = useState<ApprovalDecision>(null);
  const [ceoDecision, setCeoDecision] = useState<ApprovalDecision>(null);
  const [lmNotes, setLmNotes] = useState("");
  const [hrNotes, setHrNotes] = useState("");
  const [ceoNotes, setCeoNotes] = useState("");
  const [wfMessage, setWfMessage] = useState("");
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!declarationId) { setWfInstance(null); return; }
    setWfLoading(true);
    fetchWorkflowInstance(declarationId)
      .then((wf) => {
        setWfInstance(wf);
        if (wf) {
          const getStep = (role: string) => wf.steps.find((s: any) => s.role === role);
          setLmDecision(getStep("lineManager")?.decision ?? null);
          setHrDecision(getStep("hr")?.decision ?? null);
          setCeoDecision(getStep("ceo")?.decision ?? null);
          setLmNotes(getStep("lineManager")?.notes ?? "");
          setHrNotes(getStep("hr")?.notes ?? "");
          setCeoNotes(getStep("ceo")?.notes ?? "");
        }
      })
      .catch(() => {})
      .finally(() => setWfLoading(false));
  }, [declarationId]);

  const getStepByRole = useCallback((role: string) => wfInstance?.steps?.find((s: any) => s.role === role), [wfInstance]);
  const lmStep = getStepByRole("lineManager");
  const hrStep = getStepByRole("hr");
  const ceoStep = getStepByRole("ceo");

  const hasLm = !!lmStep;
  const hasHr = !!hrStep;
  const hasCeo = !!ceoStep;
  const isLmApproved = lmStep?.status === "approved";
  const isHrApproved = hrStep?.status === "approved";
  const isHrEnabled = hasHr && isLmApproved;
  const isCeoEnabled = hasCeo && isLmApproved && (hasHr ? isHrApproved : true);

  const allRoles = [
    {
      roleKey: "lineManager", title: "1. Line Manager Approval", defaultActor: "Line Manager",
      get decision() { return lmStep?.status !== "pending" ? (lmStep?.decision ?? null) : lmDecision; },
      setDecision: setLmDecision,
      get notes() { return lmNotes; }, setNotes: setLmNotes,
      get step() { return lmStep; }, get exists() { return hasLm; },
      get enabled() { return lmStep?.status === "pending"; },
      get completed() { return lmStep && lmStep.status !== "pending"; },
      get decidedAt() { return lmStep?.decidedAt || null; },
    },
    {
      roleKey: "hr", title: "2. Head of HR Approval", defaultActor: "Head of HR",
      get decision() { return hrStep?.status !== "pending" ? (hrStep?.decision ?? null) : hrDecision; },
      setDecision: setHrDecision,
      get notes() { return hrNotes; }, setNotes: setHrNotes,
      get step() { return hrStep; }, get exists() { return hasHr; },
      get enabled() { return isHrEnabled && hrStep?.status === "pending"; },
      get completed() { return hrStep && hrStep.status !== "pending"; },
      get decidedAt() { return hrStep?.decidedAt || null; },
    },
    {
      roleKey: "ceo", title: "3. Group CEO Approval", defaultActor: "Group CEO",
      get decision() { return ceoStep?.status !== "pending" ? (ceoStep?.decision ?? null) : ceoDecision; },
      setDecision: setCeoDecision,
      get notes() { return ceoNotes; }, setNotes: setCeoNotes,
      get step() { return ceoStep; }, get exists() { return hasCeo; },
      get enabled() { return isCeoEnabled && ceoStep?.status === "pending"; },
      get completed() { return ceoStep && ceoStep.status !== "pending"; },
      get decidedAt() { return ceoStep?.decidedAt || null; },
    },
  ];

  const wfSteps: StepView[] = allRoles.map((r) => {
    if (!r.exists) return { label: r.title, actor: r.defaultActor, state: "skipped" };
    const decided = r.completed;
    return {
      label: r.title,
      actor: r.step?.assigneeName || r.defaultActor,
      state: decided ? "completed" : r.enabled ? "active" : "pending",
      decision: r.decision ? { label: DECISION_LABELS[r.decision] || r.decision } : null,
      decidedAt: r.decidedAt,
      notes: r.notes,
    };
  });

  const currentUserStep = wfInstance?.steps?.find(
    (s: any, i: number) => s.status === "pending" && wfInstance.steps.slice(0, i).every((p: any) => p.status === "approved")
  );
  const canApprove = !!(currentUserStep?.assignee === userId && currentUserStep);
  const currentUserStepRole = canApprove ? currentUserStep?.role : undefined;
  const activeRole = allRoles.find((r) => r.enabled && r.roleKey === currentUserStepRole);

  const handleSubmit = async () => {
    if (!userId || !wfInstance) return;
    setSubmitError("");
    const stepsToUpdate = [...wfInstance.steps];
    const decisionsByRole: Record<string, ApprovalDecision> = { lineManager: lmDecision, hr: hrDecision, ceo: ceoDecision };
    const notesByRole: Record<string, string> = { lineManager: lmNotes, hr: hrNotes, ceo: ceoNotes };
    try {
      for (const step of stepsToUpdate) {
        const decision = decisionsByRole[step.role];
        const notes = notesByRole[step.role];
        if (decision && step.assignee === userId && step.status === "pending") {
          step.decision = decision;
          step.notes = notes;
          step.decidedAt = new Date().toISOString();
          if (decision === "decline") step.status = "declined";
          else if (decision === "return") step.status = "returned";
          else step.status = "approved";
          const res = await approveWorkflowStep({ declarationId, decision, notes });
          if (res?.newStatus) onStatusUpdate?.(res.newStatus);
        }
      }
      setWfInstance((current: any) => current ? { ...current, steps: stepsToUpdate } : current);
      setWfMessage("Decision submitted successfully.");
      setTimeout(() => { setWfMessage(""); }, 1500);
    } catch (err: any) {
      setSubmitError(err.message || "An error occurred while submitting the decision.");
    }
  };

  return {
    wfSteps, wfMessage, wfLoading, canApprove, submitError,
    activeDecision: activeRole?.decision as ApprovalDecision | undefined,
    setActiveDecision: activeRole?.setDecision as ((d: ApprovalDecision) => void) | undefined,
    activeNotes: activeRole?.notes || "",
    setActiveNotes: activeRole?.setNotes as ((v: string) => void) | undefined,
    handleSubmit,
    submitDisabled: !activeRole?.decision,
  };
}
