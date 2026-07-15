import { useState, useEffect } from "react";
import { fetchWorkflowInstance } from "../../services/api";
import { ApprovalDecision } from "../../types/declaration";

const DECISION_LABELS: Record<string, string> = {
  accept: "Accept",
  reject: "Reject",
  decline: "Decline",
  info: "Return for More Info",
  escalate: "Escalate",
};

const DECISION_BUTTONS = [
  { value: "accept", label: "Accept", icon: "\u2713", cls: "accept", color: "text-green-600", border: "border-green-200", hover: "hover:bg-green-50 hover:border-green-300" },
  { value: "reject", label: "Reject", icon: "\u2715", cls: "reject", color: "text-red-500", border: "border-red-200", hover: "hover:bg-red-50 hover:border-red-300" },
  { value: "decline", label: "Decline", icon: "\u2630", cls: "decline", color: "text-amber-500", border: "border-amber-200", hover: "hover:bg-amber-50 hover:border-amber-300" },
  { value: "info", label: "Return for More Info", icon: "\u21BA", cls: "info", color: "text-blue-500", border: "border-blue-200", hover: "hover:bg-blue-50 hover:border-blue-300" },
  { value: "escalate", label: "Escalate", icon: "\u29F8", cls: "escalate", color: "text-gray-500", border: "border-gray-200", hover: "hover:bg-gray-50 hover:border-gray-300" },
];

export interface StepView {
  label: string;
  actor: string;
  state: "completed" | "active" | "pending";
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

function buildStepsFromWorkflow(wf: any, employee?: string): StepView[] {
  if (wf && wf.steps && wf.steps.length > 0) {
    const result: StepView[] = [];
    for (const step of wf.steps) {
      if (step.status === "pending") {
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
    return result;
  }
  return [
    { label: "Line Manager Review", actor: "Loading...", state: "active" },
    { label: "HR Review", actor: "Head of HR", state: "pending" },
    { label: "CEO Approval", actor: "Group CEO", state: "pending" },
  ];
}

function Dot({ state }: { state: "completed" | "active" | "pending" }) {
  return (
    <div
      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${
        state === "completed" ? "bg-purple-600" :
        state === "active" ? "bg-purple-600" :
        "bg-gray-400"
      }`}
    />
  );
}

function Badge({ state }: { state: "completed" | "active" | "pending" }) {
  if (state === "completed") {
    return <span className="wf-badge text-[11px] font-bold px-2.5 py-1 rounded-full bg-green-100 text-green-600 inline-flex items-center gap-1 whitespace-nowrap">✓ Completed</span>;
  }
  if (state === "active") {
    return <span className="wf-badge text-[11px] font-bold px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 inline-flex items-center gap-1 whitespace-nowrap">In Progress</span>;
  }
  return <span className="wf-badge text-[11px] font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 inline-flex items-center gap-1 whitespace-nowrap">Pending</span>;
}

function RailLine({ steps }: { steps: StepView[] }) {
  const doneCount = steps.filter((s) => s.state !== "pending").length;
  const pct = steps.length > 1 ? ((doneCount - 1) / (steps.length - 1)) * 100 : 0;
  return (
    <div className="absolute left-[13px] top-2 bottom-2 w-[2px] bg-gray-200" />
  );
}

function CompletedDetails({ step }: { step: StepView }) {
  return (
    <>
      <div className="wf-detail-row flex justify-between py-1 text-sm">
        <span className="text-gray-500">Decision</span>
        <span className="font-semibold text-green-600">{step.decision?.label || "-"}</span>
      </div>
      <div className="wf-detail-row flex justify-between py-1 text-sm">
        <span className="text-gray-500">Date</span>
        <span className="font-semibold text-gray-900">{step.decidedAt ? step.decidedAt.slice(0, 10) : "-"}</span>
      </div>
      <div className="wf-detail-row flex justify-between py-1 text-sm">
        <span className="text-gray-500">Time</span>
        <span className="font-semibold text-gray-900">{step.decidedAt ? step.decidedAt.slice(11, 16) : "-"}</span>
      </div>
      {step.notes && (
        <p className="mt-2 text-xs italic text-gray-500 border-t border-gray-200 pt-2">"{step.notes}"</p>
      )}
    </>
  );
}

function PendingDetails() {
  return (
    <>
      <div className="wf-detail-row flex justify-between py-1 text-sm">
        <span className="text-gray-500">Status</span>
        <span className="font-semibold text-gray-900">Pending</span>
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
      <p className="text-sm text-purple-700 font-semibold mb-3">Waiting for approval from <strong>{actor}</strong></p>
      <PendingDetails />
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
    if (declarationId) fetchWorkflowInstance(declarationId).then(setWf);
  }, [declarationId]);

  const steps = externalSteps || buildStepsFromWorkflow(wf, employee);

  return (
    <div className="bg-white rounded-2xl p-7 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_8px_24px_rgba(76,29,149,0.06)]" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, sans-serif" }}>
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
        <h1 className="text-xs font-extrabold tracking-[0.06em] uppercase text-purple-700 m-0">Approval Workflow</h1>
      </div>

      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        const isActive = step.state === "active";

        return (
          <div key={i} className="flex gap-4">
            <div className="flex flex-col items-center flex-shrink-0">
              <Dot state={step.state} />
              {!isLast && <div className="w-[2px] flex-1 bg-purple-200 min-h-[24px]" style={{ margin: "4px 0" }} />}
            </div>

            <div className="flex-1" style={isLast ? {} : { paddingBottom: 28 }}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="text-sm font-bold text-gray-900 m-0">{step.label}</p>
                  <p className="text-sm text-gray-500 m-0">{step.actor}</p>
                </div>
                <Badge state={step.state} />
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-[14px] p-4">
                {step.state === "completed" && <CompletedDetails step={step} />}

                {step.state === "active" && onDecision && (
                  <>
                    <p className="text-xs font-semibold text-gray-500 mb-0.5">Status</p>
                    <p className="text-sm font-semibold text-purple-700 mb-3">Waiting for approval from {step.actor}</p>

                    <p className="text-xs font-semibold text-gray-500 mb-0.5">Decision *</p>
                    <select
                      className="w-full rounded-[10px] border border-gray-200 bg-white px-3.5 py-2.5 text-sm appearance-none cursor-pointer mb-3 bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_12px_center]"
                      value={decision ?? ""}
                      onChange={(e) => onDecision(e.target.value as ApprovalDecision || null)}
                    >
                      <option value="">Please select a decision</option>
                      {DECISION_BUTTONS.map((d) => (
                        <option key={d.value} value={d.value}>{d.label}</option>
                      ))}
                    </select>

                    <div className="flex flex-wrap gap-2">
                      {DECISION_BUTTONS.map((d) => (
                        <button
                          key={d.value}
                          onClick={() => onDecision(d.value as ApprovalDecision)}
                          className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-[10px] border bg-white cursor-pointer transition-all duration-100 hover:-translate-y-[1px] hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)] ${d.color} ${d.border} ${d.hover} ${decision === d.value ? "shadow-[0_0_0_2px_currentColor_inset]" : ""}`}
                        >
                          <span>{d.icon}</span> {d.label}
                        </button>
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
              </div>
            </div>
          </div>
        );
      })}

      {onSubmit && (
        <div className="mt-1 bg-purple-50 rounded-[14px] p-4 text-center">
          <p className="text-xs text-purple-700 mb-3">
            {submitted ? "Decision submitted. Awaiting next approval." : "Complete the current step before proceeding."}
          </p>
          <button
            onClick={onSubmit}
            disabled={submitDisabled}
            className="w-full py-3 border-none rounded-[10px] bg-gradient-to-br from-purple-700 to-purple-500 text-white text-sm font-bold cursor-pointer transition-all duration-100 disabled:opacity-45 disabled:cursor-not-allowed hover:not-disabled:-translate-y-[1px]"
          >
            {submitted ? "Decision Submitted" : "Submit Decision"}
          </button>
        </div>
      )}
    </div>
  );
}
