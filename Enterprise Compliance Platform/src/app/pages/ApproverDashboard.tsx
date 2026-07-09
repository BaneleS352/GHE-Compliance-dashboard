import { useState } from "react";
import { Check, X, Clock, DollarSign, ArrowUp, CheckSquare, AlertTriangle, ChevronRight, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { declarations, complianceTrend } from "../../data/declarations";
import { Screen } from "../../types/declaration";
import { PURPLE, YELLOW, formatRand } from "../../config/theme";
import { Card } from "../components/Card";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { TypeBadge } from "../components/TypeBadge";
import { THead } from "../components/THead";
import { KpiCard } from "../components/KpiCard";
import { ApproverViewToggle } from "../components/ApproverViewToggle";

export function ApproverDashboard({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  type MetricId = "pending" | "approved" | "declined" | "escalated";

  const [activeMetric, setActiveMetric] = useState<MetricId>("approved");
  const totalValue = declarations.reduce((sum, declaration) => sum + declaration.value, 0);
  const pendingBase = declarations.filter((d) => ["Pending", "Info Requested"].includes(d.status));
  const approvedBase = declarations.filter((d) => d.status === "Approved");
  const declinedBase = declarations.filter((d) => d.status === "Declined");
  const escalatedBase = declarations.filter((d) => d.status === "Escalated");
  const queue = declarations.filter((d) => ["Pending", "Escalated", "Info Requested"].includes(d.status)).slice(0, 3);

  const buildRows = (
    count: number,
    base: typeof declarations,
    status: typeof declarations[number]["status"],
  ) =>
    Array.from({ length: count }, (_, index) => ({
      ...(base[index % base.length] ?? declarations[index % declarations.length]),
      id: `GHE-2024-${String(1000 + index + 1).slice(1)}`,
      status,
    }));

  const metricRows: Record<MetricId, typeof declarations> = {
    pending: buildRows(14, pendingBase, "Pending"),
    approved: buildRows(47, approvedBase, "Approved"),
    declined: buildRows(8, declinedBase, "Declined"),
    escalated: buildRows(3, escalatedBase, "Escalated"),
  };

  const activeTitles: Record<MetricId, string> = {
    pending: "Pending Queue",
    approved: "Approved This Month",
    declined: "Declined This Month",
    escalated: "Escalated Reviews",
  };

  const kpis = [
    { id: "pending" as MetricId, label: "Pending Queue", value: "14", icon: Clock, color: "#d97706" },
    { id: "approved" as MetricId, label: "Approved This Month", value: "47", icon: Check, color: "#059669" },
    { id: "declined" as MetricId, label: "Declined This Month", value: "8", icon: X, color: "#dc2626" },
    { id: "escalated" as MetricId, label: "Escalated", value: "3", icon: ArrowUp, color: "#ea580c" },
    { label: "Avg Processing", value: "2.4d", icon: TrendingUp, color: "#4f46e5" },
    { label: "Total Value Declared", value: `R ${Math.round(totalValue / 1000)}K`, icon: DollarSign, color: PURPLE },
  ];

  const decisionMix = [
    { label: "Approved", value: 47, color: "#059669" },
    { label: "Declined", value: 8, color: "#dc2626" },
    { label: "Pending", value: 14, color: "#d97706" },
  ];

  const departmentLoad = [
    { department: "Marketing", value: 18, color: PURPLE },
    { department: "Operations", value: 14, color: "#0891b2" },
    { department: "Sales", value: 11, color: "#d97706" },
    { department: "Finance", value: 7, color: "#059669" },
  ];

  const activeRows = metricRows[activeMetric];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Approver Dashboard"
        subtitle="Hollywoodbets GHE Compliance Overview - November 2024"
        actions={
          <>
            <ApproverViewToggle active="approvals" onNavigate={onNavigate} />
            <button
              onClick={() => onNavigate("approval-queue")}
              className="h-10 px-4 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-all flex items-center gap-2"
              style={{ background: `linear-gradient(135deg, ${PURPLE}, #6d28d9)` }}
            >
              <CheckSquare size={15} /> Queue
              <span className="ml-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: YELLOW, color: "#1E1E2D" }}>
                14
              </span>
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map((kpi) => (
          <KpiCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            icon={kpi.icon}
            color={kpi.color}
            active={kpi.id === activeMetric}
            onClick={kpi.id ? () => setActiveMetric(kpi.id) : undefined}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        <Card className="xl:col-span-3 overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground">{activeTitles[activeMetric]}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">List behind the selected KPI card</p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#F0EEF8]" style={{ color: PURPLE }}>
              {activeRows.length} records
            </span>
          </div>
          <table className="w-full min-w-[780px] text-sm">
            <THead cols={["ID", "Employee", "Department", "Type", "Value", "Submitted", "Status"]} />
            <tbody className="divide-y divide-border">
              {activeRows.slice(0, 8).map((declaration, index) => (
                <tr key={`${activeMetric}-${declaration.id}-${index}`} className="hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3"><span className="font-mono text-xs font-bold" style={{ color: PURPLE }}>{declaration.id}</span></td>
                  <td className="px-5 py-3 text-xs font-medium text-foreground whitespace-nowrap">{declaration.employee}</td>
                  <td className="px-5 py-3 text-xs text-muted-foreground">{declaration.department}</td>
                  <td className="px-5 py-3"><TypeBadge type={declaration.type} /></td>
                  <td className="px-5 py-3 text-xs font-semibold tabular-nums whitespace-nowrap">{formatRand(declaration.value)}</td>
                  <td className="px-5 py-3 text-xs text-muted-foreground tabular-nums whitespace-nowrap">{declaration.submitted}</td>
                  <td className="px-5 py-3"><StatusBadge status={declaration.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-5 py-3 border-t border-border bg-[#F7F8FC] flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Showing first <span className="font-semibold text-foreground">{Math.min(8, activeRows.length)}</span> of {activeRows.length}
            </p>
            <button onClick={() => onNavigate("approval-queue")} className="text-xs font-semibold hover:underline" style={{ color: PURPLE }}>
              Open approval tasks
            </button>
          </div>
        </Card>

        <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-5">
          <Card className="p-5" style={{ borderLeft: `4px solid ${YELLOW}` }}>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={14} style={{ color: "#d97706" }} />
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">My Next Step</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-4xl font-bold" style={{ color: PURPLE }}>2</div>
              <div>
                <p className="text-sm font-semibold text-foreground">overdue approval tasks</p>
                <p className="text-xs text-muted-foreground mt-0.5">Highest priority: Marketing hospitality</p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {queue.slice(0, 2).map((item) => (
                <button
                  key={item.id}
                  onClick={() => onNavigate("approval-queue")}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-muted/30 hover:bg-muted/60 transition-colors text-left"
                >
                  <div>
                    <p className="text-xs font-mono font-bold" style={{ color: PURPLE }}>{item.id}</p>
                    <p className="text-xs text-muted-foreground">{item.employee}</p>
                  </div>
                  <ChevronRight size={14} className="text-muted-foreground" />
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-bold text-foreground mb-3">Approval Decision Mix</h3>
            <div className="space-y-3">
              {decisionMix.map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-muted-foreground">{item.label}</span>
                    <span className="text-xs font-bold text-foreground">{item.value}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(item.value / 47) * 100}%`, background: item.color }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <Card className="xl:col-span-2 p-5">
          <h3 className="text-sm font-bold text-foreground mb-0.5">Monthly Approval Analytics</h3>
          <p className="text-xs text-muted-foreground mb-4">Approved and declined decisions over the last six months</p>
          <ResponsiveContainer width="100%" height={190}>
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
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-bold text-foreground mb-0.5">Department Load</h3>
          <p className="text-xs text-muted-foreground mb-4">Approval volume by business area</p>
          <div className="space-y-3">
            {departmentLoad.map((item) => (
              <div key={item.department} className="flex items-center gap-3">
                <span className="w-20 text-xs font-semibold text-muted-foreground">{item.department}</span>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(item.value / 18) * 100}%`, background: item.color }} />
                </div>
                <span className="w-6 text-right text-xs font-bold text-foreground">{item.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
