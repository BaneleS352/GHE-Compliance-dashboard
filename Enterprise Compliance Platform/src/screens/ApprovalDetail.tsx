import { useState } from "react";
import { ArrowLeft } from "lucide-react";
<<<<<<< Updated upstream
import { Declaration, ApprovalDecision } from "@/types/declaration";
import { PURPLE } from "@/config/theme";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/StatusBadge";
import { DeclarationDetailView } from "@/screens/DeclarationDetailView";
import { ApproverDecisionBlock } from "@/screens/ApprovalQueue";
=======
import { Declaration, ApprovalDecision } from "../types/declaration";
import { PURPLE } from "../config/theme";
import { Card } from "../components/Card";
import { StatusBadge } from "../components/StatusBadge";
import { DeclarationDetailView } from "../screens/DeclarationDetailView";
import { ApproverDecisionBlock } from "../screens/ApprovalQueue";
>>>>>>> Stashed changes

export function ApprovalDetail({
  declaration,
  onBack,
}: {
  declaration: Declaration;
  onBack: () => void;
}) {
  const [lmDecision,  setLmDecision]  = useState<ApprovalDecision>(null);
  const [hrDecision,  setHrDecision]  = useState<ApprovalDecision>(null);
  const [ceoDecision, setCeoDecision] = useState<ApprovalDecision>(null);
  const [lmNotes,  setLmNotes]  = useState("");
  const [hrNotes,  setHrNotes]  = useState("");
  const [ceoNotes, setCeoNotes] = useState("");

  const isHrEnabled  = !!lmDecision;
  const isCeoEnabled = !!lmDecision && !!hrDecision;

  const handleSave = () => {
    console.log("Saved:", { lmDecision, hrDecision, ceoDecision });
    alert("Progress saved");
  };

  const handleSubmit = () => {
    if (!lmDecision)  { alert("Line Manager decision is required"); return; }
    if (!hrDecision)  { alert("HR decision is required");           return; }
    if (!ceoDecision) { alert("CEO decision is required");          return; }
    console.log("Final submission:", { declarationId: declaration.id, lmDecision, hrDecision, ceoDecision });
    alert("Workflow completed");
    onBack();
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-7 pb-5 border-b border-border">
        <button onClick={onBack} className="h-9 px-3.5 border rounded-xl flex items-center gap-1.5 text-sm">
          <ArrowLeft size={14} /> Back
        </button>
        <span className="font-mono font-bold">{declaration.id}</span>
        <StatusBadge status={declaration.status} />
      </div>

      <div className="grid grid-cols-5 gap-5">
        {/* Left — declaration detail */}
        <div className="col-span-3">
          <DeclarationDetailView data={declaration} onBack={onBack} />
        </div>

        {/* Right — approval steps */}
        <div className="col-span-2 space-y-4 sticky top-4 self-start">
          {/* Step 1 */}
          <ApproverDecisionBlock
            title="1. Line Manager Approval"
            role="Sipho Nkosi"
            decision={lmDecision}
            onSelect={setLmDecision}
            notes={lmNotes}
            onNotesChange={setLmNotes}
          />

          {/* Step 2 */}
          <div className={!isHrEnabled ? "opacity-50 pointer-events-none" : ""}>
            <ApproverDecisionBlock
              title="2. Head of HR Approval"
              role="Lindiwe Zulu"
              decision={hrDecision}
              onSelect={setHrDecision}
              notes={hrNotes}
              onNotesChange={setHrNotes}
            />
          </div>

          {/* Step 3 */}
          <div className={!isCeoEnabled ? "opacity-50 pointer-events-none" : ""}>
            <ApproverDecisionBlock
              title="3. Group CEO Approval"
              role="Sandile Shabalala"
              decision={ceoDecision}
              onSelect={setCeoDecision}
              notes={ceoNotes}
              onNotesChange={setCeoNotes}
            />
          </div>

          {/* Actions */}
          <Card className="p-5">
            <p className="text-xs text-muted-foreground mb-3">
              Complete all steps in sequence before submitting.
            </p>
            <div className="flex gap-2.5">
              <button onClick={handleSave} className="flex-1 h-10 border rounded-xl text-sm">
                Save Progress
              </button>
              <button
                onClick={handleSubmit}
                disabled={!lmDecision || !hrDecision || !ceoDecision}
                className="flex-1 h-10 text-white rounded-xl disabled:opacity-40 text-sm"
                style={{ background: `linear-gradient(135deg, ${PURPLE}, #6d28d9)` }}
              >
                Submit Decision
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
