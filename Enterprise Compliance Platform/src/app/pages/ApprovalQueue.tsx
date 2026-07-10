import { useState, useEffect, useMemo } from "react";
import { Filter, Download, Search, ChevronDown } from "lucide-react";
import { fetchDeclarations } from "../../services/api";
import { Declaration, ApprovalDecision } from "../../types/declaration";
import { PURPLE, formatRand } from "../../config/theme";
import { Card } from "../components/Card";
import { PageHeader } from "../components/PageHeader";
import { THead } from "../components/THead";
import { StatusBadge } from "../components/StatusBadge";
import { TypeBadge } from "../components/TypeBadge";
import { useUser } from "../auth/UserContext";
import { getPendingWorkflowStepsForUser, getApprovalOptions } from "../../data/db";

const approvalOptions = getApprovalOptions();

export function ApproverDecisionBlock({
  title,
  role,
  decision,
  onSelect,
  notes,
  onNotesChange,
  disabled,
}: {
  title: string;
  role: string;
  decision: ApprovalDecision;
  onSelect: (v: ApprovalDecision) => void;
  notes: string;
  onNotesChange: (v: string) => void;
  disabled?: boolean;
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
            className={`flex items-center gap-3 rounded-xl border-2 p-3 transition-colors ${
              disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
            } ${
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
              onChange={() => { if (!disabled) onSelect(opt.value as ApprovalDecision); }}
              className="sr-only"
            />
          </label>
        ))}
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Notes / Comments</label>
        <textarea
          value={notes}
          onChange={(e) => { if (!disabled) onNotesChange(e.target.value); }}
          rows={2}
          className={`w-full rounded-xl border px-3.5 py-2.5 text-sm ${disabled ? "bg-gray-100 cursor-not-allowed" : "bg-muted/20"}`}
          placeholder="Add notes or reasoning..."
          readOnly={disabled}
        />
      </div>
    </Card>
  );
}

export function ApprovalQueue({ onReview }: { onReview: (d: Declaration) => void }) {
  const { user } = useUser();
  const [allDeclarations, setAllDeclarations] = useState<Declaration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [deptFilter, setDeptFilter] = useState("All");

  useEffect(() => {
    fetchDeclarations()
      .then(setAllDeclarations)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const pendingSteps = useMemo(
    () => (user ? getPendingWorkflowStepsForUser(user.id) : []),
    [user]
  );

  const queueDeclIds = useMemo(
    () => new Set(pendingSteps.map((p) => p.declaration.id)),
    [pendingSteps]
  );

  const queue = useMemo(
    () => allDeclarations.filter((d) => queueDeclIds.has(d.id)),
    [allDeclarations, queueDeclIds]
  );

  const filtered = useMemo(
    () =>
      queue.filter((d) =>
        (!search || d.id.toLowerCase().includes(search.toLowerCase()) || d.employee.toLowerCase().includes(search.toLowerCase())) &&
        (typeFilter === "All" || d.type === typeFilter) &&
        (statusFilter === "All" || d.status === statusFilter) &&
        (priorityFilter === "All" || d.priority === priorityFilter) &&
        (deptFilter === "All" || d.department === deptFilter)
      ),
    [queue, search, typeFilter, statusFilter, priorityFilter, deptFilter]
  );

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
        subtitle={`${filtered.length} declarations awaiting your review`}
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

      <Card className="mb-4 flex flex-col gap-3 p-3.5 md:flex-row md:flex-wrap">
        <div className="relative min-w-0 flex-[2]">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search declarations..."
            className="h-10 w-full rounded-lg border border-border bg-white pl-9 pr-4 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-white px-2 text-sm md:max-w-[140px]">
          <option value="All">All Types</option>
          <option>Gift</option><option>Hospitality</option><option>Entertainment</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-white px-2 text-sm md:max-w-[140px]">
          <option value="All">All Status</option>
          <option>Pending</option><option>Approved</option><option>Declined</option>
        </select>
        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-white px-2 text-sm md:max-w-[120px]">
          <option value="All">All Priority</option>
          <option>High</option><option>Medium</option><option>Low</option>
        </select>
        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-white px-2 text-sm md:max-w-[150px]">
          <option value="All">All Depts</option>
          {[...new Set(queue.map((d) => d.department))].map((dept) => <option key={dept}>{dept}</option>)}
        </select>
      </Card>

      <Card className="space-y-3 p-3.5 md:hidden">
        {filtered.map((d) => (
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
        <table className="w-full text-sm">
          <THead cols={["Declaration ID", "Employee", "Dept", "Type", "Counterparty", "Value", "Submitted", "Priority", "Status", "Actions"]} compact />
          <tbody className="divide-y divide-border">
            {filtered.map((d) => (
              <tr key={d.id} className="transition-colors hover:bg-muted/20">
                <td className="px-2 py-3"><span className="font-mono text-xs font-bold" style={{ color: PURPLE }}>{d.id}</span></td>
                <td className="whitespace-nowrap px-2 py-3 text-sm font-medium text-foreground">{d.employee}</td>
                <td className="px-2 py-3 text-xs text-muted-foreground">{d.department}</td>
                <td className="px-2 py-3"><TypeBadge type={d.type} /></td>
                <td className="px-2 py-3 text-sm font-medium text-foreground">{d.Counterparty}</td>
                <td className="whitespace-nowrap px-2 py-3 text-sm font-semibold tabular-nums">{formatRand(d.value)}</td>
                <td className="whitespace-nowrap px-2 py-3 text-xs tabular-nums text-muted-foreground">{d.submitted}</td>
                <td className="px-2 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${priorityStyle[d.priority]}`}>{d.priority}</span>
                </td>
                <td className="px-2 py-3"><StatusBadge status={d.status} /></td>
                <td className="px-2 py-3">
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
            Showing <span className="font-semibold text-foreground">{filtered.length}</span> declarations
          </p>
        </div>
      </Card>
    </div>
  );
}
