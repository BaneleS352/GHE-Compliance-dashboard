import { CheckSquare, FileText } from "lucide-react";
import { PURPLE } from "../../config/theme";
import { Screen } from "../../types/declaration";

export function ApproverViewToggle({
  active,
  onNavigate,
}: {
  active: "declarations" | "approvals";
  onNavigate: (screen: Screen) => void;
}) {
  const itemClass = (item: "declarations" | "approvals") =>
    `h-9 px-3.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 ${
      active === item
        ? "text-white shadow-sm"
        : "text-muted-foreground hover:text-foreground hover:bg-muted"
    }`;

  return (
    <div className="flex items-center gap-1 rounded-xl border border-border bg-white p-1">
      <button
        onClick={() => onNavigate("my-declarations")}
        className={itemClass("declarations")}
        style={active === "declarations" ? { background: PURPLE } : {}}
      >
        <FileText size={13} /> My Declarations
      </button>
      <button
        onClick={() => onNavigate("approver-dashboard")}
        className={itemClass("approvals")}
        style={active === "approvals" ? { background: PURPLE } : {}}
      >
        <CheckSquare size={13} /> My Approvals
      </button>
    </div>
  );
}
