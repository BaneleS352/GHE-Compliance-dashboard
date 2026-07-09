import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { Declaration, ApprovalDecision } from "../../types/declaration";
import { PURPLE } from "../../config/theme";
import { Card } from "../components/Card";
import { StatusBadge } from "../components/StatusBadge";
import { DeclarationDetailView } from "../pages/DeclarationDetailView";
import { ApproverDecisionBlock } from "../pages/ApprovalQueue";

export function ApprovalDetail({
  declaration,
  onBack,
}: {
  declaration: Declaration;
  onBack: () => void;
}) {
  const [lmDecision, setLmDecision] = useState<ApprovalDecision>(null);
  const [hrDecision, setHrDecision] = useState<ApprovalDecision>(null);
  const [ceoDecision, setCeoDecision] = useState<ApprovalDecision>(null);

  const [lmNotes, setLmNotes] = useState("");
  const [hrNotes, setHrNotes] = useState("");
  const [ceoNotes, setCeoNotes] = useState("");

  const isHrEnabled = !!lmDecision;
  const isCeoEnabled = !!lmDecision && !!hrDecision;

  const steps = [
    {
      title: "1. Line Manager Approval",
      role: "Sipho Nkosi",
      decision: lmDecision,
      setDecision: setLmDecision,
      notes: lmNotes,
      setNotes: setLmNotes,
      enabled: true,
    },
    {
      title: "2. Head of HR Approval",
      role: "Lindiwe Zulu",
      decision: hrDecision,
      setDecision: setHrDecision,
      notes: hrNotes,
      setNotes: setHrNotes,
      enabled: isHrEnabled,
    },
    {
      title: "3. Group CEO Approval",
      role: "Sandile Shabalala",
      decision: ceoDecision,
      setDecision: setCeoDecision,
      notes: ceoNotes,
      setNotes: setCeoNotes,
      enabled: isCeoEnabled,
    },
  ];

  const completedSteps = steps.filter((s) => s.decision).length;

  const handleSave = () => {
    console.log("Saved:", { lmDecision, hrDecision, ceoDecision });
    alert("Progress saved");
  };

  const handleSubmit = () => {
    if (!lmDecision) return alert("Line Manager decision is required");
    if (!hrDecision) return alert("HR decision is required");
    if (!ceoDecision) return alert("CEO decision is required");

    console.log("Final submission:", {
      declarationId: declaration.id,
      lmDecision,
      hrDecision,
      ceoDecision,
    });

    alert("Workflow completed");
    onBack();
  };

  const getStepStyle = (enabled: boolean, decision: ApprovalDecision) => {
    if (!enabled) return "opacity-50 pointer-events-none grayscale";

    if (decision) {
      return `
        bg-emerald-50/70 border-emerald-200
        shadow-[0_10px_25px_rgba(16,185,129,0.15)]
      `;
    }

    return `
      bg-white/70 border-white/60
      shadow-sm hover:shadow-md
    `;
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2.5 mb-7 pb-5 border-b border-border">

        {/* The back button that results in adupliication onb the approval details page */}
        {/* <button
          onClick={onBack}
          className="h-9 px-3.5 border rounded-xl flex items-center gap-1.5 text-sm bg-card hover:bg-muted/50"
        >
          <ArrowLeft size={14} /> Back
        </button> */}

        <span className="font-mono font-bold">{declaration.id}</span>
        <StatusBadge status={declaration.status} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        {/* Left */}
        <div className="xl:col-span-3">
          <DeclarationDetailView data={declaration} onBack={onBack} />
        </div>

        {/* Right */}
        <div className="xl:col-span-2 space-y-5 xl:sticky xl:top-4 self-start">
          {/* Timeline */}
          <div className="relative">
            <div className="absolute left-4 top-2 bottom-2 w-[2px] bg-gray-300/50" />

            <motion.div
              className="absolute left-4 top-2 w-[2px] bg-gradient-to-b from-emerald-500 to-emerald-400"
              animate={{
                height: `${(completedSteps / (steps.length || 1)) * 100}%`,
              }}
              transition={{ duration: 0.5 }}
            />

            <div className="space-y-6">
              {steps.map((step, i) => {
                const isActive =
                  step.enabled && !step.decision &&
                  steps.findIndex((s) => s.enabled && !s.decision) === i;

                return (
                  <div key={i} className="flex items-start gap-4 relative">
                    {/* Node */}
                    <div className="relative z-10">
                      <div
                        className={`
                          w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold
                          ${
                            step.decision
                              ? "bg-emerald-500 text-white"
                              : isActive
                              ? "bg-white border-2 border-emerald-500 text-emerald-600"
                              : "bg-white/40 border text-gray-400"
                          }
                        `}
                      >
                        {step.decision ? "✓" : i + 1}
                      </div>
                    </div>

                    {/* Card */}
                    <motion.div
                      initial={{ opacity: 0.5, y: 10 }}
                      animate={{
                        opacity: step.enabled ? 1 : 0.5,
                        y: 0,
                      }}
                      whileHover={{ scale: step.enabled ? 1.01 : 1 }}
                      className="flex-1"
                    >
                      <div
                        className={`
                          rounded-2xl p-[1px]
                          bg-gradient-to-br from-white/40 to-white/10
                        `}
                      >
                        <div
                          className={`
                            rounded-2xl p-4 backdrop-blur-sm border transition-all
                            ${getStepStyle(step.enabled, step.decision)}
                          `}
                        >
                          {/* Status Badge */}
                          <div className="flex justify-between mb-2">
                            <span className="text-xs text-slate-500">
                              {step.role}
                            </span>

                            {!step.enabled && (
                              <span className="text-[10px] px-2 py-1 rounded-full bg-gray-100 text-gray-400">
                                Locked
                              </span>
                            )}

                            {isActive && (
                              <span className="text-[10px] px-2 py-1 rounded-full bg-indigo-100 text-indigo-600">
                                In Progress
                              </span>
                            )}

                            {step.decision && (
                              <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-100 text-emerald-600">
                                Completed
                              </span>
                            )}
                          </div>

                          <ApproverDecisionBlock
                            title={step.title}
                            role={step.role}
                            decision={step.decision}
                            onSelect={step.setDecision}
                            notes={step.notes}
                            onNotesChange={step.setNotes}
                          />
                        </div>
                      </div>
                    </motion.div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <Card
            className="
              p-5 rounded-2xl
              bg-gradient-to-br from-[#f8fafc] via-[#eef2ff] to-[#e0e7ff]
              border border-white/40
              shadow-[0_10px_30px_rgba(0,0,0,0.08)]
              backdrop-blur-sm
              relative overflow-hidden
            "
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.15),transparent_60%)]" />

            <div className="relative z-10">
              <p className="text-xs text-slate-500 mb-4">
                Complete all steps in sequence before submitting.
              </p>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <button
                  onClick={handleSave}
                  className="flex-1 h-10 border rounded-xl text-sm hover:bg-white/50 transition"
                >
                  Save Progress
                </button>

                <button
                  onClick={handleSubmit}
                  disabled={!lmDecision || !hrDecision || !ceoDecision}
                  className="
                    flex-1 h-10 text-white rounded-xl text-sm
                    disabled:opacity-40
                    shadow-md hover:shadow-lg transition
                  "
                  style={{
                    background: `linear-gradient(135deg, ${PURPLE}, #6d28d9)`,
                  }}
                >
                  Submit Decision
                </button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}