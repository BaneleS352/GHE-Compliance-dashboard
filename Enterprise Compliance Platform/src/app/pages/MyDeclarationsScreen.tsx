import * as XLSX from "xlsx";
import { useState, useEffect } from "react";
import { Download, FileText, Clock, Check, X, Coins, Eye } from "lucide-react";
import { Declaration } from "../../types/declaration";
import { fetchDeclarations } from "../../services/api";
import { formatRand } from "../../config/theme";
import { Card } from "../components/Card";
import { PageHeader } from "../components/PageHeader";
import { KpiCard } from "../components/KpiCard";
import { StatusBadge } from "../components/StatusBadge";
import { DeclarationDetailView } from "../pages/DeclarationDetailView";

export function MyDeclarationsScreen() {
  const [declarations, setDeclarations] = useState<Declaration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDeclarations()
      .then(setDeclarations)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [approverFilter, setApproverFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("");
  const [activeKpi, setActiveKpi] = useState("All");
  const [sortKey, setSortKey] = useState<keyof Declaration | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [viewDecl, setViewDecl] = useState<Declaration | null>(null);

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


  const filtered = declarations.filter(
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

  const totalValue = declarations.reduce((sum, d) => sum + d.value, 0);

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
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Declarations");
    XLSX.writeFile(wb, "Declarations.xlsx");
  };

  const exportRow = (d: Declaration) => {
    const csv = Object.entries(d).map(([k, v]) => `${k},${v}`).join("\n");
    const a = document.createElement("a");
    a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
    a.download = `${d.id}.csv`;
    a.click();
  };

  if (viewDecl) {
    return <DeclarationDetailView data={viewDecl} onBack={() => setViewDecl(null)} />;
  }

  return (
    <div>
      <PageHeader
        title="My Declarations"
        subtitle="Manage and review your declarations"
        actions={
          <button onClick={exportExcel} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border bg-white px-4 text-sm font-semibold hover:bg-muted sm:w-auto">
            <Download size={13} /> Export Excel
          </button>
        }
      />

      <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Total" value={String(declarations.length)} icon={FileText} color="#7c3aed" active={activeKpi === "All"} onClick={() => handleKpiClick("All")} />
        <KpiCard label="Pending" value={String(declarations.filter((d) => d.status === "Pending").length)} icon={Clock} color="#f59e0b" active={activeKpi === "Pending"} onClick={() => handleKpiClick("Pending")} />
        <KpiCard label="Approved" value={String(declarations.filter((d) => d.status === "Approved").length)} icon={Check} color="#10b981" active={activeKpi === "Approved"} onClick={() => handleKpiClick("Approved")} />
        <KpiCard label="Declined" value={String(declarations.filter((d) => d.status === "Declined").length)} icon={X} color="#ef4444" active={activeKpi === "Declined"} onClick={() => handleKpiClick("Declined")} />
        <KpiCard label="Total Value" value={`R ${Math.round(totalValue / 1000)}K`} icon={Coins} color="#6366f1" />
      </div>

      <Card className="mb-4 grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 xl:grid-cols-5">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="h-10 w-full rounded-lg border px-3" />
        <select onChange={(e) => setTypeFilter(e.target.value)} className="h-10 w-full rounded-lg border px-2">
          <option value="All">All GHE</option>
          <option>Gift</option>
          <option>Hospitality</option>
          <option>Entertainment</option>
        </select>
        <select onChange={(e) => setStatusFilter(e.target.value)} className="h-10 w-full rounded-lg border px-2">
          <option value="All">All Status</option>
          <option>Pending</option>
          <option>Approved</option>
          <option>Declined</option>
        </select>
        <select onChange={(e) => setApproverFilter(e.target.value)} className="h-10 w-full rounded-lg border px-2">
          <option value="All">All Approvers</option>
          {[...new Set(declarations.map((d) => d.approver))].map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
        <input type="date" onChange={(e) => setDateFilter(e.target.value)} className="h-10 w-full rounded-lg border px-2" />
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
                  className="cursor-pointer px-5 py-3 text-left text-xs font-bold hover:text-primary"
                >
                  {key === "counterparty" ? "COUNTERPARTY" : key === "approver" ? "FINAL APPROVER" : key.toUpperCase()}
                </th>
              ))}
              <th className="px-5 py-3 text-xs font-bold">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-10 text-center text-muted-foreground">No declarations found</td>
              </tr>
            ) : (
              sorted.map((d) => (
                <tr key={d.id} className="transition hover:bg-muted/20">
                  <td className="px-5 py-3">{d.id}</td>
                  <td className="px-5 py-3">{d.type}</td>
                  <td className="px-5 py-3">{d.Counterparty}</td>
                  <td className="px-5 py-3">{formatRand(d.value)}</td>
                  <td className="px-5 py-3">{d.submitted}</td>
                  <td className="px-5 py-3">{d.approver}</td>
                  <td className="px-5 py-3"><StatusBadge status={d.status} /></td>
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
