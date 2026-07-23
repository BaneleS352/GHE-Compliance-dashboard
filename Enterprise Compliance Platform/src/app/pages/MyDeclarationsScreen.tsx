import { useState, useEffect } from "react";
import { ArrowLeft, Download, Eye, Edit } from "lucide-react";
import { Declaration } from "../../types/declaration";
import { fetchDeclarations } from "../../services/api";
import { formatRand } from "../../config/theme";
import { useUser } from "../auth/UserContext";
import { Card } from "../components/Card";
import { PageHeader } from "../components/PageHeader";
import { KpiCard, STATUS_KPI } from "../components/KpiCard";
import { StatusBadge } from "../components/StatusBadge";
import { TypeBadge } from "../components/TypeBadge";
import { DeclarationDetailView, SupportingDocuments } from "../pages/DeclarationDetailView";
import { WorkflowTimeline } from "../components/WorkflowTimeline";
import { Table, Thead, Th, Tbody, Tr, Td, COL } from "../components/table";
import { PURPLE } from "../../config/theme";
import { exportRowsToXls } from "../../utils/excel";
import { useWorkflowApproval } from "../hooks/useWorkflowApproval";

export function MyDeclarationsScreen({ onEditDraft }: { onEditDraft?: (d: Declaration) => void }) {
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
  const [viewMode, setViewMode] = useState<"my" | "all">(isTeamMember ? "my" : "all");
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
  const [viewDeclStatus, setViewDeclStatus] = useState<string | null>(null);

  const {
    wfSteps, wfMessage, canApprove, submitError,
    activeDecision, setActiveDecision,
    activeNotes, setActiveNotes,
    handleSubmit, submitDisabled,
  } = useWorkflowApproval({
    declarationId: viewDecl?.id ?? null,
    userId: user?.id ?? null,
    onStatusUpdate: (s) => setViewDeclStatus(s),
  });

  useEffect(() => { setPage(0); }, [search, typeFilter, statusFilter, approverFilter, employeeFilter, dateFilterStart, dateFilterEnd, sortKey, sortDir]);

  const userDeclarations = user
    ? declarations.filter((d) => d.employeeId === user.id || d.employee === user.name)
    : declarations;
  const ownDraftsOnly = (d: Declaration) => d.status !== "Draft" || d.employeeId === user?.id || d.employee === user?.name;
  const visibleDeclarations = (viewMode === "my" ? userDeclarations : declarations).filter(ownDraftsOnly);

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
    const displayStatus = viewDeclStatus || viewDecl.status;
    return (
      <div>
        <div className="flex flex-wrap items-center gap-2.5 mb-7 pb-5 border-b border-border">
          <button
            onClick={() => setViewDecl(null)}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold shadow-sm transition-colors hover:bg-muted/50"
          >
            <ArrowLeft size={14} /> Back
          </button>
          <span className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-3.5 font-mono text-sm font-bold text-foreground shadow-sm">{viewDecl.id}</span>
          <div className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-2.5 shadow-sm">
            <StatusBadge status={displayStatus} />
          </div>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
          <div className="xl:col-span-3 flex flex-col gap-5">
            <DeclarationDetailView data={{ ...viewDecl, status: displayStatus }} onBack={() => {}} hideBackButton hideDocuments />
            <SupportingDocuments data={viewDecl} />
          </div>
        <div className="xl:col-span-2 h-full space-y-5">
          {submitError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {submitError}
            </div>
          )}
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
            <button onClick={() => { setSearch(""); setTypeFilter("All"); setStatusFilter("All"); setApproverFilter("All"); setDateFilterStart(""); setDateFilterEnd(""); setEmployeeFilter("All"); setActiveKpi("All"); }} className="flex h-10 items-center justify-center gap-2 rounded-xl border bg-white px-4 text-sm font-semibold hover:bg-muted sm:w-auto">
              Clear Filters
            </button>
            <button onClick={exportExcel} className="flex h-10 items-center justify-center gap-2 rounded-xl border bg-white px-4 text-sm font-semibold hover:bg-muted sm:w-auto">
              <Download size={13} /> Export Excel
            </button>
          </div>
        }
      />

      <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        {(["Total", "Pending", "Approved", "Returned", "Declined"] as const).map((k) => {
          const def = STATUS_KPI[k];
          const count = k === "Total" ? visibleDeclarations.length : visibleDeclarations.filter((d) => d.status === def.filterValue).length;
          return (
            <KpiCard
              key={def.key}
              label={def.label}
              value={String(count)}
              icon={def.icon}
              color={def.color}
              active={activeKpi === def.filterValue}
              onClick={() => handleKpiClick(def.filterValue)}
            />
          );
        })}
      </div>

      <Card className="mb-4 grid grid-cols-1 gap-3 border-white/70 bg-white/85 p-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-600">Search</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ID, Counterparty, Employee or Approver" className="table-filter-input" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-600">Type</label>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="table-filter-select">
            <option value="All">All GHE</option>
            <option>Gift</option>
            <option>Hospitality</option>
            <option>Entertainment</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-600">Status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="table-filter-select">
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
            <select value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} className="table-filter-select">
              <option value="All">All Employees</option>
              {[...new Set(declarations.map((d) => d.employee))].map((e) => (
                <option key={e}>{e}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-600">Date From</label>
          <input type="date" value={dateFilterStart} onChange={(e) => setDateFilterStart(e.target.value)} className="table-filter-input" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-600">Date To</label>
          <input type="date" value={dateFilterEnd} onChange={(e) => setDateFilterEnd(e.target.value)} className="table-filter-input" />
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
                {d.status === "Draft" && onEditDraft ? (
                  <button onClick={() => onEditDraft(d)} className="flex h-9 w-full items-center justify-center gap-1 rounded-xl bg-secondary text-xs font-semibold hover:bg-secondary/70">
                    <Edit size={12} /> Continue
                  </button>
                ) : (
                  <button onClick={() => setViewDecl(d)} className="flex h-9 w-full items-center justify-center gap-1 rounded-xl bg-secondary text-xs font-semibold hover:bg-secondary/70">
                    <Eye size={12} /> View
                  </button>
                )}
                <button onClick={() => exportRow(d)} className="flex h-9 w-full items-center justify-center gap-1 rounded-xl border text-xs font-semibold hover:border-primary">
                  <Download size={12} /> Export
                </button>
              </div>
            </div>
          ))
        )}
      </Card>

      <Card className="hidden overflow-x-auto md:block">
        <Table>
          <Thead>
            {["Declaration ID", "Type", "Counterparty", "Value", "Submitted", "Final Approver", "Status", "Actions"].map((label) => {
              const key = label === "Declaration ID" ? "id" : label === "Type" ? "type" : label === "Counterparty" ? "counterparty" : label === "Value" ? "value" : label === "Submitted" ? "submitted" : label === "Final Approver" ? "approver" : label === "Status" ? "status" : null;
              const isSortable = key !== null;
              return (
                <Th
                  key={label}
                  sortable={isSortable}
                  active={isSortable && sortKey === key}
                  direction={sortDir}
                  onClick={isSortable ? () => {
                    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
                    else { setSortKey(key as keyof Declaration); setSortDir("asc"); }
                  } : undefined}
                >
                  {label}
                </Th>
              );
            })}
          </Thead>
          <Tbody>
            {sorted.length === 0 ? (
              <Tr><Td colSpan={8} className="py-10 text-center">No declarations found</Td></Tr>
            ) : (
              paged.map((d) => (
                <Tr key={d.id}>
                  <Td><span className={COL.ID} style={{ color: PURPLE }}>{d.id}</span></Td>
                  <Td><TypeBadge type={d.type} /></Td>
                  <Td className={COL.COUNTERPARTY}>{d.Counterparty}</Td>
                  <Td className={COL.VALUE}>{formatRand(d.value)}</Td>
                  <Td className={COL.SUBMITTED}>{d.submitted}</Td>
                  <Td className={COL.APPROVER}>{d.approver}</Td>
                  <Td><StatusBadge status={d.status} /></Td>
                  <Td>
                    <div className="flex gap-2">
                      {d.status === "Draft" && onEditDraft ? (
                        <button onClick={() => onEditDraft(d)} className="flex h-8 items-center gap-1 rounded-lg bg-secondary px-3 text-xs font-semibold hover:bg-secondary/70">
                          <Edit size={12} /> Edit
                        </button>
                      ) : (
                        <button onClick={() => setViewDecl(d)} className="flex h-8 items-center gap-1 rounded-lg bg-secondary px-3 text-xs font-semibold hover:bg-secondary/70">
                          <Eye size={12} /> View
                        </button>
                      )}
                      <button onClick={() => exportRow(d)} className="flex h-8 items-center gap-1 rounded-lg border px-3 text-xs font-semibold hover:border-primary">
                        <Download size={12} /> Export
                      </button>
                    </div>
                  </Td>
                </Tr>
              ))
            )}
          </Tbody>
        </Table>
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








