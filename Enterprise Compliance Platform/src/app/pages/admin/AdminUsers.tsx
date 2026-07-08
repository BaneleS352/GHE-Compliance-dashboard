import { useState } from "react";
import { Search, Plus, Edit, Trash2, UserRound } from "lucide-react";
import { Card } from "../../components/Card";
import { PageHeader } from "../../components/PageHeader";
import { THead } from "../../components/THead";
import { PURPLE } from "../../../config/theme";

export function AdminUsers() {
  const [search, setSearch] = useState("");
  const users = [
    { id: "USR-001", name: "Nomvula Dlamini", email: "nomvula.d@hollywoodbets.net", role: "Team Member", department: "Marketing", status: "Active" },
    { id: "USR-002", name: "Sipho Nkosi", email: "sipho.n@hollywoodbets.net", role: "Approver", department: "Sales", status: "Active" },
    { id: "USR-003", name: "System Admin", email: "admin@hollywoodbets.net", role: "Administrator", department: "IT", status: "Active" },
    { id: "USR-004", name: "Lindiwe Zulu", email: "lindiwe.z@hollywoodbets.net", role: "Approver", department: "HR", status: "Inactive" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        subtitle="Manage system users, roles, and permissions."
        actions={
          <button
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(79,29,149,0.28)] sm:w-auto"
            style={{ background: `linear-gradient(135deg, ${PURPLE}, #6d28d9)`, border: "1px solid transparent" }}
          >
            <Plus size={15} /> Add User
          </button>
        }
      />

      <Card className="flex flex-col gap-3 border-white/70 bg-white/80 p-3.5 shadow-[0_18px_45px_rgba(79,29,149,0.08)] backdrop-blur-xl md:flex-row">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search by name, email, or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-border bg-white/90 pl-9 pr-4 text-sm transition-all focus:border-purple-300 focus:outline-none focus:ring-4 focus:ring-purple-500/10"
          />
        </div>
        <select className="h-10 w-full rounded-xl border border-border bg-white/90 px-3.5 text-sm transition-all focus:border-purple-300 focus:outline-none focus:ring-4 focus:ring-purple-500/10 md:w-auto">
          <option>All Roles</option>
          <option>Team Member</option>
          <option>Approver</option>
          <option>Administrator</option>
        </select>
        <select className="h-10 w-full rounded-xl border border-border bg-white/90 px-3.5 text-sm transition-all focus:border-purple-300 focus:outline-none focus:ring-4 focus:ring-purple-500/10 md:w-auto">
          <option>All Statuses</option>
          <option>Active</option>
          <option>Inactive</option>
        </select>
      </Card>

      <Card className="space-y-3 border-white/70 bg-white/80 p-3.5 shadow-[0_18px_45px_rgba(79,29,149,0.08)] backdrop-blur-xl md:hidden">
        {users.map((u) => (
          <div key={u.id} className="group rounded-2xl border border-primary/10 bg-white/95 p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-purple-200/70 hover:shadow-[0_14px_35px_rgba(79,29,149,0.08)]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 gap-3">
                <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-secondary shadow-sm transition-transform duration-300 group-hover:scale-105 group-hover:bg-purple-100">
                  <UserRound size={16} style={{ color: PURPLE }} />
                </div>
                <div className="min-w-0">
                  <p className="font-mono text-xs font-bold text-purple-700">{u.id}</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{u.name}</p>
                  <p className="mt-1 break-all text-xs text-muted-foreground">{u.email}</p>
                </div>
              </div>
              <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${u.status === "Active" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                {u.status}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Role</p>
                <span className={`mt-1 inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${
                  u.role === "Administrator" ? "bg-purple-100 text-purple-800" : u.role === "Approver" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"
                }`}>
                  {u.role}
                </span>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Department</p>
                <p className="mt-1 font-medium text-foreground">{u.department}</p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button className="rounded-xl p-2 text-muted-foreground transition-all duration-300 hover:bg-purple-50 hover:text-purple-700"><Edit size={14} /></button>
              <button className="rounded-xl p-2 text-muted-foreground transition-all duration-300 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </Card>

      <Card className="hidden overflow-x-auto border-white/70 bg-white/80 shadow-[0_18px_45px_rgba(79,29,149,0.08)] backdrop-blur-xl md:block">
        <table className="w-full min-w-[800px] text-sm">
          <THead cols={["User ID", "Name", "Email", "Role", "Department", "Status", "Actions"]} />
          <tbody className="divide-y divide-border">
            {users.map((u) => (
              <tr key={u.id} className="transition-all duration-300 hover:bg-purple-50/45">
                <td className="px-5 py-3.5 font-mono text-xs font-bold text-purple-700">{u.id}</td>
                <td className="px-5 py-3.5 font-semibold text-foreground">{u.name}</td>
                <td className="px-5 py-3.5 text-muted-foreground">{u.email}</td>
                <td className="px-5 py-3.5">
                  <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                    u.role === "Administrator" ? "bg-purple-100 text-purple-800" :
                    u.role === "Approver" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"
                  }`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-muted-foreground">{u.department}</td>
                <td className="px-5 py-3.5">
                  <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${u.status === "Active" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                    {u.status}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <button className="rounded-xl p-1.5 text-muted-foreground transition-all duration-300 hover:bg-purple-50 hover:text-purple-700"><Edit size={14} /></button>
                    <button className="rounded-xl p-1.5 text-muted-foreground transition-all duration-300 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
