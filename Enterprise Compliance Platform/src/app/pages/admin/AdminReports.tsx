import { useState, useMemo } from "react";
import { Download, FileText, Calendar, BarChart3 } from "lucide-react";
import { Card } from "../../components/Card";
import { PageHeader } from "../../components/PageHeader";
import { PURPLE } from "../../../config/theme";
import { getDeclarations, getConfig} from "../../../data/db";
import { exportToExcel, ColumnDef } from "../../utils/excelExport";


type ReportMeta = { title: string; desc: string };

const REPORTS: ReportMeta[] = [
  { title: "Compliance Status Report", desc: "Detailed breakdown of Approved, Declined, and Pending declarations across all departments." },
  { title: "SLA & Turnaround Time Report", desc: "Measures the time taken for approvals at each tier, highlighting bottlenecks." },
  { title: "High-Value Gifts Report", desc: "All declarations exceeding the configured high-value threshold." },
  { title: "Counterparty Concentration Report", desc: "Analysis of gifts given or received from specific vendors or clients to identify risks." },
];

export function AdminReports() {
  const [reportType, setReportType] = useState(REPORTS[0].title);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [department, setDepartment] = useState("All Departments");
  const [status, setStatus] = useState("All Statuses");

  const allDeclarations = useMemo(() => getDeclarations(), []);
  const config = useMemo(() => getConfig(), []);

  const departments = useMemo(() => {
    const deps = new Set(allDeclarations.map((d) => d.department).filter(Boolean));
    return ["All Departments", ...Array.from(deps).sort()];
  }, [allDeclarations]);

  const filtered = useMemo(() => {
    let list = [...allDeclarations];

    if (startDate) list = list.filter((d) => d.date >= startDate);
    if (endDate) list = list.filter((d) => d.date <= endDate);
    if (department !== "All Departments") list = list.filter((d) => d.department === department);
    if (status !== "All Statuses") list = list.filter((d) => d.status === status);

    switch (reportType) {
      case "Compliance Status Report":
        break;
      case "SLA & Turnaround Time Report":
        break;
      case "High-Value Gifts Report":
        list = list.filter((d) => d.value > config.highValueThreshold);
        break;
      case "Counterparty Concentration Report":
        break;
    }

    return list;
  }, [allDeclarations, startDate, endDate, department, status, reportType, config.highValueThreshold]);

  const handleExportExcel = () => {
    const columns: ColumnDef[] = [
      { header: "ID", key: "id", width: 16 },
      { header: "Employee", key: "employee", width: 22 },
      { header: "Department", key: "department", width: 14 },
      { header: "Type", key: "type", width: 14 },
      { header: "Counterparty", key: "Counterparty", width: 22 },
      { header: "Value", key: "value", width: 12 },
      { header: "Status", key: "status", width: 14 },
      { header: "Date", key: "date", width: 14 },
    ];

    exportToExcel({
      fileName: `${reportType.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}`,
      sheetName: reportType.slice(0, 31),
      title: reportType,
      meta: [
        ["Generated", new Date().toLocaleString()],
        ["Records", String(filtered.length)],
        ...(department !== "All Departments" ? [["Department", department]] : []),
        ...(status !== "All Statuses" ? [["Status", status]] : []),
      ],
      columns,
      rows: filtered as unknown as Record<string, unknown>[],
    });
  };

  const handleExportPdf = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operational Management Reports"
        subtitle="Generate, view, and export compliance data."
      />

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
              {REPORTS.map((r, i) => (
                <label
                  key={i}
                  className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition-all duration-300 ${
                    reportType === r.title
                      ? "border-purple-200 bg-purple-50 shadow-sm"
                      : "border-primary/10 bg-secondary/10 hover:-translate-y-0.5 hover:border-purple-200/70 hover:bg-purple-50/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="reportType"
                    className="mt-1"
                    checked={reportType === r.title}
                    onChange={() => setReportType(r.title)}
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
                  <input
                    type="date"
                    className="table-filter-input table-filter-with-icon"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">End Date</label>
                <div className="relative">
                  <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="date"
                    className="table-filter-input table-filter-with-icon"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Department</label>
                <select className="table-filter-select" value={department} onChange={(e) => setDepartment(e.target.value)}>
                  {departments.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Status</label>
                <select className="table-filter-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option>All Statuses</option>
                  <option>Draft</option>
                  <option>Pending</option>
                  <option>Approved</option>
                  <option>Declined</option>
                  <option>Escalated</option>
                  <option>Info Requested</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:flex-wrap sm:items-center">
              <button
                className="flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(79,29,149,0.28)] sm:flex-1"
                style={{ background: `linear-gradient(135deg, ${PURPLE}, #6d28d9)`, border: "1px solid transparent" }}
              >
                <FileText size={15} /> Generate Report
              </button>
              <button
                onClick={handleExportExcel}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-6 text-sm font-semibold text-emerald-700 transition-all duration-300 hover:-translate-y-0.5 hover:bg-emerald-100 sm:w-auto"
              >
                <Download size={15} /> Export Excel
              </button>
              <button
                onClick={handleExportPdf}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-6 text-sm font-semibold text-red-700 transition-all duration-300 hover:-translate-y-0.5 hover:bg-red-100 sm:w-auto"
              >
                <Download size={15} /> Export PDF
              </button>
            </div>
          </Card>

          <Card className="border-white/70 bg-white/80 p-5 shadow-[0_18px_45px_rgba(79,29,149,0.08)] backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold">Results</h3>
              <span className="rounded-full bg-purple-100 px-3 py-0.5 text-xs font-semibold text-purple-700">
                {filtered.length} record{filtered.length !== 1 ? "s" : ""}
              </span>
            </div>

            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center border border-dashed border-primary/10 bg-white/70 p-10 text-center rounded-xl">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary/70">
                  <FileText size={30} className="text-purple-500/60" />
                </div>
                <h3 className="mb-1 font-bold text-foreground">No Report Generated</h3>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Select your parameters and click "Generate Report" to preview the data here before exporting.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="bg-slate-100 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-3">ID</th>
                      <th className="px-4 py-3">Employee</th>
                      <th className="px-4 py-3">Dept</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Counterparty</th>
                      <th className="px-4 py-3">Value</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-medium">{d.id}</td>
                        <td className="px-4 py-2.5">{d.employee}</td>
                        <td className="px-4 py-2.5">{d.department}</td>
                        <td className="px-4 py-2.5">{d.type}</td>
                        <td className="px-4 py-2.5">{d.Counterparty}</td>
                        <td className="px-4 py-2.5">R{d.value}</td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              d.status === "Approved"
                                ? "bg-emerald-100 text-emerald-700"
                                : d.status === "Declined"
                                  ? "bg-red-100 text-red-700"
                                  : d.status === "Pending"
                                    ? "bg-amber-100 text-amber-700"
                                    : d.status === "Draft"
                                      ? "bg-slate-100 text-slate-600"
                                      : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {d.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{d.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
