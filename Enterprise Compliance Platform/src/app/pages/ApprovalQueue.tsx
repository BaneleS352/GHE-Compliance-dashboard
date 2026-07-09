import { useState, useEffect } from "react";
import { Filter, Download, Search, ChevronDown } from "lucide-react";
import { approvalOptions } from "../../data/declarations";
import { fetchDeclarations } from "../../services/api";
import { Declaration, ApprovalDecision } from "../../types/declaration";
import { PURPLE, formatRand } from "../../config/theme";
import { Card } from "../components/Card";
import { PageHeader } from "../components/PageHeader";
import { THead } from "../components/THead";
import { StatusBadge } from "../components/StatusBadge";
import { TypeBadge } from "../components/TypeBadge";

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
      <div className="mb-4 flex items-center gap-2.5 border-b border-border pb-3.5">
        <div className="h-2 w-2 rounded-full" style={{ background: PURPLE }} />
        <div>
          <p className="text-sm font-bold">{title}</p>
          <p className="text-xs text-muted-foreground">{role}</p>
        </div>
      </div>

      <div className="mb-4 space-y-2 min-h-[220px]">
        {approvalOptions.map((opt) => (
          <label
            key={opt.value}
            className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 transition-colors ${
              decision === opt.value ? "border-primary bg-[#F5F2FF]" : "border-transparent hover:border-border hover:bg-muted/20"
            }`}
          >
            <div className="flex-shrink-0">
              <div className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${decision === opt.value ? "border-primary" : "border-muted-foreground/40"}`}>
                {decision === opt.value && <div className="h-2 w-2 rounded-full" style={{ background: PURPLE }} />}
              </div>
            </div>
            <p className="text-sm leading-snug text-foreground">{opt.label}</p>
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
        <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Notes / Comments</label>
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={2}
          className="w-full rounded-xl border bg-muted/20 px-3.5 py-2.5 text-sm"
          placeholder="Add notes or reasoning..."
        />
      </div>
    </Card>
  );
}

export function ApprovalQueue({ onReview }: { onReview: (d: Declaration) => void }) {
  const [allDeclarations, setAllDeclarations] = useState<Declaration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDeclarations()
      .then(setAllDeclarations)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const queue = allDeclarations.filter((d) => ["Pending", "Escalated", "Info Requested"].includes(d.status));
  const priorityStyle: Record<string, string> = {
    High: "bg-red-50 text-red-700",
    Medium: "bg-amber-50 text-amber-700",
    Low: "bg-emerald-50 text-emerald-700",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm text-muted-foreground animate-pulse">Loading queue…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        <strong>Failed to load queue:</strong> {error}
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Approval Queue"
        subtitle={`${queue.length} declarations awaiting your review`}
        actions={
          <>
            <button className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-semibold transition-colors hover:bg-muted sm:w-auto">
              <Filter size={13} /> Filters
            </button>
            <button className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-semibold transition-colors hover:bg-muted sm:w-auto">
              <Download size={13} /> Export
            </button>
          </>
        }
      />

      <Card className="mb-4 flex flex-col gap-3 p-3.5 md:flex-row">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search declarations..."
            className="h-10 w-full rounded-lg border border-border bg-white pl-9 pr-4 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="relative w-full md:w-auto">
          <select className="h-10 w-full appearance-none rounded-lg border border-border bg-white pl-3.5 pr-9 text-sm md:w-auto">
            <option>All Departments</option>
            <option>Marketing</option>
            <option>Sales</option>
            <option>IT</option>
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        </div>
      </Card>

      <Card className="space-y-3 p-3.5 md:hidden">
        {queue.map((d) => (
          <div key={d.id} className="rounded-2xl border border-border bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-xs font-bold" style={{ color: PURPLE }}>{d.id}</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{d.employee}</p>
                <p className="mt-1 text-xs text-muted-foreground">{d.department}</p>
              </div>
              <StatusBadge status={d.status} />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Type</p>
                <div className="mt-1"><TypeBadge type={d.type} /></div>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Value</p>
                <p className="mt-1 font-semibold text-foreground">{formatRand(d.value)}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Submitted</p>
                <p className="mt-1 text-foreground">{d.submitted}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Priority</p>
                <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${priorityStyle[d.priority]}`}>{d.priority}</span>
              </div>
            </div>

            <div className="mt-4">
              <button
                onClick={() => onReview(d)}
                className="h-10 w-full rounded-xl text-sm font-semibold text-white hover:opacity-90"
                style={{ background: PURPLE }}
              >
                Review
              </button>
            </div>
          </div>
        ))}
      </Card>

      <Card className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[1050px] text-sm">
          <THead cols={["Declaration ID", "Employee", "Dept", "Type", "Counterparty", "Value", "Submitted", "Priority", "Status", "Actions"]} />
          <tbody className="divide-y divide-border">
            {queue.map((d) => (
              <tr key={d.id} className="transition-colors hover:bg-muted/20">
                <td className="px-5 py-3.5"><span className="font-mono text-xs font-bold" style={{ color: PURPLE }}>{d.id}</span></td>
                <td className="whitespace-nowrap px-5 py-3.5 text-sm font-medium text-foreground">{d.employee}</td>
                <td className="px-5 py-3.5 text-xs text-muted-foreground">{d.department}</td>
                <td className="px-5 py-3.5"><TypeBadge type={d.type} /></td>
                <td className="px-5 py-3.5 text-sm font-medium text-foreground">{d.Counterparty}</td>
                <td className="whitespace-nowrap px-5 py-3.5 text-sm font-semibold tabular-nums">{formatRand(d.value)}</td>
                <td className="whitespace-nowrap px-5 py-3.5 text-xs tabular-nums text-muted-foreground">{d.submitted}</td>
                <td className="px-5 py-3.5">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${priorityStyle[d.priority]}`}>{d.priority}</span>
                </td>
                <td className="px-5 py-3.5"><StatusBadge status={d.status} /></td>
                <td className="px-5 py-3.5">
                  <button
                    onClick={() => onReview(d)}
                    className="h-8 rounded-lg px-3 text-xs font-semibold text-white hover:opacity-90"
                    style={{ background: PURPLE }}
                  >
                    Review
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex flex-col gap-3 border-t border-border bg-[#F7F8FC] px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{queue.length}</span> declarations
          </p>
          <div className="flex gap-1.5">
            {[1, 2].map((p) => (
              <button
                key={p}
                className="h-8 w-8 rounded-lg text-xs font-semibold"
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
