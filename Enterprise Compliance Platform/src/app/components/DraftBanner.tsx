import { useEffect, useRef } from "react";
import { Check, X } from "lucide-react";
import { DEEP, PURPLE, F } from "@/config/theme";

export function DraftBanner({ onDismiss }: { onDismiss: () => void }) {
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  useEffect(() => {
    const t = setTimeout(() => onDismissRef.current(), 4000);
    return () => clearTimeout(t);
  }, []);

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
