import { FileText } from "lucide-react";
import { Card } from "@/app/components/Card";
import { FORM_SECTIONS } from "@/app/components/FS";
import { GRADIENT_PRIMARY, PURPLE } from "@/config/theme";

interface DeclarationGuidanceSidebarProps {
  activeSection: string;
  onNavigate: (sectionId: string) => void;
}

export function DeclarationGuidanceSidebar({ activeSection, onNavigate }: DeclarationGuidanceSidebarProps) {
  return (
    <aside className="hidden w-48 flex-shrink-0 flex-col gap-3 self-start lg:sticky lg:top-4 lg:flex lg:min-h-[calc(100vh-2rem)]">
      <Card className="p-3.5">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2.5 px-1">Sections</p>
        <nav className="space-y-0.5" aria-label="Declaration sections">
          {FORM_SECTIONS.map((section) => {
            const active = activeSection === section.id;
            return (
              <button key={section.id} type="button" onClick={() => onNavigate(section.id)} aria-current={active ? "step" : undefined}
                className={`w-full flex items-center gap-3 text-left py-2.5 px-3 rounded-xl text-sm transition-all duration-200 ${active ? "text-purple-900 font-semibold bg-purple-50 shadow-sm" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50 font-medium"}`}>
                <span className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-sm transition-colors duration-200" style={active ? { background: GRADIENT_PRIMARY, color: "#fff" } : { background: "var(--muted)", color: "var(--muted-foreground)" }}>{section.num}</span>
                <span className="leading-tight">{section.label}</span>
              </button>
            );
          })}
        </nav>
      </Card>
      <div className="rounded-2xl border border-white p-3.5 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <p className="text-xs font-bold uppercase tracking-widest mb-2.5" style={{ color: PURPLE }}>Definitions</p>
        {[
          { title: "Gift", description: "Anything of value including cash, vouchers, goods, services, preferential discounts or favours." },
          { title: "Hospitality", description: "Accommodation, travel, conferences, tickets or formal business functions." },
          { title: "Entertainment", description: "Meals, events, sporting, cultural or recreational activities." },
        ].map((definition) => <div key={definition.title} className="mb-2.5 last:mb-0"><p className="text-sm font-bold text-foreground">{definition.title}</p><p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{definition.description}</p></div>)}
      </div>
      <div className="mt-auto rounded-2xl border border-white/60 bg-white/70 p-3.5 shadow-[0_8px_30px_rgb(0,0,0,0.03)] backdrop-blur-xl">
        <p className="text-xs font-bold uppercase tracking-widest mb-2.5" style={{ color: PURPLE }}>Related Policies</p>
        {["Gifts, Hospitality & Entertainment Policy", "Anti-Bribery and Corruption Policy"].map((policy) => <div key={policy} className="flex items-start gap-2 rounded-xl border border-primary/5 bg-secondary/20 p-2.5 mb-2 last:mb-0"><FileText size={13} className="mt-0.5 flex-shrink-0" style={{ color: PURPLE }} /><p className="text-xs font-semibold text-foreground leading-snug">{policy}</p></div>)}
      </div>
    </aside>
  );
}
