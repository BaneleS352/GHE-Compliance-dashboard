import { useEffect } from "react";
import { Check, X } from "lucide-react";
import { DEEP, PURPLE, F } from "../config/theme";

export function DraftBanner({ onDismiss }: { onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold text-white"
      style={{
        background: `linear-gradient(135deg, ${DEEP}, ${PURPLE})`,
        animation: "popIn 0.3s ease-out",
        ...F,
      }}
    >
      <Check size={15} /> Draft saved successfully
      <button onClick={onDismiss} className="ml-2 opacity-70 hover:opacity-100">
        <X size={14} />
      </button>
    </div>
  );
}
