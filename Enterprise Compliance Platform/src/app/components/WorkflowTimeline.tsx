import { useState, useEffect } from "react";
import { fetchWorkflowInstance } from "../../services/api";
import { ApprovalDecision } from "../../types/declaration";
import { DECISION_LABELS, APPROVAL_OPTIONS, STATUS_COLORS, labelToStatus } from "../../config/theme";

export interface StepView {
  label: string;
  actor: string;
  state: "completed" | "active" | "pending" | "skipped";
  decision?: { label: string } | null;
  decidedAt?: string | null;
  notes?: string;
}

interface WorkflowTimelineProps {
  declarationId?: string;
  employee?: string;
  steps?: StepView[];
  decision?: ApprovalDecision;
  onDecision?: (d: ApprovalDecision) => void;
  notes?: string;
  onNotesChange?: (v: string) => void;
  onSubmit?: () => void;
  submitDisabled?: boolean;
  submitted?: boolean;
}

const ALL_ROLES = [
  { role: "lineManager", label: "Line Manager Review", defaultActor: "Line Manager" },
  { role: "hr",          label: "HR Review",           defaultActor: "Head of HR" },
  { role: "ceo",         label: "CEO Approval",         defaultActor: "Group CEO" },
];

function buildStepsFromWorkflow(wf: any, employee?: string): StepView[] {
  const hasData = wf && wf.steps && wf.steps.length > 0;
  const existing = hasData ? new Map(wf.steps.map((s: any) => [s.role, s])) : new Map();
  const result: StepView[] = [];
  for (const r of ALL_ROLES) {
    const step = existing.get(r.role);
    if (!step) {
      result.push({ label: r.label, actor: step?.assigneeName || r.defaultActor, state: "skipped" });
    } else if (step.status === "pending") {
      result.push({ label: step.label, actor: step.assigneeName, state: result.some((s) => s.state === "active" || s.state === "pending") ? "pending" : "active" });
    } else {
      result.push({
        label: step.label,
        actor: step.assigneeName,
        state: "completed",
        decision: step.decision ? { label: DECISION_LABELS[step.decision] || step.decision } : null,
        decidedAt: step.decidedAt || null,
        notes: step.notes || "",
      });
    }
  }
  if (!hasData && result.every((s) => s.state === "skipped")) {
    result[0].state = "active";
    result[0].actor = "Loading...";
  }
  return result;
}

function dotColor(step: StepView): string {
  if (step.state !== "completed") {
    if (step.state === "active") return "bg-purple-600";
    if (step.state === "skipped") return "bg-gray-100 border border-gray-300";
    return STATUS_COLORS.Pending.dot;
  }
  if (!step.decision?.label) return "bg-purple-600";
  return STATUS_COLORS[labelToStatus(step.decision.label)].dot;
}

function Dot({ step }: { step: StepView }) {
  const color = dotColor(step);
  return (
    <div
      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${color} text-white`}
    >
      {step.state === "skipped" ? "—" : ""}
    </div>
  );
}

function getRailColor(step: StepView): string {
  if (step.state === "pending") return STATUS_COLORS.Pending.rail;
  if (step.state !== "completed") return "bg-gray-200";
  if (!step.decision?.label) return "bg-purple-300";
  return STATUS_COLORS[labelToStatus(step.decision.label)].rail;
}

function Badge({ state, decision }: { state: "completed" | "active" | "pending" | "skipped"; decision?: { label: string } | null }) {
  if (state === "completed") {
    return <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-green-100 text-green-600 inline-flex items-center gap-1 whitespace-nowrap">Completed</span>;
  }
  if (state === "active") {
    return <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 inline-flex items-center gap-1 whitespace-nowrap">In Progress</span>;
  }
  if (state === "skipped") {
    return <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-400 inline-flex items-center gap-1 whitespace-nowrap">Not Required</span>;
  }
  if (state === "pending") {
    const c = STATUS_COLORS.Pending;
    return <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1 whitespace-nowrap ${c.bg} ${c.text}`}>Pending</span>;
  }
  return <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-400 inline-flex items-center gap-1 whitespace-nowrap">Unknown</span>;
}

function CompletedDetails({ step }: { step: StepView }) {
  const fullLabel = step.decision?.label || "";
  const simpleStatus = fullLabel ? labelToStatus(fullLabel) : "-";
  const c = simpleStatus !== "-" ? STATUS_COLORS[simpleStatus] : null;
  return (
    <>
      <div className="wf-detail-row flex justify-between py-1 text-sm">
        <span className="text-gray-500">Decision</span>
        <span className={`font-semibold ${c ? c.text || "text-gray-900" : "text-gray-900"}`}>{simpleStatus}</span>
      </div>
      <div className="wf-detail-row flex justify-between py-1 text-sm">
        <span className="text-gray-500">Date</span>
        <span className="font-semibold text-gray-900">{step.decidedAt ? step.decidedAt.slice(0, 10) : "-"}</span>
      </div>
      <div className="wf-detail-row flex justify-between py-1 text-sm">
        <span className="text-gray-500">Time</span>
        <span className="font-semibold text-gray-900">{step.decidedAt ? step.decidedAt.slice(11, 16) : "-"}</span>
      </div>
      {fullLabel && (
        <p className="mt-2 text-xs italic text-gray-500 border-t border-gray-200 pt-2">"{fullLabel}"</p>
      )}
    </>
  );
}

function PendingDetails({ isActive }: { isActive?: boolean }) {
  const c = isActive ? undefined : STATUS_COLORS.Pending;
  return (
    <>
      <div className="wf-detail-row flex justify-between py-1 text-sm">
        <span className={c ? `text-xs font-semibold ${c.text}` : "text-gray-500"}>Status</span>
        <span className={`font-semibold ${c ? c.text : "text-gray-900"}`}>Pending</span>
      </div>
      <div className="wf-detail-row flex justify-between py-1 text-sm">
        <span className="text-gray-500">Date</span>
        <span className="font-semibold text-gray-900">-</span>
      </div>
      <div className="wf-detail-row flex justify-between py-1 text-sm">
        <span className="text-gray-500">Time</span>
        <span className="font-semibold text-gray-900">-</span>
      </div>
    </>
  );
}

function WaitingDetails({ actor }: { actor: string }) {
  return (
    <>
      <p className="text-sm text-purple-700 font-semibold mb-3">Awaiting action from <strong>{actor}</strong></p>
      <PendingDetails isActive />
    </>
  );
}

export function WorkflowTimeline({
  declarationId,
  employee,
  steps: externalSteps,
  decision,
  onDecision,
  notes,
  onNotesChange,
  onSubmit,
  submitDisabled,
  submitted,
}: WorkflowTimelineProps) {
  const [wf, setWf] = useState<any>(undefined);

  useEffect(() => {
    if (!declarationId) return;
    fetchWorkflowInstance(declarationId)
      .then(setWf)
      .catch(() => setWf(null));
  }, [declarationId]);

  const steps = externalSteps || buildStepsFromWorkflow(wf, employee);

  return (
    <div className="detail-panel-shell h-full">
      <div className="detail-panel-card bg-white p-7 flex flex-col" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, sans-serif", height: "auto", minHeight: "100%" }}>
      <div className="relative z-10 flex flex-col flex-1">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-[34px] h-[34px] rounded-[10px] bg-gradient-to-br from-purple-600 to-purple-500 flex items-center justify-center flex-shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="6" cy="6" r="2.5" />
            <circle cx="18" cy="6" r="2.5" />
            <circle cx="12" cy="18" r="2.5" />
            <path d="M8.2 7.2 L11 16" />
            <path d="M15.8 7.2 L13 16" />
          </svg>
        </div>
        <h1 className="inline-flex rounded-full border border-purple-200/70 bg-purple-50 px-4 py-1.5 text-sm font-extrabold uppercase tracking-[0.2em] text-purple-900 shadow-sm m-0">Approval Workflow</h1>
      </div>

      <div className="flex-1">
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1;
          const isActive = step.state === "active";
          const isSkipped = step.state === "skipped";

          return (
            <div key={i} className="flex gap-4">
              <div className="flex flex-col items-center flex-shrink-0">
                <Dot step={step} />
                {!isLast && <div className={`w-[2px] flex-1 ${getRailColor(step)} min-h-[24px] my-1`} />}
              </div>

                <div className={`flex-1 ${isLast ? "" : "pb-7"}`}>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="text-sm font-bold text-gray-900 m-0">{step.label}</p>
                    <p className="text-sm text-gray-500 m-0">{step.actor}</p>
                  </div>
                  <Badge state={step.state} decision={step.decision} />
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-[14px] p-4">
                  {step.state === "completed" && <CompletedDetails step={step} />}

                  {step.state === "active" && onDecision && (
                    <>
                      <p className="text-xs font-semibold text-purple-700 mb-0.5">Status</p>
                      <p className="text-sm font-semibold text-purple-700 mb-3">Waiting for approval from {step.actor}</p>

                      <p className="text-xs font-semibold text-gray-500 mb-2">Decision *</p>
                      <div className="space-y-1.5 mb-3">
                        {APPROVAL_OPTIONS.map((opt) => (
                          <label
                            key={opt.value}
                            className={`flex min-h-[64px] items-start gap-3 rounded-xl border-2 p-2.5 transition-colors ${
                              decision === opt.value
                                ? "border-purple-600 bg-purple-50/50"
                                : "border-transparent hover:border-gray-200 hover:bg-gray-50"
                            }`}
                          >
                            <div className="flex-shrink-0 mt-0.5">
                              <div
                                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                  decision === opt.value ? "border-purple-600" : "border-gray-300"
                                }`}
                              >
                                {decision === opt.value && (
                                  <div className="w-2 h-2 rounded-full bg-purple-600" />
                                )}
                              </div>
                            </div>
                            <p className="text-sm text-gray-700 leading-snug">{opt.label}</p>
                            <input
                              type="radio"
                              name="wf-decision"
                              checked={decision === opt.value}
                              onChange={() => onDecision(opt.value as ApprovalDecision)}
                              className="sr-only"
                            />
                          </label>
                        ))}
                      </div>

                      {onNotesChange && (
                        <div className="mt-4">
                          <label className="mb-1 block text-xs font-semibold text-gray-500">Notes / Comments</label>
                          <textarea
                            value={notes || ""}
                            onChange={(e) => onNotesChange(e.target.value)}
                            rows={2}
                            className="w-full rounded-[10px] border border-gray-200 bg-white px-3.5 py-2.5 text-sm"
                            placeholder="Add notes or reasoning..."
                          />
                        </div>
                      )}
                    </>
                  )}

                  {step.state === "active" && !onDecision && (
                    <WaitingDetails actor={step.actor} />
                  )}

                  {step.state === "pending" && <PendingDetails />}

                  {step.state === "skipped" && (
                    <div className="text-sm text-gray-400 italic">Not required for this declaration.</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {onSubmit && (
        <div className="mt-5 bg-purple-50 rounded-[14px] p-4 text-center">
          <p className="text-xs text-purple-700 mb-3">
            {submitted ? "Decision submitted. Awaiting next approval." : "Complete the current step before proceeding."}
          </p>
          <button
            onClick={onSubmit}
            disabled={submitDisabled}
            className="w-full py-3 border-none rounded-[10px] bg-gradient-to-br from-purple-700 to-purple-500 text-white text-sm font-bold cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
          >
            {submitted ? "Decision Submitted" : "Submit Decision"}
          </button>
        </div>
      )}
    </div>
    </div>
    </div>
  );
}






