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
  return (
    <div
      onClick={onClick}
      className={`min-h-32 select-none rounded-2xl border p-4 transition-all duration-300 sm:min-h-36 sm:p-5
        ${onClick ? "cursor-pointer" : "cursor-default"}
        ${active ? "shadow-xl sm:scale-[1.03]" : "hover:shadow-md sm:hover:scale-[1.02]"}
      `}
      style={{
        background: `linear-gradient(135deg, ${color}35, ${color}18)`,
        borderColor: active ? color : "#eee",
      }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
        style={{ background: color + "40" }}
      >
        <Icon size={18} style={{ color }} />
      </div>
      <p className="text-xl font-bold break-words sm:text-2xl">{value}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{label}</p>
    </div>
  );
}
