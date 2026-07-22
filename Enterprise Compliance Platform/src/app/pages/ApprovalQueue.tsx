import { useState, useEffect } from "react";
import { Download, Search, AlertTriangle } from "lucide-react";
import { fetchDeclarations } from "../../services/api";
import { Declaration } from "../../types/declaration";
import { PURPLE, formatRand } from "../../config/theme";
import { useUser } from "../auth/UserContext";
import { Card } from "../components/Card";
import { PageHeader } from "../components/PageHeader";
import { THead } from "../components/THead";
import { StatusBadge } from "../components/StatusBadge";
import { TypeBadge } from "../components/TypeBadge";
import { exportRowsToXls } from "../../utils/excel";

function daysSince(dateStr: string): number {
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / 86400000);
}

function isOutstanding(dateStr: string): boolean {
  return daysSince(dateStr) >= 7;
}

export function ApprovalQueue({ onReview }: { onReview: (d: Declaration) => void }) {
  const { user } = useUser();
  const [allDeclarations, setAllDeclarations] = useState<Declaration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("All");
  const [status, setStatus] = useState("All");
  const [priority, setPriority] = useState("All");
  const [employeeFilter, setEmployeeFilter] = useState("All");
  const [overdueOnly, setOverdueOnly] = useState(false);

  useEffect(() => {
    fetchDeclarations()
      .then(setAllDeclarations)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const queue = allDeclarations.filter(
    (d) =>
      ["Pending", "Escalated", "Info Requested"].includes(d.status) &&
      (!user || d.approver === user.name)
  );
  const departments = Array.from(new Set(queue.map((d) => d.department))).sort();
  const employees = Array.from(new Set(queue.map((d) => d.employee))).sort();
  const filteredQueue = queue.filter((d) => {
    const query = search.trim().toLowerCase();
    return (
      (!query ||
        d.id.toLowerCase().includes(query) ||
        d.employee.toLowerCase().includes(query) ||
        d.Counterparty.toLowerCase().includes(query)) &&
      (department === "All" || d.department === department) &&
      (status === "All" || d.status === status) &&
      (priority === "All" || d.priority === priority) &&
      (employeeFilter === "All" || d.employee === employeeFilter) &&
      (!overdueOnly || isOutstanding(d.submitted))
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
              onClick={exportQueue}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-semibold transition-colors hover:bg-muted sm:w-auto"
            >
              <Download size={13} /> Export
            </button>
          </>
        }
      />

      <Card className="mb-4 grid grid-cols-1 gap-3 border-white/70 bg-white/85 p-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="xl:col-span-2">
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-600">Search</label>
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ID, Employee or Counterparty"
              className="table-filter-input table-filter-with-icon"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-600">Department</label>
          <div className="relative">
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="table-filter-select"
            >
              <option value="All">All Departments</option>
              {departments.map((dept) => (
                <option key={dept}>{dept}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-600">Employee</label>
          <div className="relative">
            <select
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className="table-filter-select"
            >
              <option value="All">All Employees</option>
              {employees.map((emp) => (
                <option key={emp}>{emp}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-600">Status</label>
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
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-600">Priority</label>
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
        </div>
      </Card>

      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => setOverdueOnly((v) => !v)}
          className={`flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors ${
            overdueOnly
              ? "border-red-400 bg-red-500 text-white shadow-sm"
              : "border-border bg-white/60 text-muted-foreground/60 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          }`}
        >
          <AlertTriangle size={12} />
          {overdueOnly ? "Overdue: On" : "Overdue only"}
        </button>
        {overdueOnly && (
          <span className="text-xs text-muted-foreground">
            Showing {filteredQueue.length} overdue {filteredQueue.length === 1 ? "declaration" : "declarations"}
          </span>
        )}
      </div>

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
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Type</p>
                <div className="mt-1"><TypeBadge type={d.type} /></div>
              </div>
              <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Value</p>
                <p className="mt-1 font-semibold text-foreground">{formatRand(d.value)}</p>
              </div>
              <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Submitted</p>
                  <p className="mt-1 text-foreground">{d.submitted}</p>
                  {isOutstanding(d.submitted) && (
                    <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                      <AlertTriangle size={10} /> {daysSince(d.submitted)} days
                    </span>
                  )}
                </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Priority</p>
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
                <td className="whitespace-nowrap px-5 py-3.5 text-xs tabular-nums text-muted-foreground">
                  {d.submitted}
                  {isOutstanding(d.submitted) && (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                      <AlertTriangle size={10} /> {daysSince(d.submitted)}d
                    </span>
                  )}
                </td>
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
