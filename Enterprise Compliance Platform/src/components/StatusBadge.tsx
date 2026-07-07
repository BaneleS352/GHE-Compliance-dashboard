<<<<<<< Updated upstream
import { statusConfig } from "@/config/theme";
import { StatusType } from "@/types/declaration";
=======
import { statusConfig } from "../config/theme";
import { StatusType } from "../types/declaration";
>>>>>>> Stashed changes

export function StatusBadge({ status }: { status: StatusType }) {
  const c = statusConfig[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${c.ring}`} /> {status}
    </span>
  );
}
