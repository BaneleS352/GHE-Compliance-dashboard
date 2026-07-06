import image_Hollywood_Group_Logo from '@/imports/Hollywood_Group_Logo.png'
import image_Logo_1 from '@/imports/Logo-1.png'
import React, { useState, useRef, useEffect, useCallback } from "react";
import * as Select from "@radix-ui/react-select";
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
type ApprovalDecision = "accept" | "discuss-org" | "discuss-foundation" | "return" | null;

interface Declaration {
  id: string; employee: string; department: string; type: string; Counterparty: string;
  value: number; submitted: string; approver: string; status: StatusType;
  priority: "High" | "Medium" | "Low"; description: string; relationship: string;
  teamMemberNumber: string; lineManager: string; position: string;
  receivedGiven: string; from: string; contactPerson: string;
  biddingProcess: string; occasion: string; date: string; instances: string; publicOfficial: string;
  company?: string; team?: string;
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
  { value: "accept", label: "Accept the actual GHE or offered Gift / Hospitality / Entertainment", description: "Approve the declaration as submitted — the GHE is compliant and may be accepted or given." },
  { value: "discuss-org", label: "Approved — Team Member to discuss with the Organisation Post", description: "Approved, and Team Member must discuss the actual GHE or offered GHE with the Organisation Post." },
  { value: "discuss-foundation", label: "Approved — Team Member to discuss with Hollywoodbets Foundation", description: "Approved, and Team Member must discuss the actual GHE with the Hollywoodbets Foundation." },
  { value: "return", label: "Return / Reject the GHE", description: "Team Member must return the actual GHE or reject the offered Gift/Hospitality/Entertainment." },
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

const inp = "w-full h-11 rounded-xl px-4 text-sm border border-slate-200 bg-slate-50 text-foreground focus:outline-none focus:ring-4 focus:ring-purple-500/20 focus:border-purple-600 focus:bg-white hover:border-purple-300 transition-all duration-200 ease-out placeholder:text-muted-foreground/50";
const sel = `${inp} appearance-none pr-10 cursor-pointer bg-white border-slate-200 hover:bg-purple-50 hover:border-purple-400 hover:text-[15.5px] hover:font-semibold hover:text-purple-900 focus:bg-white focus:border-purple-600 shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_14px_rgba(79,29,149,0.12)] transition-all duration-300`;

function Sel({ children, value, onChange, className = "" }: { children: React.ReactNode; value?: string; onChange?: (v: string) => void; className?: string }) {
  const options = React.Children.toArray(children).map(child => {
    if (React.isValidElement(child) && child.type === 'option') {
      const val = (child.props.value !== undefined ? child.props.value : child.props.children) as string;
      return { value: val === "" ? "__placeholder__" : val, label: child.props.children };
    }
    return null;
  }).filter(Boolean) as {value: string, label: React.ReactNode}[];

  const safeValue = value === "" ? "__placeholder__" : value;
  const selectedLabel = options.find(o => o.value === safeValue)?.label || options[0]?.label;

  return (
    <Select.Root value={safeValue} onValueChange={(v) => onChange?.(v === "__placeholder__" ? "" : v)}>
      <Select.Trigger className={`${sel} flex items-center justify-between group ${className}`}>
        <Select.Value>{selectedLabel}</Select.Value>
        <Select.Icon><ChevronDown size={15} className="text-slate-400 group-hover:text-purple-500 transition-colors" /></Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content position="popper" sideOffset={4} className="bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50 w-[var(--radix-select-trigger-width)]">
          <Select.Viewport className="p-1.5">
            {options.map((opt, i) => (
              <Select.Item key={i} value={opt.value} className="text-sm font-medium text-slate-700 px-3 py-2.5 rounded-lg cursor-pointer outline-none data-[highlighted]:bg-yellow-400 data-[highlighted]:text-yellow-950 transition-colors">
                <Select.ItemText>{opt.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white/70 backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_8px_32px_rgba(31,38,135,0.04)] hover:shadow-[0_8px_32px_rgba(31,38,135,0.08)] transition-shadow duration-300 ${className}`}>{children}</div>;
}

function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-7 pb-5 border-b border-border gap-4">
      <div><h1 className="text-[22px] font-bold tracking-tight text-foreground">{title}</h1>{subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}</div>
      {actions && <div className="flex items-center gap-2.5">{actions}</div>}
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, iconBg, iconColor, trend, trendColor }: {
  label: string; value: string; icon: React.ElementType; iconBg: string; iconColor: string; trend?: string; trendColor?: string;
}) {
  return (
    <Card className="p-5">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: iconBg }}><Icon size={18} style={{ color: iconColor }} /></div>
      <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
      <p className="text-xs font-medium text-muted-foreground mt-1 leading-tight">{label}</p>
      {trend && <p className="text-[11px] font-semibold mt-2" style={{ color: trendColor ?? iconColor }}>{trend}</p>}
    </Card>
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
    <header className="h-16 bg-white/60 backdrop-blur-xl border-b border-white/60 flex items-center justify-between px-6 flex-shrink-0 relative z-20 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
      <div className="flex items-center gap-4 flex-1 mr-6">
        <ImageWithFallback src={groupLogoImg} alt="Hollywoodbets Group" className="h-8 w-auto object-contain drop-shadow-sm flex-shrink-0" />
        <div className="h-6 w-px bg-slate-200/80 flex-shrink-0" />
        <div className="hidden md:flex flex-1 items-center justify-center gap-3 bg-gradient-to-r from-purple-100/50 to-indigo-50/50 border border-purple-200/60 px-8 py-2 rounded-full shadow-sm backdrop-blur-md hover:shadow-md transition-all">
          <span className="w-2.5 h-2.5 rounded-full bg-purple-600 animate-pulse shadow-[0_0_8px_rgba(147,51,234,0.6)] flex-shrink-0" />
          <span className="text-sm font-black uppercase tracking-widest bg-gradient-to-r from-purple-600 via-pink-500 to-indigo-600 bg-clip-text text-transparent drop-shadow-sm animate-gradient-text truncate">GHE Declaration System</span>
        </div>
      </div>
      <div className="flex items-center gap-4 flex-shrink-0">
        <button className="relative w-10 h-10 flex items-center justify-center rounded-full bg-white/60 border border-white/80 shadow-sm hover:shadow-md hover:scale-105 transition-all text-slate-500 hover:text-purple-600">
          <Bell size={18} />
          <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full ring-2 ring-white" style={{ background: YELLOW }} />
        </button>
        <div className="h-6 w-px bg-slate-200/80" />
        <div className="flex items-center gap-3 bg-white/60 border border-white/80 rounded-full pl-1.5 pr-4 py-1.5 shadow-sm hover:bg-white transition-colors cursor-pointer group">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md group-hover:scale-105 transition-transform" style={{ background: `linear-gradient(135deg, ${PURPLE}, #6d28d9)` }}>{initials}</div>
          <div className="hidden md:block">
            <p className="text-sm font-bold text-slate-800 leading-none">{userName}</p>
            <p className="text-[10px] font-semibold text-purple-600 mt-0.5 uppercase tracking-wider">{role === "teamMember" ? "Team Member" : "Approver"}</p>
          </div>
        </div>
        <button onClick={onSignOut} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/60 border border-white/80 shadow-sm hover:shadow-md hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition-all text-slate-500">
          <LogOut size={16} />
        </button>
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
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 relative" style={F}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[10%] w-[40%] h-[40%] rounded-full bg-purple-400/20 blur-[120px]" />
        <div className="absolute top-[30%] right-[-5%] w-[30%] h-[50%] rounded-full bg-blue-400/15 blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[20%] w-[50%] h-[40%] rounded-full bg-fuchsia-400/15 blur-[120px]" />
      </div>
      <Sidebar role={role} screen={screen} onNavigate={onNavigate} collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <div className="flex flex-col flex-1 min-w-0 min-h-0 relative z-10">
        <TopBar userName={userName} role={role} onSignOut={onSignOut} />
        <main className="flex-1 min-h-0 overflow-y-auto p-7">{children}</main>
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
  { id: "sec-ghe",         num: "3", label: "Gift, Hospitality or Entertainment Details" },
  { id: "sec-docs",        num: "4", label: "Supporting Documents" },
  { id: "sec-undertaking", num: "5", label: "Declaration & Undertaking" },
];

function FS({ id, num, title, children }: { id: string; num: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white shadow-[0_4px_10px_rgba(79,29,149,0.2)] flex-shrink-0" style={{ background: `linear-gradient(135deg, ${PURPLE}, #6d28d9)` }}>{num}</div>
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">{title}</h3>
        <div className="flex-1 h-px bg-gradient-to-r from-border to-transparent" />
      </div>
      <Card className="p-6 lg:p-8">{children}</Card>
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
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      const sectionMap: Record<string, string> = {
        employeeName: "sec-team", employeeCode: "sec-team", lineManager: "sec-team", company: "sec-team", department: "sec-team", position: "sec-team",
        partyType: "sec-declaration", Counterparty: "sec-declaration", contactPerson: "sec-declaration",
        existingRelationship: "sec-declaration", contractNegotiation: "sec-declaration", biddingProcess: "sec-declaration",
        category: "sec-ghe", description: "sec-ghe", date: "sec-ghe", instances: "sec-ghe",
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
  const ynu = ["Yes", "No", "N/A"];
  const categoryDefs: Record<string, string> = {
    Gift: "Anything of value, including cash, vouchers, goods, services, preferential discounts or favours.",
    Hospitality: "Accommodation, travel, conferences, tickets or formal business functions.",
    Entertainment: "Meals, events, sporting or cultural activities or recreational activities.",
  };
  const occasionOptions = ["Festive Season", "Year End", "Milestone", "Business Meeting", "Relationship Maintenance", "Other"];

  const ErrInp = ({ field, ...props }: { field: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} className={`${inp} ${errors[field] ? "border-red-500 bg-red-50 focus:ring-4 focus:ring-red-500/20 focus:border-red-600 hover:border-red-400" : ""}`} />
  );

  return (
    <div className="flex items-start gap-6 max-w-7xl mx-auto">
      {/* Sticky nav */}
      <aside className="w-48 flex-shrink-0 hidden lg:flex flex-col gap-3 sticky top-6 self-start">
        <div className="flex flex-col gap-3">
          <Card className="p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5 px-1">Sections</p>
            <nav className="space-y-0.5">
              {FORM_SECTIONS.map(s => {
                const active = activeSection === s.id;
                return (
                  <button key={s.id} onClick={() => jumpTo(s.id)}
                    className={`w-full flex items-center gap-3 text-left py-2.5 px-3 rounded-xl text-sm transition-all duration-200 ${active ? "text-purple-900 font-semibold bg-purple-50 shadow-sm" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50 font-medium"}`}>
                    <span className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0 shadow-sm transition-colors duration-200"
                      style={active ? { background: `linear-gradient(135deg, ${PURPLE}, #6d28d9)`, color: "#fff" } : { background: "#F0EEF8", color: "#6B6B80" }}>
                      {s.num}
                    </span>
                    <span className="leading-tight">{s.label}</span>
                  </button>
                );
              })}
            </nav>
          </Card>
          <div className="rounded-2xl border border-white p-3.5 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2.5" style={{ color: PURPLE }}>Definitions</p>
            {[{ t: "Gift", d: "Anything of value including cash, vouchers, goods, services, preferential discount or favours." }, { t: "Hospitality", d: "Accommodation, travel, conferences, tickets or formal business functions." }, { t: "Entertainment", d: "Meals, events, sporting, cultural or recreational activities." }].map(d => (
              <div key={d.t} className="mb-2.5 last:mb-0">
                <p className="text-[11px] font-bold text-foreground">{d.t}</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{d.d}</p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-white/60 p-3.5 bg-white/70 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.03)]">
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
            <p className="text-sm text-muted-foreground mt-0.5">Fields marked <span className="text-red-400 font-bold">*</span> are mandatory.</p>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="h-7 px-3 rounded-full text-xs font-bold bg-amber-100 text-amber-700 flex items-center">Draft</span>
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
              <FL error={errors.employeeCode}>Team Member Code</FL>
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
              <FL required error={errors.position}>Role / Position</FL>
              <ErrInp field="position" value={form.position} onChange={e => setF("position", e.target.value)} />
            </div>
          </div>
        </FS>

        {/* Section 2 */}
        <FS id="sec-declaration" num="2" title="Declaration Details">
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-5 items-stretch">
              <div className="flex flex-col">
                <FL required>Did you receive or give a Gift, Hospitality or Entertainment?</FL>
                <div className="mt-auto">
                  <Sel value={receivedGiven} onChange={setReceivedGiven}><option>Received</option><option>Given</option></Sel>
                </div>
              </div>
              <div className="flex flex-col">
                <FL required error={errors.partyType}>{receivedGiven === "Received" ? "Who did you receive it from?" : "Who did you give it to?"}</FL>
                <div className="mt-auto">
                  <Sel value={form.partyType} onChange={v => setF("partyType", v)} className={errors.partyType ? "border-red-500 bg-red-50 focus:ring-4 focus:ring-red-500/20 focus:border-red-600" : ""}>
                    <option value="">Select…</option>{partyOptions.map(o => <option key={o}>{o}</option>)}
                  </Sel>
                </div>
              </div>
            </div>
            <div>
              <FL required hint="Full name of the organisation or individual." error={errors.Counterparty}>Name of the Supplier, Customer, Team Member or Public Official</FL>
              <input className={`${inp} ${errors.Counterparty ? "border-red-400" : ""}`} value={form.Counterparty} onChange={e => setF("Counterparty", e.target.value)} placeholder="Full legal name" />
            </div>
            <div>
              <FL required error={errors.contactPerson}>Name of the person giving or receiving the gift at the Supplier or Customer, or name of the Public Official</FL>
              <input className={`${inp} ${errors.contactPerson ? "border-red-400" : ""}`} value={form.contactPerson} onChange={e => setF("contactPerson", e.target.value)} placeholder="e.g. Ahmed Al-Rashid" />
            </div>
            <div className="space-y-5">
              <div>
                <FL required error={errors.biddingProcess}>Is the Supplier or Team Member involved in a Bid In Progress?</FL>
                <Sel value={form.biddingProcess} onChange={v => setF("biddingProcess", v)} className={errors.biddingProcess ? "border-red-400" : ""}>
                  <option value="">Select…</option>{ynu.map(o => <option key={o}>{o}</option>)}
                </Sel>
              </div>
              <div>
                <FL required error={errors.contractNegotiation}>Are we currently negotiating a contract with the Supplier or Customer?</FL>
                <Sel value={form.contractNegotiation} onChange={v => setF("contractNegotiation", v)} className={errors.contractNegotiation ? "border-red-400" : ""}>
                  <option value="">Select…</option>{ynu.map(o => <option key={o}>{o}</option>)}
                </Sel>
              </div>
              <div>
                <FL required error={errors.existingRelationship}>Is there an existing or imminent business relationship with the supplier/customer?</FL>
                <Sel value={form.existingRelationship} onChange={v => setF("existingRelationship", v)} className={errors.existingRelationship ? "border-red-400" : ""}>
                  <option value="">Select…</option>{ynu.map(o => <option key={o}>{o}</option>)}
                </Sel>
              </div>
            </div>
          </div>
        </FS>

        {/* Section 3 */}
        <FS id="sec-ghe" num="3" title="Gift, Hospitality or Entertainment Details">
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
                <FL>Reason / Occasion for the gift</FL>
                <Sel value={form.occasion} onChange={v => setF("occasion", v)}>
                  <option value="">Select reason…</option>{occasionOptions.map(o => <option key={o}>{o}</option>)}
                </Sel>
              </div>
              <div>
                <FL required error={errors.date}>Date of Gift</FL>
                <input type="date" className={`${inp} ${errors.date ? "border-red-400" : ""}`} value={form.date} onChange={e => setF("date", e.target.value)} />
              </div>
            </div>
            <div>
              <FL required error={errors.instances}>Number of instances a gift has been given/received between you and this party in the past 12 months</FL>
              <Sel value={form.instances} onChange={v => setF("instances", v)} className={errors.instances ? "border-red-400" : ""}>
                <option value="">Select…</option>{["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", ">10"].map(n => <option key={n}>{n}</option>)}
              </Sel>
            </div>
            {/* VAT threshold at end of section */}
            <div>
              <FL hint="Enter the Rand value including VAT. Convert foreign currency to ZAR equivalent.">Rand Value or Equivalent Rand Value (including VAT)</FL>
              <div>
                <input type="number" className={inp} value={form.value} onChange={e => setF("value", e.target.value)} placeholder="0.00" />
              </div>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-2.5 mb-3">
                <AlertCircle size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800 leading-relaxed">If the Rand Value including VAT <strong>exceeds R2, 000.00</strong>, please substantiate why this Gift, Hospitality or Entertainment should be accepted or given.</p>
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
            className={`rounded-2xl border-2 border-dashed py-12 px-6 text-center cursor-pointer transition-all duration-300 ease-out group ${dragging ? "border-purple-500 bg-purple-50/50 scale-[1.02] shadow-sm" : "border-slate-300 bg-slate-50 hover:border-purple-400 hover:bg-purple-50/30 hover:shadow-sm"}`}>
            <div className="w-14 h-14 rounded-full bg-white shadow-sm flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:shadow-md transition-all duration-300"><Upload size={24} style={{ color: PURPLE }} /></div>
            <p className="text-sm font-semibold text-foreground mb-1.5">Drag &amp; drop files here, or click to browse</p>
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
              <div key={i} className="group flex items-start gap-3 py-3 px-4 rounded-xl bg-muted/30 border border-border/50 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm hover:border-purple-200/60 hover:bg-purple-50/40">
                <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:scale-110 group-hover:bg-purple-100 transition-all duration-300"><Check size={10} style={{ color: PURPLE }} /></div>
                <p className="text-sm text-foreground leading-relaxed transition-colors group-hover:text-purple-950">{item}</p>
              </div>
            ))}
          </div>

          <div className="pt-6 mt-2 border-t border-slate-100">
            <div className="flex justify-end gap-3">
              <button onClick={onDraftSaved} className="h-12 px-6 rounded-xl text-sm font-semibold border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 active:scale-[0.98]">Save Draft</button>
              <button onClick={handleSubmit} className="h-12 px-8 rounded-xl text-sm font-semibold text-white transition-all duration-300 ease-out flex items-center gap-2 shadow-[0_4px_14px_rgba(79,29,149,0.39)] hover:shadow-[0_6px_20px_rgba(79,29,149,0.23)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
                style={{ background: `linear-gradient(135deg, ${PURPLE}, #6d28d9)` }}>
                <Send size={14} /> Submit Declaration
              </button>
            </div>
          </div>
        </FS>
      </div>
    </div>
  );
}

// ─── Declaration Detail View (with approval workflow) ──────────────────────────
function DeclarationDetailView({ data, onBack }: { data: Record<string, string> | Declaration; onBack: () => void }) {
  const isRecord = typeof (data as Declaration).value === "number";
  const d = isRecord ? data as Declaration : null;

  const fields = d ? [
    ["Team Member", d.employee], ["TeamMemberCode", d.teamMemberNumber],
    ["Manager", d.lineManager], ["Department", d.department],
    ["Position", d.position], ["Received / Given", d.receivedGiven],
    ["Category", d.type], ["Counterparty", d.Counterparty],
    ["Contact Person", d.contactPerson], ["Date", d.date],
    ["Value", formatRand(d.value)], ["Occasion", d.occasion],
    ["Bid In Progress", d.biddingProcess], ["Instances", d.instances],
    ["Description", d.description],
  ] : [
    ["Team Member", (data as Record<string,string>).employee], ["TeamMemberCode", (data as Record<string,string>).employeeCode],
    ["Manager", (data as Record<string,string>).lineManager], ["Company", (data as Record<string,string>).company],
    ["Department", (data as Record<string,string>).department], ["Team", (data as Record<string,string>).team],
    ["Position", (data as Record<string,string>).position], ["Received / Given", (data as Record<string,string>).receivedGiven],
    ["Category", (data as Record<string,string>).type], ["Counterparty", (data as Record<string,string>).Counterparty],
    ["Contact Person", (data as Record<string,string>).contactPerson], ["Date", (data as Record<string,string>).date],
    ["Value", (data as Record<string,string>).value], ["Occasion", (data as Record<string,string>).occasion],
    ["Bid In Progress", (data as Record<string,string>).biddingProcess], ["Contract Negotiation", (data as Record<string,string>).contractNegotiation],
    ["Description", (data as Record<string,string>).description],
  ];

  const id = d ? d.id : (data as Record<string,string>).id;
  const status: StatusType = d ? d.status : "Pending";

  const workflowSteps = [
    { label: "Submitted", actor: "Team Member", done: true, date: d ? d.submitted : new Date().toLocaleDateString("en-ZA") },
    { label: "Line Manager Review", actor: d ? d.lineManager : (data as Record<string,string>).lineManager, done: status === "Approved" || status === "Declined", date: "Pending" },
    { label: "HR Review", actor: "Head of HR", done: status === "Approved", date: "Pending" },
    { label: "CEO Approval", actor: "Group CEO", done: false, date: "Pending" },
  ];

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-7 pb-5 border-b border-border">
        <button onClick={onBack} className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-sm font-semibold border border-border bg-white hover:bg-muted transition-colors text-muted-foreground"><ArrowLeft size={14} /> Back</button>
        <div className="h-5 w-px bg-border mx-1" />
        <span className="font-mono text-sm font-bold" style={{ color: PURPLE }}>{id}</span>
        <StatusBadge status={status} />
      </div>
      <div className="grid grid-cols-5 gap-5">
        <div className="col-span-3 space-y-4">
          <Card className="p-6">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-4">Declaration Details</h2>
            <div className="grid grid-cols-2 gap-3">
              {fields.filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className={`rounded-xl p-3 bg-muted/30 border border-border/40 ${k === "Description" ? "col-span-2" : ""}`}>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{k}</p>
                  <p className="text-sm font-medium text-foreground mt-1">{v}</p>
                </div>
              ))}
            </div>
          </Card>
          {(data as Record<string,string>).files && (
            <Card className="p-6">
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">Supporting Documents</h3>
              <p className="text-sm text-muted-foreground">{(data as Record<string,string>).files}</p>
            </Card>
          )}
        </div>
        <div className="col-span-2 space-y-4">
          <Card className="p-6">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wide mb-4">Approval Workflow</h3>
            <div className="space-y-0">
              {workflowSteps.map((step, i) => (
                <div key={i} className="flex items-start gap-3 relative">
                  {i < workflowSteps.length - 1 && <div className="absolute left-[14px] top-7 w-0.5 h-8 bg-border" />}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${step.done ? "text-white" : "bg-muted text-muted-foreground"}`}
                    style={step.done ? { background: "#059669" } : {}}>
                    {step.done ? <Check size={12} /> : <span className="text-[10px] font-bold">{i + 1}</span>}
                  </div>
                  <div className="pb-6 flex-1">
                    <p className="text-sm font-semibold text-foreground">{step.label}</p>
                    <p className="text-xs text-muted-foreground">{step.actor}</p>
                    <span className={`mt-1 inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${step.done ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                      {step.done ? "Complete" : step.date}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-6">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">Declaration Summary</h3>
            <div className="space-y-2">
              {[["ID", id], ["Status", status], ["Submitted", d ? d.submitted : new Date().toLocaleDateString("en-ZA")]].map(([k, v]) => (
                <div key={k} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                  <span className="text-xs text-muted-foreground">{k}</span>
                  <span className="text-xs font-semibold text-foreground">{k === "Status" ? <StatusBadge status={v as StatusType} /> : v}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── My Declarations ───────────────────────────────────────────────────────────
function MyDeclarationsScreen() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [viewDecl, setViewDecl] = useState<Declaration | null>(null);

  const filtered = declarations.filter(d =>
    (!search || d.Counterparty.toLowerCase().includes(search.toLowerCase()) || d.id.toLowerCase().includes(search.toLowerCase()) || d.employee.toLowerCase().includes(search.toLowerCase())) &&
    (typeFilter === "All" || d.type === typeFilter) &&
    (statusFilter === "All" || d.status === statusFilter)
  );

  const totalValue = declarations.reduce((s, d) => s + d.value, 0);

  const exportCSV = () => {
    const headers = ["Declaration ID", "Employee", "Type", "Counterparty", "Value", "Submitted", "Status", "Approver"];
    const rows = filtered.map(d => [d.id, d.employee, d.type, d.Counterparty, formatRand(d.value), d.submitted, d.status, d.approver]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`; a.download = "GHE_Declarations.csv"; a.click();
  };

  if (viewDecl) return <DeclarationDetailView data={viewDecl} onBack={() => setViewDecl(null)} />;

  return (
    <div>
      <PageHeader title="My Declarations" subtitle="View and manage your GHE declaration history"
        actions={
          <button onClick={exportCSV} className="h-9 px-4 rounded-xl text-sm font-semibold border border-border bg-white hover:bg-muted transition-colors flex items-center gap-2">
            <Download size={13} /> Export to Excel
          </button>
        } />

      {/* 5 KPI cards — Total, Pending, Approved, Declined, Total Value */}
      <div className="grid grid-cols-5 gap-4 mb-7">
        <KpiCard label="Total Declarations" value={String(declarations.length)} icon={FileText}   iconBg="#EDE8FF" iconColor={PURPLE} />
        <KpiCard label="Pending Approval"   value="2"   icon={Clock}       iconBg="#fffbeb" iconColor="#d97706" trend="Awaiting review" trendColor="#d97706" />
        <KpiCard label="Approved"           value="2"   icon={Check}       iconBg="#ecfdf5" iconColor="#059669" trend="Compliant"       trendColor="#059669" />
        <KpiCard label="Declined"           value="1"   icon={X}           iconBg="#fef2f2" iconColor="#dc2626" />
        <KpiCard label="Total Value"        value={`R ${Math.round(totalValue / 1000)}K`} icon={DollarSign} iconBg="#EDE8FF" iconColor={PURPLE} trend="All declarations" />
      </div>

      {/* Filter bar */}
      <Card className="p-3.5 mb-4 flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-44">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by ID, Counterparty or employee…" className="w-full h-9 pl-9 pr-4 rounded-lg text-sm border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={13} className="text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground">Type:</span>
          {["All","Gift","Hospitality","Entertainment"].map(t => (
            <button key={t} onClick={() => setTypeFilter(t)} className="h-8 px-3 rounded-lg text-xs font-semibold transition-colors"
              style={typeFilter === t ? { background: PURPLE, color: "#fff" } : { background: "#F0EEF8", color: "#6B6B80" }}>{t}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">Status:</span>
          {["All","Draft","Pending","Approved","Declined"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className="h-8 px-3 rounded-lg text-xs font-semibold transition-colors"
              style={statusFilter === s ? { background: PURPLE, color: "#fff" } : { background: "#F0EEF8", color: "#6B6B80" }}>{s}</button>
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <THead cols={["Declaration ID", "Type", "Counterparty", "Value", "Submitted", "Approver", "Status", "Actions"]} />
          <tbody className="divide-y divide-border">
            {filtered.map(d => (
              <tr key={d.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-5 py-3.5"><span className="font-mono text-xs font-bold" style={{ color: PURPLE }}>{d.id}</span></td>
                <td className="px-5 py-3.5"><TypeBadge type={d.type} /></td>
                <td className="px-5 py-3.5 text-sm font-medium text-foreground">{d.Counterparty}</td>
                <td className="px-5 py-3.5 text-sm font-semibold text-foreground tabular-nums">{formatRand(d.value)}</td>
                <td className="px-5 py-3.5 text-sm text-muted-foreground tabular-nums">{d.submitted}</td>
                <td className="px-5 py-3.5 text-sm text-muted-foreground">{d.approver}</td>
                <td className="px-5 py-3.5"><StatusBadge status={d.status} /></td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-1">
                    <button onClick={() => setViewDecl(d)} title="View" className="h-8 px-3 rounded-lg text-xs font-semibold bg-secondary text-secondary-foreground hover:bg-secondary/70 transition-colors flex items-center gap-1.5">
                      <Eye size={12} /> View
                    </button>
                    <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(Object.entries(d).map(([k,v]) => `${k},${v}`).join("\n"))}`} download={`${d.id}.csv`} title="Export"
                      className="h-8 px-3 rounded-lg text-xs font-semibold border border-border text-muted-foreground hover:text-primary hover:border-primary transition-colors flex items-center gap-1.5">
                      <Download size={12} /> Export
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-5 py-3.5 border-t border-border flex items-center justify-between bg-[#F7F8FC]">
          <p className="text-xs text-muted-foreground">Showing <span className="font-semibold text-foreground">{filtered.length}</span> of {declarations.length} declarations</p>
          <div className="flex gap-1.5">{[1,2,3].map(p => <button key={p} className="w-8 h-8 rounded-lg text-xs font-semibold" style={p === 1 ? { background: PURPLE, color: "#fff" } : { background: "#F0EEF8", color: "#6B6B80" }}>{p}</button>)}</div>
        </div>
      </Card>
    </div>
  );
}

// ─── Approver Dashboard ────────────────────────────────────────────────────────
function ApproverDashboard({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const kpis = [
    { label: "Pending Queue",        value: "14",      icon: Clock,       iconBg: "#fffbeb", iconColor: "#d97706", trend: "+3 today" },
    { label: "Approved This Month",  value: "47",      icon: Check,       iconBg: "#ecfdf5", iconColor: "#059669", trend: "+12 vs last month" },
    { label: "Declined",             value: "8",       icon: X,           iconBg: "#fef2f2", iconColor: "#dc2626", trend: "-2 vs last month" },
    { label: "Escalated",            value: "3",       icon: ArrowUp,     iconBg: "#fff7ed", iconColor: "#ea580c", trend: "Requires attention" },
    { label: "Avg Processing",       value: "2.4d",    icon: TrendingUp,  iconBg: "#f5f3ff", iconColor: "#7c3aed", trend: "-0.3d improvement" },
    { label: "Total Value Declared", value: "R284.5K", icon: DollarSign,  iconBg: "#EDE8FF", iconColor: PURPLE,    trend: "This month" },
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
      <div className="grid grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map(k => <KpiCard key={k.label} {...k} />)}
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
function ApproverDecisionBlock({ title, role, decision, onSelect, notes, onNotesChange }: {
  title: string; role: string; decision: ApprovalDecision;
  onSelect: (v: ApprovalDecision) => void; notes: string; onNotesChange: (v: string) => void;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2.5 mb-4 pb-3.5 border-b border-border">
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PURPLE }} />
        <div><p className="text-sm font-bold text-foreground">{title}</p><p className="text-xs text-muted-foreground mt-0.5">{role}</p></div>
      </div>
      <div className="space-y-2 mb-4">
        {approvalOptions.map(opt => (
          <label key={opt.value} className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${decision === opt.value ? "border-primary/60" : "border-border hover:border-primary/20 hover:bg-muted/20"}`}
            style={decision === opt.value ? { background: "#F5F2FF" } : {}}>
            <div className="mt-0.5 flex-shrink-0">
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${decision === opt.value ? "border-primary" : "border-muted-foreground/40"}`}>
                {decision === opt.value && <div className="w-2 h-2 rounded-full" style={{ background: PURPLE }} />}
              </div>
            </div>
            <div className="flex-1"><p className="text-xs font-semibold text-foreground leading-snug">{opt.label}</p><p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{opt.description}</p></div>
            <input type="radio" name={title} value={opt.value} checked={decision === opt.value} onChange={() => onSelect(opt.value as ApprovalDecision)} className="sr-only" />
          </label>
        ))}
      </div>
      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Notes / Comments</label>
        <textarea value={notes} onChange={e => onNotesChange(e.target.value)} rows={2} placeholder="Add notes or reasoning for this decision…"
          className="w-full rounded-xl px-3.5 py-2.5 text-sm border border-border bg-muted/20 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none placeholder:text-muted-foreground/50" />
      </div>
    </Card>
  );
}

// ─── Approval Detail ───────────────────────────────────────────────────────────
function ApprovalDetail({ declaration, onBack }: { declaration: Declaration; onBack: () => void }) {
  const [lmDecision, setLmDecision] = useState<ApprovalDecision>(null);
  const [hrDecision, setHrDecision] = useState<ApprovalDecision>(null);
  const [ceoDecision, setCeoDecision] = useState<ApprovalDecision>(null);
  const [lmNotes, setLmNotes] = useState(""); const [hrNotes, setHrNotes] = useState(""); const [ceoNotes, setCeoNotes] = useState("");
  return (
    <div>
      <div className="flex items-center gap-2.5 mb-7 pb-5 border-b border-border">
        <button onClick={onBack} className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-sm font-semibold border border-border bg-white hover:bg-muted transition-colors text-muted-foreground"><ArrowLeft size={14} /> Back</button>
        <div className="h-5 w-px bg-border mx-1" />
        <span className="font-mono text-sm font-bold" style={{ color: PURPLE }}>{declaration.id}</span>
        <StatusBadge status={declaration.status} />
      </div>
      <div className="grid grid-cols-5 gap-5">
        <div className="col-span-3 space-y-4">
          <DeclarationDetailView data={declaration} onBack={onBack} />
        </div>
        <div className="col-span-2 space-y-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
            <AlertCircle size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">Select <strong>one option</strong> per approver level. A reminder email is sent every Monday morning.</p>
          </div>
          <ApproverDecisionBlock title="3.1 – 3.4  Line Manager Approval" role="Sipho Nkosi — Line Manager" decision={lmDecision} onSelect={setLmDecision} notes={lmNotes} onNotesChange={setLmNotes} />
          <ApproverDecisionBlock title="Head of HR Approval" role="Lindiwe Zulu — Head of HR" decision={hrDecision} onSelect={setHrDecision} notes={hrNotes} onNotesChange={setHrNotes} />
          <ApproverDecisionBlock title="Group CEO Approval" role="Sandile Shabalala — Group CEO" decision={ceoDecision} onSelect={setCeoDecision} notes={ceoNotes} onNotesChange={setCeoNotes} />
          <Card className="p-5">
            <p className="text-xs text-muted-foreground mb-4">The Line Manager must select an option before submission can proceed.</p>
            <div className="flex gap-2.5">
              <button className="flex-1 h-10 rounded-xl text-sm font-semibold border border-border bg-white hover:bg-muted transition-colors">Save Progress</button>
              <button disabled={!lmDecision} className="flex-1 h-10 rounded-xl text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 flex items-center justify-center gap-2"
                style={{ background: `linear-gradient(135deg, ${PURPLE}, #6d28d9)` }}>
                <Check size={14} /> Submit Decision
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
