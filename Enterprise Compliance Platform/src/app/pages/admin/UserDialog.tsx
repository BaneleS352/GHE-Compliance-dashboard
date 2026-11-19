import { useEffect, useRef, useState } from "react";
import { F } from "@/config/theme";
import { fetchDepartments } from "@/services/api";
import type { User } from "@/types/declaration";
import { useDialogFocus } from "@/app/hooks/useDialogFocus";

const ROLES = [
  { value: "teamMember", label: "Team Member" },
  { value: "approver", label: "Approver" },
  { value: "admin", label: "Administrator" },
] as const;

/**
 * Application-styled user create/edit dialog (Phase 3). Replaces the
 * browser `prompt()` chain: validated inputs, organization select, and an
 * organization-scoped department select (Phase 6: no free-text department
 * entry — department names come from the normalized department master data).
 */
export function UserDialog({
  user,
  organizations,
  onSave,
  onCancel,
}: {
  user: User | null;
  organizations: { id: number; name: string; shortCode: string }[];
  onSave: (data: { name: string; email: string; role: User["role"]; department: string; organizationId: number | null }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState<User["role"]>((user?.role as User["role"]) ?? "teamMember");
  const [orgId, setOrgId] = useState<string>(user?.organizationId ? String(user.organizationId) : "");
  const previousOrgId = useRef(orgId);
  const [department, setDepartment] = useState(user?.department ?? "");
  const [departments, setDepartments] = useState<string[]>([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);
  const [departmentError, setDepartmentError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dialogRef = useDialogFocus<HTMLDivElement>({ onEscape: onCancel });

  useEffect(() => {
    const controller = new AbortController();
    const organizationChanged = previousOrgId.current !== orgId;
    previousOrgId.current = orgId;
    if (!orgId) {
      setDepartments([]);
      setDepartment("");
      setDepartmentError(null);
      setDepartmentsLoading(false);
      return () => controller.abort();
    }
    setDepartments([]);
    if (organizationChanged) setDepartment("");
    setDepartmentError(null);
    setDepartmentsLoading(true);
    fetchDepartments(Number(orgId), { signal: controller.signal })
      .then((names) => {
        if (controller.signal.aborted) return;
        setDepartments(names);
        // Keep the current value only when it belongs to this organization.
        setDepartment((d) => (d && names.includes(d) ? d : ""));
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setDepartmentError("Departments could not be loaded. Retry by changing the organization or closing and reopening this dialog.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setDepartmentsLoading(false);
      });
    return () => controller.abort();
  }, [orgId]);

  const submit = async () => {
    if (!name.trim()) {
      setFormError("Name is required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFormError("Enter a valid email address.");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        email: email.trim(),
        role,
        department,
        organizationId: orgId ? Number(orgId) : null,
      });
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to save user.");
      setSaving(false);
    }
  };

  const input = "h-10 w-full rounded-xl border border-border bg-white px-3 text-sm text-foreground outline-none focus:border-purple-500";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgb(0 0 0 / 0.55)", backdropFilter: "blur(6px)" }}
      onClick={onCancel}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={user ? "Edit user" : "Add user"}
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
        style={F}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-bold text-foreground">{user ? "Edit user" : "Add user"}</h2>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Name *</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} className={input} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Email *</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} className={input} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-muted-foreground">Role</span>
              <select value={role} onChange={(e) => setRole(e.target.value as User["role"])} className={input}>
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-muted-foreground">Organization</span>
              <select value={orgId} onChange={(e) => setOrgId(e.target.value)} className={input}>
                <option value="">Global (no organization)</option>
                {organizations.map((o) => <option key={o.id} value={o.id}>{o.shortCode} — {o.name}</option>)}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Department</span>
            <select value={department} onChange={(e) => setDepartment(e.target.value)} className={input} disabled={!orgId || departmentsLoading || Boolean(departmentError)}>
              <option value="">{!orgId ? "Select an organization first" : departmentsLoading ? "Loading departments…" : "Select department…"}</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            {departmentError && <span role="alert" className="mt-1 block text-xs text-red-700">{departmentError}</span>}
          </label>
        </div>
        {formError && <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-10 rounded-xl border border-border bg-white px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving || departmentsLoading || Boolean(departmentError)}
            className="h-10 rounded-xl bg-purple-700 px-4 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "Saving…" : user ? "Save changes" : "Add user"}
          </button>
        </div>
      </div>
    </div>
  );
}
