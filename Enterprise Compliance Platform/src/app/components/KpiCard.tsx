import React from "react";
import { FileText, Clock, Check, Undo, X, ArrowUp } from "lucide-react";

export interface KpiDef {
  key: string;
  label: string;
  icon: React.ElementType;
  color: string;
  filterValue: string;
}

export const STATUS_KPI: Record<string, KpiDef> = {
  Total:     { key: "Total",     label: "Total",     icon: FileText, color: "#7c3aed", filterValue: "All" },
  Pending:   { key: "Pending",   label: "Pending",   icon: Clock,    color: "#f59e0b", filterValue: "Pending" },
  Approved:  { key: "Approved",  label: "Approved",  icon: Check,    color: "#10b981", filterValue: "Approved" },
  Returned:  { key: "Returned",  label: "Returned",  icon: Undo,     color: "#06b6d4", filterValue: "Returned" },
  Declined:  { key: "Declined",  label: "Declined",  icon: X,        color: "#ef4444", filterValue: "Declined" },
  Escalated: { key: "Escalated", label: "Escalated", icon: ArrowUp,  color: "#f97316", filterValue: "Escalated" },
};

export function KpiCard({
  label,
  value,
  icon: Icon,
  color,
  active,
  onClick,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex min-h-32 select-none items-center rounded-2xl border p-4 transition-all duration-300 sm:min-h-36 sm:p-5
        ${onClick ? "cursor-pointer" : "cursor-default"}
        ${active ? "shadow-xl sm:scale-[1.03]" : "hover:shadow-md sm:hover:scale-[1.02]"}
      `}
      style={{
        background: `linear-gradient(135deg, ${color}35, ${color}18)`,
        borderColor: active ? color : "#eee",
      }}
    >
      <div className="flex items-center gap-4">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: `${color}40` }}
        >
          <Icon size={18} style={{ color }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="break-words text-xl font-bold sm:text-2xl">{value}</p>
          <p className="text-xs leading-relaxed text-muted-foreground">{label}</p>
        </div>
      </div>
    </div>
  );
}
