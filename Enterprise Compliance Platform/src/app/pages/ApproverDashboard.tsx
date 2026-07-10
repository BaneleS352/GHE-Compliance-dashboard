import { useState, useEffect } from "react";
import { Check, X, Clock, Coins, ArrowUp, CheckSquare, AlertTriangle, ChevronRight } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { fetchDeclarations, fetchDashboardStats, DashboardStats } from "../../services/api";
import { Screen, Declaration } from "../../types/declaration";
import { PURPLE, YELLOW, formatRand } from "../../config/theme";
import { Card } from "../components/Card";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { TypeBadge } from "../components/TypeBadge";
import { THead } from "../components/THead";

type DashboardFilter = "All" | "Pending" | "Approved" | "Declined" | "Escalated" | "Total Value";

export function ApproverDashboard({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const [activeFilter, setActiveFilter] = useState<DashboardFilter>("All");
  const [declarations, setDeclarations]   = useState<Declaration[]>([]);
  const [stats, setStats]                 = useState<DashboardStats | null>(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchDeclarations(), fetchDashboardStats()])
      .then(([decls, s]) => {
        setDeclarations(decls);
        setStats(s);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm text-muted-foreground animate-pulse">Loading dashboard…</div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        <strong>Failed to load dashboard:</strong> {error}
      </div>
    );
  }

  const complianceTrend = stats.complianceTrend;
  const typeBreakdown   = stats.typeBreakdown;

  const pending   = declarations.filter((d) => d.status === "Pending");
  const approved  = declarations.filter((d) => d.status === "Approved");
  const declined  = declarations.filter((d) => d.status === "Declined");
  const escalated = declarations.filter((d) => d.status === "Escalated");
  const queueCount = declarations.filter((d) => ["Pending", "Escalated", "Info Requested"].includes(d.status)).length;
  const totalValue = declarations.reduce((sum, d) => sum + d.value, 0);

  const kpis = [
    { label: "Pending Queue" as const, value: pending.length, icon: Clock, color: "#f59e0b", filter: "Pending" as DashboardFilter },
    { label: "Approved" as const, value: approved.length, icon: Check, color: "#10b981", filter: "Approved" as DashboardFilter },
    { label: "Declined" as const, value: declined.length, icon: X, color: "#ef4444", filter: "Declined" as DashboardFilter },
    { label: "Escalated" as const, value: escalated.length, icon: ArrowUp, color: "#f97316", filter: "Escalated" as DashboardFilter },
    { label: "Total Value" as const, value: `R ${Math.round(totalValue / 1000)}K`, icon: Coins, color: "#6366f1", filter: "Total Value" as DashboardFilter },
  ];

  const filteredDeclarations =
    activeFilter === "All" || activeFilter === "Total Value"
      ? [...declarations].sort((a, b) => b.value - a.value)
      : declarations.filter((d) => d.status === activeFilter);

  const filteredValue = filteredDeclarations.reduce((sum, d) => sum + d.value, 0);
  const filteredCount = filteredDeclarations.length;
  const overdueCount = filteredDeclarations.filter((d) => d.priority === "High").length;
  const desktopRows = filteredDeclarations.slice(0, 6);
  const mobileRows  = filteredDeclarations.slice(0, 4);

  const summaryTitle =
    activeFilter === "All"
      ? "All Declarations"
      : activeFilter === "Total Value"
      ? "Total Declared Value"
      : `${activeFilter} Declarations`;

  const summaryMetric =
    activeFilter === "Total Value"
      ? formatRand(filteredValue)
      : String(filteredCount);

  const summaryLead =
    activeFilter === "Pending"
      ? "awaiting review"
      : activeFilter === "Approved"
      ? "approved records in view"
      : activeFilter === "Declined"
      ? "declined records in view"
      : activeFilter === "Escalated"
      ? "escalated records in view"
      : activeFilter === "Total Value"
      ? `${filteredCount} declarations across all statuses`
      : "records in view";

  const summarySubline =
    activeFilter === "Pending"
      ? `${overdueCount} high-priority items`
      : activeFilter === "Total Value"
      ? `Largest declaration: ${filteredDeclarations[0] ? formatRand(filteredDeclarations[0].value) : "R 0"}`
      : `Combined value: ${formatRand(filteredValue)}`;

  const listHeading =
    activeFilter === "All"
      ? "All Declarations"
      : activeFilter === "Total Value"
      ? "Declarations by Value"
      : `${activeFilter} Declarations`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approver Dashboard"
        subtitle="Hollywoodbets GHE Overview"
        actions={
          <button
            onClick={() => onNavigate("approval-queue")}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white transition-all hover:opacity-90 sm:w-auto"
            style={{ background: `linear-gradient(135deg, ${PURPLE}, #6d28d9)` }}
          >
            <CheckSquare size={15} /> Approval Queue
            <span className="ml-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold" style={{ background: YELLOW, color: "#1E1E2D" }}>
              {queueCount}
            </span>
          </button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {kpis.map((k, i) => {
          const isActive = activeFilter === k.filter;
          return (
            <div
              key={i}
              onClick={() => setActiveFilter(k.filter)}
              className={`cursor-pointer rounded-2xl border p-4 transition-all duration-300 sm:p-5 ${
                isActive ? "shadow-xl ring-2 ring-primary/15 sm:scale-[1.02]" : "hover:shadow-lg sm:hover:scale-[1.02]"
              }`}
              style={{ background: `linear-gradient(135deg, ${k.color}15, ${k.color}05)`, borderColor: isActive ? k.color : "#eee" }}
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${k.color}20` }}>
                <k.icon size={18} style={{ color: k.color }} />
              </div>
              <p className="text-2xl font-bold text-foreground">{k.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{k.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card className="flex flex-col p-5" style={{ borderLeft: `4px solid ${YELLOW}` }}>
          <div className="mb-1 flex items-center gap-2">
            <AlertTriangle size={14} style={{ color: "#d97706" }} />
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Selected View</p>
          </div>
          <h3 className="mb-0.5 text-base font-bold text-foreground">{summaryTitle}</h3>
          <div className="my-4 flex items-center gap-3">
            <div className="text-4xl font-bold" style={{ color: PURPLE }}>{summaryMetric}</div>
            <div>
              <p className="text-sm font-semibold text-foreground">{summaryLead}</p>
              <p className="mt-0.5 text-xs font-semibold text-muted-foreground">{summarySubline}</p>
            </div>
          </div>
          <div className="mb-4 flex-1 space-y-2">
            {desktopRows.slice(0, 2).map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-xl bg-muted/30 p-2.5">
                <div>
                  <p className="text-xs font-mono font-bold" style={{ color: PURPLE }}>{item.id}</p>
                  <p className="text-xs text-muted-foreground">{item.employee}</p>
                </div>
                <StatusBadge status={item.status} />
              </div>
            ))}
          </div>
          <button
            onClick={() => onNavigate("my-declarations")}
            className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl text-xs font-semibold text-white hover:opacity-90"
            style={{ background: `linear-gradient(135deg, ${PURPLE}, #6d28d9)` }}
          >
            Show All Declarations <ChevronRight size={13} />
          </button>
        </Card>

        <Card className="xl:col-span-2">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h3 className="text-sm font-bold text-foreground">{listHeading}</h3>
            <button onClick={() => setActiveFilter("All")} className="text-xs font-semibold hover:underline" style={{ color: PURPLE }}>
              Reset filter
            </button>
          </div>
          <div className="space-y-3 p-3.5 md:hidden">
            {mobileRows.map((d) => (
              <div key={d.id} className="rounded-2xl border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-bold" style={{ color: PURPLE }}>{d.id}</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{d.employee}</p>
                  </div>
                  <StatusBadge status={d.status} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Type</p>
                    <div className="mt-1"><TypeBadge type={d.type} /></div>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Value</p>
                    <p className="mt-1 font-semibold text-foreground">{formatRand(d.value)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Priority</p>
                    <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${d.priority === "High" ? "bg-red-50 text-red-700" : d.priority === "Medium" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                      {d.priority}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[680px] text-sm">
              <THead cols={["ID", "Employee", "Type", "Value", "Priority", "Status"]} />
              <tbody className="divide-y divide-border">
                {desktopRows.map((d) => (
                  <tr key={d.id} className="transition-colors hover:bg-muted/20">
                    <td className="px-5 py-3"><span className="font-mono text-xs font-bold" style={{ color: PURPLE }}>{d.id}</span></td>
                    <td className="px-5 py-3 text-xs font-medium text-foreground whitespace-nowrap">{d.employee}</td>
                    <td className="px-5 py-3"><TypeBadge type={d.type} /></td>
                    <td className="px-5 py-3 text-xs font-semibold tabular-nums">{formatRand(d.value)}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${d.priority === "High" ? "bg-red-50 text-red-700" : d.priority === "Medium" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                        {d.priority}
                      </span>
                    </td>
                    <td className="px-5 py-3"><StatusBadge status={d.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card className="p-4 sm:p-6 xl:col-span-2">
          <h3 className="mb-0.5 text-sm font-bold text-foreground">Monthly Declaration Volume</h3>
          <p className="mb-5 text-xs text-muted-foreground">Approved vs Declined per month</p>
          <div className="h-[240px] w-full sm:h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={complianceTrend} barGap={4} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(79 29 149 / 0.06)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6B6B80", fontFamily: "'Plus Jakarta Sans',sans-serif" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#6B6B80", fontFamily: "'Plus Jakarta Sans',sans-serif" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid rgb(79 29 149 / 0.12)", borderRadius: 12, fontSize: 12, fontFamily: "'Plus Jakarta Sans',sans-serif" }} cursor={{ fill: "rgb(79 29 149 / 0.04)" }} />
                <Legend wrapperStyle={{ fontSize: 12, fontFamily: "'Plus Jakarta Sans',sans-serif" }} />
                <Bar dataKey="approved" name="Approved" fill="#059669" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Declined" name="Declined" fill="#dc2626" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="flex flex-col p-4 sm:p-6">
          <h3 className="mb-0.5 text-sm font-bold text-foreground">Declarations by Type</h3>
          <p className="mb-4 text-xs text-muted-foreground">This month's breakdown</p>
          <div className="flex flex-1 items-center justify-center">
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={typeBreakdown} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                    {typeBreakdown.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#fff", border: "1px solid rgb(79 29 149 / 0.12)", borderRadius: 12, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="mt-2 space-y-2">
            {typeBreakdown.map((t) => (
              <div key={t.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-sm" style={{ background: t.color }} />
                  <span className="text-xs text-muted-foreground">{t.name}</span>
                </div>
                <span className="text-xs font-semibold text-foreground">{t.value}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
