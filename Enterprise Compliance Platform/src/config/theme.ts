import { StatusType } from "../types/declaration";

// ─── Brand tokens ───────────────────────────────────────────────────────────────
export const PURPLE = "#4F1D95";
export const DEEP   = "#39156F";
export const YELLOW = "#F8D74A";
export const F      = { fontFamily: "'Plus Jakarta Sans', sans-serif" };

// ─── Type badge colours ─────────────────────────────────────────────────────────
export const typeCfg: Record<string, { bg: string; text: string }> = {
  Gift:          { bg: "#f5f3ff", text: "#6d28d9" },
  Hospitality:   { bg: "#ecfeff", text: "#0e7490" },
  Entertainment: { bg: "#fffbeb", text: "#b45309" },
};

// ─── Status badge colours ───────────────────────────────────────────────────────
export const statusConfig: Record<StatusType, { bg: string; text: string; ring: string }> = {
  Draft:            { bg: "bg-slate-100",  text: "text-slate-600",   ring: "bg-slate-400" },
  Pending:          { bg: "bg-amber-50",   text: "text-amber-700",   ring: "bg-amber-400" },
  Approved:         { bg: "bg-emerald-50", text: "text-emerald-700", ring: "bg-emerald-500" },
  Declined:         { bg: "bg-red-50",     text: "text-red-700",     ring: "bg-red-500" },
  Escalated:        { bg: "bg-orange-50",  text: "text-orange-700",  ring: "bg-orange-500" },
  "Info Requested": { bg: "bg-blue-50",    text: "text-blue-700",    ring: "bg-blue-500" },
};

// ─── Formatters ─────────────────────────────────────────────────────────────────
export function formatRand(v: number) {
  return `R ${v.toLocaleString("en-ZA")}`;
}

// ─── Shared input class strings ─────────────────────────────────────────────────
export const inp =
  "w-full h-11 rounded-xl px-4 text-sm border border-slate-200 bg-slate-50 text-foreground focus:outline-none focus:ring-4 focus:ring-purple-500/20 focus:border-purple-600 focus:bg-white hover:border-purple-300 transition-all duration-200 ease-out placeholder:text-muted-foreground/50";

export const sel = `${inp} appearance-none pr-10 cursor-pointer bg-white border-slate-200 hover:bg-purple-50 hover:border-purple-400 hover:text-[15.5px] hover:font-semibold hover:text-purple-900 focus:bg-white focus:border-purple-600 shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_14px_rgba(79,29,149,0.12)] transition-all duration-300`;
