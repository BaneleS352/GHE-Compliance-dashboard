import { useState, useEffect } from "react";
import { Filter, Download, Search } from "lucide-react";
import { fetchDeclarations } from "../../services/api";
import { Declaration, ApprovalDecision } from "../../types/declaration";
import { PURPLE, formatRand } from "../../config/theme";
import { Card } from "../components/Card";
import { PageHeader } from "../components/PageHeader";
import { THead } from "../components/THead";
import { StatusBadge } from "../components/StatusBadge";
import { TypeBadge } from "../components/TypeBadge";
import { exportRowsToXls } from "../../utils/excel";

const DECISION_BUTTONS = [
  { value: "accept", label: "Accept", icon: "✓", textCls: "text-green-600", borderCls: "border-green-200", hoverCls: "hover:bg-green-50 hover:border-green-300" },
  { value: "reject", label: "Reject", icon: "✕", textCls: "text-red-500", borderCls: "border-red-200", hoverCls: "hover:bg-red-50 hover:border-red-300" },
  { value: "decline", label: "Decline", icon: "☰", textCls: "text-amber-500", borderCls: "border-amber-200", hoverCls: "hover:bg-amber-50 hover:border-amber-300" },
  { value: "info", label: "Return for More Info", icon: "↺", textCls: "text-blue-500", borderCls: "border-blue-200", hoverCls: "hover:bg-blue-50 hover:border-blue-300" },
  { value: "escalate", label: "Escalate", icon: "⦸", textCls: "text-gray-500", borderCls: "border-gray-200", hoverCls: "hover:bg-gray-50 hover:border-gray-300" },
];

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

      <div className="mb-4">
        <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Decision *</label>
        <select
          className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm appearance-none cursor-pointer bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_12px_center]"
          value={decision ?? ""}
          onChange={(e) => onSelect(e.target.value as ApprovalDecision || null)}
        >
          <option value="">Please select a decision</option>
          {DECISION_BUTTONS.map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {DECISION_BUTTONS.map((d) => (
          <button
            key={d.value}
            onClick={() => onSelect(d.value as ApprovalDecision)}
            className={`
              inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-all duration-200
              ${decision === d.value ? "shadow-[0_0_0_2px_currentColor_inset]" : "shadow-sm"}
              ${d.textCls} ${d.borderCls} ${d.hoverCls}
              ${decision === d.value ? "bg-white" : "bg-white/70"}
            `}
          >
            <span className="text-sm leading-none">{d.icon}</span>
            <span>{d.label}</span>
          </button>
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
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("All");
  const [showFilters, setShowFilters] = useState(false);
  const [status, setStatus] = useState("All");
  const [priority, setPriority] = useState("All");

  useEffect(() => {
    fetchDeclarations()
      .then(setAllDeclarations)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const queue = allDeclarations.filter((d) => ["Pending", "Escalated", "Info Requested"].includes(d.status));
  const departments = Array.from(new Set(queue.map((d) => d.department))).sort();
  const filteredQueue = queue.filter((d) => {
    const query = search.trim().toLowerCase();
    return (
      (!query ||
        d.id.toLowerCase().includes(query) ||
        d.employee.toLowerCase().includes(query) ||
        d.Counterparty.toLowerCase().includes(query)) &&
      (department === "All" || d.department === department) &&
      (status === "All" || d.status === status) &&
      (priority === "All" || d.priority === priority)
    );
  });
  const priorityStyle: Record<string, string> = {
    High: "bg-red-50 text-red-700",
    Medium: "bg-amber-50 text-amber-700",
    Low: "bg-emerald-50 text-emerald-700",
  };
  const exportQueue = () => {
    exportRowsToXls(
      "ApprovalQueue",
      "Queue",
      filteredQueue.map((d) => ({
        ID: d.id,
        Employee: d.employee,
        Department: d.department,
        Type: d.type,
        Counterparty: d.Counterparty,
        Value: d.value,
        Submitted: d.submitted,
        Priority: d.priority,
        Status: d.status,
      }))
    );
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
        subtitle={`${filteredQueue.length} declarations awaiting your review`}
        actions={
          <>
            <button
              onClick={() => setShowFilters((v) => !v)}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-semibold transition-colors hover:bg-muted sm:w-auto"
              aria-pressed={showFilters}
            >
              <Filter size={13} /> Filters
            </button>
            <button
              onClick={exportQueue}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-semibold transition-colors hover:bg-muted sm:w-auto"
            >
              <Download size={13} /> Export
            </button>
          </>
        }
      />

      <Card className="mb-4 flex flex-col gap-3 p-3.5 md:flex-row">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search declarations..."
            className="table-filter-input table-filter-with-icon"
          />
        </div>
        <div className="relative w-full md:w-auto">
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="table-filter-select md:w-auto"
          >
            <option value="All">All Departments</option>
            {departments.map((dept) => (
              <option key={dept}>{dept}</option>
            ))}
          </select>
        </div>
      </Card>
      {showFilters && (
        <Card className="mb-4 grid grid-cols-1 gap-3 p-3.5 sm:grid-cols-2">
          <div className="relative">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="table-filter-select"
            >
              <option value="All">All Statuses</option>
              <option>Pending</option>
              <option>Escalated</option>
              <option>Info Requested</option>
            </select>
          </div>
          <div className="relative">
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="table-filter-select"
            >
              <option value="All">All Priorities</option>
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </select>
          </div>
        </Card>
      )}

      <Card className="space-y-3 p-3.5 md:hidden">
        {filteredQueue.map((d) => (
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
            {filteredQueue.map((d) => (
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
        <div className="border-t border-border bg-[#F7F8FC] px-5 py-3.5">
          <p className="text-xs text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{filteredQueue.length}</span> declarations
          </p>
        </div>
      </Card>
    </div>
  );
}
