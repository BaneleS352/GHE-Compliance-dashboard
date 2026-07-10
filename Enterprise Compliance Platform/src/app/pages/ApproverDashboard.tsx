import { useState, useEffect } from "react";
import { Clock, Check, X, AlertTriangle, Coins, ArrowUpRight } from "lucide-react";
import { fetchDeclarations, fetchDashboardStats, DashboardStats } from "../../services/api";
import { Declaration, Screen } from "../../types/declaration";
import { formatRand } from "../../config/theme";
import { Card } from "../components/Card";
import { PageHeader } from "../components/PageHeader";
import { KpiCard } from "../components/KpiCard";
import { StatusBadge } from "../components/StatusBadge";
import { useUser } from "../auth/UserContext";
import { getPendingWorkflowStepsForUser } from "../../data/db";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

export function ApproverDashboard({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const { user } = useUser();
  const [declarations, setDeclarations] = useState<Declaration[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchDeclarations(), fetchDashboardStats()])
      .then(([decls, s]) => { setDeclarations(decls); setStats(s); })
      .finally(() => setLoading(false));
  }, []);

  const pendingSteps = user ? getPendingWorkflowStepsForUser(user.id) : [];
  const queueCount = pendingSteps.length;

  const pending   = declarations.filter((d) => d.status === "Pending");
  const approved  = declarations.filter((d) => d.status === "Approved");
  const declined  = declarations.filter((d) => d.status === "Declined");
  const escalated = declarations.filter((d) => d.status === "Escalated");
  const totalValue = declarations.reduce((sum, d) => sum + d.value, 0);

  const filteredDeclarations = activeFilter === "All"
    ? [...declarations].sort((a, b) => b.value - a.value)
    : declarations.filter((d) => d.status === activeFilter);

  const filteredCount = filteredDeclarations.length;

  const kpis = [
    { label: "Pending Queue", value: String(queueCount), icon: Clock, color: "#f59e0b", key: "Pending" },
    { label: "Approved", value: String(approved.length), icon: Check, color: "#10b981", key: "Approved" },
    { label: "Declined", value: String(declined.length), icon: X, color: "#ef4444", key: "Declined" },
    { label: "Escalated", value: String(escalated.length), icon: AlertTriangle, color: "#7c3aed", key: "Escalated" },
    { label: "Total Value", value: formatRand(totalValue), icon: Coins, color: "#6366f1", key: "All" },
  ];

  const chartData = stats?.complianceTrend || [];
  const pieData = stats?.typeBreakdown || [];

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="text-sm text-muted-foreground animate-pulse">Loading dashboard…</div></div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Approver Dashboard" subtitle="Overview of declarations and approvals" />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {kpis.map((k) => (
          <KpiCard
            key={k.key}
            label={k.label}
            value={k.value}
            icon={k.icon}
            color={k.color}
            active={activeFilter === k.key}
            onClick={() => setActiveFilter(k.key)}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Card className="border-white/70 bg-white/80 p-6 shadow-[0_18px_45px_rgba(79,29,149,0.08)] backdrop-blur-xl">
          <div className="mb-4 flex items-center gap-2">
            <h3 className="text-sm font-bold text-foreground">Compliance Trend</h3>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="approved" name="Approved" fill="#7c3aed" radius={[4, 4, 0, 0]} />
              <Bar dataKey="declined" name="Declined" fill="#f59e0b" 
radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="border-white/70 bg-white/80 p-6 shadow-[0_18px_45px_rgba(79,29,149,0.08)] backdrop-blur-xl">
          <div className="mb-4 flex items-center gap-2">
            <h3 className="text-sm font-bold text-foreground">By Declaration Type</h3>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {pieData.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
              </Pie>
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="border-white/70 bg-white/80 shadow-[0_18px_45px_rgba(79,29,149,0.08)] backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h3 className="text-sm font-bold text-foreground">
              {activeFilter === "All" ? "Top Declarations" : `${activeFilter} Declarations`}
            </h3>
            <p className="text-xs text-muted-foreground">
              {activeFilter === "All" ? `${filteredCount} declarations sorted by value` : `${filteredCount} declarations`}
            </p>
          </div>
          <button onClick={() => onNavigate("approval-queue")} className="flex items-center gap-1 text-xs font-semibold transition-colors hover:text-purple-700" style={{ color: "#7c3aed" }}>
            View All <ArrowUpRight size={13} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="bg-muted/30">
                {["ID", "Employee", "Type", "Value", "Status"].map((h) => <th key={h} className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredDeclarations.slice(0, 6).map((d) => (
                <tr key={d.id} className="transition-colors hover:bg-muted/20">
                  <td className="px-5 py-3.5 font-mono text-xs font-bold" style={{ color: "#7c3aed" }}>{d.id}</td>
                  <td className="px-5 py-3.5 text-sm font-medium text-foreground">{d.employee}</td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground">{d.type}</td>
                  <td className="px-5 py-3.5 text-sm font-semibold tabular-nums">{formatRand(d.value)}</td>
                  <td className="px-5 py-3.5"><StatusBadge status={d.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
