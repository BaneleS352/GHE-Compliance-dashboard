import { useState, useEffect } from "react";
import { Save, Shield, Mail } from "lucide-react";
import { Card } from "../../components/Card";
import { PageHeader } from "../../components/PageHeader";
import { PURPLE } from "../../../config/theme";
import { getConfig, saveConfig } from "../../../data/db";
import { SystemConfig } from "../../../types/declaration";

export function AdminConfig() {
  const [config, setConfig] = useState<SystemConfig>(getConfig());
  const [saved, setSaved] = useState(false);

  useEffect(() => { setConfig(getConfig()); }, []);

  const handleSave = () => {
    saveConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Configuration"
        subtitle="Manage global application configuration."
        actions={
          <button onClick={handleSave}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(79,29,149,0.28)] sm:w-auto"
            style={{ background: `linear-gradient(135deg, ${PURPLE}, #6d28d9)`, border: "1px solid transparent" }}
          >
            <Save size={15} /> {saved ? "Saved!" : "Save Changes"}
          </button>
        }
      />

      {saved && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          Configuration saved successfully.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-white/70 bg-white/80 p-6 shadow-[0_18px_45px_rgba(79,29,149,0.08)] backdrop-blur-xl">
          <div className="mb-5 flex items-center gap-3 border-b border-border pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary shadow-sm">
              <Shield className="text-purple-600" size={18} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Policy Controls</p>
              <h3 className="text-base font-bold">Compliance Thresholds</h3>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground">High Value Gift Threshold (ZAR)</label>
              <input type="number" value={config.highValueThreshold} onChange={(e) => setConfig({ ...config, highValueThreshold: Number(e.target.value) })} className="h-11 w-full rounded-xl border border-border bg-white/90 px-4 transition-all focus:border-purple-300 focus:outline-none focus:ring-4 focus:ring-purple-500/10" />
              <p className="mt-1 text-xs text-muted-foreground">Declarations above this value require CEO approval.</p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground">SLA Escalation Time (Days)</label>
              <input type="number" value={config.slaEscalationDays} onChange={(e) => setConfig({ ...config, slaEscalationDays: Number(e.target.value) })} className="h-11 w-full rounded-xl border border-border bg-white/90 px-4 transition-all focus:border-purple-300 focus:outline-none focus:ring-4 focus:ring-purple-500/10" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground">Max Declarations per Counterparty (Annual)</label>
              <input type="number" value={config.maxDeclarationsPerCounterparty} onChange={(e) => setConfig({ ...config, maxDeclarationsPerCounterparty: Number(e.target.value) })} className="h-11 w-full rounded-xl border border-border bg-white/90 px-4 transition-all focus:border-purple-300 focus:outline-none focus:ring-4 focus:ring-purple-500/10" />
            </div>
          </div>
        </Card>

        <Card className="border-white/70 bg-white/80 p-6 shadow-[0_18px_45px_rgba(79,29,149,0.08)] backdrop-blur-xl lg:col-span-2">
          <div className="mb-5 flex items-center gap-3 border-b border-border pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary shadow-sm">
              <Mail className="text-purple-600" size={18} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Communications</p>
              <h3 className="text-base font-bold">Email Templates</h3>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground">Approval Request Template</label>
              <textarea
                rows={5}
                value={config.emailTemplate}
                onChange={(e) => setConfig({ ...config, emailTemplate: e.target.value })}
                className="w-full rounded-2xl border border-border bg-white/90 p-4 font-mono text-xs transition-all focus:border-purple-300 focus:outline-none focus:ring-4 focus:ring-purple-500/10"
              />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
