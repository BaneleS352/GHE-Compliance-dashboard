import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { Declaration, ApprovalDecision } from "../../types/declaration";
import { PURPLE } from "../../config/theme";
import { Card } from "../components/Card";
import { StatusBadge } from "../components/StatusBadge";
import { DeclarationDetailView } from "../pages/DeclarationDetailView";
import { ApproverDecisionBlock } from "../pages/ApprovalQueue";
import { useUser } from "../auth/UserContext";
import {
  getWorkflowForDeclaration, setWorkflowForDeclaration,
  updateDeclaration,
  canUserApprove,
} from "../../data/db";

export function ApprovalDetail({
  declaration,
  onBack,
}: {
  declaration: Declaration;
  onBack: () => void;
}) {
  const { user } = useUser();
  const workflow = getWorkflowForDeclaration(declaration.id);

  if (!user || !workflow) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center text-muted-foreground">
          <p className="font-medium">No workflow found for this declaration.</p>
          <button onClick={onBack} className="mt-4 text-purple-600 hover:underline">Back to Queue</button>
        </div>
      </div>
    );
  }

  if (!canUserApprove(declaration.id, user.id)) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center text-muted-foreground">
          <p className="font-medium">You are not assigned to approve this declaration.</p>
          <button onClick={onBack} className="mt-4 text-purple-600 hover:underline">Back to Queue</button>
        </div>
      </div>
    );
  }

  const getStepByRole = (role: string) => workflow?.steps.find((s) => s.role === role);

  const lmStep = getStepByRole("lineManager");
  const hrStep = getStepByRole("hr");
  const ceoStep = getStepByRole("ceo");

  const [lmDecision, setLmDecision] = useState<ApprovalDecision>(lmStep?.decision ?? null);
  const [hrDecision, setHrDecision] = useState<ApprovalDecision>(hrStep?.decision ?? null);
  const [ceoDecision, setCeoDecision] = useState<ApprovalDecision>(ceoStep?.decision ?? null);
  const [lmNotes, setLmNotes] = useState(lmStep?.notes ?? "");
  const [hrNotes, setHrNotes] = useState(hrStep?.notes ?? "");
  const [ceoNotes, setCeoNotes] = useState(ceoStep?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const hasLm = !!lmStep;
  const hasHr = !!hrStep;
  const hasCeo = !!ceoStep;

  const isLmDecided = !!lmDecision;
  const isHrEnabled = hasHr && isLmDecided;
  const isCeoEnabled = hasCeo && isLmDecided && (hasHr ? !!hrDecision : true);

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
    }] : []),
  ];

  const completedSteps = steps.filter((s) => s.completed || s.decision).length;

  const handleSubmit = () => {
    if (!user || !workflow) return;

    const stepsToUpdate = [...workflow.steps];
    const decisions = [lmDecision, hrDecision, ceoDecision];
    const notesArr = [lmNotes, hrNotes, ceoNotes];
    let allApproved = true;
    let hasReturn = false;
    let hasDecline = false;

    stepsToUpdate.forEach((step, i) => {
      const decision = decisions[i];
      if (decision && step.assignee === user.id && step.status === "pending") {
        step.decision = decision;
        step.notes = notesArr[i];
        step.decidedAt = new Date().toISOString();
        if (decision === "decline") {
          step.status = "declined";
          hasDecline = true;
          allApproved = false;
        } else if (decision === "return") {
          step.status = "returned";
          hasReturn = true;
          allApproved = false;
        } else {
          step.status = "approved";
        }
      }
    });

    setWorkflowForDeclaration({ declarationId: declaration.id, steps: stepsToUpdate });

    if (hasDecline) {
      updateDeclaration(declaration.id, { status: "Declined" });
    } else if (hasReturn) {
      updateDeclaration(declaration.id, { status: "Info Requested" });
    } else if (allApproved && stepsToUpdate.every((s) => s.status === "approved")) {
      updateDeclaration(declaration.id, { status: "Approved" });
    }

    setMessage("Decision submitted successfully.");
    setTimeout(() => { setMessage(""); onBack(); }, 1500);
  };

  const getStepStyle = (enabled: boolean, decision: ApprovalDecision) => {
    if (!enabled && !decision) return "opacity-50 pointer-events-none grayscale";
    if (decision) return "bg-emerald-50/70 border-emerald-200 shadow-[0_10px_25px_rgba(16,185,129,0.15)]";
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
          <DeclarationDetailView data={declaration} onBack={() => {}} hideBack />
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
              className="absolute left-4 top-2 w-[2px] bg-gradient-to-b from-emerald-500 to-emerald-400"
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
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                        step.decision ? "bg-emerald-500 text-white" :
                        isActive ? "bg-white border-2 border-emerald-500 text-emerald-600" :
                        "bg-white/40 border text-gray-400"
                      }`}>
                        {step.decision ? "✓" : i + 1}
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
                              <span className="text-[10px] px-2 py-1 rounded-full bg-gray-100 text-gray-400">Locked</span>
                            )}
                            {isActive && (
                              <span className="text-[10px] px-2 py-1 rounded-full bg-indigo-100 text-indigo-600">In Progress</span>
                            )}
                            {step.decision && (
                              <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-100 text-emerald-600">Completed</span>
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
                            <div className="rounded-xl bg-gray-50 p-4 text-sm text-muted-foreground">
                              {step.decision
                                ? <p>Decision recorded. <strong>{step.decision}</strong></p>
                                : <p>Awaiting <strong>{step.roleKey === "lineManager" ? "Line Manager" : step.roleKey === "hr" ? "HR" : "CEO"}</strong> review.</p>
                              }
                              {step.notes && <p className="mt-2 text-xs italic">"{step.notes}"</p>}
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
            <Card className="p-5 rounded-2xl bg-gradient-to-br from-[#f8fafc] via-[#eef2ff] to-[#e0e7ff] border border-white/40 shadow-[0_10px_30px_rgba(0,0,0,0.08)] backdrop-blur-sm relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.15),transparent_60%)]" />
              <div className="relative z-10">
                <p className="text-xs text-slate-500 mb-4">
                  Complete the current step before proceeding.
                </p>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <button
                    onClick={handleSubmit}
                    disabled={!steps.some((s) => s.decision && !s.completed)}
                    className="flex-1 h-10 text-white rounded-xl text-sm disabled:opacity-40 shadow-md hover:shadow-lg transition"
                    style={{ background: `linear-gradient(135deg, ${PURPLE}, #6d28d9)` }}
                  >
                    Submit Decision
                  </button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
