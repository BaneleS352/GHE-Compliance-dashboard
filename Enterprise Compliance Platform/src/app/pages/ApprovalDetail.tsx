import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { Declaration, ApprovalDecision } from "../../types/declaration";
import { StatusBadge } from "../components/StatusBadge";
import { DeclarationDetailView, SupportingDocuments } from "../pages/DeclarationDetailView";
import { WorkflowTimeline, StepView } from "../components/WorkflowTimeline";
import { useUser } from "../auth/UserContext";
import { fetchWorkflowInstance, approveWorkflowStep } from "../../services/api";

export function ApprovalDetail({
  declaration,
  onBack,
}: {
  declaration: Declaration;
  onBack: () => void;
}) {
  const { user } = useUser();
  const [workflow, setWorkflow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [declarationStatus, setDeclarationStatus] = useState(declaration.status);

  const [lmDecision, setLmDecision] = useState<ApprovalDecision>(null);
  const [hrDecision, setHrDecision] = useState<ApprovalDecision>(null);
  const [ceoDecision, setCeoDecision] = useState<ApprovalDecision>(null);
  const [lmNotes, setLmNotes] = useState("");
  const [hrNotes, setHrNotes] = useState("");
  const [ceoNotes, setCeoNotes] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setDeclarationStatus(declaration.status);
  }, [declaration.status]);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    fetchWorkflowInstance(declaration.id)
      .then((wf) => {
        setWorkflow(wf);
        if (wf) {
          const getStep = (role: string) => wf.steps.find((s: any) => s.role === role);
          setLmDecision(getStep("lineManager")?.decision ?? null);
          setHrDecision(getStep("hr")?.decision ?? null);
          setCeoDecision(getStep("ceo")?.decision ?? null);
          setLmNotes(getStep("lineManager")?.notes ?? "");
          setHrNotes(getStep("hr")?.notes ?? "");
          setCeoNotes(getStep("ceo")?.notes ?? "");
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [declaration.id, user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm text-muted-foreground animate-pulse">Loading workflow…</div>
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center text-muted-foreground">
          <p className="font-medium">No workflow found for this declaration.</p>
          <button onClick={onBack} className="mt-4 text-purple-600 hover:underline">Back to Queue</button>
        </div>
      </div>
    );
  }

  const getStepByRole = (role: string) => workflow?.steps.find((s) => s.role === role);

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

  const decisionLabel = (d: string) => {
    const map: Record<string, string> = {
      accept: "Accept",
      return: "Return",
      org: "Org Pool",
      foundation: "Foundation",
      decline: "Decline",
    };
    return map[d] || d;
  };

  const allRoles = [
    { roleKey: "lineManager", title: "1. Line Manager Approval", defaultActor: "Line Manager",
      get decision() { return lmStep?.status !== "pending" ? (lmStep?.decision ?? null) : lmDecision; }, setDecision: setLmDecision,
      get notes() { return lmNotes; }, setNotes: setLmNotes,
      get step() { return lmStep; }, get exists() { return hasLm; },
      get enabled() { return lmStep?.status === "pending"; },
      get completed() { return lmStep && lmStep.status !== "pending"; },
      get decidedAt() { return lmStep?.decidedAt || null; },
    },
    { roleKey: "hr", title: "2. Head of HR Approval", defaultActor: "Head of HR",
      get decision() { return hrStep?.status !== "pending" ? (hrStep?.decision ?? null) : hrDecision; }, setDecision: setHrDecision,
      get notes() { return hrNotes; }, setNotes: setHrNotes,
      get step() { return hrStep; }, get exists() { return hasHr; },
      get enabled() { return isHrEnabled && hrStep?.status === "pending"; },
      get completed() { return hrStep && hrStep.status !== "pending"; },
      get decidedAt() { return hrStep?.decidedAt || null; },
    },
    { roleKey: "ceo", title: "3. Group CEO Approval", defaultActor: "Group CEO",
      get decision() { return ceoStep?.status !== "pending" ? (ceoStep?.decision ?? null) : ceoDecision; }, setDecision: setCeoDecision,
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
      decision: r.decision ? { label: decisionLabel(r.decision) } : null,
      decidedAt: r.decidedAt,
      notes: r.notes,
    };
  });

  const currentUserStep = workflow?.steps.find(
    (s: any, index: number) =>
      s.status === "pending" &&
      workflow.steps.slice(0, index).every((prev: any) => prev.status === "approved")
  );
  const hasPendingUserStep = currentUserStep?.assignee === user?.id;
  const currentUserStepRole = hasPendingUserStep ? currentUserStep?.role : undefined;
  const activeRole = allRoles.find((r) => r.enabled && r.roleKey === currentUserStepRole);

  const handleSubmit = async () => {
    if (!user || !workflow) return;

    const stepsToUpdate = [...workflow.steps];
    const decisionsByRole: Record<string, ApprovalDecision> = { lineManager: lmDecision, hr: hrDecision, ceo: ceoDecision };
    const notesByRole: Record<string, string> = { lineManager: lmNotes, hr: hrNotes, ceo: ceoNotes };
    for (const step of stepsToUpdate) {
      const decision = decisionsByRole[step.role];
      const notes = notesByRole[step.role];
      if (decision && step.assignee === user.id && step.status === "pending") {
        step.decision = decision;
        step.notes = notes;
        step.decidedAt = new Date().toISOString();
        if (decision === "decline") {
          step.status = "declined";
        } else if (decision === "return") {
          step.status = "returned";
        } else {
          step.status = "approved";
        }
        const response = await approveWorkflowStep({ declarationId: declaration.id, decision, notes });
        setDeclarationStatus(response.newStatus ?? declaration.status);
      }
    }

    setWorkflow({ ...workflow, steps: stepsToUpdate });
    setMessage("Decision submitted successfully.");
    setTimeout(() => { setMessage(""); onBack(); }, 1500);
  };



  return (
    <div>
      <div className="flex flex-wrap items-center gap-2.5 mb-7 pb-5 border-b border-border">
        <button
          onClick={onBack}
          className="h-9 px-3.5 border rounded-xl flex items-center gap-1.5 text-sm bg-card hover:bg-muted/50"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <span className="font-mono font-bold">{declaration.id}</span>
        <StatusBadge status={declarationStatus} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        <div className="xl:col-span-3">
          <DeclarationDetailView data={declaration} onBack={() => {}} hideBackButton hideDocuments />
        </div>

        <div className="xl:col-span-2 space-y-5 h-full">
          {message && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              {message}
            </div>
          )}

          <WorkflowTimeline
            steps={wfSteps}
            decision={activeRole?.roleKey === currentUserStepRole ? activeRole?.decision : undefined}
            onDecision={hasPendingUserStep && activeRole?.setDecision ? activeRole.setDecision : undefined}
            notes={hasPendingUserStep ? activeRole?.notes || "" : undefined}
            onNotesChange={hasPendingUserStep && activeRole?.setNotes ? activeRole.setNotes : undefined}
            onSubmit={hasPendingUserStep ? handleSubmit : undefined}
            submitDisabled={!activeRole?.decision}
          />
        </div>

        <div className="xl:col-span-3">
          <SupportingDocuments data={declaration} />
        </div>
      </div>
    </div>
  );
}
