import { useState, useMemo, useEffect } from "react";
import { Search, Plus, Edit, Trash2, UserRound } from "lucide-react";
import { Card } from "../../components/Card";
import { PageHeader } from "../../components/PageHeader";
import { THead } from "../../components/THead";
import { PURPLE } from "../../../config/theme";
import { getUsers, addUser, updateUser, deleteUser } from "../../../data/db";
import { User } from "../../../types/declaration";

const ROLE_MAP: Record<string, string> = {
  teamMember: "Team Member",
  approver: "Approver",
  admin: "Administrator",
};

const ROLE_OPTIONS = ["All Roles", "Team Member", "Approver", "Administrator"];
const STATUS_OPTIONS = ["All Statuses", "Active", "Inactive"];

let _nextId = Date.now();

export function AdminUsers() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All Roles");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    setUsers(getUsers());
  }, []);

  const refresh = () => setUsers([...getUsers()]);

  const filtered = useMemo(() => {
    let list = users;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.id.toLowerCase().includes(q)
      );
    }
    if (roleFilter !== "All Roles") {
      const reverseMap: Record<string, string> = {
        "Team Member": "teamMember",
        Approver: "approver",
        Administrator: "admin",
      };
      list = list.filter((u) => ROLE_MAP[u.role] === roleFilter);
    }
    if (statusFilter !== "All Statuses") {
      list = list.filter((u) => (u as any).status === statusFilter);
    }
    return list;
  }, [users, search, roleFilter, statusFilter]);

  const handleAdd = () => {
    const name = prompt("User name:");
    if (!name) return;
    const email = prompt("Email:");
    if (!email) return;
    const roleLabels = ["teamMember", "approver", "admin"];
    const roleLabel = prompt(`Role (${roleLabels.join(", ")}):`, "teamMember");
    if (!roleLabel || !roleLabels.includes(roleLabel)) return;
    const department = prompt("Department:") || "";
    try {
      addUser({
        id: `USR-${String(_nextId++).slice(-6)}`,
        name,
        email,
        passwordHash: "default",
        role: roleLabel as "teamMember" | "approver" | "admin",
        department,
        teamMemberNumber: "",
        position: "",
        lineManager: null,
      });
      refresh();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleEdit = (user: User) => {
    const name = prompt("Name:", user.name);
    if (!name) return;
    const email = prompt("Email:", user.email);
    if (!email) return;
    const roleLabels = ["teamMember", "approver", "admin"];
    const roleLabel = prompt(`Role (${roleLabels.join(", ")}):`, user.role);
    if (!roleLabel || !roleLabels.includes(roleLabel)) return;
    const department = prompt("Department:", user.department) || "";
    try {
      updateUser(user.id, { name, email, role: roleLabel as User["role"], department });
      refresh();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDelete = (user: User) => {
    if (!confirm(`Delete user "${user.name}" (${user.id})?`)) return;
    try {
      deleteUser(user.id);
      refresh();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const roleBadge = (role: string) => {
    const display = ROLE_MAP[role] || role;
    const cls =
      display === "Administrator"
        ? "bg-purple-100 text-purple-800"
        : display === "Approver"
          ? "bg-amber-100 text-amber-800"
          : "bg-blue-100 text-blue-800";
    return (
      <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${cls}`}>
        {display}
      </span>
    );
  };

  const statusBadge = (user: User) => {
    const active = (user as any).status !== "Inactive";
    return (
      <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${active ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
        {active ? "Active" : "Inactive"}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        subtitle="Manage system users, roles, and permissions."
        actions={
          <button
            onClick={handleAdd}
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
            className="table-filter-input table-filter-with-icon"
          />
        </div>
        <select className="table-filter-select md:w-auto" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          {ROLE_OPTIONS.map((o) => <option key={o}>{o}</option>)}
        </select>
        <select className="table-filter-select md:w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          {STATUS_OPTIONS.map((o) => <option key={o}>{o}</option>)}
        </select>
      </Card>

      <Card className="space-y-3 border-white/70 bg-white/80 p-3.5 shadow-[0_18px_45px_rgba(79,29,149,0.08)] backdrop-blur-xl md:hidden">
        {filtered.map((u) => (
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
              {statusBadge(u)}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Role</p>
                <div className="mt-1">{roleBadge(u.role)}</div>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Department</p>
                <p className="mt-1 font-medium text-foreground">{u.department}</p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button onClick={() => handleEdit(u)} className="rounded-xl p-2 text-muted-foreground transition-all duration-300 hover:bg-purple-50 hover:text-purple-700"><Edit size={14} /></button>
              <button onClick={() => handleDelete(u)} className="rounded-xl p-2 text-muted-foreground transition-all duration-300 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">No users found.</p>
        )}
      </Card>

      <Card className="hidden overflow-x-auto border-white/70 bg-white/80 shadow-[0_18px_45px_rgba(79,29,149,0.08)] backdrop-blur-xl md:block">
        <table className="w-full min-w-[800px] text-sm">
          <THead cols={["User ID", "Name", "Email", "Role", "Department", "Status", "Actions"]} />
          <tbody className="divide-y divide-border">
            {filtered.map((u) => (
              <tr key={u.id} className="transition-all duration-300 hover:bg-purple-50/45">
                <td className="px-5 py-3.5 font-mono text-xs font-bold text-purple-700">{u.id}</td>
                <td className="px-5 py-3.5 font-semibold text-foreground">{u.name}</td>
                <td className="px-5 py-3.5 text-muted-foreground">{u.email}</td>
                <td className="px-5 py-3.5">{roleBadge(u.role)}</td>
                <td className="px-5 py-3.5 text-muted-foreground">{u.department}</td>
                <td className="px-5 py-3.5">{statusBadge(u)}</td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleEdit(u)} className="rounded-xl p-1.5 text-muted-foreground transition-all duration-300 hover:bg-purple-50 hover:text-purple-700"><Edit size={14} /></button>
                    <button onClick={() => handleDelete(u)} className="rounded-xl p-1.5 text-muted-foreground transition-all duration-300 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">No users found.</p>
        )}
      </Card>
    </div>
  );
}
