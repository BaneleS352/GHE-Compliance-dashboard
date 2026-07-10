import { useState, useEffect } from "react";
import { Search, Plus, Edit, Trash2, UserRound } from "lucide-react";
import { Card } from "../../components/Card";
import { PageHeader } from "../../components/PageHeader";
import { THead } from "../../components/THead";
import { PURPLE } from "../../../config/theme";
import { User } from "../../../types/declaration";
import { getUsers, addUser, updateUser, deleteUser } from "../../../data/db";
import { hashPassword } from "../../auth/authService";

export function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", role: "", department: "", teamMemberNumber: "", position: "" });

  const refresh = () => setUsers(getUsers());

  useEffect(refresh, []);

  const filtered = users.filter((u) => {
    const matchesSearch = !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()) || u.id.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === "All" || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleAdd = () => {
    const newUser: User = {
      id: `user-${Date.now()}`,
      name: "New User",
      email: "new@hb.co.za",
      passwordHash: hashPassword("password"),
      role: "teamMember",
      teamMemberNumber: "HB-00000",
      department: "General",
      position: "Team Member",
      lineManager: null,
    };
    addUser(newUser);
    refresh();
  };

  const handleEdit = (u: User) => {
    setEditingId(u.id);
    setEditForm({ name: u.name, email: u.email, role: u.role, department: u.department, teamMemberNumber: u.teamMemberNumber, position: u.position });
  };

  const handleSave = (id: string) => {
    updateUser(id, {
      name: editForm.name,
      email: editForm.email,
      role: editForm.role as User["role"],
      department: editForm.department,
      teamMemberNumber: editForm.teamMemberNumber,
      position: editForm.position,
    });
    setEditingId(null);
    refresh();
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this user?")) {
      deleteUser(id);
      refresh();
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        subtitle="Manage system users, roles, and permissions."
        actions={
          <button onClick={handleAdd}
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
          <input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-10 w-full rounded-xl border border-border bg-white/90 pl-9 pr-4 text-sm transition-all focus:border-purple-300 focus:outline-none focus:ring-4 focus:ring-purple-500/10" />
        </div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="h-10 w-full rounded-xl border border-border bg-white/90 px-3.5 text-sm md:w-auto">
          <option value="All">All Roles</option>
          <option value="teamMember">Team Member</option>
          <option value="approver">Approver</option>
          <option value="admin">Administrator</option>
        </select>
      </Card>

      <Card className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[800px] text-sm">
          <THead cols={["User ID", "Name", "Email", "Role", "Department", "Actions"]} />
          <tbody className="divide-y divide-border">
            {filtered.map((u) => (
              <tr key={u.id} className="transition-all duration-300 hover:bg-purple-50/45">
                <td className="px-5 py-3.5 font-mono text-xs font-bold text-purple-700">{u.id}</td>
                <td className="px-5 py-3.5">
                  {editingId === u.id ? (
                    <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full rounded border px-2 py-1 text-sm" />
                  ) : <span className="font-semibold text-foreground">{u.name}</span>}
                </td>
                <td className="px-5 py-3.5 text-muted-foreground">{u.email}</td>
                <td className="px-5 py-3.5">
                  {editingId === u.id ? (
                    <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} className="rounded border px-2 py-1 text-sm">
                      <option value="teamMember">Team Member</option>
                      <option value="approver">Approver</option>
                      <option value="admin">Administrator</option>
                    </select>
                  ) : (
                    <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                      u.role === "admin" ? "bg-purple-100 text-purple-800" : u.role === "approver" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"
                    }`}>
                      {u.role === "admin" ? "Administrator" : u.role === "approver" ? "Approver" : "Team Member"}
                    </span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-muted-foreground">{u.department}</td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    {editingId === u.id ? (
                      <button onClick={() => handleSave(u.id)} className="rounded-xl px-3 py-1 text-xs font-semibold text-white" style={{ background: PURPLE }}>Save</button>
                    ) : (
                      <button onClick={() => handleEdit(u)} className="rounded-xl p-1.5 text-muted-foreground hover:bg-purple-50 hover:text-purple-700"><Edit size={14} /></button>
                    )}
                    <button onClick={() => handleDelete(u.id)} className="rounded-xl p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
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
