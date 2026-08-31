import { useState, useEffect } from "react";
import { Save, Shield, Mail, ChevronDown, ChevronRight, Building2, Plus, Pencil, Trash2 } from "lucide-react";
import { Card } from "../../components/Card";
import { PageHeader } from "../../components/PageHeader";
import { PURPLE, GRADIENT_PRIMARY } from "../../../config/theme";
import { fetchConfig, saveConfig, fetchAdminOrganizations, createOrganization, updateOrganization, deleteOrganization } from "../../../services/api";
import { SystemConfig, NotificationTemplates } from "../../../types/declaration";

const DEFAULT_NOTIFICATION_TEMPLATES: NotificationTemplates = {
  managerApproval: {
    subject: "GHE Declaration – Approval Required - [Declaration ID]",
    body: "Hi [Approving Manager Name],\n\nA new Gift, Hospitality and Entertainment (GHE) declaration has been submitted by [Team Member Name] and requires your attention.\n\nPlease access the GHE Declaration App using the link below to review and action the declaration.\n\n[Review Declaration]\n\nKind regards,\nGHE Declaration System\n\nThis is an automated notification. Please do not reply to this email.",
  },
  hrApproval: {
    subject: "GHE Declaration – HR Approval Required - [Declaration ID]",
    body: "Hi [HR Approver Name],\n\nA Gift, Hospitality and Entertainment (GHE) declaration has been submitted for HR approval and requires your attention.\n\nPlease access the GHE Declaration App using the link below to review and action the declaration.\n\n[Review Declaration]\n\nKind regards,\nGHE Declaration System\n\nThis is an automated notification. Please do not reply to this email.",
  },
  declarationReturned: {
    subject: "GHE Declaration – Action Required - [Declaration ID]",
    body: "Hi [Team Member Name],\n\nYour Gift, Hospitality and Entertainment (GHE) declaration has been returned and requires your attention.\n\nPlease access the GHE Declaration App using the link below to review the feedback, make the required changes and resubmit your declaration.\n\n[Review Declaration]\n\nKind regards,\nGHE Declaration System\n\nThis is an automated notification. Please do not reply to this email.",
  },
  declarationDeclined: {
    subject: "GHE Declaration – Declined - [Declaration ID]",
    body: "Hi [Team Member Name],\n\nYour Gift, Hospitality and Entertainment (GHE) declaration has been reviewed and declined.\n\nPlease access the GHE Declaration App using the link below to view the outcome and any relevant feedback.\n\n[View Declaration]\n\nKind regards,\nGHE Declaration System\n\nThis is an automated notification. Please do not reply to this email.",
  },
  declarationApproved: {
    subject: "GHE Declaration – Approved - [Declaration ID]",
    body: "Hi [Team Member Name],\n\nYour Gift, Hospitality and Entertainment (GHE) declaration has completed the required approval process and has been [Manager Approval Option].\n\nPlease access the GHE Declaration App using the link below to view your declaration.\n\n[View Declaration]\n\nKind regards,\nGHE Declaration System\n\nThis is an automated notification. Please do not reply to this email.",
  },
};

const TEMPLATE_LABELS: Record<string, string> = {
  managerApproval: "1. Manager Approval Required",
  hrApproval: "2. HR Approval Required",
  declarationReturned: "3. Declaration Returned",
  declarationDeclined: "4. Declaration Declined",
  declarationApproved: "5. Declaration Approved",
};

export function AdminConfig() {
  const [config, setConfig] = useState<SystemConfig>({
    highValueThreshold: 1000,
    mediumValueThreshold: 1000,
    slaEscalationDays: 7,
    maxDeclarationsPerCounterparty: 10,
    maximumValue: 1000000,
    emailTemplate: "",
    notificationTemplates: JSON.stringify(DEFAULT_NOTIFICATION_TEMPLATES),
  });
  const [saved, setSaved] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<{ id: string; name: string; shortCode: string }[]>([]);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgShortCode, setNewOrgShortCode] = useState("");
  const [editingOrg, setEditingOrg] = useState<{ id: string; name: string; shortCode: string } | null>(null);

  useEffect(() => { fetchConfig().then(setConfig).catch((err: Error) => setFetchError(err.message)); }, []);
  useEffect(() => { fetchAdminOrganizations().then(setOrganizations).catch(() => {}); }, []);

  const parsedTemplates: NotificationTemplates = (() => {
    try { return JSON.parse(config.notificationTemplates); } catch { return DEFAULT_NOTIFICATION_TEMPLATES; }
  })();

  const updateTemplate = (key: keyof NotificationTemplates, field: "subject" | "body", value: string) => {
    const updated = { ...parsedTemplates, [key]: { ...parsedTemplates[key], [field]: value } };
    setConfig({ ...config, notificationTemplates: JSON.stringify(updated) });
  };

  const handleSave = async () => {
    try {
      await saveConfig(config);
      setSaved(true);
      const t = setTimeout(() => setSaved(false), 2000);
      return () => clearTimeout(t);
    } catch (err: any) {
      setFetchError(err.message || "Failed to save configuration.");
    }
  };

  const handleAddOrg = async () => {
    if (!newOrgName.trim() || !newOrgShortCode.trim()) return;
    try {
      const created = await createOrganization({ name: newOrgName.trim(), shortCode: newOrgShortCode.trim() });
      setOrganizations([...organizations, created]);
      setNewOrgName("");
      setNewOrgShortCode("");
    } catch (err: any) {
      setFetchError(err.message || "Failed to create organization.");
    }
  };

  const handleUpdateOrg = async () => {
    if (!editingOrg) return;
    try {
      const updated = await updateOrganization(editingOrg.id, { name: editingOrg.name, shortCode: editingOrg.shortCode });
      setOrganizations(organizations.map((o) => o.id === updated.id ? updated : o));
      setEditingOrg(null);
    } catch (err: any) {
      setFetchError(err.message || "Failed to update organization.");
    }
  };

  const handleDeleteOrg = async (id: string) => {
    try {
      await deleteOrganization(id);
      setOrganizations(organizations.filter((o) => o.id !== id));
    } catch (err: any) {
      setFetchError(err.message || "Failed to delete organization.");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Configuration"
        subtitle="Manage global application configuration."
        actions={
          <button onClick={handleSave}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(79,29,149,0.28)] sm:w-auto"
            style={{ background: GRADIENT_PRIMARY, border: "1px solid transparent" }}
          >
            <Save size={15} /> {saved ? "Saved!" : "Save Changes"}
          </button>
        }
      />

      {fetchError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {fetchError}
        </div>
      )}
      {saved && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          Configuration saved successfully.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-white/70 bg-white/80 p-6 card-shadow">
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
              <p className="mt-1 text-xs text-muted-foreground">Declarations above this value require HR approval. Affects new declarations’ workflow routing (LM → HR). Existing workflows are frozen.</p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground">Maximum Value (ZAR)</label>
              <input type="number" value={config.maximumValue ?? 1000000} onChange={(e) => setConfig({ ...config, maximumValue: Number(e.target.value) })} className="h-11 w-full rounded-xl border border-border bg-white/90 px-4 transition-all focus:border-purple-300 focus:outline-none focus:ring-4 focus:ring-purple-500/10" />
              <p className="mt-1 text-xs text-muted-foreground">Declarations above this value are blocked. Shown as “Maximum value exceeded” in the New Declaration form.</p>
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

        <Card className="border-white/70 bg-white/80 p-6 card-shadow lg:col-span-2">
          <div className="mb-5 flex items-center gap-3 border-b border-border pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary shadow-sm">
              <Mail className="text-purple-600" size={18} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Communications</p>
              <h3 className="text-base font-bold">Email Notification Templates</h3>
            </div>
          </div>
          <div className="space-y-3">
            {(Object.keys(TEMPLATE_LABELS) as (keyof NotificationTemplates)[]).map((key) => {
              const isExpanded = expandedTemplate === key;
              const tmpl = parsedTemplates[key] || DEFAULT_NOTIFICATION_TEMPLATES[key];
              return (
                <div key={key} className="rounded-xl border border-border overflow-hidden">
                  <button
                    onClick={() => setExpandedTemplate(isExpanded ? null : key)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                  >
                    {isExpanded ? <ChevronDown size={16} className="text-muted-foreground" /> : <ChevronRight size={16} className="text-muted-foreground" />}
                    <span className="text-sm font-semibold text-foreground">{TEMPLATE_LABELS[key]}</span>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3 border-t border-border/50">
                      <div className="pt-3">
                        <label className="mb-1 block text-xs font-semibold text-muted-foreground">Subject</label>
                        <input
                          type="text"
                          value={tmpl.subject}
                          onChange={(e) => updateTemplate(key, "subject", e.target.value)}
                          className="h-10 w-full rounded-xl border border-border bg-white/90 px-4 text-sm transition-all focus:border-purple-300 focus:outline-none focus:ring-4 focus:ring-purple-500/10"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-muted-foreground">Body</label>
                        <textarea
                          rows={8}
                          value={tmpl.body}
                          onChange={(e) => updateTemplate(key, "body", e.target.value)}
                          className="w-full rounded-2xl border border-border bg-white/90 p-4 font-mono text-xs transition-all focus:border-purple-300 focus:outline-none focus:ring-4 focus:ring-purple-500/10"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="border-white/70 bg-white/80 p-6 card-shadow lg:col-span-2">
          <div className="mb-5 flex items-center gap-3 border-b border-border pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary shadow-sm">
              <Building2 className="text-purple-600" size={18} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Multi-Tenant</p>
              <h3 className="text-base font-bold">Organizations</h3>
            </div>
          </div>
          <div className="space-y-3">
            {organizations.map((org) => (
              <div key={org.id} className="flex items-center gap-3 rounded-xl border border-border px-4 py-3">
                {editingOrg?.id === org.id ? (
                  <>
                    <input value={editingOrg.name} onChange={(e) => setEditingOrg({ ...editingOrg, name: e.target.value })} className="h-9 flex-1 rounded-lg border border-border px-3 text-sm" />
                    <input value={editingOrg.shortCode} onChange={(e) => setEditingOrg({ ...editingOrg, shortCode: e.target.value })} className="h-9 w-24 rounded-lg border border-border px-3 text-sm" />
                    <button onClick={handleUpdateOrg} className="rounded-lg px-3 py-1 text-xs font-semibold text-white" style={{ background: PURPLE }}>Save</button>
                    <button onClick={() => setEditingOrg(null)} className="rounded-lg px-3 py-1 text-xs font-semibold text-muted-foreground border border-border">Cancel</button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium text-foreground">{org.name}</span>
                    <span className="rounded-lg bg-muted px-2 py-1 text-xs font-mono text-muted-foreground">{org.shortCode}</span>
                    <button onClick={() => setEditingOrg(org)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"><Pencil size={14} /></button>
                    <button onClick={() => handleDeleteOrg(org.id)} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 transition-colors"><Trash2 size={14} /></button>
                  </>
                )}
              </div>
            ))}
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-border px-4 py-3">
              <input value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} placeholder="Organization name" className="h-9 flex-1 rounded-lg border border-border px-3 text-sm" />
              <input value={newOrgShortCode} onChange={(e) => setNewOrgShortCode(e.target.value)} placeholder="Short code" className="h-9 w-24 rounded-lg border border-border px-3 text-sm" />
              <button onClick={handleAddOrg} className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white" style={{ background: PURPLE }}><Plus size={14} /> Add</button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
