import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, CheckCircle2 } from "lucide-react";
import { Card } from "../../components/Card";
import { PageHeader } from "../../components/PageHeader";
import { THead } from "../../components/THead";
import { PURPLE, GRADIENT_PRIMARY } from "../../../config/theme";
import { fetchApprovalOptions, createApprovalOption, updateApprovalOption, deleteApprovalOption } from "../../../services/api";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { notifySuccess, notifyError } from "../../components/notify";

interface Option {
  value: string;
  label: string;
}

export function AdminApprovalOptions() {
  const [options, setOptions] = useState<Option[]>([]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editValue, setEditValue] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newId, setNewId] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [deletingIdx, setDeletingIdx] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { fetchApprovalOptions().then(setOptions).catch((err: Error) => setError(err.message)); }, []);

  const handleAdd = async () => {
    try {
      if (!newId.trim() || !newValue.trim() || !newLabel.trim()) {
        setError("ID, value, and label are all required.");
        return;
      }
      await createApprovalOption({ id: newId.trim(), value: newValue.trim(), label: newLabel.trim() });
      setShowAddDialog(false);
      setNewId("");
      setNewValue("");
      setNewLabel("");
      setOptions(await fetchApprovalOptions());
      notifySuccess("Approval option added.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to add approval option.";
      setError(message);
      notifyError(message);
    }
  };

  const handleEdit = (idx: number) => {
    setEditingIdx(idx);
    setEditValue(options[idx].value);
    setEditLabel(options[idx].label);
  };

  const handleSaveEdit = async () => {
    try {
      if (editingIdx === null || !editValue || !editLabel) return;
      const option = options[editingIdx];
      await updateApprovalOption(option.value, { value: editValue, label: editLabel });
      setOptions(await fetchApprovalOptions());
      setEditingIdx(null);
      notifySuccess("Approval option updated.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save approval option.";
      setError(message);
      notifyError(message);
    }
  };

  const handleDelete = async (idx: number) => {
    try {
      await deleteApprovalOption(options[idx].value);
      setDeletingIdx(null);
      setOptions(await fetchApprovalOptions());
      notifySuccess("Approval option deleted.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete approval option.";
      setError(message);
      notifyError(message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Approval Options Configuration" subtitle="Manage the available approval decision options." />

      <Card className="overflow-hidden border-white/70 bg-white/80 p-0 card-shadow">
        <div className="flex flex-col gap-3 border-b border-border bg-secondary/15 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm">
              <CheckCircle2 size={16} style={{ color: PURPLE }} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Options</p>
              <h3 className="text-sm font-bold text-foreground">Approval Decisions</h3>
            </div>
          </div>
          <button onClick={() => setShowAddDialog(true)}
            className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-white transition-all hover:-translate-y-0.5 sm:w-auto"
            style={{ background: GRADIENT_PRIMARY }}
          >
            <Plus size={13} /> Add
          </button>
        </div>

        <div className="hidden md:block">
          <table className="w-full text-sm">
            <THead cols={["Value", "Label", "Actions"]} />
            <tbody className="divide-y divide-border">
              {options.map((opt, idx) => (
                <tr key={opt.value} className="transition-all hover:bg-purple-50/45">
                  <td className="px-5 py-3">
                    {editingIdx === idx ? (
                      <input value={editValue} onChange={(e) => setEditValue(e.target.value)} className="rounded border px-2 py-1 text-sm w-full" />
                    ) : <span className="font-mono text-xs text-muted-foreground">{opt.value}</span>}
                  </td>
                  <td className="px-5 py-3">
                    {editingIdx === idx ? (
                      <input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} className="rounded border px-2 py-1 text-sm w-full" />
                    ) : <span className="font-medium text-foreground">{opt.label}</span>}
                  </td>
                  <td className="w-32 px-5 py-3">
                    <div className="flex items-center gap-2">
                      {editingIdx === idx ? (
                        <button onClick={handleSaveEdit} className="rounded-xl px-3 py-1 text-xs font-semibold text-white" style={{ background: PURPLE }}>Save</button>
                      ) : (
                        <button onClick={() => handleEdit(idx)} className="rounded-xl p-1.5 text-muted-foreground hover:bg-purple-50 hover:text-purple-700"><Edit size={14} /></button>
                      )}
                      <button onClick={() => setDeletingIdx(idx)} className="rounded-xl p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-2 p-4 md:hidden">
          {options.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No approval options configured.</p>}
          {options.map((opt, idx) => (
            <div key={opt.value} className="group rounded-xl border border-primary/10 bg-white/95 p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-purple-200/70">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  {editingIdx === idx ? (
                    <div className="space-y-2">
                      <input value={editValue} onChange={(e) => setEditValue(e.target.value)} className="w-full rounded border px-2 py-1 text-sm" placeholder="Value" autoFocus />
                      <input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} className="w-full rounded border px-2 py-1 text-sm" placeholder="Label" />
                    </div>
                  ) : (
                    <div>
                      <span className="font-medium text-foreground">{opt.label}</span>
                      <span className="ml-2 font-mono text-xs text-muted-foreground">({opt.value})</span>
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {editingIdx === idx ? (
                    <button onClick={handleSaveEdit} className="rounded-lg px-2.5 py-1 text-xs font-semibold text-white" style={{ background: PURPLE }}>Save</button>
                  ) : (
                    <button onClick={() => handleEdit(idx)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-purple-50 hover:text-purple-700"><Edit size={14} /></button>
                  )}
                  <button onClick={() => setDeletingIdx(idx)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {showAddDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgb(0 0 0 / 0.55)", backdropFilter: "blur(6px)" }}
          onClick={() => setShowAddDialog(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Add approval option"
            className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-bold text-foreground">Add approval option</h2>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-muted-foreground">Unique ID *</span>
                <input type="text" value={newId} onChange={(e) => setNewId(e.target.value)} maxLength={100} className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-purple-500" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-muted-foreground">Value (sent to API) *</span>
                <input type="text" value={newValue} onChange={(e) => setNewValue(e.target.value)} maxLength={100} className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-purple-500" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-muted-foreground">Display label *</span>
                <input type="text" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} maxLength={100} className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-purple-500" />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setShowAddDialog(false)} className="h-10 rounded-xl border border-border bg-white px-4 text-sm font-semibold hover:bg-muted">Cancel</button>
              <button type="button" onClick={handleAdd} className="h-10 rounded-xl bg-purple-700 px-4 text-sm font-semibold text-white hover:opacity-90">Add option</button>
            </div>
          </div>
        </div>
      )}
      {deletingIdx !== null && options[deletingIdx] && (
        <ConfirmDialog
          title="Delete approval option"
          message={`Delete the "${options[deletingIdx].label}" option? This cannot be undone.`}
          confirmLabel="Delete"
          destructive
          onConfirm={() => handleDelete(deletingIdx)}
          onCancel={() => setDeletingIdx(null)}
        />
      )}
    </div>
  );
}