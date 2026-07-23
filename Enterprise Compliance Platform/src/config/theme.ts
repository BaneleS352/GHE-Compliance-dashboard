import { StatusType } from "../types/declaration";

// ─── Brand tokens ───────────────────────────────────────────────────────────────
export const PURPLE     = "#4F1D95";
export const DEEP       = "#39156F";
export const YELLOW     = "#F8D74A";
export const DARKEST    = "#0f0225";    // darkest purple used in gradients
export const PURPLE_600 = "#6d28d9";   // medium purple (tailwind purple-600)
export const F          = { fontFamily: "'Plus Jakarta Sans', sans-serif" };

// ─── Common gradient strings (for inline style={{ background: ... }}) ──────────
export const GRADIENT_PRIMARY = `linear-gradient(135deg, ${PURPLE}, ${PURPLE_600})`;
export const GRADIENT_ACCENT = `linear-gradient(135deg, ${YELLOW}, #f59e0b)`;
export const GRADIENT_SIDEBAR = `linear-gradient(180deg, ${DARKEST} 0%, ${DEEP} 100%)`;
export const GRADIENT_LANDING = `linear-gradient(145deg, ${DARKEST} 0%, ${DEEP} 35%, ${PURPLE} 70%, ${PURPLE_600} 100%)`;

// ─── Shared background colours ──────────────────────────────────────────────────
export const TABLE_HEADER_BG = "#F7F8FC";
export const INFO_BG        = "#F5F2FF";

// ─── Declaration type chart colours (shared by dashboard charts) ────────────────
export const TYPE_COLORS: Record<string, string> = {
  Gift:          "#6d28d9",
  Hospitality:   "#0e7490",
  Entertainment: "#b45309",
};

// ─── Type badge colours ─────────────────────────────────────────────────────────
export const typeCfg: Record<string, { bg: string; text: string }> = {
  Gift:          { bg: "#f5f3ff", text: "#6d28d9" },
  Hospitality:   { bg: "#ecfeff", text: "#0e7490" },
  Entertainment: { bg: "#fffbeb", text: "#b45309" },
};

// ─── Status colours — single source of truth ────────────────────────────────────
//         bg / text / ring = Tailwind classes for StatusBadge
//         hex              = hex colour for KPI cards, icons, gradients
//         dot / rail       = Tailwind classes for WorkflowTimeline
export const STATUS_COLORS: Record<StatusType, { bg: string; text: string; ring: string; hex: string; dot: string; rail: string }> = {
  Draft:            { bg: "bg-slate-100",  text: "text-slate-600",   ring: "bg-slate-400", hex: "#94a3b8", dot: "bg-slate-400", rail: "bg-slate-300" },
  Pending:          { bg: "bg-amber-50",   text: "text-amber-700",   ring: "bg-amber-400", hex: "#f59e0b", dot: "bg-amber-500", rail: "bg-amber-300" },
  Approved:         { bg: "bg-emerald-50", text: "text-emerald-700", ring: "bg-emerald-500", hex: "#10b981", dot: "bg-emerald-500", rail: "bg-emerald-300" },
  Declined:         { bg: "bg-red-50",     text: "text-red-700",     ring: "bg-red-500", hex: "#ef4444", dot: "bg-red-500", rail: "bg-red-300" },
  Escalated:        { bg: "bg-orange-50",  text: "text-orange-700",  ring: "bg-orange-500", hex: "#f97316", dot: "bg-orange-500", rail: "bg-orange-300" },
  "Info Requested": { bg: "bg-blue-50",    text: "text-blue-700",    ring: "bg-blue-500", hex: "#3b82f6", dot: "bg-blue-500", rail: "bg-blue-300" },
  Returned:         { bg: "bg-sky-50",     text: "text-sky-700",     ring: "bg-sky-500", hex: "#06b6d4", dot: "bg-sky-500", rail: "bg-sky-300" },
};

// ─── Decision labels (shared by WorkflowTimeline & useWorkflowApproval) ────────
export const DECISION_LABELS: Record<string, string> = {
  return: "Returned - Team member to provide additional information.",
  accept: "Approved - Team Member to accept the actual GHE or offered GHE in their personal capacity.",
  org: "Approved - Team Member to share the actual GHE or offered GHE with the Organisation Pool.",
  foundation: "Approved - Team Member to donate the actual GHE or offered GHE to the Hollywood Foundation.",
  decline: "Declined - Team Member to return the actual GHE or regret the offered GHE.",
};

export const APPROVAL_OPTIONS = [
  { value: "return",     label: "Return - Team member to provide additional information." },
  { value: "accept",     label: "Approved - Team Member to accept the actual GHE or offered GHE in their personal capacity." },
  { value: "org",        label: "Approved - Team Member to share the actual GHE or offered GHE with the Organisation Pool." },
  { value: "foundation", label: "Approved - Team Member to donate the actual GHE or offered GHE to the Hollywood Foundation." },
  { value: "decline",    label: "Declined - Team Member to return the actual GHE or regret the offered GHE." },
];

// ─── Helper: map decision label text → StatusType ──────────────────────────────
export function labelToStatus(label: string): StatusType {
  if (label.startsWith("Declined")) return "Declined";
  if (label.startsWith("Returned")) return "Returned";
  return "Approved";
}

// ─── Priority colours ──────────────────────────────────────────────────────────
export const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  High:   { bg: "bg-red-50",   text: "text-red-700" },
  Medium: { bg: "bg-amber-50", text: "text-amber-700" },
  Low:    { bg: "bg-emerald-50", text: "text-emerald-700" },
};

// ─── Formatters ─────────────────────────────────────────────────────────────────
export function formatRand(v: number) {
  return `R ${v.toLocaleString("en-ZA")}`;
}

// ─── Shared input class strings ─────────────────────────────────────────────────
export const inp =
  "w-full h-11 rounded-xl px-4 text-sm border border-slate-200 bg-slate-50 text-foreground focus:outline-none focus:ring-4 focus:ring-purple-500/20 focus:border-purple-600 focus:bg-white hover:border-purple-300 transition-all duration-200 ease-out placeholder:text-muted-foreground/50";

export const sel = `${inp} appearance-none pr-10 cursor-pointer bg-white border-slate-200 hover:bg-purple-50 hover:border-purple-400 hover:text-[15.5px] hover:font-semibold hover:text-purple-900 focus:bg-white focus:border-purple-600 shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_14px_rgba(79,29,149,0.12)] transition-all duration-300`;
