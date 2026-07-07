import { typeCfg } from "../config/theme";

export function TypeBadge({ type }: { type: string }) {
  const cfg = typeCfg[type] ?? { bg: "#f3f4f6", text: "#374151" };
  return (
    <span
      className="px-2.5 py-1 rounded-md text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.text }}
    >
      {type}
    </span>
  );
}
