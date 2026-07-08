import { useState } from "react";
import { Plus, Edit, Trash2, ArrowRight, Workflow } from "lucide-react";
import { Card } from "../../components/Card";
import { PageHeader } from "../../components/PageHeader";
import { PURPLE } from "../../../config/theme";

export function AdminWorkflows() {
  const [workflows] = useState([
    { id: 1, name: "Standard Gift (< R2000)", tiers: ["Line Manager"] },
    { id: 2, name: "High Value Gift (> R2000)", tiers: ["Line Manager", "Head of HR", "Group CEO"] },
    { id: 3, name: "Hospitality Request", tiers: ["Line Manager", "Head of HR"] },
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approval Workflows"
        subtitle="Configure conditional routing and approver tiers for declarations."
        actions={
          <button
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(79,29,149,0.28)] sm:w-auto"
            style={{ background: `linear-gradient(135deg, ${PURPLE}, #6d28d9)`, border: "1px solid transparent" }}
          >
            <Plus size={15} /> New Workflow
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-5">
        {workflows.map((wf) => (
          <Card
            key={wf.id}
            className="group flex flex-col justify-between gap-4 border-white/70 bg-white/80 p-5 shadow-[0_18px_45px_rgba(79,29,149,0.08)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_55px_rgba(79,29,149,0.12)] md:flex-row md:items-center"
          >
            <div className="flex flex-1 gap-4">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-secondary shadow-sm transition-transform duration-300 group-hover:scale-105 group-hover:bg-purple-100">
                <Workflow size={18} style={{ color: PURPLE }} />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-foreground">{wf.name}</h3>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Routing Tiers</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {wf.tiers.map((tier, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="rounded-xl border border-primary/10 bg-secondary/20 px-3 py-1.5 text-sm font-medium text-foreground shadow-sm">
                        {idx + 1}. {tier}
                      </span>
                      {idx < wf.tiers.length - 1 && <ArrowRight size={14} className="text-muted-foreground" />}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-2 flex w-full flex-col gap-2 md:mt-0 md:w-auto md:self-start md:flex-row">
              <button className="flex h-9 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-purple-200 hover:bg-purple-50 hover:text-purple-700">
                <Edit size={13} /> Edit
              </button>
              <button className="flex h-9 items-center justify-center gap-1 rounded-xl border border-red-100 bg-red-50 px-3 text-xs font-semibold text-red-600 transition-all duration-300 hover:-translate-y-0.5 hover:bg-red-100">
                <Trash2 size={13} /> Delete
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
