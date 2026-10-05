import { useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import { F } from "@/config/theme";

export const EXPORT_PASSWORD_MIN_LENGTH = 8;

/**
 * Shared password-input dialog (Phase 5). The downloader sets a per-export
 * password: it travels in the request body only, is used once server-side,
 * and is never stored. Keyboard accessible (Escape closes, autofocus),
 * mobile-friendly layout.
 */
export function PasswordDialog({
  title,
  message,
  confirmLabel = "Protect & Download",
  onSubmit,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  onSubmit: (password: string) => void;
  onCancel: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const submit = () => {
    if (password.length < EXPORT_PASSWORD_MIN_LENGTH) {
      setError(`Password must be at least ${EXPORT_PASSWORD_MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    onSubmit(password);
  };

  const input =
    "h-10 w-full rounded-xl border border-border bg-white px-3 text-sm text-foreground outline-none focus:border-purple-500";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgb(0 0 0 / 0.55)", backdropFilter: "blur(6px)" }}
      onClick={onCancel}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
        style={F}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
            <Lock size={18} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-foreground">{title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{message}</p>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Password *</span>
            <input
              ref={inputRef}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              maxLength={128}
              autoComplete="new-password"
              className={input}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Confirm password *</span>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              maxLength={128}
              autoComplete="new-password"
              className={input}
            />
          </label>
        </div>
        {error && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-10 rounded-xl border border-border bg-white px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            className="h-10 rounded-xl bg-purple-700 px-4 text-sm font-semibold text-white transition-all hover:opacity-90"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
