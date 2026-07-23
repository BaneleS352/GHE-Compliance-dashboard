import { Check, Sparkles, X } from "lucide-react";
import { PURPLE, YELLOW, F, GRADIENT_PRIMARY, INFO_BG } from "../../config/theme";
import { Declaration } from "../../types/declaration";

export function SuccessModal({
  data,
  onClose,
  onView,
}: {
  data: Declaration;
  onClose: () => void;
  onView: () => void;
}) {
  const pieces = Array.from({ length: 22 }, (_, i) => ({
    color: [PURPLE, YELLOW, "#10b981", "#3b82f6", "#f43f5e", "#f97316"][i % 6],
    left: `${(i * 4.5) % 100}%`,
    delay: `${(i * 0.12) % 1.8}s`,
    dur: `${2.5 + (i % 4) * 0.5}s`,
  }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgb(0 0 0 / 0.55)", backdropFilter: "blur(6px)" }}
    >
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(-40px) rotate(0deg) scale(1); opacity: 1; }
          100% { transform: translateY(340px) rotate(720deg) scale(0.4); opacity: 0; }
        }
        @keyframes popIn {
          0%   { transform: scale(0.7); opacity: 0; }
          70%  { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {/* Confetti */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
        {pieces.map((p, i) => (
          <div
            key={i}
            className="absolute w-2.5 h-2.5 rounded-sm"
            style={{
              background: p.color,
              left: p.left,
              top: "-10px",
              animation: `confettiFall ${p.dur} ${p.delay} ease-in forwards`,
            }}
          />
        ))}
      </div>

      <div
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 text-center relative"
        style={{ animation: "popIn 0.4s ease-out", ...F }}
      >
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5"
          style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}
        >
          <Check size={36} className="text-white" strokeWidth={3} />
        </div>
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles size={18} style={{ color: YELLOW }} />
          <h2 className="text-2xl font-bold text-foreground">Declaration Submitted!</h2>
          <Sparkles size={18} style={{ color: YELLOW }} />
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed mb-1">
          Thank you, <span className="font-semibold text-foreground">{data.employee}</span>.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          Your declaration{" "}
          <span className="font-mono font-bold" style={{ color: PURPLE }}>
            {data.id}
          </span>{" "}
          has been submitted for approval. Your line manager will be notified shortly.
        </p>
        <div className="rounded-2xl p-4 mb-6 text-left space-y-2" style={{ background: INFO_BG }}>
          {[
            ["Declaration ID", data.id],
            ["Type", data.type],
            ["Counterparty", data.Counterparty],
            ["Submitted", new Date().toLocaleDateString("en-ZA")],
            ["Status", "Pending Approval"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span className="text-xs text-muted-foreground">{k}</span>
              <span className="text-xs font-semibold text-foreground">{v}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-11 rounded-xl text-sm font-semibold border border-border bg-white hover:bg-muted transition-colors"
          >
            Close
          </button>
          <button
            onClick={onView}
            className="flex-1 h-11 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-all"
            style={{ background: GRADIENT_PRIMARY }}
          >
            View Declaration
          </button>
        </div>
      </div>
    </div>
  );
}
