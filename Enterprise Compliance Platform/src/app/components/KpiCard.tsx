import React from "react";

export function KpiCard({
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
  const glow = `${color}33`;
  const ring = `${color}66`;

  return (
    <div
      onClick={onClick}
      className={`min-h-32 select-none rounded-[1.35rem] border p-4 text-white transition-all duration-300 sm:min-h-36 sm:p-5
        ${onClick ? "cursor-pointer" : "cursor-default"}
        ${active ? "shadow-2xl sm:scale-[1.03]" : "hover:shadow-xl sm:hover:scale-[1.02]"}
      `}
      style={{
        background: `
          radial-gradient(circle at top right, ${glow}, transparent 38%),
          linear-gradient(160deg, #18181f 0%, #111118 58%, #0b0b11 100%)
        `,
        borderColor: active ? ring : "#23232d",
        boxShadow: active
          ? `0 24px 50px rgba(5, 5, 10, 0.42), 0 0 0 1px ${ring} inset`
          : `0 18px 40px rgba(5, 5, 10, 0.34), 0 0 0 1px rgba(255,255,255,0.03) inset`,
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-2xl border"
          style={{
            background: `linear-gradient(145deg, ${color}40, ${color}1a)`,
            borderColor: `${color}55`,
            boxShadow: `0 10px 24px ${color}20`,
          }}
        >
        <Icon size={18} style={{ color }} />
        </div>
        <div
          className="h-2.5 w-2.5 rounded-full"
          style={{
            background: color,
            boxShadow: `0 0 16px ${color}`,
          }}
        />
      </div>
      <p className="break-words text-xl font-bold tracking-tight text-white sm:text-2xl">{value}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-300">{label}</p>
    </div>
  );
}
