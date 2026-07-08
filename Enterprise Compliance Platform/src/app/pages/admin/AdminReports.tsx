import { useState } from "react";
import { Download, FileText, Calendar, BarChart3 } from "lucide-react";
import { Card } from "../../components/Card";
import { PageHeader } from "../../components/PageHeader";
import { PURPLE } from "../../../config/theme";

export function AdminReports() {
  const [reportType, setReportType] = useState("Compliance Status Report");

  const reports = [
    { title: "Compliance Status Report", desc: "Detailed breakdown of Approved, Declined, and Pending declarations across all departments." },
    { title: "SLA & Turnaround Time Report", desc: "Measures the time taken for approvals at each tier, highlighting bottlenecks." },
    { title: "High-Value Gifts Report", desc: "All declarations exceeding the configured high-value threshold." },
    { counterparty: "Counterparty Concentration Report", desc: "Analysis of gifts given or received from specific vendors or clients to identify risks." },
  ];

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
              {reports.map((r, i) => (
                <label
                  key={i}
                  className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition-all duration-300 ${
                    reportType === (r.title || r.counterparty)
                      ? "border-purple-200 bg-purple-50 shadow-sm"
                      : "border-primary/10 bg-secondary/10 hover:-translate-y-0.5 hover:border-purple-200/70 hover:bg-purple-50/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="reportType"
                    className="mt-1"
                    checked={reportType === (r.title || r.counterparty)}
                    onChange={() => setReportType(r.title || r.counterparty || "")}
                  />
                  <div>
                    <p className="text-sm font-semibold">{r.title || r.counterparty}</p>
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
                  <input type="date" className="h-11 w-full rounded-xl border border-border bg-white/90 pl-9 pr-3 text-sm transition-all focus:border-purple-300 focus:outline-none focus:ring-4 focus:ring-purple-500/10" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">End Date</label>
                <div className="relative">
                  <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="date" className="h-11 w-full rounded-xl border border-border bg-white/90 pl-9 pr-3 text-sm transition-all focus:border-purple-300 focus:outline-none focus:ring-4 focus:ring-purple-500/10" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Department</label>
                <select className="h-11 w-full rounded-xl border border-border bg-white/90 px-3 text-sm transition-all focus:border-purple-300 focus:outline-none focus:ring-4 focus:ring-purple-500/10">
                  <option>All Departments</option>
                  <option>Marketing</option>
                  <option>Sales</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Status</label>
                <select className="h-11 w-full rounded-xl border border-border bg-white/90 px-3 text-sm transition-all focus:border-purple-300 focus:outline-none focus:ring-4 focus:ring-purple-500/10">
                  <option>All Statuses</option>
                  <option>Approved</option>
                  <option>Pending</option>
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
              <button className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-6 text-sm font-semibold text-emerald-700 transition-all duration-300 hover:-translate-y-0.5 hover:bg-emerald-100 sm:w-auto">
                <Download size={15} /> Export Excel
              </button>
              <button className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-6 text-sm font-semibold text-red-700 transition-all duration-300 hover:-translate-y-0.5 hover:bg-red-100 sm:w-auto">
                <Download size={15} /> Export PDF
              </button>
            </div>
          </Card>

          <Card className="flex flex-col items-center justify-center border border-dashed border-primary/10 bg-white/70 p-10 text-center shadow-[0_18px_45px_rgba(79,29,149,0.05)] backdrop-blur-xl">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary/70">
              <FileText size={30} className="text-purple-500/60" />
            </div>
            <h3 className="mb-1 font-bold text-foreground">No Report Generated</h3>
            <p className="max-w-sm text-sm text-muted-foreground">
              Select your parameters and click "Generate Report" to preview the data here before exporting.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
