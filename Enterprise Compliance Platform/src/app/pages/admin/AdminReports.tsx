import { useState, useMemo } from "react";
import { Download, FileText, Calendar, BarChart3 } from "lucide-react";
import { Card } from "../../components/Card";
import { PageHeader } from "../../components/PageHeader";
import { PURPLE } from "../../../config/theme";
import { getDeclarations, getConfig, getUsers, getWorkflowForDeclaration } from "../../../data/db";
import { exportToExcel, ColumnDef } from "../../utils/excelExport";
import { Declaration, User } from "../../../types/declaration";

type ReportId = "compliance" | "sla" | "highValue" | "counterparty";

interface ReportDef {
  id: ReportId;
  title: string;
  desc: string;
}

const REPORTS: ReportDef[] = [
  { id: "compliance", title: "Compliance Status Report", desc: "Detailed breakdown of Approved, Declined, and Pending declarations across all departments." },
  { id: "sla", title: "SLA & Turnaround Time Report", desc: "Measures the time taken for approvals at each tier, highlighting bottlenecks." },
  { id: "highValue", title: "High-Value Gifts Report", desc: "All declarations exceeding the configured high-value threshold." },
  { id: "counterparty", title: "Counterparty Concentration Report", desc: "Analysis of gifts given or received from specific vendors or clients to identify risks." },
];

function daysBetween(a: string, b: string): number | null {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  if (Number.isNaN(da) || Number.isNaN(db)) return null;
  return Math.round((db - da) / 86_400_000);
}

export function AdminReports() {
  const [reportType, setReportType] = useState<ReportId>("compliance");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [department, setDepartment] = useState("All Departments");
  const [status, setStatus] = useState("All Statuses");
  const [generated, setGenerated] = useState(false);

  const users = useMemo(() => getUsers(), []);
  const userMap = useMemo(() => new Map<string, User>(users.map((u) => [u.id, u])), [users]);

  const declarations = useMemo(() => {
    let list = getDeclarations();
    if (department !== "All Departments") list = list.filter((d) => d.department === department);
    if (status !== "All Statuses") list = list.filter((d) => d.status === status);
    if (startDate) list = list.filter((d) => d.submitted >= startDate);
    if (endDate) list = list.filter((d) => d.submitted <= endDate);
    return list;
  }, [department, status, startDate, endDate]);

  const { columns, rows, title } = useMemo(() => {
    const cfg = getConfig();
    switch (reportType) {
      case "compliance": {
        const cols: ColumnDef[] = [
          { header: "ID", key: "id", width: 16 },
          { header: "Employee", key: "employee", width: 22 },
          { header: "Department", key: "department", width: 16 },
          { header: "Type", key: "type", width: 14 },
          { header: "Value (R)", key: "value", width: 14 },
          { header: "Submitted", key: "submitted", width: 14 },
          { header: "Status", key: "status", width: 14 },
          { header: "Priority", key: "priority", width: 12 },
          { header: "Final Approver", key: "approver", width: 20 },
        ];
        const rows = declarations.map((d: Declaration) => ({
          id: d.id, employee: d.employee, department: d.department, type: d.type,
          value: d.value, submitted: d.submitted, status: d.status, priority: d.priority, approver: d.approver,
        }));
        return { columns: cols, rows, title: "Compliance Status Report" };
      }
      case "sla": {
        const cols: ColumnDef[] = [
          { header: "ID", key: "id", width: 16 },
          { header: "Employee", key: "employee", width: 22 },
          { header: "Department", key: "department", width: 16 },
          { header: "Submitted", key: "submitted", width: 14 },
          { header: "Last Decision", key: "lastDecision", width: 16 },
          { header: "Turnaround (days)", key: "turnaround", width: 18 },
          { header: "Status", key: "status", width: 14 },
        ];
        const rows = declarations.map((d: Declaration) => {
          const wf = getWorkflowForDeclaration(d.id);
          const decidedSteps = (wf?.steps ?? []).filter((s) => s.decidedAt);
          const lastDecision = decidedSteps.length
            ? decidedSteps[decidedSteps.length - 1].decidedAt!.slice(0, 10)
            : "";
          const turnaround = lastDecision
            ? daysBetween(d.submitted, lastDecision) ?? "—"
            : "In Progress";
          return {
            id: d.id, employee: d.employee, department: d.department, submitted: d.submitted,
            lastDecision: lastDecision || "In Progress",
            turnaround,
            status: d.status,
          };
        });
        return { columns: cols, rows, title: "SLA & Turnaround Time Report" };
      }
      case "highValue": {
        const cols: ColumnDef[] = [
          { header: "ID", key: "id", width: 16 },
          { header: "Employee", key: "employee", width: 22 },
          { header: "Department", key: "department", width: 16 },
          { header: "Counterparty", key: "Counterparty", width: 24 },
          { header: "Value (R)", key: "value", width: 14 },
          { header: "Status", key: "status", width: 14 },
        ];
        const rows = declarations
          .filter((d) => Number(d.value) > cfg.highValueThreshold)
          .map((d: Declaration) => ({
            id: d.id, employee: d.employee, department: d.department,
            Counterparty: d.Counterparty, value: d.value, status: d.status,
          }));
        return { columns: cols, rows, title: `High-Value Gifts Report (> R${cfg.highValueThreshold})` };
      }
      case "counterparty": {
        const cols: ColumnDef[] = [
          { header: "Counterparty", key: "Counterparty", width: 26 },
          { header: "Declarations", key: "count", width: 16 },
          { header: "Total Value (R)", key: "total", width: 18 },
        ];
        const map = new Map<string, { count: number; total: number }>();
        for (const d of declarations) {
          const cur = map.get(d.Counterparty) ?? { count: 0, total: 0 };
          cur.count += 1;
          cur.total += Number(d.value) || 0;
          map.set(d.Counterparty, cur);
        }
        const rows = Array.from(map.entries())
          .map(([cp, v]) => ({ Counterparty: cp, count: v.count, total: v.total }))
          .sort((a, b) => b.total - a.total);
        return { columns: cols, rows, title: "Counterparty Concentration Report" };
      }
    }
  }, [reportType, declarations]);

  const handleExport = () => {
    exportToExcel({
      fileName: `${title}.xlsx`,
      sheetName: "Report",
      title,
      meta: [
        ["Generated", new Date().toISOString().slice(0, 10)],
        ["Department", department],
        ["Status", status],
        ["Records", String(rows.length)],
      ],
      columns,
      rows,
    });
  };

  const active = REPORTS.find((r) => r.id === reportType)!;

  return (
    <div className="space-y-6">
      <PageHeader title="Operational Management Reports" subtitle="Generate, view, and export compliance data." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <Card className="border-white/70 bg-white/80 p-5 shadow-[0_18px_45px_rgba(79,29,149,0.08)] backdrop-blur-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary shadow-sm">
                <BarChart3 size={16} style={{ color: PURPLE }} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Reports</p>
                <h3 className="text-sm font-bold">Report Type</h3>
              </div>
            </div>
            <div className="space-y-2">
              {REPORTS.map((r) => (
                <label
                  key={r.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition-all duration-300 ${
                    reportType === r.id
                      ? "border-purple-200 bg-purple-50 shadow-sm"
                      : "border-primary/10 bg-secondary/10 hover:-translate-y-0.5 hover:border-purple-200/70 hover:bg-purple-50/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="reportType"
                    className="mt-1"
                    checked={reportType === r.id}
                    onChange={() => { setReportType(r.id); setGenerated(false); }}
                  />
                  <div>
                    <p className="text-sm font-semibold">{r.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{r.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <Card className="border-white/70 bg-white/80 p-5 shadow-[0_18px_45px_rgba(79,29,149,0.08)] backdrop-blur-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary shadow-sm">
                <Calendar size={16} style={{ color: PURPLE }} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Filters</p>
                <h3 className="text-sm font-bold">Report Parameters</h3>
              </div>
            </div>
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Start Date</label>
                <div className="relative">
                  <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-11 w-full rounded-xl border border-border bg-white/90 pl-9 pr-3 text-sm transition-all focus:border-purple-300 focus:outline-none focus:ring-4 focus:ring-purple-500/10" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">End Date</label>
                <div className="relative">
                  <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-11 w-full rounded-xl border border-border bg-white/90 pl-9 pr-3 text-sm transition-all focus:border-purple-300 focus:outline-none focus:ring-4 focus:ring-purple-500/10" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Department</label>
                <select value={department} onChange={(e) => setDepartment(e.target.value)} className="h-11 w-full rounded-xl border border-border bg-white/90 px-3 text-sm transition-all focus:border-purple-300 focus:outline-none focus:ring-4 focus:ring-purple-500/10">
                  <option>All Departments</option>
                  {Array.from(new Set(getDeclarations().map((d) => d.department))).map((d) => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-11 w-full rounded-xl border border-border bg-white/90 px-3 text-sm transition-all focus:border-purple-300 focus:outline-none focus:ring-4 focus:ring-purple-500/10">
                  <option>All Statuses</option>
                  <option>Approved</option>
                  <option>Pending</option>
                  <option>Declined</option>
                  <option>Draft</option>
                  <option>Info Requested</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:flex-wrap sm:items-center">
              <button
                onClick={() => setGenerated(true)}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(79,29,149,0.28)] sm:flex-1"
                style={{ background: `linear-gradient(135deg, ${PURPLE}, #6d28d9)`, border: "1px solid transparent" }}
              >
                <FileText size={15} /> Generate Report
              </button>
              <button onClick={handleExport} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-6 text-sm font-semibold text-emerald-700 transition-all duration-300 hover:-translate-y-0.5 hover:bg-emerald-100 sm:w-auto">
                <Download size={15} /> Export Excel
              </button>
            </div>
          </Card>

          {generated ? (
            <Card className="overflow-hidden border border-primary/10 bg-white/80 p-0 shadow-[0_18px_45px_rgba(79,29,149,0.05)] backdrop-blur-xl">
              <div className="border-b border-border bg-purple-50/60 px-5 py-3">
                <p className="text-sm font-bold text-purple-900">{title}</p>
                <p className="text-xs text-muted-foreground">{rows.length} record(s) match the current filters</p>
              </div>
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr>
                      {columns.map((c) => (
                        <th key={c.key} className="whitespace-nowrap border-b border-border px-4 py-2.5 text-left text-xs font-bold">{c.header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.length === 0 ? (
                      <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-muted-foreground">No records found for the selected filters.</td></tr>
                    ) : (
                      rows.map((r, i) => (
                        <tr key={i} className="hover:bg-purple-50/40">
                          {columns.map((c) => (
                            <td key={c.key} className="whitespace-nowrap px-4 py-2.5 text-foreground">{String(r[c.key] ?? "")}</td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : (
            <Card className="flex flex-col items-center justify-center border border-dashed border-primary/10 bg-white/70 p-10 text-center shadow-[0_18px_45px(rgba(79,29,149,0.05))] backdrop-blur-xl">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary/70">
                <FileText size={30} className="text-purple-500/60" />
              </div>
              <h3 className="mb-1 font-bold text-foreground">No Report Generated</h3>
              <p className="max-w-sm text-sm text-muted-foreground">
                Select your parameters and click "Generate Report" to preview the data here before exporting.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
