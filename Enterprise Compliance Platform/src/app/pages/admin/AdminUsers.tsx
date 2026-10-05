import { useState, useMemo, useEffect } from "react";
import { Search, Plus, Edit, Trash2, UserRound } from "lucide-react";
import { Card } from "../../components/Card";
import { PageHeader } from "../../components/PageHeader";
import { THead } from "../../components/THead";
import { PURPLE, GRADIENT_PRIMARY } from "../../../config/theme";
import { fetchUsers, createUser, updateUser, deleteUser, fetchAdminOrganizations } from "../../../services/api";
import { User } from "../../../types/declaration";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { UserDialog } from "./UserDialog";
import { notifySuccess, notifyError } from "../../components/notify";

const ROLE_MAP: Record<string, string> = {
  teamMember: "Team Member",
  approver: "Approver",
  admin: "Administrator",
};

const ROLE_OPTIONS = ["All Roles", "Team Member", "Approver", "Administrator"];

export function AdminUsers() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All Roles");
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<{ id: number; name: string; shortCode: string }[]>([]);
  // Dialog state: application-styled dialogs replace browser prompt/confirm.
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  useEffect(() => {
    fetchUsers().then(setUsers).catch((err: Error) => setError(err.message));
    fetchAdminOrganizations().then(setOrganizations).catch(() => {});
  }, []);

  const refresh = () => fetchUsers().then(setUsers).catch((err: Error) => setError(err.message));

  const filtered = useMemo(() => {
    let list = users;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          String(u.id).toLowerCase().includes(q)
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
    return list;
  }, [users, search, roleFilter]);

  const handleAdd = async (data: { name: string; email: string; role: User["role"]; department: string; organizationId: number | null }) => {
    try {
      await createUser({
        name: data.name,
        email: data.email,
        role: data.role,
        department: data.department,
        teamMemberNumber: "",
        position: "",
        lineManager: null,
        organizationId: data.organizationId,
      });
      setShowAddDialog(false);
      notifySuccess(`User "${data.name}" added.`);
      refresh();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to add user.";
      setError(message);
      notifyError(message);
      throw e;
    }
  };

  const handleEdit = async (user: User, data: { name: string; email: string; role: User["role"]; department: string; organizationId: number | null }) => {
    try {
      await updateUser(user.id, { name: data.name, email: data.email, role: data.role, department: data.department, organizationId: data.organizationId });
      setEditingUser(null);
      notifySuccess(`User "${data.name}" updated.`);
      refresh();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to update user.";
      setError(message);
      notifyError(message);
      throw e;
    }
  };

  const handleDelete = async (user: User) => {
    try {
      await deleteUser(user.id);
      setDeletingUser(null);
      notifySuccess(`User "${user.name}" deleted.`);
      refresh();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to delete user.";
      setError(message);
      notifyError(message);
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

  const statusBadge = () => (
    <span className="rounded-full px-2 py-1 text-[10px] font-bold bg-emerald-100 text-emerald-800">Active</span>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        subtitle="Manage system users, roles, and permissions."
        actions={
          <button
            onClick={() => setShowAddDialog(true)}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(79,29,149,0.28)] sm:w-auto"
            style={{ background: GRADIENT_PRIMARY, border: "1px solid transparent" }}
          >
            <Plus size={15} /> Add User
          </button>
        }
      />

      <Card className="flex flex-col gap-3 border-white/70 bg-white/80 p-3.5 card-shadow md:flex-row">
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
      </Card>

      <Card className="space-y-3 border-white/70 bg-white/80 p-3.5 card-shadow md:hidden">
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
              {statusBadge()}
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
              <button onClick={() => setEditingUser(u)} className="rounded-xl p-2 text-muted-foreground transition-all duration-300 hover:bg-purple-50 hover:text-purple-700"><Edit size={14} /></button>
              <button onClick={() => setDeletingUser(u)} className="rounded-xl p-2 text-muted-foreground transition-all duration-300 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">No users found.</p>
        )}
      </Card>

      <Card className="hidden overflow-x-auto border-white/70 bg-white/80 card-shadow md:block">
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
                <td className="px-5 py-3.5">{statusBadge()}</td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setEditingUser(u)} className="rounded-xl p-1.5 text-muted-foreground transition-all duration-300 hover:bg-purple-50 hover:text-purple-700"><Edit size={14} /></button>
                    <button onClick={() => setDeletingUser(u)} className="rounded-xl p-1.5 text-muted-foreground transition-all duration-300 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
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
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {showAddDialog && (
        <UserDialog
          user={null}
          organizations={organizations}
          onSave={handleAdd}
          onCancel={() => setShowAddDialog(false)}
        />
      )}
      {editingUser && (
        <UserDialog
          user={editingUser}
          organizations={organizations}
          onSave={(data) => handleEdit(editingUser, data)}
          onCancel={() => setEditingUser(null)}
        />
      )}
      {deletingUser && (
        <ConfirmDialog
          title="Delete user"
          message={`Delete user "${deletingUser.name}" (${deletingUser.id})? This cannot be undone.`}
          confirmLabel="Delete"
          destructive
          onConfirm={() => handleDelete(deletingUser)}
          onCancel={() => setDeletingUser(null)}
        />
      )}
    </div>
  );
}
