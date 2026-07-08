import { useState } from "react";
import { Plus, Edit, Trash2, ListTree } from "lucide-react";
import { Card } from "../../components/Card";
import { PageHeader } from "../../components/PageHeader";
import { THead } from "../../components/THead";
import { PURPLE } from "../../../config/theme";

export function AdminDropdowns() {
  const [activeTab, setActiveTab] = useState("Departments");

  const data: Record<string, string[]> = {
    Departments: ["Marketing", "Sales", "IT", "HR", "Finance", "Legal"],
    Categories: ["Gift", "Hospitality", "Entertainment"],
    Occasions: ["Festive Season", "Year End", "Milestone", "Business Meeting", "Relationship Maintenance"],
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dropdown Data Configuration"
        subtitle="Manage the options available in the declaration form dropdowns."
      />

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {Object.keys(data).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`shrink-0 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all duration-300 ${
              activeTab === tab
                ? "border-purple-200 bg-purple-50 text-purple-900 shadow-sm"
                : "border-white/70 bg-white/70 text-muted-foreground hover:border-purple-100 hover:bg-white hover:text-foreground"
            }`}
          >
            {tab}
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
              <h3 className="text-sm font-bold text-foreground">{activeTab} List</h3>
            </div>
          </div>
          <button
            className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(79,29,149,0.22)] sm:w-auto"
            style={{ background: `linear-gradient(135deg, ${PURPLE}, #6d28d9)`, border: "1px solid transparent" }}
          >
            <Plus size={13} /> Add {activeTab.slice(0, -1)}
          </button>
        </div>

        <div className="space-y-3 p-3.5 md:hidden">
          {data[activeTab].map((item, idx) => (
            <div key={idx} className="group rounded-2xl border border-primary/10 bg-white/95 p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-purple-200/70 hover:shadow-[0_14px_35px_rgba(79,29,149,0.08)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{item}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{activeTab.slice(0, -1)} option</p>
                </div>
                <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-800">Active</span>
              </div>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button className="rounded-xl p-2 text-muted-foreground transition-all duration-300 hover:bg-purple-50 hover:text-purple-700"><Edit size={14} /></button>
                <button className="rounded-xl p-2 text-muted-foreground transition-all duration-300 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>

        <div className="hidden md:block">
          <table className="w-full text-sm">
            <THead cols={["Option Name", "Status", "Actions"]} />
            <tbody className="divide-y divide-border">
              {data[activeTab].map((item, idx) => (
                <tr key={idx} className="transition-all duration-300 hover:bg-purple-50/45">
                  <td className="px-5 py-3 font-medium text-foreground">{item}</td>
                  <td className="px-5 py-3">
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-800">Active</span>
                  </td>
                  <td className="w-32 px-5 py-3">
                    <div className="flex items-center gap-2">
                      <button className="rounded-xl p-1.5 text-muted-foreground transition-all duration-300 hover:bg-purple-50 hover:text-purple-700"><Edit size={14} /></button>
                      <button className="rounded-xl p-1.5 text-muted-foreground transition-all duration-300 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
