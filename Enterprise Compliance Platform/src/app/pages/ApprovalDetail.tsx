import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { Declaration } from "../../types/declaration";
import { StatusBadge } from "../components/StatusBadge";
import { DeclarationDetailView, SupportingDocuments } from "../pages/DeclarationDetailView";
import { WorkflowTimeline } from "../components/WorkflowTimeline";
import { useUser } from "../auth/UserContext";
import { useWorkflowApproval } from "../hooks/useWorkflowApproval";

export function ApprovalDetail({
  declaration,
  onBack,
}: {
  declaration: Declaration;
  onBack: () => void;
}) {
  const { user } = useUser();
  const [declarationStatus, setDeclarationStatus] = useState(declaration.status);

  useEffect(() => {
    setDeclarationStatus(declaration.status);
  }, [declaration.status]);

  const {
    wfSteps, wfMessage, wfLoading, canApprove, submitError,
    activeDecision, setActiveDecision,
    activeNotes, setActiveNotes,
    handleSubmit, submitDisabled,
  } = useWorkflowApproval({
    declarationId: declaration.id,
    userId: user?.id ?? null,
    onSuccess: onBack,
    onStatusUpdate: (s) => setDeclarationStatus(s),
  });

  if (wfLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm text-muted-foreground animate-pulse">Loading workflow…</div>
      </div>
    );
  }

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
        <div className="xl:col-span-3 flex flex-col gap-5">
          <DeclarationDetailView data={declaration} onBack={() => {}} hideBackButton hideDocuments hideTitle />
          <SupportingDocuments data={declaration} />
        </div>

        <div className="xl:col-span-2 space-y-5 h-full">
          {submitError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {submitError}
            </div>
          )}
          {wfMessage && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              {wfMessage}
            </div>
          )}

          <WorkflowTimeline
            steps={wfSteps}
            decision={canApprove ? activeDecision : undefined}
            onDecision={canApprove && setActiveDecision ? setActiveDecision : undefined}
            notes={canApprove ? activeNotes : undefined}
            onNotesChange={canApprove && setActiveNotes ? setActiveNotes : undefined}
            onSubmit={canApprove ? handleSubmit : undefined}
            submitDisabled={submitDisabled}
          />
        </div>
      </div>
    </div>
  );
}
