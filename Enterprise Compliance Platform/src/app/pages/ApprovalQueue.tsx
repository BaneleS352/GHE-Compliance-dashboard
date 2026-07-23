import { useState, useEffect } from "react";
import { Download, Search, AlertTriangle } from "lucide-react";
import { fetchPendingWorkflows } from "../../services/api";
import { Declaration } from "../../types/declaration";
import { PURPLE, formatRand, PRIORITY_COLORS } from "../../config/theme";
import { Card } from "../components/Card";
import { PageHeader } from "../components/PageHeader";

import { StatusBadge } from "../components/StatusBadge";
import { TypeBadge } from "../components/TypeBadge";
import { Table, Thead, Th, Tbody, Tr, Td, COL } from "../components/table";
import { exportRowsToXls } from "../../utils/excel";

function daysSince(dateStr: string): number {
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / 86400000);
}

function isOutstanding(dateStr: string): boolean {
  return daysSince(dateStr) >= 7;
}

export function ApprovalQueue({ onReview }: { onReview: (d: Declaration) => void }) {
  const [allDeclarations, setAllDeclarations] = useState<Declaration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("All");
  const [status, setStatus] = useState("All");
  const [priority, setPriority] = useState("All");
  const [employeeFilter, setEmployeeFilter] = useState("All");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const PAGE_SIZE = 10;

  useEffect(() => {
    fetchPendingWorkflows()
      .then((items) => setAllDeclarations(items.map((item) => item.declaration)))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { setPage(0); }, [search, department, status, priority, employeeFilter, overdueOnly, sortKey, sortDir]);

  const queue = allDeclarations;
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
  const sortFieldMap: Record<string, string> = {
    "Declaration ID": "id", Employee: "employee", Dept: "department", Type: "type",
    Counterparty: "Counterparty", Value: "value", Submitted: "submitted",
    Priority: "priority", Status: "status",
  };
  const sorted = sortKey
    ? [...filteredQueue].sort((a, b) => {
        const aVal = (a as any)[sortFieldMap[sortKey] || sortKey] ?? "";
        const bVal = (b as any)[sortFieldMap[sortKey] || sortKey] ?? "";
        if (typeof aVal === "number" && typeof bVal === "number") return sortDir === "asc" ? aVal - bVal : bVal - aVal;
        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();
        if (aStr < bStr) return sortDir === "asc" ? -1 : 1;
        if (aStr > bStr) return sortDir === "asc" ? 1 : -1;
        return 0;
      })
    : filteredQueue;
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pagedQueue = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const exportQueue = () => {
    exportRowsToXls(
      "ApprovalQueue",
      "Queue",
      sorted.map((d) => ({
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
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { setSearch(""); setDepartment("All"); setStatus("All"); setPriority("All"); setEmployeeFilter("All"); setOverdueOnly(false); }}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-semibold transition-colors hover:bg-muted sm:w-auto"
            >
              Clear Filters
            </button>
            <button
              onClick={exportQueue}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-semibold transition-colors hover:bg-muted sm:w-auto"
            >
              <Download size={13} /> Export Excel
            </button>
          </div>
        }
      />

      <Card className="mb-4 grid grid-cols-1 gap-3 border-white/70 bg-white/85 p-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
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
              <option>Returned</option>
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
        <div className="flex items-end">
          <button
            onClick={() => setOverdueOnly((v) => !v)}
            className={`flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors ${
              overdueOnly
                ? "border-red-300 bg-red-100 text-red-700 shadow-sm"
                : "border-red-200 bg-red-50 text-red-600 hover:border-red-300 hover:bg-red-100 hover:text-red-700"
            }`}
          >
            <AlertTriangle size={12} />
            {overdueOnly ? "Overdue: On" : "Overdue only"}
          </button>
        </div>
      </Card>

      <Card className="space-y-3 p-3.5 md:hidden">
        {pagedQueue.map((d) => (
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
                </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Priority</p>
                <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${PRIORITY_COLORS[d.priority]?.bg || ""} ${PRIORITY_COLORS[d.priority]?.text || ""}`}>{d.priority}</span>
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
        <Table>
          <Thead>
            {["Declaration ID", "Employee", "Dept", "Type", "Counterparty", "Value", "Submitted", "Priority", "Status"].map((label) => (
              <Th
                key={label}
                sortable
                active={sortKey === label}
                direction={sortDir}
                onClick={() => {
                  if (sortKey === label) setSortDir(sortDir === "asc" ? "desc" : "asc");
                  else { setSortKey(label); setSortDir("asc"); }
                }}
              >
                {label}
              </Th>
            ))}
            <Th>Actions</Th>
          </Thead>
          <Tbody>
            {pagedQueue.map((d) => (
              <Tr key={d.id}>
                <Td><span className={COL.ID} style={{ color: PURPLE }}>{d.id}</span></Td>
                <Td className={COL.EMPLOYEE}>{d.employee}</Td>
                <Td className={COL.DEPARTMENT}>{d.department}</Td>
                <Td><TypeBadge type={d.type} /></Td>
                <Td className={COL.COUNTERPARTY}>{d.Counterparty}</Td>
                <Td className={COL.VALUE}>{formatRand(d.value)}</Td>
                <Td className={COL.SUBMITTED}>{d.submitted}</Td>
                <Td>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${PRIORITY_COLORS[d.priority]?.bg || ""} ${PRIORITY_COLORS[d.priority]?.text || ""}`}>{d.priority}</span>
                </Td>
                <Td><StatusBadge status={d.status} /></Td>
                <Td>
                  <button
                    onClick={() => onReview(d)}
                    className="h-8 rounded-lg px-3 text-xs font-semibold text-white hover:opacity-90"
                    style={{ background: PURPLE }}
                  >
                    Review
                  </button>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
        <div className="flex items-center justify-between border-t border-border bg-[#F7F8FC] px-5 py-3">
          <p className="text-xs text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{filteredQueue.length}</span> declarations
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs text-muted-foreground">
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}






