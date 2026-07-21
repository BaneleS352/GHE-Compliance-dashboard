import { useState, useEffect, useMemo } from "react";
import { Check, X, Clock, Coins, ArrowUp, CheckSquare, AlertTriangle, ChevronRight, Users, FileText } from "lucide-react";
import { fetchDeclarations, fetchDashboardStats, DashboardStats } from "../../services/api";
import { Screen, Declaration } from "../../types/declaration";
import { PURPLE, YELLOW, formatRand } from "../../config/theme";
import { useUser } from "../auth/UserContext";
import { Card } from "../components/Card";
import { PageHeader } from "../components/PageHeader";
import { THead } from "../components/THead";

type DashboardFilter = "All" | "Pending" | "Approved" | "Declined" | "Escalated" | "Total Value";

export function ApproverDashboard({ onNavigate, onReview }: { onNavigate: (s: Screen) => void; onReview?: (d: Declaration) => void }) {
  const { user } = useUser();
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

  const isAdmin = user?.role === "admin";

  const approverStats = useMemo(() => {
    const map = new Map<string, { approved: number; declined: number; pending: number; total: number }>();
    declarations.forEach(d => {
      const a = d.approver || "Unassigned";
      if (!map.has(a)) map.set(a, { approved: 0, declined: 0, pending: 0, total: 0 });
      const s = map.get(a)!;
      s.total++;
      if (d.status === "Approved") s.approved++;
      else if (d.status === "Declined") s.declined++;
      else if (["Pending", "Escalated", "Info Requested"].includes(d.status)) s.pending++;
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [declarations]);

  const daysSince = (dateStr: string) => Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);

  const teamActivity = useMemo(() => {
    if (isAdmin) {
      const map = new Map<string, { members: Set<string>; declarations: number; totalValue: number }>();
      declarations.forEach(d => {
        const a = d.approver || "Unassigned";
        if (!map.has(a)) map.set(a, { members: new Set(), declarations: 0, totalValue: 0 });
        const s = map.get(a)!;
        s.members.add(d.employee);
        s.declarations++;
        s.totalValue += d.value;
      });
      return Array.from(map.entries()).map(([name, s]) => ({
        name, teamSize: s.members.size, declarations: s.declarations, totalValue: s.totalValue,
      })).sort((a, b) => b.declarations - a.declarations);
    }
    const map = new Map<string, { declarations: number; approved: number; pending: number; totalValue: number }>();
    declarations.filter(d => d.approver === user?.name).forEach(d => {
      if (!map.has(d.employee)) map.set(d.employee, { declarations: 0, approved: 0, pending: 0, totalValue: 0 });
      const s = map.get(d.employee)!;
      s.declarations++;
      s.totalValue += d.value;
      if (d.status === "Approved") s.approved++;
      else if (["Pending", "Escalated", "Info Requested"].includes(d.status)) s.pending++;
    });
    return Array.from(map.entries()).map(([name, s]) => ({ name, ...s })).sort((a, b) => b.declarations - a.declarations);
  }, [declarations, user, isAdmin]);

  const overdueDeclarations = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 86400000;
    return declarations.filter(d => {
      if (!["Pending", "Escalated", "Info Requested"].includes(d.status)) return false;
      if (!isAdmin && d.approver !== user?.name) return false;
      if (activeFilter !== "All" && activeFilter !== "Total Value" && d.status !== activeFilter) return false;
      return new Date(d.submitted).getTime() < sevenDaysAgo;
    }).sort((a, b) => new Date(a.submitted).getTime() - new Date(b.submitted).getTime());
  }, [declarations, user, activeFilter, isAdmin]);

  const departmentStats = useMemo(() => {
    const scope = isAdmin ? declarations : declarations.filter(d => d.approver === user?.name);
    const map = new Map<string, { declarations: number; approved: number; declined: number; pending: number; totalValue: number }>();
    scope.forEach(d => {
      if (!map.has(d.department)) map.set(d.department, { declarations: 0, approved: 0, declined: 0, pending: 0, totalValue: 0 });
      const s = map.get(d.department)!;
      s.declarations++;
      s.totalValue += d.value;
      if (d.status === "Approved") s.approved++;
      else if (d.status === "Declined") s.declined++;
      else if (["Pending", "Escalated", "Info Requested"].includes(d.status)) s.pending++;
    });
    return Array.from(map.entries()).map(([name, s]) => ({ name, ...s })).sort((a, b) => b.declarations - a.declarations);
  }, [declarations, user, isAdmin]);

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

  const kpisData = stats.kpis;
  const queueCount = declarations.filter((d) => ["Pending", "Escalated", "Info Requested"].includes(d.status)).length;

  const kpis = [
    { label: "Pending Queue" as const, value: kpisData.pending, icon: Clock, color: "#f59e0b", filter: "Pending" as DashboardFilter },
    { label: "Approved" as const, value: kpisData.approved, icon: Check, color: "#10b981", filter: "Approved" as DashboardFilter },
    { label: "Declined" as const, value: kpisData.declined, icon: X, color: "#ef4444", filter: "Declined" as DashboardFilter },
    { label: "Escalated" as const, value: kpisData.escalated, icon: ArrowUp, color: "#f97316", filter: "Escalated" as DashboardFilter },
    { label: "Total Value" as const, value: `R ${Math.round(kpisData.totalValue / 1000)}K`, icon: Coins, color: "#6366f1", filter: "Total Value" as DashboardFilter },
  ];

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
              style={{ background: `linear-gradient(135deg, ${k.color}35, ${k.color}18)`, borderColor: isActive ? k.color : "#eee" }}
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${k.color}40` }}>
                <k.icon size={18} style={{ color: k.color }} />
              </div>
              <p className="text-2xl font-bold text-foreground">{k.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{k.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card className="flex flex-col p-5">
          <div className="mb-1 flex items-center gap-2">
            <Users size={14} style={{ color: PURPLE }} />
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {isAdmin ? "Manager Oversight" : "My Activity"}
            </p>
          </div>
          {isAdmin ? (
            <div className="mt-3 flex-1 space-y-2">
              {approverStats.length === 0 ? (
                <p className="text-xs text-muted-foreground">No data yet</p>
              ) : (
                approverStats.slice(0, 6).map((a) => (
                  <div key={a.name} className="flex items-center justify-between rounded-xl bg-muted/30 p-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-foreground truncate">{a.name}</p>
                      <p className="text-[10px] text-muted-foreground">{a.total} total · {a.pending} pending</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-[10px] font-semibold">
                      <span className="text-emerald-600">{a.approved} ✓</span>
                      <span className="text-red-600">{a.declined} ✗</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="mt-3 flex-1 space-y-2">
              {(() => {
                const myStats = approverStats.find(a => a.name === user?.name);
                if (!myStats) return <p className="text-xs text-muted-foreground">No activity recorded</p>;
                return (
                  <div className="rounded-xl bg-muted/30 p-3">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-lg font-bold text-emerald-600">{myStats.approved}</p>
                        <p className="text-[10px] text-muted-foreground">Approved</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-red-600">{myStats.declined}</p>
                        <p className="text-[10px] text-muted-foreground">Declined</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-amber-600">{myStats.pending}</p>
                        <p className="text-[10px] text-muted-foreground">Pending</p>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </Card>

        <Card className="flex flex-col p-5">
          <div className="mb-1 flex items-center gap-2">
            <FileText size={14} style={{ color: PURPLE }} />
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {isAdmin ? "Line Manager Activity" : "Team Member Activity"}
            </p>
          </div>
          <div className="mt-3 flex-1 space-y-2">
            {teamActivity.length === 0 ? (
              <p className="text-xs text-muted-foreground">No data yet</p>
            ) : (
              teamActivity.slice(0, 5).map((p) => (
                <div key={p.name} className="rounded-xl bg-muted/30 p-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-foreground truncate">{p.name}</p>
                    {isAdmin ? (
                      <span className="text-[10px] text-muted-foreground">{p.teamSize} member{p.teamSize !== 1 ? "s" : ""}</span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">{p.declarations} decl.</span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-[10px]">
                    <span className="font-semibold tabular-nums" style={{ color: PURPLE }}>{formatRand(p.totalValue)}</span>
                    {"approved" in p && (
                      <span className="text-emerald-600">{p.approved} approved</span>
                    )}
                    {"pending" in p && p.pending > 0 && (
                      <span className="text-amber-600">{p.pending} pending</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          <button
            onClick={() => onNavigate(isAdmin ? "my-declarations" : "approval-queue")}
            className="mt-3 flex h-8 w-full items-center justify-center gap-1 rounded-xl bg-secondary text-xs font-semibold hover:bg-secondary/70"
          >
            View {isAdmin ? "Declarations" : "Queue"} <ChevronRight size={12} />
          </button>
        </Card>

        <Card className="flex flex-col p-5" style={{ borderLeft: `4px solid #ef4444` }}>
          <div className="mb-1 flex items-center gap-2">
            <AlertTriangle size={14} style={{ color: "#ef4444" }} />
            <p className="text-xs font-bold uppercase tracking-wide text-red-600">Overdue · 7+ Days</p>
          </div>
          <div className="mt-3 flex-1 space-y-2">
            {overdueDeclarations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <p className="text-xs font-semibold text-emerald-600">All caught up!</p>
                <p className="text-[10px] text-muted-foreground">No declarations overdue</p>
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
                    <p className="text-[10px] text-muted-foreground truncate">{d.employee} · {daysSince(d.submitted)} days</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${d.priority === "High" ? "bg-red-100 text-red-700" : d.priority === "Medium" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                    {d.priority}
                  </span>
                </button>
              ))
            )}
          </div>
          {overdueDeclarations.length > 5 && (
            <button
              onClick={() => onNavigate("approval-queue")}
              className="mt-2 text-center text-[10px] font-semibold hover:underline" style={{ color: PURPLE }}
            >
              +{overdueDeclarations.length - 5} more overdue
            </button>
          )}
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-sm font-bold text-foreground">Department Insights</h3>
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">{departmentStats.reduce((s, d) => s + d.declarations, 0)}</strong> total declarations
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <THead cols={["Department", "Declarations", "Pending", "Approved", "Declined", "Total Value"]} />
            <tbody className="divide-y divide-border">
              {departmentStats.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-xs text-muted-foreground">No data available</td>
                </tr>
              ) : (
                departmentStats.map((d) => (
                  <tr key={d.name} className="transition-colors hover:bg-muted/20">
                    <td className="px-5 py-3 text-xs font-semibold text-foreground">{d.name}</td>
                    <td className="px-5 py-3 text-xs text-foreground">{d.declarations}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold ${d.pending > 0 ? "text-amber-600" : "text-muted-foreground"}`}>{d.pending}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold ${d.approved > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>{d.approved}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold ${d.declined > 0 ? "text-red-600" : "text-muted-foreground"}`}>{d.declined}</span>
                    </td>
                    <td className="px-5 py-3 text-xs font-semibold tabular-nums text-foreground">{formatRand(d.totalValue)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
