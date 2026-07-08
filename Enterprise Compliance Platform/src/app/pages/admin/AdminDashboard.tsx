import { Users, Settings, Activity, FileText } from "lucide-react";
import { Card } from "../../components/Card";
import { PageHeader } from "../../components/PageHeader";
import { KpiCard } from "../../components/KpiCard";
import { PURPLE, YELLOW } from "../../../config/theme";
import { Screen } from "../../../types/declaration";

export function AdminDashboard({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Dashboard"
        subtitle="System Management Overview"
        actions={
          <button
            onClick={() => onNavigate("admin-users")}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(79,29,149,0.28)] sm:w-auto"
            style={{ background: `linear-gradient(135deg, ${PURPLE}, #6d28d9)`, border: "1px solid transparent" }}
          >
            <Users size={15} /> Manage Users
          </button>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Total Users" value="1,245" icon={Users} color="#7c3aed" onClick={() => onNavigate("admin-users")} active />
        <KpiCard label="Active Workflows" value="12" icon={Activity} color="#10b981" onClick={() => onNavigate("admin-workflows")} />
        <KpiCard label="System Events" value="142" icon={Settings} color="#f59e0b" onClick={() => onNavigate("admin-config")} />
        <KpiCard label="Reports Generated" value="89" icon={FileText} color="#ef4444" onClick={() => onNavigate("admin-reports")} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Card className="border-white/70 bg-white/80 p-6 shadow-[0_18px_45px_rgba(79,29,149,0.08)] backdrop-blur-xl">
          <div className="mb-5 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "linear-gradient(135deg, #F8D74A, #f59e0b)" }}>
              <Settings size={16} className="text-purple-950" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">Quick Links</p>
              <h3 className="text-sm font-bold text-foreground">Admin Tools</h3>
            </div>
          </div>
          <div className="space-y-3">
            {[
              { label: "User Management", desc: "Add, edit, or remove system users and roles.", screen: "admin-users" as Screen },
              { label: "Workflow Config", desc: "Setup conditional routing and approver tiers.", screen: "admin-workflows" as Screen },
              { label: "Dropdown Data", desc: "Manage categories, occasions, and departments.", screen: "admin-dropdowns" as Screen },
              { label: "System Config", desc: "Update notification and global settings.", screen: "admin-config" as Screen },
            ].map((link, idx) => (
              <div
                key={idx}
                className="group flex cursor-pointer flex-col gap-3 rounded-2xl border border-primary/10 bg-secondary/15 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-purple-200/70 hover:bg-purple-50/45 hover:shadow-[0_14px_35px_rgba(79,29,149,0.08)] sm:flex-row sm:items-center sm:justify-between"
                onClick={() => onNavigate(link.screen)}
              >
                <div>
                  <p className="text-sm font-bold text-foreground">{link.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{link.desc}</p>
                </div>
                <button className="h-8 w-full rounded-xl border border-white/80 bg-white/90 px-3 text-xs font-semibold text-foreground shadow-sm transition-all duration-300 group-hover:border-purple-200 group-hover:bg-white group-hover:text-purple-900 sm:w-auto">
                  Manage
                </button>
              </div>
            ))}
          </div>
        </Card>

        <Card className="flex flex-col items-center justify-center border-white/70 bg-white/80 p-6 text-center shadow-[0_18px_45px_rgba(79,29,149,0.08)] backdrop-blur-xl">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full shadow-[0_12px_28px_rgba(248,215,74,0.3)]" style={{ background: `linear-gradient(135deg, ${YELLOW}, #f59e0b)` }}>
            <Activity size={28} className="text-purple-950" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-2">System Healthy</h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-6">
            All services are running normally. Active directory sync completed 5 minutes ago.
          </p>
          <button className="h-9 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-purple-200 hover:bg-purple-50 hover:shadow-md">
            View System Logs
          </button>
        </Card>
      </div>
    </div>
  );
}
