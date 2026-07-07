import { Check, X, Clock, DollarSign, ArrowUp, CheckSquare, AlertTriangle, ChevronRight } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { declarations, complianceTrend, typeBreakdown } from "../../data/declarations";
import { Screen } from "../../types/declaration";
import { PURPLE, YELLOW, formatRand } from "../../config/theme";
import { Card } from "../components/Card";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { TypeBadge } from "../components/TypeBadge";
import { THead } from "../components/THead";

export function ApproverDashboard({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const pending   = declarations.filter((d) => d.status === "Pending");
  const approved  = declarations.filter((d) => d.status === "Approved");
  const declined  = declarations.filter((d) => d.status === "Declined");
  const escalated = declarations.filter((d) => d.status === "Escalated");
  const totalValue = declarations.reduce((s, d) => s + d.value, 0);

  const kpis = [
    { label: "Pending Queue", value: pending.length,   icon: Clock,       color: "#f59e0b", onClick: () => onNavigate("approval-queue") },
    { label: "Approved",      value: approved.length,  icon: Check,       color: "#10b981", onClick: () => onNavigate("approval-queue") },
    { label: "Declined",      value: declined.length,  icon: X,           color: "#ef4444", onClick: () => onNavigate("approval-queue") },
    { label: "Escalated",     value: escalated.length, icon: ArrowUp,     color: "#f97316", onClick: () => onNavigate("approval-queue") },
    { label: "Total Value",   value: `R ${Math.round(totalValue / 1000)}K`, icon: DollarSign, color: "#6366f1" },
  ];

  const queue = declarations.filter((d) => ["Pending", "Escalated"].includes(d.status)).slice(0, 4);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approver Dashboard"
        subtitle="Hollywoodbets GHE Overview"
        actions={
          <button
            onClick={() => onNavigate("approval-queue")}
            className="h-10 px-5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-all flex items-center gap-2"
            style={{ background: `linear-gradient(135deg, ${PURPLE}, #6d28d9)` }}
          >
            <CheckSquare size={15} /> Approval Queue
            <span className="ml-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: YELLOW, color: "#1E1E2D" }}>
              14
            </span>
          </button>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {kpis.map((k, i) => (
          <div
            key={i}
            onClick={k.onClick}
            className="p-5 rounded-2xl cursor-pointer transition-all duration-300 hover:scale-[1.03] hover:shadow-lg border"
            style={{ background: `linear-gradient(135deg, ${k.color}15, ${k.color}05)`, borderColor: "#eee" }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: k.color + "20" }}>
              <k.icon size={18} style={{ color: k.color }} />
            </div>
            <p className="text-2xl font-bold text-foreground">{k.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Actions + pending table */}
      <div className="grid grid-cols-3 gap-5">
        <Card className="col-span-1 p-5 flex flex-col" style={{ borderLeft: `4px solid ${YELLOW}` }}>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={14} style={{ color: "#d97706" }} />
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">My Next Step</p>
          </div>
          <h3 className="text-base font-bold text-foreground mb-0.5">Actions Requiring Your Attention</h3>
          <div className="flex items-center gap-3 my-4">
            <div className="text-4xl font-bold" style={{ color: PURPLE }}>2</div>
            <div>
              <p className="text-sm font-semibold text-foreground">declarations awaiting review</p>
              <p className="text-xs text-red-600 font-semibold mt-0.5">2 overdue</p>
            </div>
          </div>
          <div className="space-y-2 mb-4 flex-1">
            {[{ id: "GHE-2024-0047", employee: "Nomvula Dlamini" }, { id: "GHE-2024-0042", employee: "Bongani Cele" }].map((item) => (
              <div key={item.id} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30">
                <div>
                  <p className="text-xs font-mono font-bold" style={{ color: PURPLE }}>{item.id}</p>
                  <p className="text-xs text-muted-foreground">{item.employee}</p>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-600">Overdue</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => onNavigate("approval-queue")}
            className="w-full h-9 rounded-xl text-xs font-semibold text-white hover:opacity-90 flex items-center justify-center gap-1.5"
            style={{ background: `linear-gradient(135deg, ${PURPLE}, #6d28d9)` }}
          >
            View My Actions <ChevronRight size={13} />
          </button>
        </Card>

        <Card className="col-span-2 overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">Pending Approvals</h3>
            <button onClick={() => onNavigate("approval-queue")} className="text-xs font-semibold hover:underline" style={{ color: PURPLE }}>
              View all
            </button>
          </div>
          <table className="w-full text-sm">
            <THead cols={["ID", "Employee", "Type", "Value", "Priority", "Status"]} />
            <tbody className="divide-y divide-border">
              {queue.map((d) => (
                <tr key={d.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3"><span className="font-mono text-xs font-bold" style={{ color: PURPLE }}>{d.id}</span></td>
                  <td className="px-5 py-3 text-xs font-medium text-foreground whitespace-nowrap">{d.employee}</td>
                  <td className="px-5 py-3"><TypeBadge type={d.type} /></td>
                  <td className="px-5 py-3 text-xs font-semibold tabular-nums">{formatRand(d.value)}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${d.priority === "High" ? "bg-red-50 text-red-700" : d.priority === "Medium" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                      {d.priority}
                    </span>
                  </td>
                  <td className="px-5 py-3"><StatusBadge status={d.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-3 gap-5">
        <Card className="col-span-2 p-6">
          <h3 className="text-sm font-bold text-foreground mb-0.5">Monthly Declaration Volume</h3>
          <p className="text-xs text-muted-foreground mb-5">Approved vs Declined per month</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={complianceTrend} barGap={4} barSize={18}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(79 29 149 / 0.06)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6B6B80", fontFamily: "'Plus Jakarta Sans',sans-serif" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#6B6B80", fontFamily: "'Plus Jakarta Sans',sans-serif" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid rgb(79 29 149 / 0.12)", borderRadius: 12, fontSize: 12, fontFamily: "'Plus Jakarta Sans',sans-serif" }} cursor={{ fill: "rgb(79 29 149 / 0.04)" }} />
              <Legend wrapperStyle={{ fontSize: 12, fontFamily: "'Plus Jakarta Sans',sans-serif" }} />
              <Bar dataKey="approved" name="Approved" fill="#059669" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Declined" name="Declined"  fill="#dc2626" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6 flex flex-col">
          <h3 className="text-sm font-bold text-foreground mb-0.5">Declarations by Type</h3>
          <p className="text-xs text-muted-foreground mb-4">This month's breakdown</p>
          <div className="flex-1 flex items-center justify-center">
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={typeBreakdown} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                  {typeBreakdown.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid rgb(79 29 149 / 0.12)", borderRadius: 12, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-2">
            {typeBreakdown.map((t) => (
              <div key={t.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ background: t.color }} />
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
