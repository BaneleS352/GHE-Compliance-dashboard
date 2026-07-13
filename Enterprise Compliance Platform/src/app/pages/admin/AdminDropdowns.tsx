import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, ListTree } from "lucide-react";
import { Card } from "../../components/Card";
import { PageHeader } from "../../components/PageHeader";
import { THead } from "../../components/THead";
import { PURPLE } from "../../../config/theme";
import { getDropdowns, updateDropdowns } from "../../../data/db";

export function AdminDropdowns() {
  const [activeTab, setActiveTab] = useState("departments");
  const [data, setData] = useState(getDropdowns());
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  const tabs = Object.keys(data) as (keyof typeof data)[];

  useEffect(() => { setData(getDropdowns()); }, []);

  const currentList = data[activeTab] || [];

  const handleAdd = () => {
    const item = prompt(`Add new ${activeTab.slice(0, -1)}:`);
    if (!item) return;
    const updated = { ...data, [activeTab]: [...currentList, item] };
    setData(updated);
    updateDropdowns(updated);
  };

  const handleEdit = (idx: number) => {
    setEditingIdx(idx);
    setEditValue(currentList[idx]);
  };

  const handleSaveEdit = () => {
    if (editingIdx === null || !editValue) return;
    const list = [...currentList];
    list[editingIdx] = editValue;
    const updated = { ...data, [activeTab]: list };
    setData(updated);
    updateDropdowns(updated);
    setEditingIdx(null);
  };

  const handleDelete = (idx: number) => {
    if (!confirm("Delete this option?")) return;
    const list = currentList.filter((_, i) => i !== idx);
    const updated = { ...data, [activeTab]: list };
    setData(updated);
    updateDropdowns(updated);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Dropdown Data Configuration" subtitle="Manage the options available in the declaration form dropdowns." />

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => (
          <button key={tab}
            onClick={() => setActiveTab(tab)}
            className={`shrink-0 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all ${
              activeTab === tab ? "border-purple-200 bg-purple-50 text-purple-900 shadow-sm" : "border-white/70 bg-white/70 text-muted-foreground hover:border-purple-100 hover:bg-white"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden border-white/70 bg-white/80 p-0 shadow-[0_18px_45px_rgba(79,29,149,0.08)] backdrop-blur-xl">
        <div className="flex flex-col gap-3 border-b border-border bg-secondary/15 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm">
              <ListTree size={16} style={{ color: PURPLE }} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Reference List</p>
              <h3 className="text-sm font-bold text-foreground">{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h3>
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
            <THead cols={["Option Name", "Actions"]} />
            <tbody className="divide-y divide-border">
              {currentList.map((item, idx) => (
                <tr key={idx} className="transition-all hover:bg-purple-50/45">
                  <td className="px-5 py-3">
                    {editingIdx === idx ? (
                      <input value={editValue} onChange={(e) => setEditValue(e.target.value)} className="rounded border px-2 py-1 text-sm w-full" />
                    ) : <span className="font-medium text-foreground">{item}</span>}
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
          {currentList.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No items in this list.</p>}
          {currentList.map((item, idx) => (
            <div key={idx} className="group rounded-xl border border-primary/10 bg-white/95 p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-purple-200/70">
              <div className="flex items-center justify-between gap-3">
                {editingIdx === idx ? (
                  <input value={editValue} onChange={(e) => setEditValue(e.target.value)} className="flex-1 rounded border px-2 py-1 text-sm" autoFocus />
                ) : (
                  <span className="text-sm font-medium text-foreground">{item}</span>
                )}
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
