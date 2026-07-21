import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, CheckCircle2 } from "lucide-react";
import { Card } from "../../components/Card";
import { PageHeader } from "../../components/PageHeader";
import { THead } from "../../components/THead";
import { PURPLE } from "../../../config/theme";
import { fetchApprovalOptions, createApprovalOption, updateApprovalOption, deleteApprovalOption } from "../../../services/api";

interface Option {
  value: string;
  label: string;
}

export function AdminApprovalOptions() {
  const [options, setOptions] = useState<Option[]>([]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editValue, setEditValue] = useState("");

  useEffect(() => { fetchApprovalOptions().then(setOptions); }, []);

  const handleAdd = async () => {
    const id = prompt("Enter a unique ID for this option:");
    if (!id) return;
    const value = prompt("Enter the value (sent to API):");
    if (!value) return;
    const label = prompt("Enter the display label:");
    if (!label) return;
    await createApprovalOption({ id, value, label });
    setOptions(await fetchApprovalOptions());
  };

  const handleEdit = (idx: number) => {
    setEditingIdx(idx);
    setEditValue(options[idx].value);
    setEditLabel(options[idx].label);
  };

  const handleSaveEdit = async () => {
    if (editingIdx === null || !editValue || !editLabel) return;
    const option = options[editingIdx];
    await updateApprovalOption(option.value, { value: editValue, label: editLabel });
    setOptions(await fetchApprovalOptions());
    setEditingIdx(null);
  };

  const handleDelete = async (idx: number) => {
    if (!confirm("Delete this option?")) return;
    await deleteApprovalOption(options[idx].value);
    setOptions(await fetchApprovalOptions());
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Approval Options Configuration" subtitle="Manage the available approval decision options." />

      <Card className="overflow-hidden border-white/70 bg-white/80 p-0 shadow-[0_18px_45px_rgba(79,29,149,0.08)] backdrop-blur-xl">
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
          <button onClick={handleAdd}
            className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-white transition-all hover:-translate-y-0.5 sm:w-auto"
            style={{ background: `linear-gradient(135deg, ${PURPLE}, #6d28d9)` }}
          >
            <Plus size={13} /> Add
          </button>
        </div>

        <div className="hidden md:block">
          <table className="w-full text-sm">
            <THead cols={["Value", "Label", "Actions"]} />
            <tbody className="divide-y divide-border">
              {options.map((opt, idx) => (
                <tr key={idx} className="transition-all hover:bg-purple-50/45">
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
                      <button onClick={() => handleDelete(idx)} className="rounded-xl p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
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
            <div key={idx} className="group rounded-xl border border-primary/10 bg-white/95 p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-purple-200/70">
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
                  <button onClick={() => handleDelete(idx)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}