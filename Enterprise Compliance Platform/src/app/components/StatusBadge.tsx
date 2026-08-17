import { STATUS_COLORS } from "@/config/theme";
import { StatusType } from "@/types/declaration";

export function StatusBadge({ status }: { status: StatusType }) {
  const fallback = { bg: "bg-slate-100", text: "text-slate-600", ring: "bg-slate-400" };
  const c = STATUS_COLORS[status] ?? fallback;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${c.ring}`} /> {status}
    </span>
  );
}
