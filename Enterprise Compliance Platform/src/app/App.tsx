import image_Hollywood_Group_Logo from '@/imports/Hollywood_Group_Logo.png'
import image_Logo_1 from '@/imports/Logo-1.png'
import { useState, useRef, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";
import {
  FileText, CheckSquare, Home, Settings, LogOut, Bell,
  ChevronRight, Upload, Eye, Download, X, Check, AlertCircle,
  ArrowLeft, TrendingUp, Clock, DollarSign, Filter, Search,
  ChevronDown, ArrowUp, MoreHorizontal, Send, Gift,
  Menu, ChevronLeft, Paperclip, Trash2, AlertTriangle,
  Sparkles, Star, Building2, Users, Layers,
} from "lucide-react";
import { ImageWithFallback } from "@/app/components/figma/ImageWithFallback";
import logoImg from "@/imports/Logo.png";
import groupLogoImg from "@/imports/Hollywood_Group_Logo.png";
import bannerImg from "@/imports/Button.png";


// ─── Types ─────────────────────────────────────────────────────────────────────
type Screen = "landing" | "login" | "new-declaration" | "my-declarations" | "approver-dashboard" | "approval-queue" | "approval-detail" | "declaration-detail";
type Role = "teamMember" | "approver";
type StatusType = "Draft" | "Pending" | "Approved" | "Declined" | "Escalated" | "Info Requested";
type ApprovalDecision =
  | "return"
  | "accept"
  | "org"
  | "foundation"
  | "decline"
  | null;

interface Declaration {
  id: string; employee: string; department: string; type: string; Counterparty: string;
  value: number; submitted: string; approver: string; status: StatusType;
  priority: "High" | "Medium" | "Low"; description: string; relationship: string;
  teamMemberNumber: string; lineManager: string; position: string;
  receivedGiven: string; from: string; contactPerson: string;
  biddingProcess: string; contractNegotiation?: string;  occasion: string; date: string; instances: string; publicOfficial: string;
  company?: string; team?: string; substantiation?: string; 
}
interface UploadedFile { name: string; size: number; type: string; url: string; }

// ─── Data ──────────────────────────────────────────────────────────────────────
const declarations: Declaration[] = [
  { id: "GHE-2024-0047", employee: "Nomvula Dlamini", teamMemberNumber: "HB-204478", lineManager: "Sipho Nkosi", position: "Senior Brand Manager", department: "Marketing", company: "Hollywoodbets Group", team: "Brand & Communications", type: "Hospitality", Counterparty: "Tsogo Sun Hotels", value: 8500, submitted: "2024-11-12", approver: "Sipho Nkosi", status: "Pending", priority: "High", description: "Corporate dinner for key partners at Sandton Sun", relationship: "Client – Strategic Partner", receivedGiven: "Received", from: "Supplier", contactPerson: "John Smith", biddingProcess: "No", occasion: "Relationship Maintenance", date: "2024-11-10", instances: "2", publicOfficial: "No" },
  { id: "GHE-2024-0046", employee: "Thabo Mokoena", teamMemberNumber: "HB-187234", lineManager: "Lindiwe Zulu", position: "Sales Executive", department: "Sales", company: "Hollywoodbets Group", team: "Enterprise Sales", type: "Gift", Counterparty: "Makro", value: 1200, submitted: "2024-11-10", approver: "Sipho Nkosi", status: "Approved", priority: "Low", description: "End-of-year gift basket received from supplier", relationship: "Supplier – Regular", receivedGiven: "Received", from: "Supplier", contactPerson: "Jane Dube", biddingProcess: "No", occasion: "Festive", date: "2024-11-08", instances: "1", publicOfficial: "No" },
  { id: "GHE-2024-0045", employee: "Ayanda Khumalo", teamMemberNumber: "HB-219033", lineManager: "Sipho Nkosi", position: "Operations Manager", department: "Operations", company: "Hollywoodbets Group", team: "Operations", type: "Entertainment", Counterparty: "Emirates Airline", value: 34000, submitted: "2024-11-08", approver: "Lindiwe Zulu", status: "Escalated", priority: "High", description: "Business class flights and lounge access for conference", relationship: "Counterparty – Technology", receivedGiven: "Received", from: "Customer", contactPerson: "Ahmed Al-Rashid", biddingProcess: "Yes", occasion: "Other", date: "2024-11-05", instances: "3", publicOfficial: "No" },
  { id: "GHE-2024-0044", employee: "Pieter van der Berg", teamMemberNumber: "HB-156902", lineManager: "Lindiwe Zulu", position: "Finance Analyst", department: "Finance", company: "Hollywoodbets Group", team: "Financial Reporting", type: "Hospitality", Counterparty: "La Colombe Restaurant", value: 3200, submitted: "2024-11-06", approver: "Sipho Nkosi", status: "Declined", priority: "Medium", description: "Lunch meeting with audit consultants", relationship: "Service Provider – Annual", receivedGiven: "Given", from: "Customer", contactPerson: "Mark Johnson", biddingProcess: "No", occasion: "Relationship Maintenance", date: "2024-11-04", instances: "1", publicOfficial: "No" },
  { id: "GHE-2024-0043", employee: "Zanele Sithole", teamMemberNumber: "HB-198741", lineManager: "Sipho Nkosi", position: "HR Generalist", department: "HR", company: "Hollywoodbets Group", team: "People & Culture", type: "Gift", Counterparty: "Woolworths", value: 650, submitted: "2024-11-04", approver: "Lindiwe Zulu", status: "Approved", priority: "Low", description: "Festive season hamper from staffing agency", relationship: "Supplier – Staffing", receivedGiven: "Received", from: "Supplier", contactPerson: "Thandi Molefe", biddingProcess: "No", occasion: "Festive", date: "2024-11-02", instances: "1", publicOfficial: "No" },
  { id: "GHE-2024-0042", employee: "Bongani Cele", teamMemberNumber: "HB-234512", lineManager: "Lindiwe Zulu", position: "IT Systems Lead", department: "IT", company: "Hollywoodbets Group", team: "Technology", type: "Entertainment", Counterparty: "Sun International", value: 12800, submitted: "2024-11-02", approver: "Sipho Nkosi", status: "Pending", priority: "Medium", description: "Golf day and networking event hosted by Sun International", relationship: "Counterparty – IT Solutions", receivedGiven: "Received", from: "Supplier", contactPerson: "Riaan Botha", biddingProcess: "Yes", occasion: "Relationship Maintenance", date: "2024-10-31", instances: "2", publicOfficial: "No" },
  { id: "GHE-2024-0041", employee: "Fatima Ismail", teamMemberNumber: "HB-167823", lineManager: "Sipho Nkosi", position: "Legal Counsel", department: "Legal", company: "Hollywoodbets Group", team: "Legal & Compliance", type: "Gift", Counterparty: "Edgars", value: 890, submitted: "2024-10-30", approver: "Lindiwe Zulu", status: "Info Requested", priority: "Medium", description: "Clothing voucher received at legal conference", relationship: "External – Industry Event", receivedGiven: "Received", from: "Customer", contactPerson: "Priya Naidoo", biddingProcess: "N/A", occasion: "Other", date: "2024-10-28", instances: "1", publicOfficial: "No" },
  { id: "GHE-2024-0040", employee: "Siphamandla Ndlovu", teamMemberNumber: "HB-244001", lineManager: "Lindiwe Zulu", position: "Brand Strategist", department: "Marketing", company: "Hollywoodbets Group", team: "Brand & Communications", type: "Hospitality", Counterparty: "Radisson Blu", value: 5600, submitted: "2024-10-28", approver: "Sipho Nkosi", status: "Draft", priority: "Low", description: "Team dinner for campaign launch celebration", relationship: "Internal – Team Event", receivedGiven: "Given", from: "Team Member", contactPerson: "Lebo Mahlangu", biddingProcess: "No", occasion: "Milestone", date: "2024-10-25", instances: "1", publicOfficial: "No" },
];

const complianceTrend = [
  { month: "Jun", approved: 14, Declined: 4 }, { month: "Jul", approved: 19, Declined: 5 },
  { month: "Aug", approved: 15, Declined: 4 }, { month: "Sep", approved: 25, Declined: 6 },
  { month: "Oct", approved: 22, Declined: 6 }, { month: "Nov", approved: 18, Declined: 4 },
];
const typeBreakdown = [
  { name: "Gift", value: 38, color: "#7c3aed" },
  { name: "Hospitality", value: 41, color: "#0891b2" },
  { name: "Entertainment", value: 21, color: "#d97706" },
];


const approvalOptions = [
  {
    value: "return",
    label: "Return - Team member to provide additional information.",
  },
  {
    value: "accept",
    label: "Approved - Team Member to accept the actual GHE or offered GHE in their personal capacity.",
  },
  {
    value: "org",
    label: "Approved - Team Member to share the actual GHE or offered GHE with the Organisation Pool.",
  },
  {
    value: "foundation",
    label: "Approved - Team Member to donate the actual GHE or offered GHE to the Hollywood Foundation.",
  },
  {
    value: "decline",
    label: "Declined - Team Member to return the actual GHE or regret the offered GHE.",
  },
];

// ─── Design tokens ─────────────────────────────────────────────────────────────
const PURPLE = "#4F1D95";
const DEEP   = "#39156F";
const YELLOW = "#F8D74A";
const F      = { fontFamily: "'Plus Jakarta Sans', sans-serif" };

const typeCfg: Record<string, { bg: string; text: string }> = {
  Gift:          { bg: "#f5f3ff", text: "#6d28d9" },
  Hospitality:   { bg: "#ecfeff", text: "#0e7490" },
  Entertainment: { bg: "#fffbeb", text: "#b45309" },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
const statusConfig: Record<StatusType, { bg: string; text: string; ring: string }> = {
  Draft:            { bg: "bg-slate-100",  text: "text-slate-600",   ring: "bg-slate-400" },
  Pending:          { bg: "bg-amber-50",   text: "text-amber-700",   ring: "bg-amber-400" },
  Approved:         { bg: "bg-emerald-50", text: "text-emerald-700", ring: "bg-emerald-500" },
  Declined:         { bg: "bg-red-50",     text: "text-red-700",     ring: "bg-red-500" },
  Escalated:        { bg: "bg-orange-50",  text: "text-orange-700",  ring: "bg-orange-500" },
  "Info Requested": { bg: "bg-blue-50",    text: "text-blue-700",    ring: "bg-blue-500" },
};

function StatusBadge({ status }: { status: StatusType }) {
  const c = statusConfig[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.ring}`} /> {status}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const cfg = typeCfg[type] ?? { bg: "#f3f4f6", text: "#374151" };
  return <span className="px-2.5 py-1 rounded-md text-xs font-semibold" style={{ background: cfg.bg, color: cfg.text }}>{type}</span>;
}

function formatRand(v: number) { return `R ${v.toLocaleString("en-ZA")}`; }
function formatBytes(b: number) { return b < 1_048_576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1_048_576).toFixed(1)} MB`; }

const inp = "w-full h-11 rounded-xl px-4 text-sm border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-muted-foreground/50";
const sel = `${inp} appearance-none pr-10 cursor-pointer`;

function Sel({ children, value, onChange, className = "" }: { children: React.ReactNode; value?: string; onChange?: (v: string) => void; className?: string }) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange?.(e.target.value)} className={`${sel} ${className}`}>{children}</select>
      <ChevronDown size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
    </div>
  );
}
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
}

function Card({
    children,
    className = "",
    ...props
}: CardProps) {
    return (
        <div
            className={`bg-white rounded-2xl border border-border shadow-sm ${className}`}
            {...props}
        >
            {children}
        </div>
    );
}

function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-7 pb-5 border-b border-border gap-4">
      <div><h1 className="text-[22px] font-bold tracking-tight text-foreground">{title}</h1>{subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}</div>
      {actions && <div className="flex items-center gap-2.5">{actions}</div>}
    </div>
  );
}



function KpiCard({
  label,
  value,
  icon: Icon,
  color,
  active,
  onClick,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`p-5 rounded-2xl cursor-pointer transition-all duration-300 border transform
        ${active ? "scale-105 shadow-xl" : "hover:scale-[1.02] hover:shadow-md"}
      `}
      style={{
        background: `linear-gradient(135deg, ${color}15, ${color}05)`,
        borderColor: active ? color : "#eee",
      }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
        style={{ background: color + "20" }}
      >
        <Icon size={18} style={{ color }} />
      </div>

      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs mt-1">{label}</p>
    </div>
  );
}

function THead({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr className="border-b border-border bg-[#F7F8FC]">
        {cols.map(c => <th key={c} className="text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-5 py-3">{c}</th>)}
      </tr>
    </thead>
  );
}

// ─── Confetti / Success Modal ──────────────────────────────────────────────────
function SuccessModal({ data, onClose, onView }: { data: Record<string, string>; onClose: () => void; onView: () => void }) {
  // CSS confetti pieces
  const pieces = Array.from({ length: 22 }, (_, i) => ({
    color: [PURPLE, YELLOW, "#10b981", "#3b82f6", "#f43f5e", "#f97316"][i % 6],
    left: `${(i * 4.5) % 100}%`,
    delay: `${(i * 0.12) % 1.8}s`,
    dur: `${2.5 + (i % 4) * 0.5}s`,
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgb(0 0 0 / 0.55)", backdropFilter: "blur(6px)" }}>
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(-40px) rotate(0deg) scale(1); opacity: 1; }
          100% { transform: translateY(340px) rotate(720deg) scale(0.4); opacity: 0; }
        }
        @keyframes popIn {
          0%   { transform: scale(0.7); opacity: 0; }
          70%  { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {/* Confetti */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
        {pieces.map((p, i) => (
          <div key={i} className="absolute w-2.5 h-2.5 rounded-sm" style={{
            background: p.color, left: p.left, top: "-10px",
            animation: `confettiFall ${p.dur} ${p.delay} ease-in forwards`,
          }} />
        ))}
      </div>

      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 text-center relative" style={{ animation: "popIn 0.4s ease-out", ...F }}>
        <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5"
          style={{ background: `linear-gradient(135deg, #10b981, #059669)` }}>
          <Check size={36} className="text-white" strokeWidth={3} />
        </div>
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles size={18} style={{ color: YELLOW }} />
          <h2 className="text-2xl font-bold text-foreground">Declaration Submitted!</h2>
          <Sparkles size={18} style={{ color: YELLOW }} />
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed mb-1">Thank you, <span className="font-semibold text-foreground">{data.employee}</span>.</p>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">Your declaration <span className="font-mono font-bold" style={{ color: PURPLE }}>{data.id}</span> has been submitted for approval. Your line manager will be notified shortly.</p>
        <div className="rounded-2xl p-4 mb-6 text-left space-y-2" style={{ background: "#F5F2FF" }}>
          {[["Declaration ID", data.id], ["Type", data.type], ["Counterparty", data.Counterparty], ["Submitted", new Date().toLocaleDateString("en-ZA")], ["Status", "Pending Approval"]].map(([k, v]) => (
            <div key={k} className="flex justify-between"><span className="text-xs text-muted-foreground">{k}</span><span className="text-xs font-semibold text-foreground">{v}</span></div>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 h-11 rounded-xl text-sm font-semibold border border-border bg-white hover:bg-muted transition-colors">Close</button>
          <button onClick={onView} className="flex-1 h-11 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-all"
            style={{ background: `linear-gradient(135deg, ${PURPLE}, #6d28d9)` }}>View Declaration</button>
        </div>
      </div>
    </div>
  );
}

// ─── Save Draft Banner ─────────────────────────────────────────────────────────
function DraftBanner({ onDismiss }: { onDismiss: () => void }) {
  useEffect(() => { const t = setTimeout(onDismiss, 4000); return () => clearTimeout(t); }, [onDismiss]);
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold text-white" style={{ background: `linear-gradient(135deg, ${DEEP}, ${PURPLE})`, animation: "popIn 0.3s ease-out", ...F }}>
      <Check size={15} /> Draft saved successfully
      <button onClick={onDismiss} className="ml-2 opacity-70 hover:opacity-100"><X size={14} /></button>
    </div>
  );
}

// ─── Shell ─────────────────────────────────────────────────────────────────────
function Sidebar({ role, screen, onNavigate, collapsed, onToggle }: {
  role: Role; screen: Screen; onNavigate: (s: Screen) => void; collapsed: boolean; onToggle: () => void;
}) {
  const links = role === "teamMember"
    ? [{ screen: "new-declaration" as Screen, icon: Gift, label: "New Declaration" }, { screen: "my-declarations" as Screen, icon: FileText, label: "My Declarations" }]
    : [{ screen: "approver-dashboard" as Screen, icon: Home, label: "Dashboard" }, { screen: "approval-queue" as Screen, icon: CheckSquare, label: "Approval Queue" }, { screen: "my-declarations" as Screen, icon: FileText, label: "All Declarations" }];

  return (
    <aside className={`flex-shrink-0 flex flex-col transition-all duration-300 ${collapsed ? "w-16" : "w-56"}`}
      style={{ background: `linear-gradient(180deg, #0f0225 0%, ${DEEP} 100%)` }}>
      <div className={`h-14 flex items-center border-b ${collapsed ? "justify-center px-0" : "justify-between px-4"}`} style={{ borderColor: "rgb(255 255 255 / 0.1)" }}>
        {!collapsed && <ImageWithFallback src={logoImg} alt="Hollywoodbets" className="h-8 w-auto object-contain" />}
        <button onClick={onToggle} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors text-[#c4b5fd] flex-shrink-0">
          {collapsed ? <Menu size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
      <nav className="flex-1 py-5 px-2">
        {!collapsed && <p className="text-[10px] font-bold uppercase tracking-widest px-3 pb-3" style={{ color: "rgb(237 232 255 / 0.45)" }}>{role === "teamMember" ? "Team Member" : "Approver"}</p>}
        <div className="space-y-0.5">
          {links.map(link => {
            const active = screen === link.screen || (screen === "declaration-detail" && link.screen === "my-declarations");
            return (
              <button key={link.screen} onClick={() => onNavigate(link.screen)} title={collapsed ? link.label : undefined}
                className={`w-full flex items-center gap-3 rounded-xl text-sm transition-all ${collapsed ? "justify-center p-2.5" : "px-3 py-2.5"} ${active ? "font-semibold" : "text-[#c4b5fd] hover:bg-white/10 font-medium"}`}
                style={active ? { background: YELLOW, color: "#1E1E2D" } : {}}>
                <link.icon size={16} className={active ? "" : "opacity-80"} />
                {!collapsed && link.label}
              </button>
            );
          })}
        </div>
      </nav>
      <div className="px-2 pb-5 border-t pt-4" style={{ borderColor: "rgb(255 255 255 / 0.1)" }}>
        <button title={collapsed ? "Settings" : undefined}
          className={`w-full flex items-center gap-3 rounded-xl text-sm text-[#c4b5fd] hover:bg-white/10 transition-colors font-medium ${collapsed ? "justify-center p-2.5" : "px-3 py-2.5"}`}>
          <Settings size={16} className="opacity-80" />{!collapsed && "Settings"}
        </button>
      </div>
    </aside>
  );
}

function TopBar({ userName, role, onSignOut }: { userName: string; role: Role; onSignOut: () => void }) {
  const initials = userName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  return (
    <header className="h-14 bg-white border-b border-border flex items-center justify-between px-6 flex-shrink-0">
      <div className="flex items-center gap-3">
        <ImageWithFallback src={groupLogoImg} alt="Hollywoodbets Group" className="h-7 w-auto object-contain" />
        <div className="h-5 w-px bg-border" />
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground hidden md:block">Gift, Hospitality or Entertainment ("GHE") Declaration System</span>
      </div>
      <div className="flex items-center gap-3">
        <button className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors">
          <Bell size={17} className="text-muted-foreground" />
          <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full" style={{ background: YELLOW }} />
        </button>
        <div className="h-6 w-px bg-border" />
        <div className="flex items-center gap-2.5 pl-1">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: PURPLE }}>{initials}</div>
          <div className="hidden md:block">
            <p className="text-sm font-semibold text-foreground leading-tight">{userName}</p>
            <p className="text-[10px] text-muted-foreground capitalize">{role === "teamMember" ? "Team Member" : "Approver"}</p>
          </div>
        </div>
        <button onClick={onSignOut} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-muted transition-colors text-muted-foreground"><LogOut size={15} /></button>
      </div>
    </header>
  );
}

function AppShell({ role, screen, userName, onNavigate, onSignOut, children }: {
  role: Role; screen: Screen; userName: string;
  onNavigate: (s: Screen) => void; onSignOut: () => void; children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="flex h-screen w-screen overflow-hidden" style={F}>
      <Sidebar role={role} screen={screen} onNavigate={onNavigate} collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <div className="flex flex-col flex-1 min-w-0 min-h-0">
        <TopBar userName={userName} role={role} onSignOut={onSignOut} />
        <main className="flex-1 min-h-0 overflow-y-auto bg-background p-7">{children}</main>
      </div>
    </div>
  );
}

// ─── Landing + Login ───────────────────────────────────────────────────────────
function LandingScreen({ onEnter }: { onEnter: (role: Role, name: string) => void }) {
  const [role, setRole] = useState<Role>("teamMember");
  const [loading, setLoading] = useState(false);
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    setTimeout(() => onEnter(role, role === "approver" ? "Sipho Nkosi" : "Nomvula Dlamini"), 800);
  };
  return (
    <div className="min-h-screen w-full flex" style={F}>
      <div className="hidden lg:flex w-[58%] flex-col relative overflow-hidden"
        style={{ background: `linear-gradient(145deg, #0f0225 0%, ${DEEP} 35%, ${PURPLE} 70%, #6d28d9 100%)` }}>
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full opacity-20" style={{ background: `radial-gradient(circle, ${YELLOW}, transparent 70%)` }} />
          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full opacity-15" style={{ background: "radial-gradient(circle, #a78bfa, transparent 70%)", transform: "translate(20%,20%)" }} />
          <svg className="absolute bottom-0 left-0 w-full opacity-10" viewBox="0 0 800 120" preserveAspectRatio="none">
            <path d="M0,40 C200,90 400,0 600,50 C700,75 760,30 800,40 L800,120 L0,120 Z" fill="#EDE8FF" />
          </svg>
        </div>
        <div className="relative z-10 p-8 pb-0"></div>
        <div className="relative z-10 flex-1 flex flex-col justify-center px-10 py-8">
          <div className="rounded-2xl overflow-hidden mb-8" style={{ boxShadow: "0 20px 60px rgb(0 0 0 / 0.5)" }}>
            <ImageWithFallback src={bannerImg} alt="Gifting, Hospitality & Entertainment Declaration" className="w-full object-cover" />
          </div>
          
          
          <div className="mt-7 flex items-center gap-5">
            {[["🔒", "Secure & Encrypted"], ["📋", "Fully Audited"], ["✅", "Policy Compliant"]].map(([icon, label]) => (
              <div key={label} className="flex items-center gap-1.5"></div>
            ))}
          </div>
        </div>
        <div className="relative z-10 px-10 pb-6"><p className="text-xs" style={{ color: "rgb(237 232 255 / 0.35)" }}>© 2024 Hollywoodbets Group. Authorised employees only.</p></div>
      </div>
      <div className="flex-1 flex items-center justify-center bg-background px-8 py-10">
        <div className="w-full max-w-[380px]">
          <div className="lg:hidden mb-8"><ImageWithFallback src={logoImg} alt="Hollywoodbets" className="h-9 w-auto object-contain" /></div>
          <div className="mb-8"><h1 className="text-2xl font-bold text-foreground">Welcome back</h1><p className="text-sm text-muted-foreground mt-1">Sign in to the GHE Declaration Portal</p></div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><label className="block text-sm font-semibold text-foreground mb-1.5">Username</label><input type="text" placeholder="Enter your username" className={inp} /></div>
            <div><label className="block text-sm font-semibold text-foreground mb-1.5">Password</label><input type="password" placeholder="Enter your password" className={inp} /></div>
            <div><label className="block text-sm font-semibold text-foreground mb-1.5">Sign in as</label>
              <Sel value={role} onChange={v => setRole(v as Role)}><option value="teamMember">Team Member</option><option value="approver">Approver</option></Sel>
            </div>
            <div className="pt-1"><button type="submit" disabled={loading} className="w-full h-11 rounded-xl text-sm font-semibold text-white hover:opacity-90 active:scale-[0.98] disabled:opacity-60 transition-all" style={{ background: `linear-gradient(135deg, ${PURPLE}, #6d28d9)` }}>{loading ? "Signing in…" : "Sign In"}</button></div>
          </form>
          <div className="flex gap-2.5 mt-3">
            <button className="flex-1 h-9 rounded-xl text-xs font-semibold text-muted-foreground border border-border hover:bg-muted transition-colors">Forgot Password</button>
            <button className="flex-1 h-9 rounded-xl text-xs font-semibold text-muted-foreground border border-border hover:bg-muted transition-colors">Support</button>
          </div>
          <div className="mt-8 pt-6 border-t border-border"><p className="text-xs text-center text-muted-foreground">For access issues, contact your IT Helpdesk or HR representative.</p></div>
        </div>
      </div>
    </div>
  );
}

// ─── Form helpers ──────────────────────────────────────────────────────────────
function FL({ children, required, hint, error }: { children: React.ReactNode; required?: boolean; hint?: string; error?: string }) {
  return (
    <div className="mb-2">
      <p className="text-sm font-semibold text-foreground">{children}{required && <span className="text-red-400 ml-1 font-bold">*</span>}</p>
      {hint && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{hint}</p>}
      {error && <p className="text-xs text-red-500 mt-0.5 font-medium">{error}</p>}
    </div>
  );
}

const FORM_SECTIONS = [
  { id: "sec-team",        num: "1", label: "Team Member Details" },
  { id: "sec-declaration", num: "2", label: "Declaration Details" },
  { id: "sec-ghe",         num: "3", label: "GHE Details" },
  { id: "sec-docs",        num: "4", label: "Supporting Documents" },
  { id: "sec-undertaking", num: "5", label: "Declaration & Undertaking" },
];

function FS({ id, num, title, children }: { id: string; num: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0" style={{ background: PURPLE }}>{num}</div>
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">{title}</h3>
        <div className="flex-1 h-px bg-border" />
      </div>
      <Card className="p-6 lg:p-7">{children}</Card>
    </section>
  );
}

// ─── New Declaration ───────────────────────────────────────────────────────────
function NewDeclarationScreen({ onSubmitSuccess, onDraftSaved }: {
  onSubmitSuccess: (data: Record<string, string>) => void;
  onDraftSaved: () => void;
}) {
  const [receivedGiven, setReceivedGiven] = useState("Received");
  const [category, setCategory] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [activeSection, setActiveSection] = useState("sec-team");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [form, setFormState] = useState({
    employeeName: "Nomvula Dlamini", employeeCode: "HB-204478",
    lineManager: "Sipho Nkosi", company: "Hollywoodbets Group",
    department: "Marketing", team: "Brand & Communications", position: "Senior Brand Manager",
    partyType: "", Counterparty: "", contactPerson: "",
    existingRelationship: "", contractNegotiation: "", biddingProcess: "",
    occasion: "", date: "", value: "", currency: "ZAR",
    substantiation: "", instances: "", description: "",
  });
  const setF = (k: string, v: string) => { setFormState(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: "" })); };

  useEffect(() => {
    const el = scrollRef.current;
    const scrollRoot = el?.closest("main") as HTMLElement | null;
    if (!el || !scrollRoot) return;

    const onScroll = () => {
      const rootTop = scrollRoot.getBoundingClientRect().top;
      for (const s of [...FORM_SECTIONS].reverse()) {
        const node = el.querySelector(`#${s.id}`) as HTMLElement | null;
        if (node && node.getBoundingClientRect().top - rootTop <= 36) {
          setActiveSection(s.id);
          return;
        }
      }
    };

    onScroll();
    scrollRoot.addEventListener("scroll", onScroll, { passive: true });
    return () => scrollRoot.removeEventListener("scroll", onScroll);
  }, []);

  const jumpTo = (id: string) => {
    const el = scrollRef.current;
    const node = el?.querySelector(`#${id}`) as HTMLElement | null;
    node?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const ALLOWED = ["application/pdf", "image/png", "image/jpeg", "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
  const MAX_SIZE = 20 * 1_048_576;

  const processFiles = useCallback((rawFiles: FileList | null) => {
    if (!rawFiles) return;
    Array.from(rawFiles).forEach(file => {
      if (!ALLOWED.includes(file.type)) { alert(`${file.name}: unsupported format. Use PDF, PNG, JPG, or DOCX.`); return; }
      if (file.size > MAX_SIZE) { alert(`${file.name} exceeds the 20 MB limit.`); return; }
      setFiles(f => [...f, { name: file.name, size: file.size, type: file.type, url: URL.createObjectURL(file) }]);
    });
  }, []);

  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setDragging(false); processFiles(e.dataTransfer.files); };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.employeeName.trim()) errs.employeeName = "Required";
    if (!form.employeeCode.trim()) errs.employeeCode = "Required";
    if (!form.lineManager.trim()) errs.lineManager = "Required";
    if (!form.company.trim()) errs.company = "Required";
    if (!form.department.trim()) errs.department = "Required";
    if (!form.position.trim()) errs.position = "Required";
    if (!form.partyType) errs.partyType = "Required";
    if (!form.Counterparty.trim()) errs.Counterparty = "Required";
    if (!form.contactPerson.trim()) errs.contactPerson = "Required";
    if (!form.existingRelationship) errs.existingRelationship = "Required";
    if (!form.contractNegotiation) errs.contractNegotiation = "Required";
    if (!form.biddingProcess) errs.biddingProcess = "Required";
    if (!category) errs.category = "Required";
    if (!form.description.trim()) errs.description = "Required";
    if (!form.date) errs.date = "Required";
    if (!form.instances) errs.instances = "Required";
    if (!confirmed) errs.confirmed = "You must confirm the declaration";
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      const sectionMap: Record<string, string> = {
        employeeName: "sec-team", employeeCode: "sec-team", lineManager: "sec-team", company: "sec-team", department: "sec-team", position: "sec-team",
        partyType: "sec-declaration", Counterparty: "sec-declaration", contactPerson: "sec-declaration",
        existingRelationship: "sec-declaration", contractNegotiation: "sec-declaration", biddingProcess: "sec-declaration",
        category: "sec-ghe", description: "sec-ghe", date: "sec-ghe", instances: "sec-ghe",
        confirmed: "sec-undertaking",
      };
      jumpTo(sectionMap[Object.keys(errs)[0]] ?? "sec-team");
      return false;
    }
    return true;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    const id = `GHE-2024-${String(Math.floor(Math.random() * 900) + 48).padStart(4, "0")}`;
    onSubmitSuccess({
      id, employee: form.employeeName, employeeCode: form.employeeCode,
      lineManager: form.lineManager, company: form.company, department: form.department,
      team: form.team, position: form.position, receivedGiven,
      partyType: form.partyType, Counterparty: form.Counterparty, contactPerson: form.contactPerson,
      existingRelationship: form.existingRelationship, contractNegotiation: form.contractNegotiation,
      biddingProcess: form.biddingProcess, type: category, date: form.date,
      value: form.value ? `R ${form.value}` : "Not specified", occasion: form.occasion,
      description: form.description, files: files.length ? files.map(f => f.name).join(", ") : "",
    });
  };

  const partyOptions = ["Supplier", "Customer", "Team Member", "Public Official"];
  const ynu = ["Yes", "No", "Unsure", "N/A"];
  const categoryDefs: Record<string, string> = {
    Gift: "Anything of value, including cash, vouchers, goods, services, preferential discounts or favours.",
    Hospitality: "Accommodation, travel, conferences, tickets or formal business functions.",
    Entertainment: "Meals, events, sporting or cultural activities or recreational activities.",
  };
  const occasionOptions = ["Milestone", "Festive", "Relationship Maintenance", "Business Development", "Conference / Event", "Year-End Function", "Other"];

  const ErrInp = ({ field, ...props }: { field: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} className={`${inp} ${errors[field] ? "border-red-400 focus:ring-red-200" : ""}`} />
  );

  return (
    <div className="flex items-start gap-6 max-w-7xl mx-auto">
      {/* Sticky nav */}
      <aside className="w-48 flex-shrink-0 hidden lg:flex flex-col gap-3">
        <div className="sticky top-0 flex flex-col gap-3">
          <Card className="p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5 px-1">Sections</p>
            <nav className="space-y-0.5">
              {FORM_SECTIONS.map(s => {
                const active = activeSection === s.id;
                return (
                  <button key={s.id} onClick={() => jumpTo(s.id)}
                    className={`w-full flex items-center gap-2 text-left py-2 px-2 rounded-lg text-xs transition-all ${active ? "text-primary font-semibold bg-secondary/50" : "text-muted-foreground hover:text-foreground hover:bg-muted/40 font-medium"}`}>
                    <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                      style={active ? { background: PURPLE, color: "#fff" } : { background: "#F0EEF8", color: "#6B6B80" }}>
                      {s.num}
                    </span>
                    <span className="leading-tight">{s.label}</span>
                  </button>
                );
              })}
            </nav>
          </Card>
          <div className="rounded-2xl border border-primary/10 p-3.5" style={{ background: "#F5F2FF" }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2.5" style={{ color: PURPLE }}>Definitions</p>
            {[{ t: "Gift", d: "Cash, vouchers, goods, services or preferential favours." }, { t: "Hospitality", d: "Accommodation, travel, conferences or formal functions." }, { t: "Entertainment", d: "Meals, events, sporting or recreational activities." }].map(d => (
              <div key={d.t} className="mb-2.5 last:mb-0">
                <p className="text-[11px] font-bold text-foreground">{d.t}</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{d.d}</p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-primary/10 p-3.5 bg-white">
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2.5" style={{ color: PURPLE }}>Related Policies</p>
            {["Gifts, Hospitality & Entertainment Policy", "Anti-Bribery and Corruption Policy"].map(policy => (
              <div key={policy} className="flex items-start gap-2 rounded-xl border border-primary/5 bg-secondary/20 p-2.5 mb-2 last:mb-0">
                <FileText size={13} className="mt-0.5 flex-shrink-0" style={{ color: PURPLE }} />
                <p className="text-[11px] font-semibold text-foreground leading-snug">{policy}</p>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Form content */}
      <div ref={scrollRef} className="flex-1 min-w-0 space-y-7 pb-2">
        {/* Header */}
        <div className="flex items-center justify-between pb-5 border-b border-border gap-4">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-foreground">New Declaration</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Fields marked <span className="text-red-400 font-bold">*</span> are required.</p>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="h-7 px-3 rounded-full text-xs font-bold bg-amber-100 text-amber-700 flex items-center">Draft</span>
            <button onClick={onDraftSaved} className="h-10 px-4 rounded-xl text-sm font-semibold border border-border bg-white hover:bg-muted transition-colors">Save Draft</button>
            <button onClick={handleSubmit} className="h-10 px-5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-all flex items-center gap-2"
              style={{ background: `linear-gradient(135deg, ${PURPLE}, #6d28d9)` }}>
              <Send size={13} /> Submit
            </button>
          </div>
        </div>

        {/* Section 1 — expanded team member details */}
        <FS id="sec-team" num="1" title="Team Member Details">
          <div className="grid grid-cols-2 gap-x-5 gap-y-5">
            <div>
              <FL required error={errors.employeeName}>Team Member Name</FL>
              <ErrInp field="employeeName" value={form.employeeName} onChange={e => setF("employeeName", e.target.value)} />
            </div>
            <div>
              <FL required hint="Your Hollywoodbets TeamMembernumber." error={errors.employeeCode}>TeamMemberCode</FL>
              <ErrInp field="employeeCode" value={form.employeeCode} onChange={e => setF("employeeCode", e.target.value)} placeholder="e.g. HB-204478" />
            </div>
            <div>
              <FL required error={errors.lineManager}>Manager Name</FL>
              <ErrInp field="lineManager" value={form.lineManager} onChange={e => setF("lineManager", e.target.value)} />
            </div>
            <div>
              <FL required error={errors.company}>Company</FL>
              <ErrInp field="company" value={form.company} onChange={e => setF("company", e.target.value)} />
            </div>
            <div>
              <FL required error={errors.department}>Department</FL>
              <ErrInp field="department" value={form.department} onChange={e => setF("department", e.target.value)} />
            </div>
            <div>
              <FL hint="The team or business unit you belong to.">Team</FL>
              <input className={inp} value={form.team} onChange={e => setF("team", e.target.value)} placeholder="e.g. Brand & Communications" />
            </div>
            <div className="col-span-2">
              <FL required error={errors.position}>Role / Position</FL>
              <ErrInp field="position" value={form.position} onChange={e => setF("position", e.target.value)} />
            </div>
          </div>
        </FS>

        {/* Section 2 */}
        <FS id="sec-declaration" num="2" title="Declaration Details">
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-5">
              <div>
                <FL required>Did you receive or give a Gift, Hospitality or Entertainment?</FL>
                <Sel value={receivedGiven} onChange={setReceivedGiven}><option>Received</option><option>Given</option></Sel>
              </div>
              <div>
                <FL required error={errors.partyType}>{receivedGiven === "Received" ? "Who did you receive it from?" : "Who did you give it to?"}</FL>
                <Sel value={form.partyType} onChange={v => setF("partyType", v)} className={errors.partyType ? "border-red-400" : ""}>
                  <option value="">Select…</option>{partyOptions.map(o => <option key={o}>{o}</option>)}
                </Sel>
              </div>
            </div>
            <div>
              <FL required hint="Full name of the organisation or individual." error={errors.Counterparty}>Name of the Supplier, Customer, Public Official or Team Member</FL>
              <input className={`${inp} ${errors.Counterparty ? "border-red-400" : ""}`} value={form.Counterparty} onChange={e => setF("Counterparty", e.target.value)} placeholder="Full legal name" />
            </div>
            <div>
              <FL required error={errors.contactPerson}>Name of the person {receivedGiven === "Received" ? "giving" : "receiving"} the Gift, Hospitality or Entertainment</FL>
              <input className={`${inp} ${errors.contactPerson ? "border-red-400" : ""}`} value={form.contactPerson} onChange={e => setF("contactPerson", e.target.value)} placeholder="e.g. Ahmed Al-Rashid" />
            </div>
            <div className="grid grid-cols-3 gap-5">
              <div>
                <FL required error={errors.biddingProcess}>Is the Supplier or Team Member involved in a Bid In Progress?</FL>
                <Sel value={form.biddingProcess} onChange={v => setF("biddingProcess", v)} className={errors.biddingProcess ? "border-red-400" : ""}>
                  <option value="">Select…</option>{ynu.map(o => <option key={o}>{o}</option>)}
                </Sel>
              </div>
              <div>
                <FL required hint="Is there an existing or soon-to-start relationship?" error={errors.existingRelationship}>Is there an existing or imminent relationship with the supplier/customer?</FL>
                <Sel value={form.existingRelationship} onChange={v => setF("existingRelationship", v)} className={errors.existingRelationship ? "border-red-400" : ""}>
                  <option value="">Select…</option>{ynu.map(o => <option key={o}>{o}</option>)}
                </Sel>
              </div>
              <div>
                <FL required error={errors.contractNegotiation}>Are we currently negotiating a contract with the Supplier or Customer?</FL>
                <Sel value={form.contractNegotiation} onChange={v => setF("contractNegotiation", v)} className={errors.contractNegotiation ? "border-red-400" : ""}>
                  <option value="">Select…</option>{ynu.map(o => <option key={o}>{o}</option>)}
                </Sel>
              </div>
            </div>
          </div>
        </FS>

        {/* Section 3 */}
        <FS id="sec-ghe" num="3" title="GHE Details">
          <div className="space-y-5">
            <div>
              <FL required error={errors.category}>What category does the nature of the gift fall into?</FL>
              <Sel value={category} onChange={v => { setCategory(v); setErrors(e => ({ ...e, category: "" })); }} className={errors.category ? "border-red-400" : ""}>
                <option value="">Select category…</option><option>Gift</option><option>Hospitality</option><option>Entertainment</option>
              </Sel>
              {category && (
                <div className="mt-2.5 flex items-start gap-2.5 p-3.5 rounded-xl border border-primary/10" style={{ background: "#F5F2FF" }}>
                  <Check size={13} className="mt-0.5 flex-shrink-0" style={{ color: PURPLE }} />
                  <p className="text-sm text-foreground"><span className="font-semibold">{category}:</span> {categoryDefs[category]}</p>
                </div>
              )}
            </div>
            <div>
              <FL required error={errors.description}>Please describe the nature of the gift in detail</FL>
              <textarea className={`${inp} h-auto resize-none ${errors.description ? "border-red-400" : ""}`} rows={4} value={form.description} onChange={e => setF("description", e.target.value)}
                placeholder="e.g. Corporate dinner at Sandton Sun for 4 guests including wine and dessert. Estimated value R 4,200." />
            </div>
            <div className="grid grid-cols-2 gap-5">
              <div>
                <FL>Reason / Occasion</FL>
                <Sel value={form.occasion} onChange={v => setF("occasion", v)}>
                  <option value="">Select reason…</option>{occasionOptions.map(o => <option key={o}>{o}</option>)}
                </Sel>
              </div>
              <div>
                <FL required error={errors.date}>Date of Gift, Hospitality or Entertainment</FL>
                <input type="date" className={`${inp} ${errors.date ? "border-red-400" : ""}`} value={form.date} onChange={e => setF("date", e.target.value)} />
              </div>
            </div>
            <div>
              <FL required error={errors.instances}>Number of instances from this party in the past months</FL>
              <Sel value={form.instances} onChange={v => setF("instances", v)} className={errors.instances ? "border-red-400" : ""}>
                <option value="">Select…</option>{[1,2,3,4,5,6,7,8,9,10,11,12].map(n => <option key={n}>{n}</option>)}
              </Sel>
            </div>
            {/* VAT threshold at end of section */}
            <div>
              <FL hint="Enter the Rand value including VAT. Convert foreign currency to ZAR equivalent.">Rand Value or Equivalent Rand Value (including VAT)</FL>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2"><input type="number" className={inp} value={form.value} onChange={e => setF("value", e.target.value)} placeholder="0.00" /></div>
                <Sel value={form.currency} onChange={v => setF("currency", v)}><option>ZAR</option><option>USD</option><option>EUR</option><option>GBP</option></Sel>
              </div>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-2.5 mb-3">
                <AlertCircle size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800 leading-relaxed">If the Rand Value including VAT <strong>exceeds R2,000.00</strong>, please substantiate why this Gift, Hospitality or Entertainment should be allowed or given.</p>
              </div>
              <textarea className="w-full h-20 rounded-xl px-4 py-3 text-sm border border-amber-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300/40 transition-all resize-none placeholder:text-muted-foreground/50"
                value={form.substantiation} onChange={e => setF("substantiation", e.target.value)} placeholder="Substantiation for value exceeding R2,000.00 (if applicable)…" />
            </div>
          </div>
        </FS>

        {/* Section 4 — working upload */}
        <FS id="sec-docs" num="4" title="Supporting Documents">
          <input ref={fileInputRef} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" className="sr-only"
            onChange={e => { processFiles(e.target.files); e.target.value = ""; }} />
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`rounded-xl border-2 border-dashed py-10 px-6 text-center cursor-pointer transition-all ${dragging ? "border-primary bg-secondary/20" : "border-primary/20 bg-secondary/10 hover:border-primary/40 hover:bg-secondary/20"}`}>
            <div className="w-11 h-11 rounded-2xl bg-secondary/50 flex items-center justify-center mx-auto mb-3"><Upload size={20} style={{ color: PURPLE }} /></div>
            <p className="text-sm font-semibold text-foreground mb-1">Drag &amp; drop files here, or click to browse</p>
            <p className="text-xs text-muted-foreground">PDF (preferred), PNG, JPG, DOCX — max 20 MB each</p>
          </div>
          {files.length > 0 && (
            <div className="mt-4 space-y-2">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50">
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0"><Paperclip size={13} style={{ color: PURPLE }} /></div>
                  <div className="flex-1 min-w-0"><p className="text-sm font-medium text-foreground truncate">{f.name}</p><p className="text-xs text-muted-foreground">{formatBytes(f.size)}</p></div>
                  <a href={f.url} download={f.name} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-primary" onClick={e => e.stopPropagation()}><Download size={13} /></a>
                  <button onClick={e => { e.stopPropagation(); URL.revokeObjectURL(f.url); setFiles(fs => fs.filter((_, j) => j !== i)); }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-500"><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-3">Upload invoices, receipts, photos, or event invitations that support this declaration.</p>
        </FS>

        {/* Section 5 */}
        <FS id="sec-undertaking" num="5" title="Declaration & Undertaking">
          <p className="text-sm text-muted-foreground mb-4">By submitting this declaration I undertake and confirm that:</p>
          <div className="space-y-2.5 mb-6">
            {[
              "My objectivity and impartiality has not been impacted by receiving or giving of the Gift, Hospitality or Entertainment.",
              "The execution of my duties has not been influenced and will not be influenced.",
              "I have complied with the Anti-Bribery and Corruption Policy.",
              "I have complied with the Gifts, Hospitality and Entertainment Policy.",
              "No conflict of interest or perceived conflict of interest has been created.",
              "The information provided is valid, accurate and complete.",
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 py-3 px-4 rounded-xl bg-muted/30 border border-border/50">
                <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 mt-0.5"><Check size={10} style={{ color: PURPLE }} /></div>
                <p className="text-sm text-foreground leading-relaxed">{item}</p>
              </div>
            ))}
          </div>

          <div className="pt-5 border-t border-border">
            <label className="flex items-start gap-3 cursor-pointer select-none group mb-6">
              <div className="relative mt-0.5 flex-shrink-0">
                <input type="checkbox" checked={confirmed} onChange={e => { setConfirmed(e.target.checked); setErrors(er => ({ ...er, confirmed: "" })); }} className="sr-only" />
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${confirmed ? "border-primary" : errors.confirmed ? "border-red-400 bg-red-50" : "bg-white border-border group-hover:border-primary/40"}`}
                  style={confirmed ? { background: PURPLE } : {}}>
                  {confirmed && <Check size={10} className="text-white" />}
                </div>
              </div>
              <div>
                <span className="text-sm font-medium text-foreground leading-relaxed">I confirm that the above information is accurate and that I understand and accept the Hollywoodbets Group Gifting, Hospitality &amp; Entertainment Policy.</span>
                {errors.confirmed && <p className="text-xs text-red-500 mt-1 font-medium">{errors.confirmed}</p>}
              </div>
            </label>
            <div className="flex justify-end gap-2.5">
              <button onClick={onDraftSaved} className="h-10 px-5 rounded-xl text-sm font-semibold border border-border bg-white hover:bg-muted transition-colors">Save Draft</button>
              <button onClick={handleSubmit} className="h-10 px-6 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-all flex items-center gap-2"
                style={{ background: `linear-gradient(135deg, ${PURPLE}, #6d28d9)` }}>
                <Send size={13} /> Submit Declaration
              </button>
            </div>
          </div>
        </FS>
      </div>
    </div>
  );
}

// ─── Declaration Detail View (with approval workflow) ──────────────────────────
function DeclarationDetailView({
  data,
  onBack,
}: {
  data: Record<string, string> | Declaration;
  onBack: () => void;
}) {
  const isRecord = typeof (data as Declaration).value === "number";
  const d = isRecord ? (data as Declaration) : null;
  const record = !d ? (data as Record<string, string>) : null;

  const safe = (v: any) => v ?? "—";

  const fields: [string, string][] = d
    ? [
        ["Team Member", safe(d.employee)],
        ["Team Member Code", safe(d.teamMemberNumber)],
        ["Manager", safe(d.lineManager)],
        ["Company", safe(d.company)],
        ["Department", safe(d.department)],
        ["Position", safe(d.position)],
        ["Received / Given", safe(d.receivedGiven)],
        ["Category", safe(d.type)],
        ["Counter Party Name", safe(d.Counterparty)],
        ["Name Of Counter Person", safe(d.contactPerson)],
        ["Date", safe(d.date)],
        ["Value", formatRand(d.value)],
        ["Reason/Occasion", safe(d.occasion)],
        ["Bid In Progress", safe(d.biddingProcess)],
        ["Contract In Progress", safe(d.contractNegotiation)],
        ["No. of GHE past 12 months", safe(d.instances)],
        ["Description", safe(d.description)],
        ...(d.value > 2000
          ? ([["Substantiation (> R2 000)", safe(d.substantiation || "Required")]] as [string, string][])
          : []),
      ]
    : [
        ["Team Member", safe(record?.employee)],
        ["Team Member Code", safe(record?.teamMemberNumber)],
        ["Manager", safe(record?.lineManager)],
        ["Company", safe(record?.company)],
        ["Department", safe(record?.department)],
        ["Team", safe(record?.team)],
        ["Position", safe(record?.position)],
        ["Received / Given", safe(record?.receivedGiven)],
        ["Category", safe(record?.type)],
        ["Counter Party Name", safe(record?.Counterparty)],
        ["Name Of Counter Person", safe(record?.contactPerson)],
        ["Date", safe(record?.date)],
        ["Value", safe(record?.value)],
        ["Reason/Occasion", safe(record?.occasion)],
        ["Bid In Progress", safe(record?.biddingProcess)],
        ["Contract In Progress", safe(record?.contractNegotiation)],
        ["No. of GHE past 12 months", safe(record?.instances)],
        ["Description", safe(record?.description)],
        ...(Number(record?.value) > 2000
          ? ([["Substantiation (> R2 000)", safe(record?.substantiation || "Required")]] as [string, string][])
          : []),
      ];

  const status: StatusType = d ? d.status : "Pending";

  const workflowSteps = [
    {
      label: "Submission",
      actor: "Team Member",
      done: true,
      updates: [
        {
          status: "Submitted",
          date: d
            ? d.submitted
            : new Date().toLocaleDateString("en-ZA"),
          time: "08:45",
        },
      ],
    },
    {
      label: "Line Manager Review",
      actor: d ? d.lineManager : safe(record?.lineManager),
      done: status === "Approved" || status === "Declined",
      updates:
        status === "Approved"
          ? [{ status: "Approved", date: "2026-07-01", time: "10:15" }]
          : status === "Declined"
          ? [{ status: "Declined", date: "2026-07-01", time: "10:15" }]
          : [{ status: "Pending", date: "-", time: "-" }],
    },
    {
      label: "HR Review",
      actor: "Head of HR",
      done: status === "Approved",
      updates:
        status === "Approved"
          ? [{ status: "Approved", date: "2026-07-02", time: "12:30" }]
          : [{ status: "Pending", date: "-", time: "-" }],
    },
    {
      label: "CEO Approval",
      actor: "Group CEO",
      done: false,
      updates: [{ status: "Pending", date: "-", time: "-" }],
    },
  ];

  return (
    <div className="grid grid-cols-5 gap-5">

      {/* ROW 1 */}
      <div className="col-span-5 flex gap-5">

        {/* LEFT */}
        <div className="flex-[3]">
          <Card className="p-6 h-full">
            <h2 className="text-sm font-bold uppercase mb-4">
              Declaration Details
            </h2>

            <div className="grid grid-cols-2 gap-3">
              {fields.map(([k, v]) => (
                <div
                  key={k}
                  className={`rounded-xl p-3 bg-muted/30 border ${
                    ["Description", "Substantiation (> R2 000)"].includes(k)
                      ? "col-span-2"
                      : ""
                  }`}
                >
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase">
                    {k}
                  </p>
                  <p className="text-sm font-medium mt-1">{v}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* RIGHT */}
        <div className="flex-[2]">
          <Card className="p-6 h-full flex flex-col">
            <h3 className="text-sm font-bold uppercase mb-4">
              Approval Workflow
            </h3>

            <div className="relative flex flex-col justify-between flex-1">

              <div className="absolute left-[14px] top-7 bottom-7 w-[2px] bg-border" />

              <div
                className="absolute left-[14px] top-7 w-[2px] bg-emerald-600"
                style={{
                  height: `${
                    ((workflowSteps.filter((s) => s.done).length - 1) /
                      (workflowSteps.length - 1 || 1)) *
                    100
                  }%`,
                }}
              />

              {workflowSteps.map((step, i) => (
                <div key={i} className="flex items-start gap-3">

                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center ${
                      step.done
                        ? "bg-emerald-600 text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {step.done ? <Check size={12} /> : i + 1}
                  </div>

                  <div className="flex-1">
                    <p className="text-sm font-semibold">{step.label}</p>
                    <p className="text-xs text-muted-foreground mb-2">
                      {step.actor}
                    </p>

                    {step.updates.map((u, idx) => (
                      <div key={idx} className="text-[11px] px-3 py-2 rounded-md bg-muted/40 border space-y-1">
                        <div className="flex gap-2">
                          <span className="w-14 text-muted-foreground">Status:</span>
                          <span>{u.status}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="w-14 text-muted-foreground">Date:</span>
                          <span>{u.date}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="w-14 text-muted-foreground">Time:</span>
                          <span>{u.time}</span>
                        </div>
                      </div>
                    ))}

                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

      </div>

      {/* ROW 2 */}
      <div className="col-span-3">
        <Card className="p-6">
          <h3 className="text-sm font-bold uppercase mb-3">
            Supporting Documents
          </h3>

          <div className="space-y-2">
            {(record?.files ?? "")
              .split(",")
              .filter(Boolean)
              .map((file, i) => (
                <button
                  key={i}
                  className="w-full text-left text-sm px-3 py-2 rounded-lg border bg-muted/40 hover:bg-muted"
                  onClick={() => window.open(file.trim(), "_blank")}
                >
                  📄 {file.trim()}
                </button>
              ))}
          </div>

        </Card>
      </div>

    </div>
  );
}

// ─── My Declarations ───────────────────────────────────────────────────────────
import * as XLSX from "xlsx";

function MyDeclarationsScreen() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [approverFilter, setApproverFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("");
  const [activeKpi, setActiveKpi] = useState("All");

  const [sortKey, setSortKey] = useState<keyof Declaration | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const [viewDecl, setViewDecl] = useState<Declaration | null>(null);

  // FILTERING
  const filtered = declarations.filter(d =>
    (!search ||
      d.id.toLowerCase().includes(search.toLowerCase()) ||
      d.Counterparty.toLowerCase().includes(search.toLowerCase()) ||
      d.employee.toLowerCase().includes(search.toLowerCase())
    ) &&
    (typeFilter === "All" || d.type === typeFilter) &&
    (statusFilter === "All" || d.status === statusFilter) &&
    (approverFilter === "All" || d.approver === approverFilter) &&
    (!dateFilter || d.submitted === dateFilter)
  );

  // SORTING
  const sorted = [...filtered].sort((a, b) => {
  if (!sortKey) return 0;

  const aVal = a[sortKey] ?? "";
  const bVal = b[sortKey] ?? "";

  // Convert numbers safely
  if (typeof aVal === "number" && typeof bVal === "number") {
    return sortDir === "asc" ? aVal - bVal : bVal - aVal;
  }

  // Convert everything else to string
  const aStr = String(aVal).toLowerCase();
  const bStr = String(bVal).toLowerCase();

  if (aStr < bStr) return sortDir === "asc" ? -1 : 1;
  if (aStr > bStr) return sortDir === "asc" ? 1 : -1;

  return 0;
});

  // PAGINATION
  const totalPages = Math.ceil(sorted.length / pageSize);

  const paginated = sorted.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // KPI
  const totalValue = declarations.reduce((s, d) => s + d.value, 0);

  const handleKpiClick = (type: string) => {
    setActiveKpi(type);
    setCurrentPage(1);
    setStatusFilter(type === "All" ? "All" : type);
  };

  // EXCEL EXPORT
  const exportExcel = () => {
    const data = filtered.map(d => ({
      ID: d.id,
      Employee: d.employee,
      Type: d.type,
      Vendor: d.Counterparty,
      Value: d.value,
      Submitted: d.submitted,
      Status: d.status,
      Approver: d.approver,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Declarations");

    XLSX.writeFile(wb, "Declarations.xlsx");
  };

  if (viewDecl) return <DeclarationDetailView data={viewDecl} onBack={() => setViewDecl(null)} />;

  return (
    <div>

      <PageHeader
        title="My Declarations"
        subtitle="Manage and review your declarations"
        actions={
          <button onClick={exportExcel} className="h-9 px-4 rounded-xl border bg-white hover:bg-muted flex gap-2 items-center">
            <Download size={13}/> Export Excel
          </button>
        }
      />

      {/* KPI CARDS */}
      <div className="grid grid-cols-5 gap-4 mb-7">
        <KpiCard label="Total" value={String(declarations.length)} icon={FileText} color="#7c3aed" active={activeKpi==="All"} onClick={()=>handleKpiClick("All")} />
        <KpiCard label="Pending" value={String(declarations.filter(d=>d.status==="Pending").length)} icon={Clock} color="#f59e0b" active={activeKpi==="Pending"} onClick={()=>handleKpiClick("Pending")} />
        <KpiCard label="Approved" value={String(declarations.filter(d=>d.status==="Approved").length)} icon={Check} color="#10b981" active={activeKpi==="Approved"} onClick={()=>handleKpiClick("Approved")} />
        <KpiCard label="Declined" value={String(declarations.filter(d=>d.status==="Declined").length)} icon={X} color="#ef4444" active={activeKpi==="Declined"} onClick={()=>handleKpiClick("Declined")} />
        <KpiCard label="Total Value" value={`R ${Math.round(totalValue/1000)}K`} icon={DollarSign} color="#6366f1" />
      </div>

      {/* FILTERS */}
      <Card className="p-3 mb-4 flex gap-3 flex-wrap">
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." className="h-9 px-3 border rounded-lg"/>

        <select onChange={e=>setTypeFilter(e.target.value)} className="h-9 border rounded-lg px-2">
          <option>All</option>
          <option>Gift</option>
          <option>Hospitality</option>
          <option>Entertainment</option>
        </select>

        <select onChange={e=>setStatusFilter(e.target.value)} className="h-9 border rounded-lg px-2">
          <option>All</option>
          <option>Pending</option>
          <option>Approved</option>
          <option>Declined</option>
        </select>

        <select onChange={e=>setApproverFilter(e.target.value)} className="h-9 border rounded-lg px-2">
          <option>All</option>
          {[...new Set(declarations.map(d=>d.approver))].map(a=>(
            <option key={a}>{a}</option>
          ))}
        </select>

        <input type="date" onChange={e=>setDateFilter(e.target.value)} className="h-9 border rounded-lg px-2"/>
      </Card>

      {/* TABLE */}
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white z-10">
            <tr>
              {["id","type","vendor","value","submitted","approver"].map(key=>(
                <th
                  key={key}
                  onClick={()=>{
                    if (sortKey===key) setSortDir(sortDir==="asc"?"desc":"asc");
                    else { setSortKey(key as keyof Declaration); setSortDir("asc"); }
                  }}
                  className="px-5 py-3 text-left cursor-pointer text-xs font-bold hover:text-primary"
                >
                  {key.toUpperCase()}
                </th>
              ))}
              <th className="px-5 py-3 text-xs font-bold">ACTIONS</th>
            </tr>
          </thead>

          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-10 text-muted-foreground">
                  No declarations found
                </td>
              </tr>
            ) : (
              paginated.map(d=>(
                <tr key={d.id} className="hover:bg-muted/20 transition">
                  <td className="px-5 py-3">{d.id}</td>
                  <td>{d.type}</td>
                  <td>{d.Counterparty}</td>
                  <td>{formatRand(d.value)}</td>
                  <td>{d.submitted}</td>
                  <td>{d.approver}</td>
                  <td><StatusBadge status={d.status}/></td>

                  {/*  ACTIONS COLUMN */}
                  <td className="px-5 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setViewDecl(d)}
                        className="h-8 px-3 rounded-lg text-xs font-semibold bg-secondary hover:bg-secondary/70 flex items-center gap-1"
                      >
                        <Eye size={12}/> View
                      </button>

                      <button
                        onClick={() => {
                          const csv = Object.entries(d)
                            .map(([k,v]) => `${k},${v}`)
                            .join("\n");

                          const a = document.createElement("a");
                          a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
                          a.download = `${d.id}.csv`;
                          a.click();
                        }}
                        className="h-8 px-3 rounded-lg text-xs border hover:border-primary flex items-center gap-1"
                      >
                        <Download size={12}/> Export
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* FOOTER */}
        <div className="flex justify-between p-4 border-t">
          <p className="text-xs">
            Showing {(currentPage-1)*pageSize+1}–
            {Math.min(currentPage*pageSize, filtered.length)} of {filtered.length}
          </p>

          <div className="flex gap-2">
            <button disabled={currentPage===1} onClick={()=>setCurrentPage(p=>p-1)}>Prev</button>

            {[...Array(totalPages)].map((_,i)=>(
              <button key={i}
                onClick={()=>setCurrentPage(i+1)}
                className={currentPage===i+1 ? "bg-purple-600 text-white px-2" : "px-2"}
              >
                {i+1}
              </button>
            ))}

            <button disabled={currentPage===totalPages} onClick={()=>setCurrentPage(p=>p+1)}>Next</button>
          </div>
        </div>

      </Card>
    </div>
  );
}

// ─── Approver Dashboard ────────────────────────────────────────────────────────
function ApproverDashboard({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  
  const pending = declarations.filter(d => d.status === "Pending");
  const approved = declarations.filter(d => d.status === "Approved");
  const declined = declarations.filter(d => d.status === "Declined");
  const escalated = declarations.filter(d => d.status === "Escalated");

  const totalValue = declarations.reduce((s, d) => s + d.value, 0);
  const kpis = [
    {
      label: "Pending Queue",
      value: pending.length,
      icon: Clock,
      color: "#f59e0b",
      onClick: () => onNavigate("approval-queue"),
    },
    {
      label: "Approved",
      value: approved.length,
      icon: Check,
      color: "#10b981",
      onClick: () => onNavigate("approval-queue"),
    },
    {
      label: "Declined",
      value: declined.length,
      icon: X,
      color: "#ef4444",
      onClick: () => onNavigate("approval-queue"),
    },
    {
      label: "Escalated",
      value: escalated.length,
      icon: ArrowUp,
      color: "#f97316",
      onClick: () => onNavigate("approval-queue"),
    },
    {
      label: "Total Value",
      value: `R ${Math.round(totalValue / 1000)}K`,
      icon: DollarSign,
      color: "#6366f1",
    },
  ];

  const queue = declarations.filter(d => ["Pending", "Escalated"].includes(d.status)).slice(0, 4);
  return (
    <div className="space-y-6">
      <PageHeader title="Approver Dashboard" subtitle="Hollywoodbets GHE Overview"
        actions={
          <button onClick={() => onNavigate("approval-queue")} className="h-10 px-5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-all flex items-center gap-2"
            style={{ background: `linear-gradient(135deg, ${PURPLE}, #6d28d9)` }}>
            <CheckSquare size={15} /> Approval Queue
            <span className="ml-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: YELLOW, color: "#1E1E2D" }}>14</span>
          </button>
        } />
      <div className="grid grid-cols-5 gap-4 mb-6">
        {kpis.map((k, i) => (
          <div
            key={i}
            onClick={k.onClick}
            className="p-5 rounded-2xl cursor-pointer transition-all duration-300 hover:scale-[1.03] hover:shadow-lg border"
            style={{
              background: `linear-gradient(135deg, ${k.color}15, ${k.color}05)`,
              borderColor: "#eee",
            }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
              style={{ background: k.color + "20" }}
            >
              <k.icon size={18} style={{ color: k.color }} />
            </div>

            <p className="text-2xl font-bold text-foreground">{k.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{k.label}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-5">
        <Card className="col-span-1 p-5 flex flex-col" style={{ borderLeft: `4px solid ${YELLOW}` }}>
          <div className="flex items-center gap-2 mb-1"><AlertTriangle size={14} style={{ color: "#d97706" }} /><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">My Next Step</p></div>
          <h3 className="text-base font-bold text-foreground mb-0.5">Actions Requiring Your Attention</h3>
          <div className="flex items-center gap-3 my-4">
            <div className="text-4xl font-bold" style={{ color: PURPLE }}>2</div>
            <div><p className="text-sm font-semibold text-foreground">declarations awaiting review</p><p className="text-xs text-red-600 font-semibold mt-0.5">2 overdue</p></div>
          </div>
          <div className="space-y-2 mb-4 flex-1">
            {[{ id: "GHE-2024-0047", employee: "Nomvula Dlamini" }, { id: "GHE-2024-0042", employee: "Bongani Cele" }].map(item => (
              <div key={item.id} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30">
                <div><p className="text-xs font-mono font-bold" style={{ color: PURPLE }}>{item.id}</p><p className="text-xs text-muted-foreground">{item.employee}</p></div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-600">Overdue</span>
              </div>
            ))}
          </div>
          <button onClick={() => onNavigate("approval-queue")} className="w-full h-9 rounded-xl text-xs font-semibold text-white hover:opacity-90 flex items-center justify-center gap-1.5"
            style={{ background: `linear-gradient(135deg, ${PURPLE}, #6d28d9)` }}>View My Actions <ChevronRight size={13} /></button>
        </Card>
        <Card className="col-span-2 overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">Pending Approvals</h3>
            <button onClick={() => onNavigate("approval-queue")} className="text-xs font-semibold hover:underline" style={{ color: PURPLE }}>View all</button>
          </div>
          <table className="w-full text-sm">
            <THead cols={["ID", "Employee", "Type", "Value", "Priority", "Status"]} />
            <tbody className="divide-y divide-border">
              {queue.map(d => (
                <tr key={d.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3"><span className="font-mono text-xs font-bold" style={{ color: PURPLE }}>{d.id}</span></td>
                  <td className="px-5 py-3 text-xs font-medium text-foreground whitespace-nowrap">{d.employee}</td>
                  <td className="px-5 py-3"><TypeBadge type={d.type} /></td>
                  <td className="px-5 py-3 text-xs font-semibold tabular-nums">{formatRand(d.value)}</td>
                  <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${d.priority === "High" ? "bg-red-50 text-red-700" : d.priority === "Medium" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{d.priority}</span></td>
                  <td className="px-5 py-3"><StatusBadge status={d.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
      <div className="grid grid-cols-3 gap-5">
        <Card className="col-span-2 p-6">
          <h3 className="text-sm font-bold text-foreground mb-0.5">Monthly Declaration Volume</h3>
          <p className="text-xs text-muted-foreground mb-5">Approved vs Declined per month</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={complianceTrend} barGap={4} barSize={18}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(79 29 149 / 0.06)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6B6B80", fontFamily: "'Plus Jakarta Sans',sans-serif" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#6B6B80", fontFamily: "'Plus Jakarta Sans',sans-serif" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid rgb(79 29 149 / 0.12)", borderRadius: 12, fontSize: 12, fontFamily: "'Plus Jakarta Sans',sans-serif" }} cursor={{ fill: "rgb(79 29 149 / 0.04)" }} />
              <Legend wrapperStyle={{ fontSize: 12, fontFamily: "'Plus Jakarta Sans',sans-serif" }} />
              <Bar dataKey="approved" name="Approved" fill="#059669" radius={[4,4,0,0]} />
              <Bar dataKey="Declined" name="Declined" fill="#dc2626" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-6 flex flex-col">
          <h3 className="text-sm font-bold text-foreground mb-0.5">Declarations by Type</h3>
          <p className="text-xs text-muted-foreground mb-4">This month's breakdown</p>
          <div className="flex-1 flex items-center justify-center">
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={typeBreakdown} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                  {typeBreakdown.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid rgb(79 29 149 / 0.12)", borderRadius: 12, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-2">
            {typeBreakdown.map(t => (
              <div key={t.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-sm" style={{ background: t.color }} /><span className="text-xs text-muted-foreground">{t.name}</span></div>
                <span className="text-xs font-semibold text-foreground">{t.value}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── Approval Queue ────────────────────────────────────────────────────────────
function ApprovalQueue({ onReview }: { onReview: (d: Declaration) => void }) {
  const queue = declarations.filter(d => ["Pending", "Escalated", "Info Requested"].includes(d.status));
  const priorityStyle: Record<string, string> = { High: "bg-red-50 text-red-700", Medium: "bg-amber-50 text-amber-700", Low: "bg-emerald-50 text-emerald-700" };
  return (
    <div>
      <PageHeader title="Approval Queue" subtitle={`${queue.length} declarations awaiting your review`}
        actions={<>
          <button className="h-9 px-4 rounded-xl text-sm font-semibold border border-border bg-white hover:bg-muted transition-colors flex items-center gap-2"><Filter size={13} /> Filters</button>
          <button className="h-9 px-4 rounded-xl text-sm font-semibold border border-border bg-white hover:bg-muted transition-colors flex items-center gap-2"><Download size={13} /> Export</button>
        </>} />
      <Card className="p-3.5 mb-4 flex gap-3">
        <div className="relative flex-1"><Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" /><input placeholder="Search declarations…" className="w-full h-9 pl-9 pr-4 rounded-lg text-sm border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" /></div>
        <div className="relative"><select className="h-9 pl-3.5 pr-9 rounded-lg text-sm border border-border bg-white appearance-none"><option>All Departments</option><option>Marketing</option><option>Sales</option><option>IT</option></select><ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" /></div>
      </Card>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <THead cols={["Declaration ID", "Employee", "Dept", "Type", "Counterparty", "Value", "Submitted", "Priority", "Status", "Actions"]} />
          <tbody className="divide-y divide-border">
            {queue.map(d => (
              <tr key={d.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-5 py-3.5"><span className="font-mono text-xs font-bold" style={{ color: PURPLE }}>{d.id}</span></td>
                <td className="px-5 py-3.5 text-sm font-medium text-foreground whitespace-nowrap">{d.employee}</td>
                <td className="px-5 py-3.5 text-xs text-muted-foreground">{d.department}</td>
                <td className="px-5 py-3.5"><TypeBadge type={d.type} /></td>
                <td className="px-5 py-3.5 text-sm font-medium text-foreground">{d.Counterparty}</td>
                <td className="px-5 py-3.5 text-sm font-semibold tabular-nums whitespace-nowrap">{formatRand(d.value)}</td>
                <td className="px-5 py-3.5 text-xs text-muted-foreground tabular-nums whitespace-nowrap">{d.submitted}</td>
                <td className="px-5 py-3.5"><span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${priorityStyle[d.priority]}`}>{d.priority}</span></td>
                <td className="px-5 py-3.5"><StatusBadge status={d.status} /></td>
                <td className="px-5 py-3.5"><button onClick={() => onReview(d)} className="h-8 px-3 rounded-lg text-xs font-semibold text-white hover:opacity-90" style={{ background: PURPLE }}>Review</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-5 py-3.5 border-t border-border flex items-center justify-between bg-[#F7F8FC]">
          <p className="text-xs text-muted-foreground">Showing <span className="font-semibold text-foreground">{queue.length}</span> declarations</p>
          <div className="flex gap-1.5">{[1,2].map(p => <button key={p} className="w-8 h-8 rounded-lg text-xs font-semibold" style={p === 1 ? { background: PURPLE, color: "#fff" } : { background: "#F0EEF8", color: "#6B6B80" }}>{p}</button>)}</div>
        </div>
      </Card>
    </div>
  );
}


// ─── Approver Decision Block ───────────────────────────────────────────────────
function ApproverDecisionBlock({
  title,
  role,
  decision,
  onSelect,
  notes,
  onNotesChange,
}: {
  title: string;
  role: string;
  decision: ApprovalDecision;
  onSelect: (v: ApprovalDecision) => void;
  notes: string;
  onNotesChange: (v: string) => void;
}) {
  return (
    <Card className="p-5">
      {/* HEADER */}
      <div className="flex items-center gap-2.5 mb-4 pb-3.5 border-b border-border">
        <div className="w-2 h-2 rounded-full" style={{ background: PURPLE }} />
        <div>
          <p className="text-sm font-bold">{title}</p>
          <p className="text-xs text-muted-foreground">{role}</p>
        </div>
      </div>

      {/* OPTIONS (FIXED HEIGHT + NO LAYOUT SHIFT) */}
      <div className="space-y-2 mb-4 min-h-[220px]">
        {approvalOptions.map(opt => (
          <label
            key={opt.value}
            className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors
              ${
                decision === opt.value
                  ? "border-primary bg-[#F5F2FF]"
                  : "border-transparent hover:border-border hover:bg-muted/20"
              }`}
          >
            {/* RADIO ICON */}
            <div className="flex-shrink-0">
              <div
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center
                  ${
                    decision === opt.value
                      ? "border-primary"
                      : "border-muted-foreground/40"
                  }`}
              >
                {decision === opt.value && (
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ background: PURPLE }}
                  />
                )}
              </div>
            </div>

            {/* TEXT */}
            <p className="text-sm text-foreground leading-snug">
              {opt.label}
            </p>

            <input
              type="radio"
              name={title}
              checked={decision === opt.value}
              onChange={() => onSelect(opt.value as ApprovalDecision)}
              className="sr-only"
            />
          </label>
        ))}
      </div>

      {/* NOTES */}
      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
          Notes / Comments
        </label>
        <textarea
          value={notes}
          onChange={e => onNotesChange(e.target.value)}
          rows={2}
          className="w-full rounded-xl px-3.5 py-2.5 text-sm border bg-muted/20"
          placeholder="Add notes or reasoning..."
        />
      </div>
    </Card>
  );
}

// ─── Approval Detail ───────────────────────────────────────────────────────────
function ApprovalDetail({
  declaration,
  onBack,
}: {
  declaration: Declaration;
  onBack: () => void;
}) {
  const [lmDecision, setLmDecision] = useState<ApprovalDecision>(null);
  const [hrDecision, setHrDecision] = useState<ApprovalDecision>(null);
  const [ceoDecision, setCeoDecision] = useState<ApprovalDecision>(null);

  const [lmNotes, setLmNotes] = useState("");
  const [hrNotes, setHrNotes] = useState("");
  const [ceoNotes, setCeoNotes] = useState("");

  // 🔒 STEP LOGIC
  const isHrEnabled = !!lmDecision;
  const isCeoEnabled = !!lmDecision && !!hrDecision;

  // SAVE
  const handleSave = () => {
    console.log("Saved:", {
      lmDecision,
      hrDecision,
      ceoDecision,
    });
    alert("Progress saved");
  };

  // SUBMIT
  const handleSubmit = () => {
    if (!lmDecision) {
      alert("Line Manager decision is required");
      return;
    }

    if (!hrDecision) {
      alert("HR decision is required");
      return;
    }

    if (!ceoDecision) {
      alert("CEO decision is required");
      return;
    }

    console.log("Final submission:", {
      declarationId: declaration.id,
      lmDecision,
      hrDecision,
      ceoDecision,
    });

    alert("Workflow completed");
    onBack();
  };

  return (
    <div>
      {/* HEADER */}
      <div className="flex items-center gap-2.5 mb-7 pb-5 border-b border-border">
        <button onClick={onBack} className="h-9 px-3.5 border rounded-xl">
          <ArrowLeft size={14} /> Back
        </button>

        <span className="font-mono font-bold">{declaration.id}</span>
        <StatusBadge status={declaration.status} />
      </div>

      <div className="grid grid-cols-5 gap-5">

        {/* LEFT */}
        <div className="col-span-3">
          <DeclarationDetailView data={declaration} onBack={onBack} />
        </div>

        {/* RIGHT */}
        <div className="col-span-2 space-y-4 sticky top-4 self-start">

          {/* STEP 1 */}
          <ApproverDecisionBlock
            title="1. Line Manager Approval"
            role="Sipho Nkosi"
            decision={lmDecision}
            onSelect={setLmDecision}
            notes={lmNotes}
            onNotesChange={setLmNotes}
          />

          {/* STEP 2 */}
          <div className={!isHrEnabled ? "opacity-50 pointer-events-none" : ""}>
            <ApproverDecisionBlock
              title="2. Head of HR Approval"
              role="Lindiwe Zulu"
              decision={hrDecision}
              onSelect={setHrDecision}
              notes={hrNotes}
              onNotesChange={setHrNotes}
            />
          </div>

          {/* STEP 3 */}
          <div className={!isCeoEnabled ? "opacity-50 pointer-events-none" : ""}>
            <ApproverDecisionBlock
              title="3. Group CEO Approval"
              role="Sandile Shabalala"
              decision={ceoDecision}
              onSelect={setCeoDecision}
              notes={ceoNotes}
              onNotesChange={setCeoNotes}
            />
          </div>

          {/* ACTIONS */}
          <Card className="p-5">
            <p className="text-xs text-muted-foreground mb-3">
              Complete all steps in sequence before submitting.
            </p>

            <div className="flex gap-2.5">
              <button
                onClick={handleSave}
                className="flex-1 h-10 border rounded-xl"
              >
                Save Progress
              </button>

              <button
                onClick={handleSubmit}
                disabled={!lmDecision || !hrDecision || !ceoDecision}
                className="flex-1 h-10 text-white rounded-xl disabled:opacity-40"
                style={{
                  background: `linear-gradient(135deg, ${PURPLE}, #6d28d9)`,
                }}
              >
                Submit Decision
              </button>
            </div>
          </Card>

        </div>
      </div>
    </div>
  );
}

// ─── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [role, setRole] = useState<Role>("teamMember");
  const [userName, setUserName] = useState("");
  const [selectedDecl, setSelectedDecl] = useState<Declaration | null>(null);
  const [submittedData, setSubmittedData] = useState<Record<string, string> | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showSubmittedView, setShowSubmittedView] = useState(false);
  const [showDraftBanner, setShowDraftBanner] = useState(false);

  const handleLogin = (r: Role, name: string) => { setRole(r); setUserName(name); setScreen(r === "approver" ? "approver-dashboard" : "new-declaration"); };
  const handleSignOut = () => { setScreen("landing"); setUserName(""); setSelectedDecl(null); setSubmittedData(null); setShowSuccess(false); setShowSubmittedView(false); };
  const handleSubmitSuccess = (data: Record<string, string>) => { setSubmittedData(data); setShowSuccess(true); setShowSubmittedView(false); };

  if (screen === "landing" || screen === "login") return <LandingScreen onEnter={handleLogin} />;

  return (
    <>
      {showDraftBanner && <DraftBanner onDismiss={() => setShowDraftBanner(false)} />}
      <AppShell role={role} screen={screen} userName={userName} onNavigate={setScreen} onSignOut={handleSignOut}>
        {screen === "new-declaration" && !showSubmittedView && (
          <NewDeclarationScreen onSubmitSuccess={handleSubmitSuccess} onDraftSaved={() => setShowDraftBanner(true)} />
        )}
        {screen === "new-declaration" && showSubmittedView && submittedData && (
          <DeclarationDetailView data={submittedData} onBack={() => setShowSubmittedView(false)} />
        )}
        {screen === "my-declarations"    && <MyDeclarationsScreen />}
        {screen === "approver-dashboard" && <ApproverDashboard onNavigate={setScreen} />}
        {screen === "approval-queue"     && <ApprovalQueue onReview={d => { setSelectedDecl(d); setScreen("approval-detail"); }} />}
        {screen === "approval-detail"    && selectedDecl && <ApprovalDetail declaration={selectedDecl} onBack={() => setScreen("approval-queue")} />}
      </AppShell>
      {showSuccess && submittedData && (
        <SuccessModal data={submittedData} onClose={() => setShowSuccess(false)} onView={() => { setShowSuccess(false); setShowSubmittedView(true); }} />
      )}
    </>
  );
}
