import React, { useId } from "react";
import { FileText, Clock, Check, Undo, X, ArrowUp } from "lucide-react";
import { STATUS_COLORS } from "@/config/theme";

export interface KpiDef {
  key: string;
  label: string;
  icon: React.ElementType;
  color: string;
  filterValue: string;
}

export const STATUS_KPI: Record<string, KpiDef> = {
  Total:     { key: "Total",     label: "Total",     icon: FileText, color: "#7c3aed",             filterValue: "All" },
  Pending:   { key: "Pending",   label: "Pending",   icon: Clock,    color: STATUS_COLORS.Pending.hex,   filterValue: "Pending" },
  Approved:  { key: "Approved",  label: "Approved",  icon: Check,    color: STATUS_COLORS.Approved.hex,  filterValue: "Approved" },
  Returned:  { key: "Returned",  label: "Returned",  icon: Undo,     color: STATUS_COLORS.Returned.hex,  filterValue: "Returned" },
  Declined:  { key: "Declined",  label: "Declined",  icon: X,        color: STATUS_COLORS.Declined.hex,  filterValue: "Declined" },
  Escalated: { key: "Escalated", label: "Escalated", icon: ArrowUp,  color: STATUS_COLORS.Escalated.hex, filterValue: "Escalated" },
};

// kpi.html gradients (125deg / 110deg + radial for Returned)
const GRADIENTS: Record<string, string> = {
  Total:       "linear-gradient(125deg,#6431e5,#280897)",
  Pending:     "linear-gradient(125deg,#ffac2a,#bd5800)",
  Approved:    "linear-gradient(125deg,#02a473,#05c89a)",
  Returned:    "radial-gradient(ellipse 75% 90% at 2% 0%, rgba(34,218,230,.82), transparent 64%), linear-gradient(110deg,#0dbdd4 0%,#08a9c2 47%,#08728d 100%)",
  Declined:    "linear-gradient(125deg,#f52b32,#e90009)",
  Escalated:   "linear-gradient(125deg,#f97316,#ea580c)",
  "Total Value": "linear-gradient(125deg,#6431e5,#280897)",
};

function DecorPending() {
  return (
    <div
      className="art bars"
      aria-hidden="true"
      style={{
        position: "absolute",
        right: 6,
        bottom: 0,
        width: 180,
        height: 112,
        display: "flex",
        alignItems: "end",
        gap: 9,
        padding: "0 10px 8px",
        opacity: 0.62,
      }}
    >
      {[40, 70, 96, 58, 84, 106, 68].map((h, i) => (
        <i
          key={i}
          style={{
            display: "block",
            width: 18,
            height: h,
            background: "#fff",
            borderRadius: "6px 6px 0 0",
          }}
        />
      ))}
    </div>
  );
}

function DecorApproved() {
  return (
    <div className="art person" aria-hidden="true" style={{ position: "absolute", right: 6, bottom: 0, width: 130, height: 120, transform: "scale(clamp(.78, 5vw, 1))", transformOrigin: "bottom right" }}>
      <div style={{ position: "absolute", top: 6, left: 42, width: 48, height: 48, borderRadius: "50%", background: "#A5D2B5" }} />
      <div style={{ position: "absolute", bottom: 8, left: 28, width: 72, height: 54, borderRadius: "40px 40px 0 0", background: "#A5D2B5" }} />
      <span
        className="check"
        style={{
          position: "absolute",
          zIndex: 2,
          right: 0,
          bottom: 0,
          width: 46,
          height: 46,
          border: "5px solid #0DCA87",
          borderRadius: "50%",
           background: "#A5D2B5",
          color: "#FFFFFF",
          fontSize: 29,
          fontWeight: 700,
          lineHeight: "36px",
          textAlign: "center",
        }}
      >
        ✓
      </span>
    </div>
  );
}

function DecorDeclined() {
  return (
    <div className="art person decline-person" aria-hidden="true" style={{ position: "absolute", right: 6, bottom: 0, width: 130, height: 120, transform: "scale(clamp(.78, 5vw, 1))", transformOrigin: "bottom right" }}>
      <div style={{ position: "absolute", top: 6, left: 42, width: 48, height: 48, borderRadius: "50%", background: "#FF5757" }} />
      <div style={{ position: "absolute", bottom: 8, left: 28, width: 72, height: 54, borderRadius: "40px 40px 0 0", background: "#FF5757" }} />
      <span
        className="check cross"
        style={{
          position: "absolute",
          zIndex: 2,
          right: 0,
          bottom: 0,
          width: 46,
          height: 46,
          border: "5px solid #D90F17",
          borderRadius: "50%",
          background: "#FF5757",
          color: "#FFFFFF",
          fontSize: 34,
          fontWeight: 700,
          lineHeight: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}
        >
          <span style={{ transform: "translateY(-3px)" }}>×</span>
        </span>
    </div>
  );
}

function DecorReturned() {
  return (
    <svg className="returned-arrows" viewBox="0 0 194 166" aria-hidden="true" style={{ position: "absolute", top: 4, right: 6, width: 138, height: 118, opacity: 0.62 }}>
      <path d="M16 91 C18 55 42 35 79 35 H104 V15 L147 50 L104 85 V66 H80 C52 66 30 77 16 91 Z" fill="none" stroke="#cbd4d7" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M178 79 C176 115 152 136 114 136 H89 V153 L47 116 L89 80 V98 H113 C141 98 164 87 178 79 Z" fill="none" stroke="#cbd4d7" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DecorTotal() {
  return null;
}

function DecorFallback() {
  return null;
}

const DECOR_MAP: Record<string, React.FC> = {
  Total: DecorTotal,
  Pending: DecorPending,
  Approved: DecorApproved,
  Returned: DecorReturned,
  Declined: DecorDeclined,
  Escalated: DecorFallback,
  "Total Value": DecorTotal,
};

function getGradient(keyOrLabel: string): string {
  return GRADIENTS[keyOrLabel] || GRADIENTS.Total;
}

function getDecor(keyOrLabel: string): React.FC {
  return DECOR_MAP[keyOrLabel] || DecorFallback;
}

export function KpiCard({
  label,
  value,
  secondaryValue,
  icon: Icon,
  active,
  onClick,
  delta,
  decorKey,
}: {
  label: string;
  value: string;
  secondaryValue?: string;
  icon: React.ElementType;
  color: string;
  active?: boolean;
  onClick?: () => void;
  delta?: { text: string; positive?: boolean; negative?: boolean };
  decorKey?: string;
}) {
  const uid = useId();
  const key = decorKey || label;
  const Decor = getDecor(key);
  const bgGradient = getGradient(key);
  const isTotal = key === "Total";
  const isReturned = key === "Returned";

  // Map lucide icon to kpi.html mini char for exact match, fallback to Icon
  const miniCharMap: Record<string, string> = {
    Total: "▤",
    Pending: "◷",
    Approved: "✓",
    Returned: "↶",
    Declined: "×",
    Escalated: "↑",
  };
  const miniChar = miniCharMap[key];

  return (
    <div
      id={uid}
      onClick={onClick}
      className={`relative overflow-hidden select-none transition-all duration-300 ${onClick ? "cursor-pointer" : "cursor-default"} ${active ? "scale-[1.02] shadow-xl" : "hover:-translate-y-0.5 hover:shadow-lg"}`}
      style={{
        height: "clamp(108px, 8vw, 128px)",
        padding: isReturned ? 0 : "clamp(16px, 2.1vw, 27px) clamp(16px, 2.2vw, 28px) clamp(12px, 1.4vw, 18px)",
        borderRadius: 22,
        color: "white",
        background: bgGradient,
        boxShadow: isReturned ? "0 2px 5px rgba(0,0,0,.26)" : "inset 0 -10px 18px rgba(0,0,0,.14)",
      }}
    >
      {/* Label */}
      <div
        className="label"
        style={
          isReturned
            ? {
                position: "absolute",
                top: 21,
                left: 28,
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 14,
                fontWeight: 800,
                letterSpacing: "-0.3px",
                textShadow: "0 1px 1px rgba(0,0,0,.18)",
                textTransform: "uppercase",
              }
            : {
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 14,
                fontWeight: 800,
                textTransform: "uppercase",
              }
        }
      >
        <span
          className="mini"
          style={
            isReturned
              ? {
                  width: 31,
                  height: 31,
                  display: "grid",
                  placeItems: "center",
                  border: "1px solid rgba(255,255,255,.21)",
                  borderRadius: "50%",
                  background: "rgba(255,255,255,.1)",
                  color: "rgba(255,255,255,.78)",
                  fontSize: 21,
                  fontWeight: 300,
                }
              : {
                  width: 28,
                  height: 28,
                  display: "grid",
                  placeItems: "center",
                  border: "2px solid transparent",
                  borderRadius: "50%",
                  background: "rgba(255,255,255,.3)",
                  color: "#ffffff",
                  fontSize: 17,
                }
          }
        >
          {miniChar ? miniChar : <Icon size={14} />}
        </span>
        {label}
      </div>

      {/* Value */}
      <div
        className="value"
        style={
          isTotal
            ? {
                position: "absolute",
                left: 28,
                bottom: 20,
                display: "flex",
                alignItems: "center",
                gap: 38,
                fontSize: 46,
                lineHeight: "42px",
                fontWeight: 800,
              }
            : isReturned
              ? {
                  position: "absolute",
                  left: 33,
                  bottom: 17,
                  display: "flex",
                  alignItems: "center",
                  gap: 0,
                  fontSize: 46,
                  lineHeight: 0.85 as any,
                  fontWeight: 800,
                  textShadow: "0 1px 1px rgba(0,0,0,.15)",
                }
              : {
                  position: "absolute",
                  left: 28,
                  bottom: 20,
                  display: "flex",
                  alignItems: "center",
                  gap: 0,
                  fontSize: 46,
                  lineHeight: "42px",
                  fontWeight: 800,
                }
        }
      >
        <span>{value}</span>
        {isTotal && secondaryValue && (
          <span className="money" style={{ fontSize: 46, letterSpacing: 1, fontWeight: 800 }}>
            {secondaryValue}
          </span>
        )}
      </div>

      {/* Non-total cards without secondaryValue already show single value; delta below if needed */}
      {delta && (
        <span
          className={`absolute left-[28px] bottom-[8px] inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[11px] font-semibold ${delta.positive ? "bg-[rgba(140,255,201,0.18)] text-[#c8ffe4]" : delta.negative ? "bg-[rgba(255,140,140,0.16)] text-[#ffd6d6]" : "bg-[rgba(255,255,255,0.14)] text-white"}`}
          style={{ border: delta.positive ? "1px solid rgba(140,255,201,0.35)" : delta.negative ? "1px solid rgba(255,140,140,0.3)" : "1px solid rgba(255,255,255,0.18)" }}
        >
          {delta.text}
        </span>
      )}

      <Decor />

      {/* Active ring */}
      {active && <div className="pointer-events-none absolute inset-0 rounded-[22px] ring-2 ring-white/30" />}
    </div>
  );
}
