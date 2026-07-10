import { useState, useEffect, useMemo } from "react";
import { Download, FileText, Clock, Check, X, Coins, Eye, List } from "lucide-react";
import { Declaration, Role } from "../../types/declaration";
import { formatRand } from "../../config/theme";
import { Card } from "../components/Card";
import { PageHeader } from "../components/PageHeader";
import { KpiCard } from "../components/KpiCard";
import { StatusBadge } from "../components/StatusBadge";
import { DeclarationDetailView } from "../pages/DeclarationDetailView";
import { useUser } from "../auth/UserContext";
import { getDeclarationsByEmployee, getDeclarations } from "../../data/db";
import { exportToExcel, ColumnDef } from "../utils/excelExport";

const DECLARATION_COLUMNS: ColumnDef[] = [
  { header: "ID", key: "id", width: 16 },
  { header: "Employee", key: "employee", width: 22 },
  { header: "Team Member No", key: "teamMemberNumber", width: 16 },
  { header: "Department", key: "department", width: 16 },
  { header: "Type", key: "type", width: 14 },
  { header: "Counterparty", key: "Counterparty", width: 22 },
  { header: "Value (R)", key: "value", width: 14 },
  { header: "Submitted", key: "submitted", width: 14 },
  { header: "Final Approver", key: "approver", width: 20 },
  { header: "Status", key: "status", width: 14 },
  { header: "Priority", key: "priority", width: 12 },
];

const toRow = (d: Declaration) => ({
  id: d.id,
  employee: d.employee,
  teamMemberNumber: d.teamMemberNumber,
  department: d.department,
  type: d.type,
  Counterparty: d.Counterparty,
  value: d.value,
  submitted: d.submitted,
  approver: d.approver,
  status: d.status,
  priority: d.priority,
});

export function MyDeclarationsScreen() {
  const { user } = useUser();
  const [declarations, setDeclarations] = useState<Declaration[]>([]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (user) {
      const list = showAll ? getDeclarations() : getDeclarationsByEmployee(user.id);
      setDeclarations(list.sort((a, b) => b.submitted.localeCompare(a.submitted)));
    }
  }, [user, showAll]);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [prioFilter, setPrioFilter] = useState("All");
  const [deptFilter, setDeptFilter] = useState("All");
  const [approverFilter, setApproverFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("");
  const [activeKpi, setActiveKpi] = useState("All");
  const [sortKey, setSortKey] = useState<keyof Declaration | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [viewDecl, setViewDecl] = useState<Declaration | null>(null);

  const filtered = useMemo(
    () =>
      declarations.filter(
        (d) =>
          (!search ||
            d.id.toLowerCase().includes(search.toLowerCase()) ||
            d.Counterparty.toLowerCase().includes(search.toLowerCase()) ||
            d.employee.toLowerCase().includes(search.toLowerCase())) &&
          (typeFilter === "All" || d.type === typeFilter) &&
          (statusFilter === "All" || d.status === statusFilter) &&
          (prioFilter === "All" || d.priority === prioFilter) &&
          (deptFilter === "All" || d.department === deptFilter) &&
          (approverFilter === "All" || d.approver === approverFilter) &&
          (!dateFilter || d.submitted === dateFilter)
      ),
    [declarations, search, typeFilter, statusFilter, prioFilter, deptFilter, approverFilter, dateFilter]
  );

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
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
      }),
    [filtered, sortKey, sortDir]
  );

  const totalValue = declarations.reduce((sum, d) => sum + d.value, 0);

  const handleKpiClick = (type: string) => {
    setActiveKpi(type);
    setStatusFilter(type === "All" ? "All" : type);
  };

  const exportExcel = () => {
    exportToExcel({
      fileName: "Declarations.xlsx",
      sheetName: "Declarations",
      title: showAll ? "All Declarations" : "My Declarations",
      meta: [
        ["Generated", new Date().toISOString().slice(0, 10)],
        ["Total Records", String(filtered.length)],
      ],
      columns: DECLARATION_COLUMNS,
      rows: filtered.map(toRow),
    });
  };

  const exportRow = (d: Declaration) => {
    exportToExcel({
      fileName: `${d.id}.xlsx`,
      sheetName: "Declaration",
      title: `Declaration ${d.id}`,
      columns: DECLARATION_COLUMNS,
      rows: [toRow(d)],
    });
  };

  if (viewDecl) {
    return <DeclarationDetailView data={viewDecl} onBack={() => setViewDecl(null)} />;
  }

  const title = showAll ? "All Declarations" : "My Declarations";
  const subtitle = showAll
    ? `All ${declarations.length} declarations in the system`
    : `Manage and review your ${declarations.length} declarations`;

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowAll(!showAll)}
              className="flex h-10 items-center justify-center gap-2 rounded-xl border border-purple-200 bg-white px-4 text-sm font-semibold text-purple-700 hover:bg-purple-50 sm:w-auto"
            >
              <List size={13} /> {showAll ? "My Declarations" : "All Declarations"}
            </button>
            <button onClick={exportExcel} className="flex h-10 items-center justify-center gap-2 rounded-xl border bg-white px-4 text-sm font-semibold hover:bg-muted sm:w-auto">
              <Download size={13} /> Export Excel
            </button>
          </div>
        }
      />

      <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Total" value={String(declarations.length)} icon={FileText} color="#7c3aed" active={activeKpi === "All"} onClick={() => handleKpiClick("All")} />
        <KpiCard label="Pending" value={String(declarations.filter((d) => d.status === "Pending").length)} icon={Clock} color="#f59e0b" active={activeKpi === "Pending"} onClick={() => handleKpiClick("Pending")} />
        <KpiCard label="Approved" value={String(declarations.filter((d) => d.status === "Approved").length)} icon={Check} color="#10b981" active={activeKpi === "Approved"} onClick={() => handleKpiClick("Approved")} />
        <KpiCard label="Declined" value={String(declarations.filter((d) => d.status === "Declined").length)} icon={X} color="#ef4444" active={activeKpi === "Declined"} onClick={() => handleKpiClick("Declined")} />
        <KpiCard label="Total Value" value={`R ${Math.round(totalValue / 1000)}K`} icon={Coins} color="#6366f1" />
      </div>

      <Card className="mb-4 flex flex-col gap-3 p-3.5 md:flex-row md:flex-wrap">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="h-10 min-w-0 flex-[2] rounded-lg border border-border bg-white px-3 text-sm" />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-white px-2 text-sm md:max-w-[140px]">
          <option value="All">All Types</option>
          <option>Gift</option><option>Hospitality</option><option>Entertainment</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-white px-2 text-sm md:max-w-[140px]">
          <option value="All">All Status</option>
          <option>Pending</option><option>Approved</option><option>Declined</option>
        </select>
        {showAll ? (
          <>
            <select value={prioFilter} onChange={(e) => setPrioFilter(e.target.value)} className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-white px-2 text-sm md:max-w-[120px]">
              <option value="All">All Priority</option>
              <option>High</option><option>Medium</option><option>Low</option>
            </select>
            <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-white px-2 text-sm md:max-w-[150px]">
              <option value="All">All Depts</option>
              {[...new Set(declarations.map((d) => d.department))].map((d) => <option key={d}>{d}</option>)}
            </select>
          </>
        ) : (
          <select value={approverFilter} onChange={(e) => setApproverFilter(e.target.value)} className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-white px-2 text-sm md:max-w-[150px]">
            <option value="All">All Approvers</option>
            {[...new Set(declarations.map((d) => d.approver))].map((a) => <option key={a}>{a}</option>)}
          </select>
        )}
        <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-white px-2 text-sm md:max-w-[160px]" />
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
                <div><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Type</p><p className="mt-1 font-medium text-foreground">{d.type}</p></div>
                <div><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Value</p><p className="mt-1 font-medium text-foreground">{formatRand(d.value)}</p></div>
                <div><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Submitted</p><p className="mt-1 font-medium text-foreground">{d.submitted}</p></div>
                <div><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Employee</p><p className="mt-1 font-medium text-foreground">{d.employee}</p></div>
              </div>
              <div className="mt-4 flex flex-col gap-2">
                <button onClick={() => setViewDecl(d)} className="flex h-9 w-full items-center justify-center gap-1 rounded-xl bg-secondary text-xs font-semibold hover:bg-secondary/70"><Eye size={12} /> View</button>
                <button onClick={() => exportRow(d)} className="flex h-9 w-full items-center justify-center gap-1 rounded-xl border text-xs font-semibold hover:border-primary"><Download size={12} /> Export</button>
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
                <th key={key} onClick={() => { if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc"); else { setSortKey(key as keyof Declaration); setSortDir("asc"); } }} className="cursor-pointer px-5 py-3 text-left text-xs font-bold hover:text-primary">
                  {key === "counterparty" ? "COUNTERPARTY" : key === "approver" ? "FINAL APPROVER" : key.toUpperCase()}
                </th>
              ))}
              <th className="px-5 py-3 text-xs font-bold">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={8} className="py-10 text-center text-muted-foreground">No declarations found</td></tr>
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
                      <button onClick={() => setViewDecl(d)} className="flex h-8 items-center gap-1 rounded-lg bg-secondary px-3 text-xs font-semibold hover:bg-secondary/70"><Eye size={12} /> View</button>
                      <button onClick={() => exportRow(d)} className="flex h-8 items-center gap-1 rounded-lg border px-3 text-xs font-semibold hover:border-primary"><Download size={12} /> Export</button>
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
