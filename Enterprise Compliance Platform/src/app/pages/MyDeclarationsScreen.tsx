import { useState, useEffect } from "react";
import { Download, FileText, Clock, Check, X, Coins, Eye } from "lucide-react";
import { Declaration } from "../../types/declaration";
import { fetchDeclarations } from "../../services/api";
import { formatRand } from "../../config/theme";
import { useUser } from "../auth/UserContext";
import { Card } from "../components/Card";
import { PageHeader } from "../components/PageHeader";
import { KpiCard } from "../components/KpiCard";
import { StatusBadge } from "../components/StatusBadge";
import { DeclarationDetailView } from "../pages/DeclarationDetailView";
import { exportRowsToXls } from "../../utils/excel";

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

  const [viewMode, setViewMode] = useState<"my" | "all">("my");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [approverFilter, setApproverFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("");
  const [activeKpi, setActiveKpi] = useState("All");
  const [sortKey, setSortKey] = useState<keyof Declaration | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [viewDecl, setViewDecl] = useState<Declaration | null>(null);

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
        d.employee.toLowerCase().includes(search.toLowerCase())) &&
      (typeFilter === "All" || d.type === typeFilter) &&
      (statusFilter === "All" || d.status === statusFilter) &&
      (approverFilter === "All" || d.approver === approverFilter) &&
      (!dateFilter || d.submitted === dateFilter)
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
    return <DeclarationDetailView data={viewDecl} onBack={() => setViewDecl(null)} />;
  }

  return (
    <div>
      <PageHeader
        title={viewMode === "my" ? "My Declarations" : "All Declarations"}
        subtitle={`${visibleDeclarations.length} ${viewMode === "my" ? "of your" : "total"} declarations`}
        actions={
          <div className="flex gap-2">
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

      <Card className="mb-4 grid grid-cols-1 gap-3 border-white/70 bg-white/85 p-3 sm:grid-cols-2 xl:grid-cols-5">
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Search</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Declaration ID, Type, Counterparty or Status" className="table-filter-input" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Type</label>
          <select onChange={(e) => setTypeFilter(e.target.value)} className="table-filter-select">
            <option value="All">All GHE</option>
            <option>Gift</option>
            <option>Hospitality</option>
            <option>Entertainment</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</label>
          <select onChange={(e) => setStatusFilter(e.target.value)} className="table-filter-select">
            <option value="All">All Status</option>
            <option>Pending</option>
            <option>Approved</option>
            <option>Declined</option>
            <option>Returned</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Approver</label>
          <select onChange={(e) => setApproverFilter(e.target.value)} className="table-filter-select">
            <option value="All">All Approvers</option>
            {[...new Set(declarations.map((d) => d.approver))].map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Date</label>
          <input type="date" onChange={(e) => setDateFilter(e.target.value)} className="table-filter-input" />
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
        <table className="w-full min-w-[920px] text-sm">
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
                  {key === "counterparty" ? "COUNTERPARTY" : key === "approver" ? "FINAL APPROVER" : key.toUpperCase()}
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
              sorted.map((d) => (
                <tr key={d.id} className="group border-b border-border/70 transition-all duration-300 hover:bg-purple-50/35 hover:shadow-[inset_0_1px_0_rgba(196,181,253,0.12)]">
                  <td className="px-5 py-3 font-medium text-slate-700 transition-colors duration-200 group-hover:text-purple-900">{d.id}</td>
                  <td className="px-5 py-3 text-slate-700 transition-colors duration-200 group-hover:text-slate-900">{d.type}</td>
                  <td className="px-5 py-3 text-slate-700 transition-colors duration-200 group-hover:text-slate-900">{d.Counterparty}</td>
                  <td className="px-5 py-3 font-medium text-slate-700 transition-colors duration-200 group-hover:text-purple-900">{formatRand(d.value)}</td>
                  <td className="px-5 py-3 text-slate-700 transition-colors duration-200 group-hover:text-slate-900">{d.submitted}</td>
                  <td className="px-5 py-3 text-slate-700 transition-colors duration-200 group-hover:text-slate-900">{d.approver}</td>
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

      </Card>
    </div>
  );
}
