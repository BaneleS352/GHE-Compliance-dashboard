import React, { useId } from "react";
import { FileText, Clock, Check, Undo, X, ArrowUp } from "lucide-react";
import { STATUS_COLORS } from "../../config/theme";

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

const GRADIENTS: Record<string, string> = {
  Total:       "linear-gradient(145deg,#6b3ef0 0%,#4423b8 45%,#1e1268 100%)",
  Pending:     "linear-gradient(145deg,#ffb04a 0%,#e07a0f 50%,#8a3d05 100%)",
  Approved:    "linear-gradient(145deg,#0c8f6b 0%,#12b380 55%,#1de29a 100%)",
  Returned:    "linear-gradient(145deg,#22d3ee 0%,#0891b2 50%,#155e75 100%)",
  Declined:    "linear-gradient(145deg,#ef4444 0%,#dc2626 50%,#991b1b 100%)",
  Escalated:   "linear-gradient(145deg,#f97316 0%,#ea580c 50%,#9a3412 100%)",
  "Total Value": "linear-gradient(145deg,#ff6aa7 0%,#a13cd6 50%,#4a1f8f 100%)",
};

function DecorTotal({ id }: { id: string }) {
  return (
    <svg className="decor float" width="170" height="110" viewBox="0 0 170 110" fill="none" style={{ position: "absolute", right: -6, bottom: -6, zIndex: 2, pointerEvents: "none" }}>
      <path className="stream" d="M-4 78 C 12 60, 22 90, 34 74 C 46 58, 56 44, 70 58 C 84 72, 92 78, 104 60 C 116 42, 128 40, 142 52 C 156 64, 166 54, 176 42" stroke="rgba(220,205,255,0.7)" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <path d="M-4 78 C 12 60, 22 90, 34 74 C 46 58, 56 44, 70 58 C 84 72, 92 78, 104 60 C 116 42, 128 40, 142 52 C 156 64, 166 54, 176 42 L 176 110 L -4 110 Z" fill={`url(#${id}-fill)`} />
    </svg>
  );
}

function DecorPending({ id }: { id: string }) {
  return (
    <svg className="decor" width="160" height="105" viewBox="0 0 160 105" fill="none" style={{ position: "absolute", right: -6, bottom: -6, zIndex: 2, pointerEvents: "none" }}>
      <defs>
        <linearGradient id={`${id}-barA`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff2cf" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#ffb347" stopOpacity="0.25" />
        </linearGradient>
        <linearGradient id={`${id}-barB`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe4b0" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ffa02b" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      <rect x="18" y="62" width="14" height="30" rx="4" fill={`url(#${id}-barA)`} />
      <rect x="38" y="46" width="14" height="46" rx="4" fill={`url(#${id}-barB)`} />
      <rect x="58" y="22" width="14" height="70" rx="4" fill={`url(#${id}-barA)`} />
      <rect x="78" y="50" width="14" height="42" rx="4" fill={`url(#${id}-barB)`} />
      <rect x="98" y="34" width="14" height="58" rx="4" fill={`url(#${id}-barA)`} />
      <rect x="118" y="14" width="14" height="78" rx="4" fill={`url(#${id}-barB)`} />
      <rect x="138" y="40" width="14" height="52" rx="4" fill={`url(#${id}-barA)`} />
      <line x1="14" y1="94" x2="156" y2="94" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
    </svg>
  );
}

function DecorApproved({ id }: { id: string }) {
  return (
    <svg className="decor" width="130" height="130" viewBox="0 0 130 130" fill="none" style={{ position: "absolute", right: -6, bottom: -6, zIndex: 2, pointerEvents: "none" }}>
      <defs>
        <linearGradient id={`${id}-ring`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e6fff4" />
          <stop offset="100%" stopColor="#20e0a0" />
        </linearGradient>
      </defs>
      <circle cx="65" cy="65" r="42" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="11" />
      <circle cx="65" cy="65" r="42" fill="none" stroke={`url(#${id}-ring)`} strokeWidth="11" strokeDasharray="263.9" strokeDashoffset="198" strokeLinecap="round" transform="rotate(-90 65 65)" />
    </svg>
  );
}

function DecorValue({ id }: { id: string }) {
  return (
    <svg className="decor float" width="175" height="110" viewBox="0 0 175 110" fill="none" style={{ position: "absolute", right: -6, bottom: -6, zIndex: 2, pointerEvents: "none" }}>
      <defs>
        <linearGradient id={`${id}-fillP`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,140,190,0.35)" />
          <stop offset="100%" stopColor="rgba(255,140,190,0)" />
        </linearGradient>
      </defs>
      <path d="M-4 72 C 12 60, 22 84, 34 72 C 46 60, 54 46, 66 40 C 76 34, 82 40, 90 50 C 100 62, 108 44, 118 34 C 128 24, 138 30, 148 44 C 158 58, 168 50, 180 40 L180 110 L-4 110 Z" fill={`url(#${id}-fillP)`} />
      <path d="M-4 72 C 12 60, 22 84, 34 72 C 46 60, 54 46, 66 40 C 76 34, 82 40, 90 50 C 100 62, 108 44, 118 34 C 128 24, 138 30, 148 44 C 158 58, 168 50, 180 40" stroke="rgba(255,220,240,0.85)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <circle cx="118" cy="34" r="10" fill="#ff5f8f" opacity="0.25" />
      <circle cx="118" cy="34" r="4" fill="#fff" />
      <circle cx="118" cy="34" r="2" fill="#ff5f8f" />
    </svg>
  );
}

function DecorReturned({ id }: { id: string }) {
  return (
    <svg className="decor float" width="160" height="100" viewBox="0 0 160 100" fill="none" style={{ position: "absolute", right: -6, bottom: -6, zIndex: 2, pointerEvents: "none" }}>
      <defs>
        <linearGradient id={`${id}-loop`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      <path d="M12 80 Q 30 30, 50 50 T 90 40 T 130 60 T 160 45" stroke="rgba(255,255,255,0.5)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M12 80 Q 30 30, 50 50 T 90 40 T 130 60 L 160 45" stroke={`url(#${id}-loop)`} strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.3" />
      <path d="M12 80 L 24 66 L 18 60" stroke="rgba(255,255,255,0.6)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DecorDeclined({ id }: { id: string }) {
  return (
    <svg className="decor" width="160" height="100" viewBox="0 0 160 100" fill="none" style={{ position: "absolute", right: -6, bottom: -6, zIndex: 2, pointerEvents: "none" }}>
      <defs>
        <linearGradient id={`${id}-down`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,180,180,0.3)" />
          <stop offset="100%" stopColor="rgba(255,180,180,0)" />
        </linearGradient>
      </defs>
      <path d="M-4 30 C 20 40, 40 20, 60 38 C 80 56, 100 60, 120 70 C 140 80, 155 90, 170 96" stroke="rgba(255,180,180,0.7)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M-4 30 C 20 40, 40 20, 60 38 C 80 56, 100 60, 120 70 C 140 80, 155 90, 170 96 L 170 100 L -4 100 Z" fill={`url(#${id}-down)`} />
      <line x1="150" y1="78" x2="164" y2="92" stroke="rgba(255,180,180,0.7)" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="164" y1="78" x2="150" y2="92" stroke="rgba(255,180,180,0.7)" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function DecorEscalated({ id }: { id: string }) {
  return (
    <svg className="decor float" width="160" height="100" viewBox="0 0 160 100" fill="none" style={{ position: "absolute", right: -6, bottom: -6, zIndex: 2, pointerEvents: "none" }}>
      <defs>
        <linearGradient id={`${id}-up`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,200,150,0.3)" />
          <stop offset="100%" stopColor="rgba(255,200,150,0)" />
        </linearGradient>
      </defs>
      <path d="M-4 70 C 20 60, 40 76, 60 56 C 80 36, 100 20, 120 30 C 140 40, 155 30, 170 20" stroke="rgba(255,200,150,0.7)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M-4 70 C 20 60, 40 76, 60 56 C 80 36, 100 20, 120 30 C 140 40, 155 30, 170 20 L 170 100 L -4 100 Z" fill={`url(#${id}-up)`} />
      <line x1="154" y1="20" x2="170" y2="12" stroke="rgba(255,200,150,0.7)" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="170" y1="20" x2="162" y2="8" stroke="rgba(255,200,150,0.7)" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function DecorFallback(_: { id: string }) {
  return null;
}

const DECOR_MAP: Record<string, React.FC<{ id: string }>> = {
  Total: DecorTotal,
  Pending: DecorPending,
  Approved: DecorApproved,
  Returned: DecorReturned,
  Declined: DecorDeclined,
  Escalated: DecorEscalated,
  "Total Value": DecorValue,
};

function getGradient(keyOrLabel: string): string {
  return GRADIENTS[keyOrLabel] || GRADIENTS.Total;
}

function getDecor(keyOrLabel: string): React.FC<{ id: string }> {
  return DECOR_MAP[keyOrLabel] || DecorFallback;
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  color,
  active,
  onClick,
  delta,
  decorKey,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
  active?: boolean;
  onClick?: () => void;
  delta?: { text: string; positive?: boolean; negative?: boolean };
  decorKey?: string;
}) {
  const uid = useId();
  const key = decorKey || label;
  const DecorSvg = getDecor(key);
  const bgGradient = getGradient(key);

  return (
    <div
      onClick={onClick}
      className={`relative isolate overflow-hidden select-none rounded-2xl sm:rounded-[20px] transition-all duration-300
        ${onClick ? "cursor-pointer" : "cursor-default"}
        ${active ? "shadow-xl sm:scale-[1.03]" : "hover:-translate-y-1 hover:shadow-[0_1px_0_rgba(255,255,255,0.1)_inset,0_-20px_40px_rgba(0,0,0,0.15)_inset,0_28px_50px_-12px_rgba(0,0,0,0.65),0_10px_20px_-8px_rgba(0,0,0,0.5)]"}
      `}
      style={{
        background: bgGradient,
        boxShadow: active
          ? "0 1px 0 rgba(255,255,255,0.08) inset,0 -20px 40px rgba(0,0,0,0.15) inset,0 20px 40px -12px rgba(0,0,0,0.55),0 8px 16px -8px rgba(0,0,0,0.4),0 0 0 2px rgba(255,255,255,0.25)"
          : "0 1px 0 rgba(255,255,255,0.08) inset,0 -20px 40px rgba(0,0,0,0.15) inset,0 20px 40px -12px rgba(0,0,0,0.55),0 8px 16px -8px rgba(0,0,0,0.4)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 z-[1] opacity-[0.18] mix-blend-overlay"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,.9) 1px, transparent 1px)",
          backgroundSize: "3px 3px",
          WebkitMaskImage: "linear-gradient(120deg, transparent 30%, black 90%)",
          maskImage: "linear-gradient(120deg, transparent 30%, black 90%)",
        }}
      />

      <div className="relative z-[4] p-5 sm:p-[20px_22px]">
        <div className="flex items-center gap-2">
          <div
            className="flex h-[26px] w-[26px] items-center justify-center rounded-lg"
            style={{
              background: "rgba(255,255,255,0.14)",
              border: "1px solid rgba(255,255,255,0.22)",
              backdropFilter: "blur(6px)",
              color: "#fff",
            }}
          >
            <Icon size={13} />
          </div>
          <span
            className="text-[12.5px] font-semibold uppercase tracking-[0.4px]"
            style={{ color: "rgba(255,255,255,0.85)" }}
          >
            {label}
          </span>
        </div>

        <div
          className="mt-[10px] text-[40px] font-bold leading-none tracking-[-0.02em] text-white"
          style={{ textShadow: "0 2px 12px rgba(0,0,0,0.25)" }}
        >
          {value}
        </div>

        {delta && (
          <span
            className={`mt-[10px] inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[11px] font-semibold backdrop-blur-sm ${
              delta.positive
                ? "bg-[rgba(140,255,201,0.18)] text-[#c8ffe4]"
                : delta.negative
                  ? "bg-[rgba(255,140,140,0.16)] text-[#ffd6d6]"
                  : "bg-[rgba(255,255,255,0.14)] text-white"
            }`}
            style={{ border: delta.positive ? "1px solid rgba(140,255,201,0.35)" : delta.negative ? "1px solid rgba(255,140,140,0.3)" : "1px solid rgba(255,255,255,0.18)" }}
          >
            {delta.text}
          </span>
        )}
      </div>

      <DecorSvg id={uid} />

      <div
        className="pointer-events-none absolute inset-0 z-[3] mix-blend-overlay"
        style={{
          background:
            "radial-gradient(120% 80% at 100% 0%, rgba(255,255,255,0.22), transparent 55%), radial-gradient(80% 60% at 0% 100%, rgba(0,0,0,0.35), transparent 60%)",
        }}
      />

      <div
        className="pointer-events-none absolute inset-0 z-[5]"
        style={{
          borderRadius: "inherit",
          padding: 1,
          background: "linear-gradient(160deg,rgba(255,255,255,0.35),rgba(255,255,255,0.02) 40%,rgba(255,255,255,0) 60%,rgba(255,255,255,0.12))",
          mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          maskComposite: "exclude",
          WebkitMaskComposite: "xor",
        }}
      />
    </div>
  );
}
