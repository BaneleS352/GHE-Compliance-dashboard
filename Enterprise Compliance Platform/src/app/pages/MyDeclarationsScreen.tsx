import { useState, useEffect } from "react";
import { ArrowLeft, Download, FileText, Clock, Check, X, Coins, Eye } from "lucide-react";
import { Declaration } from "../../types/declaration";
import { fetchDeclarations } from "../../services/api";
import { formatRand } from "../../config/theme";
import { useUser } from "../auth/UserContext";
import { Card } from "../components/Card";
import { PageHeader } from "../components/PageHeader";
import { KpiCard } from "../components/KpiCard";
import { StatusBadge } from "../components/StatusBadge";
import { DeclarationDetailView, SupportingDocuments } from "../pages/DeclarationDetailView";
import { WorkflowTimeline } from "../components/WorkflowTimeline";
import { exportRowsToXls } from "../../utils/excel";
import { useWorkflowApproval } from "../hooks/useWorkflowApproval";

export function MyDeclarationsScreen() {
  const { user } = useUser();
  const [declarations, setDeclarations] = useState<Declaration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDeclarations()
      .then(setDeclarations)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const isTeamMember = user?.role === "teamMember";
  const [viewMode, setViewMode] = useState<"my" | "all">("my");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [approverFilter, setApproverFilter] = useState("All");
  const [dateFilterStart, setDateFilterStart] = useState("");
  const [dateFilterEnd, setDateFilterEnd] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("All");
  const [activeKpi, setActiveKpi] = useState("All");
  const [sortKey, setSortKey] = useState<keyof Declaration | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;
  const [viewDecl, setViewDecl] = useState<Declaration | null>(null);

  const {
    wfSteps, wfMessage, canApprove,
    activeDecision, setActiveDecision,
    activeNotes, setActiveNotes,
    handleSubmit, submitDisabled,
  } = useWorkflowApproval({
    declarationId: viewDecl?.id ?? null,
    userId: user?.id ?? null,
    onSuccess: () => setViewDecl(null),
  });

  useEffect(() => { setPage(0); }, [search, typeFilter, statusFilter, approverFilter, employeeFilter, dateFilterStart, dateFilterEnd, sortKey, sortDir]);

  const userDeclarations = user
    ? declarations.filter((d) => d.employeeId === user.id || d.employee === user.name)
    : declarations;
  const visibleDeclarations = viewMode === "my" ? userDeclarations : declarations;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm text-muted-foreground animate-pulse">Loading declarations…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        <strong>Failed to load data:</strong> {error}
      </div>
    );
  }


  const filtered = visibleDeclarations.filter(
    (d) =>
      (!search ||
        d.id.toLowerCase().includes(search.toLowerCase()) ||
        d.Counterparty.toLowerCase().includes(search.toLowerCase()) ||
        d.employee.toLowerCase().includes(search.toLowerCase()) ||
        (d.approver || "").toLowerCase().includes(search.toLowerCase())) &&
      (typeFilter === "All" || d.type === typeFilter) &&
      (statusFilter === "All" || d.status === statusFilter) &&
      (approverFilter === "All" || d.approver === approverFilter) &&
      (employeeFilter === "All" || d.employee === employeeFilter) &&
      (!dateFilterStart || d.submitted >= dateFilterStart) &&
      (!dateFilterEnd || d.submitted <= dateFilterEnd)
  );

  const sorted = [...filtered].sort((a, b) => {
    if (!sortKey) return 0;
    const aVal = a[sortKey] ?? "";
    const bVal = b[sortKey] ?? "";

    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    }

    const aStr = String(aVal).toLowerCase();
    const bStr = String(bVal).toLowerCase();
    if (aStr < bStr) return sortDir === "asc" ? -1 : 1;
    if (aStr > bStr) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const totalValue = visibleDeclarations.reduce((sum, d) => sum + d.value, 0);


  const handleKpiClick = (type: string) => {
    setActiveKpi(type);
    setStatusFilter(type === "All" ? "All" : type);
  };

  const exportExcel = () => {
    const data = filtered.map((d) => ({
      ID: d.id,
      Employee: d.employee,
      Type: d.type,
      Counterparty: d.Counterparty,
      Value: d.value,
      Submitted: d.submitted,
      Status: d.status,
      Approver: d.approver,
    }));
    exportRowsToXls("Declarations", "Declarations", data);
  };

  const exportRow = (d: Declaration) => {
    exportRowsToXls(d.id, "Declaration", [
      {
        ID: d.id,
        Employee: d.employee,
        Department: d.department,
        Type: d.type,
        Counterparty: d.Counterparty,
        Value: d.value,
        Submitted: d.submitted,
        Status: d.status,
        Approver: d.approver,
        Priority: d.priority,
      },
    ]);
  };

  if (viewDecl) {
    return (
      <div>
        <div className="flex flex-wrap items-center gap-2.5 mb-7 pb-5 border-b border-border">
          <button
            onClick={() => setViewDecl(null)}
            className="h-9 px-3.5 border rounded-xl flex items-center gap-1.5 text-sm bg-card hover:bg-muted/50"
          >
            <ArrowLeft size={14} /> Back
          </button>
          <span className="font-mono font-bold">{viewDecl.id}</span>
          <StatusBadge status={viewDecl.status} />
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
          <div className="xl:col-span-3">
            <DeclarationDetailView data={viewDecl} onBack={() => {}} hideBackButton hideDocuments hideTitle />
          </div>
        <div className="xl:col-span-2 h-full space-y-5">
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
        <div className="xl:col-span-3">
          <SupportingDocuments data={viewDecl} />
        </div>
      </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={viewMode === "my" ? "My Declarations" : "All Declarations"}
        subtitle={`${visibleDeclarations.length} ${viewMode === "my" ? "of your" : "total"} declarations`}
        actions={
          <div className="flex gap-2">
            {!isTeamMember && (
              <div className="flex overflow-hidden rounded-xl border border-border bg-white text-sm font-semibold">
                <button
                  onClick={() => setViewMode("my")}
                  className={`px-4 py-2 transition-colors ${viewMode === "my" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"}`}
                >
                  My
                </button>
                <button
                  onClick={() => setViewMode("all")}
                  className={`px-4 py-2 transition-colors ${viewMode === "all" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"}`}
                >
                  All
                </button>
              </div>
            )}
            <button onClick={exportExcel} className="flex h-10 items-center justify-center gap-2 rounded-xl border bg-white px-4 text-sm font-semibold hover:bg-muted sm:w-auto">
              <Download size={13} /> Export Excel
            </button>
          </div>
        }
      />

      <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Total" value={String(visibleDeclarations.length)} icon={FileText} color="#7c3aed" active={activeKpi === "All"} onClick={() => handleKpiClick("All")} />
        <KpiCard label="Pending" value={String(visibleDeclarations.filter((d) => d.status === "Pending").length)} icon={Clock} color="#f59e0b" active={activeKpi === "Pending"} onClick={() => handleKpiClick("Pending")} />
        <KpiCard label="Approved" value={String(visibleDeclarations.filter((d) => d.status === "Approved").length)} icon={Check} color="#10b981" active={activeKpi === "Approved"} onClick={() => handleKpiClick("Approved")} />
        <KpiCard label="Declined" value={String(visibleDeclarations.filter((d) => d.status === "Declined").length)} icon={X} color="#ef4444" active={activeKpi === "Declined"} onClick={() => handleKpiClick("Declined")} />
        <KpiCard label="Total Value" value={`R ${Math.round(totalValue / 1000)}K`} icon={Coins} color="#6366f1" />
      </div>

      <Card className="mb-4 grid grid-cols-1 gap-3 border-white/70 bg-white/85 p-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-600">Search</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ID, Counterparty, Employee or Approver" className="table-filter-input" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-600">Type</label>
          <select onChange={(e) => setTypeFilter(e.target.value)} className="table-filter-select">
            <option value="All">All GHE</option>
            <option>Gift</option>
            <option>Hospitality</option>
            <option>Entertainment</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-600">Status</label>
          <select onChange={(e) => setStatusFilter(e.target.value)} className="table-filter-select">
            <option value="All">All Status</option>
            <option>Pending</option>
            <option>Approved</option>
            <option>Declined</option>
            <option>Returned</option>
          </select>
        </div>
        {!isTeamMember && (
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-600">Employee</label>
            <select onChange={(e) => setEmployeeFilter(e.target.value)} className="table-filter-select">
              <option value="All">All Employees</option>
              {[...new Set(declarations.map((d) => d.employee))].map((e) => (
                <option key={e}>{e}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-600">Date From</label>
          <input type="date" onChange={(e) => setDateFilterStart(e.target.value)} className="table-filter-input" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-600">Date To</label>
          <input type="date" onChange={(e) => setDateFilterEnd(e.target.value)} className="table-filter-input" />
        </div>
        <div className="flex items-end">
          <button
            onClick={() => { setSearch(""); setTypeFilter("All"); setStatusFilter("All"); setApproverFilter("All"); setEmployeeFilter("All"); setDateFilterStart(""); setDateFilterEnd(""); setActiveKpi("All"); }}
            className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-white px-2.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          >
            Clear Filters
          </button>
        </div>
      </Card>

      <Card className="space-y-3 p-3.5 md:hidden">
        {sorted.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">No declarations found</div>
        ) : (
          sorted.map((d) => (
            <div key={d.id} className="rounded-2xl border border-border bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-xs font-bold text-primary">{d.id}</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{d.Counterparty}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{d.approver}</p>
                </div>
                <StatusBadge status={d.status} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Type</p>
                  <p className="mt-1 font-medium text-foreground">{d.type}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Value</p>
                  <p className="mt-1 font-medium text-foreground">{formatRand(d.value)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Submitted</p>
                  <p className="mt-1 font-medium text-foreground">{d.submitted}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Employee</p>
                  <p className="mt-1 font-medium text-foreground">{d.employee}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2">
                <button onClick={() => setViewDecl(d)} className="flex h-9 w-full items-center justify-center gap-1 rounded-xl bg-secondary text-xs font-semibold hover:bg-secondary/70">
                  <Eye size={12} /> View
                </button>
                <button onClick={() => exportRow(d)} className="flex h-9 w-full items-center justify-center gap-1 rounded-xl border text-xs font-semibold hover:border-primary">
                  <Download size={12} /> Export
                </button>
              </div>
            </div>
          ))
        )}
      </Card>

      <Card className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-white">
            <tr>
              {["id", "type", "counterparty", "value", "submitted", "approver", "status"].map((key) => (
                <th
                  key={key}
                  onClick={() => {
                    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
                    else {
                      setSortKey(key as keyof Declaration);
                      setSortDir("asc");
                    }
                  }}
                  className="cursor-pointer px-5 py-3 text-left text-xs font-bold transition-all duration-200 hover:bg-purple-50/45 hover:text-purple-700"
                >
                  {key === "counterparty" ? "COUNTERPARTY" : key === "approver" ? "FINAL APPROVER" : key.toUpperCase()}{sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                </th>
              ))}
              <th className="px-5 py-3 text-xs font-bold transition-all duration-200 hover:bg-purple-50/45">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-10 text-center text-muted-foreground">No declarations found</td>
              </tr>
            ) : (
              paged.map((d) => (
                <tr key={d.id} className="group border-b border-border/70 transition-all duration-300 hover:bg-purple-50/35 hover:shadow-[inset_0_1px_0_rgba(196,181,253,0.12)]">
                  <td className="whitespace-nowrap px-5 py-3 font-medium text-slate-700 transition-colors duration-200 group-hover:text-purple-900">{d.id}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-slate-700 transition-colors duration-200 group-hover:text-slate-900">{d.type}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-slate-700 transition-colors duration-200 group-hover:text-slate-900">{d.Counterparty}</td>
                  <td className="whitespace-nowrap px-5 py-3 font-medium text-slate-700 transition-colors duration-200 group-hover:text-purple-900">{formatRand(d.value)}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-slate-700 transition-colors duration-200 group-hover:text-slate-900">{d.submitted}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-slate-700 transition-colors duration-200 group-hover:text-slate-900">{d.approver}</td>
                  <td className="px-5 py-3 transition-transform duration-200 group-hover:translate-x-0.5"><StatusBadge status={d.status} /></td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => setViewDecl(d)} className="flex h-8 items-center gap-1 rounded-lg bg-secondary px-3 text-xs font-semibold hover:bg-secondary/70">
                        <Eye size={12} /> View
                      </button>
                      <button onClick={() => exportRow(d)} className="flex h-8 items-center gap-1 rounded-lg border px-3 text-xs font-semibold hover:border-primary">
                        <Download size={12} /> Export
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-border bg-[#F7F8FC] px-5 py-3">
          <p className="text-xs text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{sorted.length}</span> declarations
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
