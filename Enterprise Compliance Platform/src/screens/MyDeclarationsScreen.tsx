// Note: import moved to top — fixes the mid-file import that existed in App.tsx
import * as XLSX from "xlsx";
import { useState } from "react";
import { Download, FileText, Clock, Check, X, DollarSign, Eye } from "lucide-react";
import { declarations } from "@/data/declarations";
import { Declaration } from "@/types/declaration";
import { formatRand } from "@/config/theme";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { StatusBadge } from "@/components/StatusBadge";
import { DeclarationDetailView } from "@/screens/DeclarationDetailView";

export function MyDeclarationsScreen() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [approverFilter, setApproverFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("");
  const [activeKpi, setActiveKpi] = useState("All");
  const [sortKey, setSortKey] = useState<keyof Declaration | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;
  const [viewDecl, setViewDecl] = useState<Declaration | null>(null);

  // Filtering
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

  // Sorting
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

  // Pagination
  const totalPages = Math.ceil(sorted.length / pageSize);
  const paginated = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // KPI
  const totalValue = declarations.reduce((s, d) => s + d.value, 0);
  const handleKpiClick = (type: string) => {
    setActiveKpi(type);
    setCurrentPage(1);
    setStatusFilter(type === "All" ? "All" : type);
  };

  // Excel export
  const exportExcel = () => {
    const data = filtered.map((d) => ({
      ID: d.id,
      Employee: d.employee,
      Type: d.type,
      Vendor: d.Counterparty,
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

  if (viewDecl) return <DeclarationDetailView data={viewDecl} onBack={() => setViewDecl(null)} />;

  return (
    <div>
      <PageHeader
        title="My Declarations"
        subtitle="Manage and review your declarations"
        actions={
          <button onClick={exportExcel} className="h-9 px-4 rounded-xl border bg-white hover:bg-muted flex gap-2 items-center">
            <Download size={13} /> Export Excel
          </button>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-5 gap-4 mb-7">
        <KpiCard label="Total"    value={String(declarations.length)}                                         icon={FileText}   color="#7c3aed" active={activeKpi === "All"}      onClick={() => handleKpiClick("All")} />
        <KpiCard label="Pending"  value={String(declarations.filter((d) => d.status === "Pending").length)}  icon={Clock}      color="#f59e0b" active={activeKpi === "Pending"}  onClick={() => handleKpiClick("Pending")} />
        <KpiCard label="Approved" value={String(declarations.filter((d) => d.status === "Approved").length)} icon={Check}      color="#10b981" active={activeKpi === "Approved"} onClick={() => handleKpiClick("Approved")} />
        <KpiCard label="Declined" value={String(declarations.filter((d) => d.status === "Declined").length)} icon={X}          color="#ef4444" active={activeKpi === "Declined"} onClick={() => handleKpiClick("Declined")} />
        <KpiCard label="Total Value" value={`R ${Math.round(totalValue / 1000)}K`}                           icon={DollarSign} color="#6366f1" />
      </div>

      {/* Filters */}
      <Card className="p-3 mb-4 flex gap-3 flex-wrap">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="h-9 px-3 border rounded-lg" />
        <select onChange={(e) => setTypeFilter(e.target.value)} className="h-9 border rounded-lg px-2">
          <option>All</option><option>Gift</option><option>Hospitality</option><option>Entertainment</option>
        </select>
        <select onChange={(e) => setStatusFilter(e.target.value)} className="h-9 border rounded-lg px-2">
          <option>All</option><option>Pending</option><option>Approved</option><option>Declined</option>
        </select>
        <select onChange={(e) => setApproverFilter(e.target.value)} className="h-9 border rounded-lg px-2">
          <option>All</option>
          {[...new Set(declarations.map((d) => d.approver))].map((a) => <option key={a}>{a}</option>)}
        </select>
        <input type="date" onChange={(e) => setDateFilter(e.target.value)} className="h-9 border rounded-lg px-2" />
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white z-10">
            <tr>
              {["id", "type", "vendor", "value", "submitted", "approver"].map((key) => (
                <th
                  key={key}
                  onClick={() => {
                    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
                    else { setSortKey(key as keyof Declaration); setSortDir("asc"); }
                  }}
                  className="px-5 py-3 text-left cursor-pointer text-xs font-bold hover:text-primary"
                >
                  {key.toUpperCase()}
                </th>
              ))}
              <th className="px-5 py-3 text-xs font-bold">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">No declarations found</td></tr>
            ) : (
              paginated.map((d) => (
                <tr key={d.id} className="hover:bg-muted/20 transition">
                  <td className="px-5 py-3">{d.id}</td>
                  <td>{d.type}</td>
                  <td>{d.Counterparty}</td>
                  <td>{formatRand(d.value)}</td>
                  <td>{d.submitted}</td>
                  <td>{d.approver}</td>
                  <td><StatusBadge status={d.status} /></td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => setViewDecl(d)} className="h-8 px-3 rounded-lg text-xs font-semibold bg-secondary hover:bg-secondary/70 flex items-center gap-1">
                        <Eye size={12} /> View
                      </button>
                      <button
                        onClick={() => {
                          const csv = Object.entries(d).map(([k, v]) => `${k},${v}`).join("\n");
                          const a = document.createElement("a");
                          a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
                          a.download = `${d.id}.csv`;
                          a.click();
                        }}
                        className="h-8 px-3 rounded-lg text-xs border hover:border-primary flex items-center gap-1"
                      >
                        <Download size={12} /> Export
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination footer */}
        <div className="flex justify-between p-4 border-t">
          <p className="text-xs">
            Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} of {filtered.length}
          </p>
          <div className="flex gap-2">
            <button disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)}>Prev</button>
            {[...Array(totalPages)].map((_, i) => (
              <button key={i} onClick={() => setCurrentPage(i + 1)} className={currentPage === i + 1 ? "bg-purple-600 text-white px-2" : "px-2"}>
                {i + 1}
              </button>
            ))}
            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => p + 1)}>Next</button>
          </div>
        </div>
      </Card>
    </div>
  );
}
