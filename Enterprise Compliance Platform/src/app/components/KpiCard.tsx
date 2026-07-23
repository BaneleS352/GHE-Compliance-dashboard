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
      className={`flex min-h-32 select-none items-center rounded-2xl border p-4 transition-all duration-300 sm:min-h-36 sm:p-5
        ${onClick ? "cursor-pointer" : "cursor-default"}
        ${active ? "shadow-xl sm:scale-[1.03]" : "hover:shadow-md sm:hover:scale-[1.02]"}
      `}
      style={{
        background: `linear-gradient(135deg, ${color}35, ${color}18)`,
        borderColor: active ? color : "#eee",
      }}
    >
      <div className="flex items-center gap-4">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: `${color}40` }}
        >
          <Icon size={18} style={{ color }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="break-words text-xl font-bold sm:text-2xl">{value}</p>
          <p className="text-xs leading-relaxed text-muted-foreground">{label}</p>
        </div>
      </div>
    </div>
  );
}
