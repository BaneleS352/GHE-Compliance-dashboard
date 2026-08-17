import { useState, useCallback, useEffect, useMemo } from "react";
import { fetchWorkflowInstance, approveWorkflowStep } from "@/services/api";
import { DECISION_LABELS } from "@/config/theme";
// import type { StepView } from "@/../components/WorkflowTimeline";
import type { StepView } from "@/app/components/WorkflowTimeline"
import type {
    ApprovalDecision,
    StatusType,
} from "@/types/declaration";

interface UseWorkflowApprovalOptions {
    declarationId: string | null;
    userId: string | null;
    onStatusUpdate?: (status: StatusType) => void;
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

  const loadWorkflowInstance = useCallback(async () => {
    if (!declarationId) {
      setWfInstance(null);
      return;
    }
    setWfLoading(true);
    try {
      const wf = await fetchWorkflowInstance(declarationId);
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
    } catch {
      setSubmitError("Failed to load workflow instance.");
    } finally {
      setWfLoading(false);
    }
  }, [declarationId]);

  useEffect(() => {
    loadWorkflowInstance();
  }, [loadWorkflowInstance]);

  const steps = wfInstance?.steps ?? [];
  const lmStep = steps.find((s: any) => s.role === "lineManager");
  const hrStep = steps.find((s: any) => s.role === "hr");
  const ceoStep = steps.find((s: any) => s.role === "ceo");

  const hasLm = !!lmStep;
  const hasHr = !!hrStep;
  const hasCeo = !!ceoStep;
  const isLmApproved = lmStep?.status === "approved";
  const isHrApproved = hrStep?.status === "approved";
  const isHrEnabled = hasHr && isLmApproved;
  const isCeoEnabled = hasCeo && isLmApproved && (hasHr ? isHrApproved : true);

  const allRoles = useMemo(() => [
    {
      roleKey: "lineManager" as const,
      title: "1. Line Manager Approval",
      defaultActor: "Line Manager",
      get decision() { return lmStep?.status !== "pending" ? (lmStep?.decision ?? null) : lmDecision; },
      setDecision: setLmDecision,
      get notes() { return lmNotes; },
      setNotes: setLmNotes,
      get step() { return lmStep; },
      get exists() { return hasLm; },
      get enabled() { return lmStep?.status === "pending"; },
      get completed() { return lmStep && lmStep.status !== "pending"; },
      get decidedAt() { return lmStep?.decidedAt || null; },
    },
    {
      roleKey: "hr" as const,
      title: "2. Head of HR Approval",
      defaultActor: "Head of HR",
      get decision() { return hrStep?.status !== "pending" ? (hrStep?.decision ?? null) : hrDecision; },
      setDecision: setHrDecision,
      get notes() { return hrNotes; },
      setNotes: setHrNotes,
      get step() { return hrStep; },
      get exists() { return hasHr; },
      get enabled() { return isHrEnabled && hrStep?.status === "pending"; },
      get completed() { return hrStep && hrStep.status !== "pending"; },
      get decidedAt() { return hrStep?.decidedAt || null; },
    },
    {
      roleKey: "ceo" as const,
      title: "3. Group CEO Approval",
      defaultActor: "Group CEO",
      get decision() { return ceoStep?.status !== "pending" ? (ceoStep?.decision ?? null) : ceoDecision; },
      setDecision: setCeoDecision,
      get notes() { return ceoNotes; },
      setNotes: setCeoNotes,
      get step() { return ceoStep; },
      get exists() { return hasCeo; },
      get enabled() { return isCeoEnabled && ceoStep?.status === "pending"; },
      get completed() { return ceoStep && ceoStep.status !== "pending"; },
      get decidedAt() { return ceoStep?.decidedAt || null; },
    },
  ], [lmStep, hrStep, ceoStep, hasLm, hasHr, hasCeo, isLmApproved, isHrApproved, isHrEnabled, isCeoEnabled, lmDecision, hrDecision, ceoDecision, lmNotes, hrNotes, ceoNotes]);

  const wfSteps: StepView[] = useMemo(() => allRoles.map((r) => {
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
  }), [allRoles]);

  const currentUserStep = useMemo(() => steps.find(
    (s: any, i: number) => s.status === "pending" && steps.slice(0, i).every((p: any) => p.status === "approved" || p.status === "skipped")
  ), [steps]);
  const canApprove = !!(currentUserStep?.assignee === userId && currentUserStep);
  const currentUserStepRole = canApprove ? currentUserStep?.role : undefined;
  const activeRole = useMemo(() => allRoles.find((r) => r.enabled && r.roleKey === currentUserStepRole), [allRoles, currentUserStepRole]);

  const decisionsByRole: Record<string, ApprovalDecision> = { lineManager: lmDecision, hr: hrDecision, ceo: ceoDecision };
  const notesByRole: Record<string, string> = { lineManager: lmNotes, hr: hrNotes, ceo: ceoNotes };

  const handleSubmit = async () => {
    if (!userId || !wfInstance || !currentUserStep) return;
    setSubmitError("");
    const decision = decisionsByRole[currentUserStep.role];
    const notes = notesByRole[currentUserStep.role];
    if (!decision) return;
    try {
      if (!declarationId) return;
      const res = await approveWorkflowStep({ declarationId, decision, notes });
      if (res?.newStatus) onStatusUpdate?.(res.newStatus);
      await loadWorkflowInstance();
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