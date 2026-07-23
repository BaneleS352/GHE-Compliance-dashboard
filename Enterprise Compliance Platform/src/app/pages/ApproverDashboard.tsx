import { useEffect, useMemo, useState } from "react";
import {
  Check,
  X,
  Clock,
  Coins,
  ArrowUp,
  CheckSquare,
  AlertTriangle,
  ChevronRight,
  FileText,
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { fetchDeclarations } from "../../services/api";
import { Screen, Declaration } from "../../types/declaration";
import { PURPLE, YELLOW, formatRand } from "../../config/theme";
import { useUser } from "../auth/UserContext";
import { Card } from "../components/Card";
import { PageHeader } from "../components/PageHeader";
import { THead } from "../components/THead";

type DashboardFilter = "All" | "Pending" | "Approved" | "Declined" | "Escalated" | "Total Value";

const TYPE_COLORS: Record<string, string> = {
  Gift: "#7c3aed",
  Hospitality: "#0f766e",
  Entertainment: "#d97706",
};

function isCurrentMonth(value: string): boolean {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

export function ApproverDashboard({ onNavigate, onReview }: { onNavigate: (s: Screen) => void; onReview?: (d: Declaration) => void }) {
  const { user } = useUser();
  const [activeFilter, setActiveFilter] = useState<DashboardFilter>("All");
  const [deptPage, setDeptPage] = useState(0);
  const DEPT_PAGE_SIZE = 10;
  const [declarations, setDeclarations] = useState<Declaration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDeclarations()
      .then(setDeclarations)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const isAdmin = user?.role === "admin";

  const currentMonthDeclarations = useMemo(
    () => declarations.filter((d) => isCurrentMonth(d.submitted || d.date)),
    [declarations]
  );

  const scopedDeclarations = useMemo(() => {
    if (isAdmin) return currentMonthDeclarations;
    return currentMonthDeclarations.filter((d) => d.approver === user?.name || d.employeeId === user?.id || d.employee === user?.name);
  }, [currentMonthDeclarations, isAdmin, user]);

  const filteredDeclarations = useMemo(() => {
    if (activeFilter === "All" || activeFilter === "Total Value") return scopedDeclarations;
    return scopedDeclarations.filter((d) => d.status === activeFilter);
  }, [activeFilter, scopedDeclarations]);

  const daysSince = (dateStr: string) => Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);

  const kpisData = useMemo(() => ({
    pending: scopedDeclarations.filter((d) => d.status === "Pending").length,
    approved: scopedDeclarations.filter((d) => d.status === "Approved").length,
    declined: scopedDeclarations.filter((d) => d.status === "Declined").length,
    escalated: scopedDeclarations.filter((d) => d.status === "Escalated").length,
    totalValue: scopedDeclarations.reduce((sum, d) => sum + d.value, 0),
  }), [scopedDeclarations]);

  const teamActivity = useMemo(() => {
    const map = new Map<string, { declarations: number; totalValue: number; types: Record<string, number> }>();
    scopedDeclarations.forEach((d) => {
      const key = d.employee;
      if (!map.has(key)) map.set(key, { declarations: 0, totalValue: 0, types: { Gift: 0, Hospitality: 0, Entertainment: 0 } });
      const row = map.get(key)!;
      row.declarations += 1;
      row.totalValue += d.value;
      row.types[d.type] = (row.types[d.type] || 0) + 1;
    });
    return Array.from(map.entries())
      .map(([name, row]) => ({ name, ...row }))
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 5);
  }, [scopedDeclarations]);

  const typeDistribution = useMemo(() => {
    const counts = scopedDeclarations.reduce<Record<string, number>>((acc, d) => {
      acc[d.type] = (acc[d.type] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).map(([name, value]) => ({
      name,
      value,
      color: TYPE_COLORS[name] || PURPLE,
    }));
  }, [scopedDeclarations]);

  const overdueDeclarations = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 86400000;
    return filteredDeclarations
      .filter((d) => ["Pending", "Escalated", "Info Requested"].includes(d.status) && new Date(d.submitted).getTime() < sevenDaysAgo)
      .sort((a, b) => new Date(a.submitted).getTime() - new Date(b.submitted).getTime());
  }, [filteredDeclarations]);

  const departmentStats = useMemo(() => {
    const map = new Map<string, { declarations: number; approved: number; declined: number; pending: number; totalValue: number }>();
    filteredDeclarations.forEach((d) => {
      if (!map.has(d.department)) map.set(d.department, { declarations: 0, approved: 0, declined: 0, pending: 0, totalValue: 0 });
      const row = map.get(d.department)!;
      row.declarations += 1;
      row.totalValue += d.value;
      if (d.status === "Approved") row.approved += 1;
      else if (d.status === "Declined") row.declined += 1;
      else if (["Pending", "Escalated", "Info Requested"].includes(d.status)) row.pending += 1;
    });
    return Array.from(map.entries()).map(([name, row]) => ({ name, ...row })).sort((a, b) => b.totalValue - a.totalValue);
  }, [filteredDeclarations]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="text-sm text-muted-foreground animate-pulse">Loading dashboard…</div></div>;
  }

  if (error) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700"><strong>Failed to load dashboard:</strong> {error}</div>;
  }

  const queueCount = scopedDeclarations.filter((d) => ["Pending", "Escalated", "Info Requested"].includes(d.status)).length;
  const monthLabel = new Date().toLocaleDateString("en-ZA", { month: "long", year: "numeric" });

  const kpis = [
    { label: "Pending Queue" as const, value: kpisData.pending, icon: Clock, color: "#f59e0b", filter: "Pending" as DashboardFilter },
    { label: "Approved" as const, value: kpisData.approved, icon: Check, color: "#10b981", filter: "Approved" as DashboardFilter },
    { label: "Declined" as const, value: kpisData.declined, icon: X, color: "#ef4444", filter: "Declined" as DashboardFilter },
    { label: "Escalated" as const, value: kpisData.escalated, icon: ArrowUp, color: "#f97316", filter: "Escalated" as DashboardFilter },
    { label: "Total Value" as const, value: formatRand(kpisData.totalValue), icon: Coins, color: "#6366f1", filter: "Total Value" as DashboardFilter },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approver Dashboard"
        subtitle={`Current month view • ${monthLabel}`}
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
              className={`flex min-h-32 cursor-pointer items-center rounded-2xl border p-4 transition-all duration-300 sm:min-h-36 sm:p-5 ${
                isActive ? "shadow-xl ring-2 ring-primary/15 sm:scale-[1.02]" : "hover:shadow-lg sm:hover:scale-[1.02]"
              }`}
              style={{ background: `linear-gradient(135deg, ${k.color}35, ${k.color}18)`, borderColor: isActive ? k.color : "#eee" }}
            >
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: `${k.color}40` }}>
                  <k.icon size={18} style={{ color: k.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-2xl font-bold text-foreground">{k.value}</p>
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card className="flex flex-col p-5">
          <div className="mb-1 flex items-center gap-2">
            <FileText size={14} style={{ color: PURPLE }} />
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Team Member Activity</p>
          </div>
          <div className="mt-3 flex-1 space-y-2">
            {teamActivity.length === 0 ? (
              <p className="text-xs text-muted-foreground">No current-month activity yet</p>
            ) : (
              teamActivity.map((row) => (
                <div key={row.name} className="rounded-xl bg-muted/30 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-semibold text-foreground">{row.name}</p>
                    <span className="text-[10px] text-muted-foreground">{row.declarations} decl.</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-3 text-[11px]">
                    <span className="font-semibold" style={{ color: PURPLE }}>{formatRand(row.totalValue)}</span>
                    <span className="text-muted-foreground">Gift {row.types.Gift || 0} • Hosp {row.types.Hospitality || 0} • Ent {row.types.Entertainment || 0}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="flex flex-col p-5">
          <div className="mb-1 flex items-center gap-2">
            <Coins size={14} style={{ color: PURPLE }} />
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">GHE Distribution</p>
          </div>
          <div className="mt-3 flex-1">
            {typeDistribution.length === 0 ? (
              <div className="flex h-full min-h-48 items-center justify-center text-xs text-muted-foreground">No current-month data yet</div>
            ) : (
              <>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={typeDistribution} dataKey="value" nameKey="name" innerRadius={44} outerRadius={78} paddingAngle={3}>
                        {typeDistribution.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number, _name, payload: any) => [`${value}`, payload?.payload?.name || ""]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {typeDistribution.map((entry) => {
                    const percent = Math.round((entry.value / typeDistribution.reduce((sum, item) => sum + item.value, 0)) * 100);
                    return (
                      <div key={entry.name} className="rounded-xl border border-border bg-white px-3 py-2 text-center">
                        <p className="text-xs font-semibold text-foreground">{entry.name}</p>
                        <p className="text-[11px] text-muted-foreground">{entry.value} • {percent}%</p>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </Card>

        <Card className="flex flex-col p-5" style={{ borderLeft: "4px solid #ef4444" }}>
          <div className="mb-1 flex items-center gap-2">
            <AlertTriangle size={14} style={{ color: "#ef4444" }} />
            <p className="text-xs font-bold uppercase tracking-wide text-red-600">Overdue • 7+ Days</p>
          </div>
          <div className="mt-3 flex-1 space-y-2">
            {overdueDeclarations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <p className="text-xs font-semibold text-emerald-600">All caught up!</p>
                <p className="text-[10px] text-muted-foreground">No declarations overdue this month</p>
              </div>
            ) : (
              overdueDeclarations.slice(0, 5).map((d) => (
                <button
                  key={d.id}
                  onClick={() => onReview?.(d)}
                  className="flex w-full items-center justify-between rounded-xl bg-red-50 p-2.5 text-left transition-colors hover:bg-red-100"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-mono font-bold" style={{ color: PURPLE }}>{d.id}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{d.employee} • {daysSince(d.submitted)} days</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${d.priority === "High" ? "bg-red-100 text-red-700" : d.priority === "Medium" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                    {d.priority}
                  </span>
                </button>
              ))
            )}
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-sm font-bold text-foreground">Department Insights</h3>
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">{departmentStats.reduce((sum, row) => sum + row.declarations, 0)}</strong> current-month declarations
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <THead cols={["Department", "Declarations", "Pending", "Approved", "Declined", "Total Value"]} />
            <tbody className="divide-y divide-border">
              {departmentStats.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-xs text-muted-foreground">No current-month data available</td>
                </tr>
              ) : (
                departmentStats.slice(deptPage * DEPT_PAGE_SIZE, (deptPage + 1) * DEPT_PAGE_SIZE).map((row) => (
                  <tr key={row.name} className="transition-colors hover:bg-muted/20">
                    <td className="whitespace-nowrap px-5 py-3 text-xs font-semibold text-foreground">{row.name}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-xs text-foreground">{row.declarations}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-xs font-semibold text-amber-600">{row.pending}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-xs font-semibold text-emerald-600">{row.approved}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-xs font-semibold text-red-600">{row.declined}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-xs font-semibold tabular-nums text-foreground">{formatRand(row.totalValue)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {departmentStats.length > DEPT_PAGE_SIZE && (
            <div className="flex items-center justify-between border-t border-border bg-[#F7F8FC] px-5 py-3">
              <p className="text-xs text-muted-foreground">Showing <span className="font-semibold text-foreground">{departmentStats.length}</span> departments</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setDeptPage((p) => Math.max(0, p - 1))} disabled={deptPage === 0} className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-40">Previous</button>
                <span className="text-xs text-muted-foreground">Page {deptPage + 1} of {Math.ceil(departmentStats.length / DEPT_PAGE_SIZE)}</span>
                <button onClick={() => setDeptPage((p) => Math.min(Math.ceil(departmentStats.length / DEPT_PAGE_SIZE) - 1, p + 1))} disabled={deptPage >= Math.ceil(departmentStats.length / DEPT_PAGE_SIZE) - 1} className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
