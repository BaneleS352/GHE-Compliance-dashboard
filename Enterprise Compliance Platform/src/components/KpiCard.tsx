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
      className={`p-4 sm:p-5 rounded-2xl cursor-pointer transition-all duration-300 border transform
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
      <p className="text-xl sm:text-2xl font-bold">{value}</p>
      <p className="text-xs mt-1">{label}</p>
    </div>
  );
}
