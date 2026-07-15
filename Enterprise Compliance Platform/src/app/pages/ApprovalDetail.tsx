import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { Declaration, ApprovalDecision } from "../../types/declaration";
import { PURPLE } from "../../config/theme";
import { Card } from "../components/Card";
import { StatusBadge } from "../components/StatusBadge";
import { DeclarationDetailView } from "../pages/DeclarationDetailView";
import { ApproverDecisionBlock } from "../pages/ApprovalQueue";
import { useUser } from "../auth/UserContext";
import { fetchWorkflowInstance, approveWorkflowStep, updateDeclaration } from "../../services/api";

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

  const [lmDecision, setLmDecision] = useState<ApprovalDecision>(null);
  const [hrDecision, setHrDecision] = useState<ApprovalDecision>(null);
  const [ceoDecision, setCeoDecision] = useState<ApprovalDecision>(null);
  const [lmNotes, setLmNotes] = useState("");
  const [hrNotes, setHrNotes] = useState("");
  const [ceoNotes, setCeoNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

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

  const isLmDecided = !!lmDecision;
  const isHrEnabled = hasHr && isLmDecided;
  const isCeoEnabled = hasCeo && isLmDecided && (hasHr ? !!hrDecision : true);

  const decisionLabel = (d: string) => {
    const map: Record<string, string> = {
      accept: "Accept",
      reject: "Reject",
      decline: "Decline",
      info: "Return for More Info",
      escalate: "Escalate",
    };
    return map[d] || d;
  };

  const steps = [
    ...(hasLm ? [{
      title: "1. Line Manager Approval",
      role: lmStep?.assigneeName || "Line Manager",
      roleKey: "lineManager",
      decision: lmDecision,
      setDecision: setLmDecision,
      notes: lmNotes,
      setNotes: setLmNotes,
      enabled: lmStep?.status === "pending",
      completed: lmStep && lmStep.status !== "pending",
      decidedAt: lmStep?.decidedAt || null,
    }] : []),
    ...(hasHr ? [{
      title: "2. Head of HR Approval",
      role: hrStep?.assigneeName || "Head of HR",
      roleKey: "hr",
      decision: hrDecision,
      setDecision: setHrDecision,
      notes: hrNotes,
      setNotes: setHrNotes,
      enabled: isHrEnabled && hrStep?.status === "pending",
      completed: hrStep && hrStep.status !== "pending",
      decidedAt: hrStep?.decidedAt || null,
    }] : []),
    ...(hasCeo ? [{
      title: "3. Group CEO Approval",
      role: ceoStep?.assigneeName || "Group CEO",
      roleKey: "ceo",
      decision: ceoDecision,
      setDecision: setCeoDecision,
      notes: ceoNotes,
      setNotes: setCeoNotes,
      enabled: isCeoEnabled && ceoStep?.status === "pending",
      completed: ceoStep && ceoStep.status !== "pending",
      decidedAt: ceoStep?.decidedAt || null,
    }] : []),
  ];

  const completedSteps = steps.filter((s) => s.completed || s.decision).length;

  const handleSubmit = async () => {
    if (!user || !workflow) return;

    const stepsToUpdate = [...workflow.steps];
    const decisions = [lmDecision, hrDecision, ceoDecision];
    const notesArr = [lmNotes, hrNotes, ceoNotes];
    let allApproved = true;
    let hasReturn = false;
    let hasDecline = false;

    for (let i = 0; i < stepsToUpdate.length; i++) {
      const step = stepsToUpdate[i];
      const decision = decisions[i];
      if (decision && step.assignee === user.id && step.status === "pending") {
        step.decision = decision;
        step.notes = notesArr[i];
        step.decidedAt = new Date().toISOString();
        if (decision === "decline" || decision === "reject") {
          step.status = "declined";
          hasDecline = true;
          allApproved = false;
        } else if (decision === "info") {
          step.status = "returned";
          hasReturn = true;
          allApproved = false;
        } else if (decision === "escalate") {
          step.status = "approved";
          allApproved = false;
        } else {
          step.status = "approved";
        }
        await approveWorkflowStep({ declarationId: declaration.id, decision, notes: notesArr[i] });
      }
    }

    if (hasDecline) {
      await updateDeclaration(declaration.id, { status: "Declined" });
    } else if (hasReturn) {
      await updateDeclaration(declaration.id, { status: "Info Requested" });
    } else if (allApproved && stepsToUpdate.every((s) => s.status === "approved")) {
      await updateDeclaration(declaration.id, { status: "Approved" });
    }

    setMessage("Decision submitted successfully.");
    setTimeout(() => { setMessage(""); onBack(); }, 1500);
  };

  const getStepStyle = (isCurrent: boolean, decision: ApprovalDecision) => {
    if (!isCurrent && !decision) return "opacity-50 pointer-events-none grayscale";
    if (decision) return "bg-purple-50/70 border-purple-200 shadow-[0_10px_25px_rgba(124,58,237,0.15)]";
    return "bg-white/70 border-white/60 shadow-sm hover:shadow-md";
  };

  const currentUserStepRole = workflow?.steps.find((s) => s.assignee === user?.id)?.role;
  const currentUserIndex = steps.findIndex((s) => s.enabled);

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
        <StatusBadge status={declaration.status} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        <div className="xl:col-span-3">
          <DeclarationDetailView data={declaration} onBack={() => {}} />
        </div>

        <div className="xl:col-span-2 space-y-5 xl:sticky xl:top-4 self-start">
          {message && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              {message}
            </div>
          )}

          <div className="relative">
            <div className="absolute left-4 top-2 bottom-2 w-[2px] bg-gray-300/50" />

            <motion.div
              className="absolute left-4 top-2 w-[2px] bg-gradient-to-b from-purple-600 to-purple-500"
              animate={{ height: `${(completedSteps / (steps.length || 1)) * 100}%` }}
              transition={{ duration: 0.5 }}
            />

            <div className="space-y-6">
              {steps.map((step, i) => {
                const isActive = step.enabled && !step.decision &&
                  steps.findIndex((s) => s.enabled && !s.decision) === i;
                const isCurrentUserStep = isActive && step.roleKey === currentUserStepRole;

                return (
                  <div key={i} className="flex items-start gap-4 relative">
                    <div className="relative z-10">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                        step.decision ? "bg-purple-600 text-white shadow" :
                        isActive ? "bg-white border-2 border-purple-600 text-purple-700 shadow-[0_4px_20px_rgba(124,58,237,0.25)]" :
                        "bg-white/40 border border-white/50 text-gray-400"
                      }`}>
                        {i + 1}
                      </div>
                    </div>

                    <motion.div
                      initial={{ opacity: 0.5, y: 10 }}
                      animate={{ opacity: step.enabled || step.decision ? 1 : 0.5, y: 0 }}
                      className="flex-1"
                    >
                      <div className="rounded-2xl p-[1px] bg-gradient-to-br from-white/40 to-white/10">
                        <div className={`rounded-2xl p-4 backdrop-blur-sm border transition-all ${getStepStyle(isCurrentUserStep, step.decision)}`}>
                          <div className="flex justify-between mb-2">
                            <span className="text-xs text-slate-500">{step.role}</span>
                            {!step.enabled && !step.decision && (
                              <span className="text-[10px] px-2 py-1 rounded-full bg-gray-100 text-gray-500">Pending</span>
                            )}
                            {isActive && (
                              <span className="text-[10px] px-2 py-1 rounded-full bg-purple-100 text-purple-700">In Progress</span>
                            )}
                            {step.decision && (
                              <span className="text-[10px] px-2 py-1 rounded-full bg-green-100 text-green-600">✓ Completed</span>
                            )}
                          </div>

                          {isCurrentUserStep ? (
                            <ApproverDecisionBlock
                              title={step.title}
                              role={step.role}
                              decision={step.decision}
                              onSelect={step.setDecision}
                              notes={step.notes}
                              onNotesChange={step.setNotes}
                            />
                          ) : (
                            <div className="rounded-xl bg-gray-50 p-4 text-sm">
                              {step.decision ? (
                                <>
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Decision</span>
                                    <span className="font-semibold text-green-600">{decisionLabel(step.decision)}</span>
                                  </div>
                                  <div className="flex justify-between mt-1">
                                    <span className="text-gray-500">Date</span>
                                    <span className="font-semibold">{step.decidedAt ? step.decidedAt.slice(0, 10) : "—"}</span>
                                  </div>
                                  <div className="flex justify-between mt-1">
                                    <span className="text-gray-500">Time</span>
                                    <span className="font-semibold">{step.decidedAt ? step.decidedAt.slice(11, 16) : "—"}</span>
                                  </div>
                                  {step.notes && <p className="mt-2 text-xs italic border-t border-gray-200 pt-2 text-muted-foreground">"{step.notes}"</p>}
                                </>
                              ) : (
                                <p className="text-muted-foreground">Awaiting <strong>{step.roleKey === "lineManager" ? "Line Manager" : step.roleKey === "hr" ? "HR" : "CEO"}</strong> review.</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  </div>
                );
              })}
            </div>
          </div>

          {workflow?.steps.find((s) => s.assignee === user?.id) && (
            <Card className="p-5 rounded-2xl bg-purple-50 border border-purple-100 shadow-sm">
              <div className="relative z-10">
                <p className="text-xs text-purple-700 mb-4 text-center">
                  {steps.some((s) => s.decision && !s.completed)
                    ? "Decision submitted. Awaiting next approval."
                    : "Complete the current step before proceeding."}
                </p>
                <button
                  onClick={handleSubmit}
                  disabled={!steps.some((s) => s.decision && !s.completed)}
                  className="w-full h-11 text-white rounded-xl text-sm font-bold disabled:opacity-45 shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 active:translate-y-0"
                  style={{ background: `linear-gradient(135deg, ${PURPLE}, #6d28d9)` }}
                >
                  {steps.some((s) => s.decision && !s.completed) ? "Submit Decision" : "Submit Decision"}
                </button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
