import { Save, Bell, Shield, Mail } from "lucide-react";
import { Card } from "../../components/Card";
import { PageHeader } from "../../components/PageHeader";
import { PURPLE } from "../../../config/theme";

export function AdminConfig() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="System Configuration"
        subtitle="Manage global application settings and notifications."
        actions={
          <button
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(79,29,149,0.28)] sm:w-auto"
            style={{ background: `linear-gradient(135deg, ${PURPLE}, #6d28d9)`, border: "1px solid transparent" }}
          >
            <Save size={15} /> Save Changes
          </button>
        }
      />

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
              <input type="number" defaultValue={2000} className="h-11 w-full rounded-xl border border-border bg-white/90 px-4 transition-all focus:border-purple-300 focus:outline-none focus:ring-4 focus:ring-purple-500/10" />
              <p className="mt-1 text-xs text-muted-foreground">Declarations above this value require CEO approval.</p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground">SLA Escalation Time (Days)</label>
              <input type="number" defaultValue={3} className="h-11 w-full rounded-xl border border-border bg-white/90 px-4 transition-all focus:border-purple-300 focus:outline-none focus:ring-4 focus:ring-purple-500/10" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground">Max Declarations per Counterparty (Annual)</label>
              <input type="number" defaultValue={5} className="h-11 w-full rounded-xl border border-border bg-white/90 px-4 transition-all focus:border-purple-300 focus:outline-none focus:ring-4 focus:ring-purple-500/10" />
            </div>
          </div>
        </Card>

        <Card className="border-white/70 bg-white/80 p-6 shadow-[0_18px_45px_rgba(79,29,149,0.08)] backdrop-blur-xl">
          <div className="mb-5 flex items-center gap-3 border-b border-border pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary shadow-sm">
              <Bell className="text-purple-600" size={18} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Automation</p>
              <h3 className="text-base font-bold">Notification Settings</h3>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-2xl border border-primary/10 bg-secondary/15 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-purple-200/70 hover:bg-purple-50/40">
              <div>
                <p className="text-sm font-semibold text-foreground">Email Notifications</p>
                <p className="text-xs text-muted-foreground">Send emails to approvers on new submissions.</p>
              </div>
              <input type="checkbox" defaultChecked className="h-4 w-4 rounded text-purple-600" />
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-primary/10 bg-secondary/15 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-purple-200/70 hover:bg-purple-50/40">
              <div>
                <p className="text-sm font-semibold text-foreground">SLA Breach Alerts</p>
                <p className="text-xs text-muted-foreground">Notify Admin when a declaration SLA is breached.</p>
              </div>
              <input type="checkbox" defaultChecked className="h-4 w-4 rounded text-purple-600" />
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-primary/10 bg-secondary/15 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-purple-200/70 hover:bg-purple-50/40">
              <div>
                <p className="text-sm font-semibold text-foreground">Weekly Digest</p>
                <p className="text-xs text-muted-foreground">Send weekly summary to Group CEO.</p>
              </div>
              <input type="checkbox" className="h-4 w-4 rounded text-purple-600" />
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
                defaultValue={"Hi {{ApproverName}},\n\nA new GHE Declaration ({{DeclarationID}}) from {{EmployeeName}} requires your review.\n\nPlease log into the system to approve or decline.\n\nRegards,\nCompliance Team"}
                className="w-full rounded-2xl border border-border bg-white/90 p-4 font-mono text-xs transition-all focus:border-purple-300 focus:outline-none focus:ring-4 focus:ring-purple-500/10"
              />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
