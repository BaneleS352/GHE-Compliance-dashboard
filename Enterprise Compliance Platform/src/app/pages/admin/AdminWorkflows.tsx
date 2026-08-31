import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, ArrowRight, Workflow } from "lucide-react";
import { Card } from "../../components/Card";
import { PageHeader } from "../../components/PageHeader";
import { PURPLE, GRADIENT_PRIMARY } from "../../../config/theme";
import { WorkflowRule } from "../../../types/declaration";
import { fetchWorkflowRules, createWorkflowRule, updateWorkflowRule, deleteWorkflowRule, fetchConfig } from "../../../services/api";

const ROLE_LABELS: Record<string, string> = { lineManager: "Line Manager", hr: "Head of HR" };

export function AdminWorkflows() {
  const [rules, setRules] = useState<WorkflowRule[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [threshold, setThreshold] = useState<{ highValueThreshold: number; maximumValue: number } | null>(null);

  useEffect(() => { fetchWorkflowRules().then(setRules).catch((err: Error) => setError(err.message)); }, []);
  useEffect(() => { fetchConfig().then((c) => setThreshold({ highValueThreshold: c.highValueThreshold, maximumValue: (c as any).maximumValue ?? 1000000 })).catch(() => {}); }, []);

  const handleAdd = async () => {
    try {
      const newRule: WorkflowRule = {
        id: `rule-${Date.now()}`,
        name: "New Rule",
        condition: "gift",
        priority: rules.length + 1,
        steps: [{ order: 1, role: "lineManager", label: "Line Manager Review" }],
      };
      await createWorkflowRule(newRule);
      fetchWorkflowRules().then(setRules).catch((err: Error) => setError(err.message));
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleEditClick = (rule: WorkflowRule) => {
    setEditingId(rule.id);
    setEditName(rule.name);
  };

  const handleSaveEdit = async (id: string) => {
    try {
      await updateWorkflowRule(id, { name: editName });
      setEditingId(null);
      fetchWorkflowRules().then(setRules).catch((err: Error) => setError(err.message));
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this workflow rule?")) return;
    try {
      await deleteWorkflowRule(id);
      fetchWorkflowRules().then(setRules).catch((err: Error) => setError(err.message));
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approval Workflows"
        subtitle="Configure conditional routing and approver tiers for declarations."
        actions={
          <button onClick={handleAdd}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(79,29,149,0.28)] sm:w-auto"
            style={{ background: GRADIENT_PRIMARY, border: "1px solid transparent" }}
          >
            <Plus size={15} /> New Workflow
          </button>
        }
      />

      {threshold && (
        <Card className="border-purple-200/50 bg-purple-50/50 p-4">
          <p className="text-sm text-purple-900">
            <span className="font-bold">Current thresholds from System Configuration:</span> High Value = R{threshold.highValueThreshold.toLocaleString("en-ZA").replace(/,/g, " ")} (above → Line Manager + HR, below → Line Manager only) • Maximum = R{threshold.maximumValue.toLocaleString("en-ZA").replace(/,/g, " ")} (blocked above). Changing System Configuration affects new declarations (existing workflows frozen).
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-5">
        {rules
          .filter((r) => {
            try {
              const steps: any[] = JSON.parse((r as any).steps ?? "[]");
              return !steps.some((s: any) => s.role === "ceo" || s.label?.toLowerCase().includes("ceo"));
            } catch {
              return true;
            }
          })
          .map((rule) => (
          <Card key={rule.id} className="group flex flex-col justify-between gap-4 border-white/70 bg-white/80 p-5 card-shadow transition-all md:flex-row md:items-center">
            <div className="flex flex-1 gap-4">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-secondary shadow-sm transition-transform group-hover:scale-105 group-hover:bg-purple-100">
                <Workflow size={18} style={{ color: PURPLE }} />
              </div>
              <div className="flex-1">
                {editingId === rule.id ? (
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} className="text-base font-bold rounded border px-2 py-1 w-full mb-2" />
                ) : (
                  <h3 className="text-base font-bold text-foreground">{rule.name}</h3>
                )}
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Condition: {rule.condition}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {rule.steps.map((step, idx) => (
                    <div key={`${step.order}-${step.role}`} className="flex items-center gap-2">
                      <span className="rounded-xl border border-primary/10 bg-secondary/20 px-3 py-1.5 text-sm font-medium text-foreground shadow-sm">
                        {step.order}. {step.label}
                      </span>
                      {idx < rule.steps.length - 1 && <ArrowRight size={14} className="text-muted-foreground" />}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-2 flex w-full flex-col gap-2 md:mt-0 md:w-auto md:self-start md:flex-row">
              {editingId === rule.id ? (
                <button onClick={() => handleSaveEdit(rule.id)} className="flex h-9 items-center justify-center gap-1 rounded-xl px-3 text-xs font-semibold text-white" style={{ background: PURPLE }}>
                  Save
                </button>
              ) : (
                <button onClick={() => handleEditClick(rule)} className="flex h-9 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold shadow-sm hover:-translate-y-0.5 hover:border-purple-200 hover:bg-purple-50 hover:text-purple-700">
                  <Edit size={13} /> Edit
                </button>
              )}
              <button onClick={() => handleDelete(rule.id)} className="flex h-9 items-center justify-center gap-1 rounded-xl border border-red-100 bg-red-50 px-3 text-xs font-semibold text-red-600 hover:-translate-y-0.5 hover:bg-red-100">
                <Trash2 size={13} /> Delete
              </button>
            </div>
          </Card>
        ))}
      </div>
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    </div>
  );
}
