import { useState } from "react";
import { Filter, Download, Search, ChevronDown } from "lucide-react";
import { declarations, approvalOptions } from "../../data/declarations";
import { Declaration, ApprovalDecision } from "../../types/declaration";
import { PURPLE } from "../../config/theme";
import { Card } from "../components/Card";
import { PageHeader } from "../components/PageHeader";
import { THead } from "../components/THead";
import { StatusBadge } from "../components/StatusBadge";
import { TypeBadge } from "../components/TypeBadge";
import { formatRand } from "../../config/theme";

// ─── Approver Decision Block ────────────────────────────────────────────────────
export function ApproverDecisionBlock({
  title,
  role,
  decision,
  onSelect,
  notes,
  onNotesChange,
}: {
  title: string;
  role: string;
  decision: ApprovalDecision;
  onSelect: (v: ApprovalDecision) => void;
  notes: string;
  onNotesChange: (v: string) => void;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2.5 mb-4 pb-3.5 border-b border-border">
        <div className="w-2 h-2 rounded-full" style={{ background: PURPLE }} />
        <div>
          <p className="text-sm font-bold">{title}</p>
          <p className="text-xs text-muted-foreground">{role}</p>
        </div>
      </div>

      <div className="space-y-2 mb-4 min-h-[220px]">
        {approvalOptions.map((opt) => (
          <label
            key={opt.value}
            className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
              decision === opt.value
                ? "border-primary bg-[#F5F2FF]"
                : "border-transparent hover:border-border hover:bg-muted/20"
            }`}
          >
            <div className="flex-shrink-0">
              <div
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  decision === opt.value ? "border-primary" : "border-muted-foreground/40"
                }`}
              >
                {decision === opt.value && (
                  <div className="w-2 h-2 rounded-full" style={{ background: PURPLE }} />
                )}
              </div>
            </div>
            <p className="text-sm text-foreground leading-snug">{opt.label}</p>
            <input
              type="radio"
              name={title}
              checked={decision === opt.value}
              onChange={() => onSelect(opt.value as ApprovalDecision)}
              className="sr-only"
            />
          </label>
        ))}
      </div>

      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Notes / Comments</label>
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={2}
          className="w-full rounded-xl px-3.5 py-2.5 text-sm border bg-muted/20"
          placeholder="Add notes or reasoning..."
        />
      </div>
    </Card>
  );
}

// ─── Approval Queue ─────────────────────────────────────────────────────────────
export function ApprovalQueue({ onReview }: { onReview: (d: Declaration) => void }) {
  const queue = declarations.filter((d) =>
    ["Pending", "Escalated", "Info Requested"].includes(d.status)
  );
  const priorityStyle: Record<string, string> = {
    High:   "bg-red-50 text-red-700",
    Medium: "bg-amber-50 text-amber-700",
    Low:    "bg-emerald-50 text-emerald-700",
  };

  return (
    <div>
      <PageHeader
        title="Approval Queue"
        subtitle={`${queue.length} declarations awaiting your review`}
        actions={
          <>
            <button className="h-9 px-4 rounded-xl text-sm font-semibold border border-border bg-white hover:bg-muted transition-colors flex items-center gap-2">
              <Filter size={13} /> Filters
            </button>
            <button className="h-9 px-4 rounded-xl text-sm font-semibold border border-border bg-white hover:bg-muted transition-colors flex items-center gap-2">
              <Download size={13} /> Export
            </button>
          </>
        }
      />

      {/* Search bar */}
      <Card className="p-3.5 mb-4 flex gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search declarations…"
            className="w-full h-9 pl-9 pr-4 rounded-lg text-sm border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>
        <div className="relative">
          <select className="h-9 pl-3.5 pr-9 rounded-lg text-sm border border-border bg-white appearance-none">
            <option>All Departments</option>
            <option>Marketing</option>
            <option>Sales</option>
            <option>IT</option>
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
      </Card>

      {/* Queue table */}
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <THead cols={["Declaration ID", "Employee", "Dept", "Type", "Counterparty", "Value", "Submitted", "Priority", "Status", "Actions"]} />
          <tbody className="divide-y divide-border">
            {queue.map((d) => (
              <tr key={d.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-5 py-3.5"><span className="font-mono text-xs font-bold" style={{ color: PURPLE }}>{d.id}</span></td>
                <td className="px-5 py-3.5 text-sm font-medium text-foreground whitespace-nowrap">{d.employee}</td>
                <td className="px-5 py-3.5 text-xs text-muted-foreground">{d.department}</td>
                <td className="px-5 py-3.5"><TypeBadge type={d.type} /></td>
                <td className="px-5 py-3.5 text-sm font-medium text-foreground">{d.Counterparty}</td>
                <td className="px-5 py-3.5 text-sm font-semibold tabular-nums whitespace-nowrap">{formatRand(d.value)}</td>
                <td className="px-5 py-3.5 text-xs text-muted-foreground tabular-nums whitespace-nowrap">{d.submitted}</td>
                <td className="px-5 py-3.5">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${priorityStyle[d.priority]}`}>{d.priority}</span>
                </td>
                <td className="px-5 py-3.5"><StatusBadge status={d.status} /></td>
                <td className="px-5 py-3.5">
                  <button
                    onClick={() => onReview(d)}
                    className="h-8 px-3 rounded-lg text-xs font-semibold text-white hover:opacity-90"
                    style={{ background: PURPLE }}
                  >
                    Review
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-5 py-3.5 border-t border-border flex items-center justify-between bg-[#F7F8FC]">
          <p className="text-xs text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{queue.length}</span> declarations
          </p>
          <div className="flex gap-1.5">
            {[1, 2].map((p) => (
              <button
                key={p}
                className="w-8 h-8 rounded-lg text-xs font-semibold"
                style={p === 1 ? { background: PURPLE, color: "#fff" } : { background: "#F0EEF8", color: "#6B6B80" }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
