import { useState } from "react";
import { CircleHelp } from "lucide-react";
import { ImageWithFallback } from "@/app/components/ImageWithFallback";
import bannerImg from "@/assets/Button.png";
import { F } from "@/config/theme";
import { authenticate } from "@/app/auth/authService";

export function LandingScreen() {
  const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const [quickLoginEmail, setQuickLoginEmail] = useState("nomvula@hb.co.za");
  const handleSubmit = async (event: React.FormEvent) => { event.preventDefault(); setError(""); setLoading(true); try { await authenticate(); } catch { setError("Sign-in could not be started. Please contact support."); setLoading(false); } };
  const handleQuickLogin = async () => {
    if (!import.meta.env.DEV) return;
    setError("");
    setLoading(true);
    try {
      const { quickLogin } = await import("@/dev/quickLogin");
      await quickLogin(quickLoginEmail);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Quick login could not connect. Start the app with dev.bat and confirm the local test provider is running.");
      setLoading(false);
    }
  };
  return <div className="relative min-h-screen w-full overflow-hidden bg-[#0f0225]" style={F}>
    <div className="absolute inset-0 z-0"><ImageWithFallback src={bannerImg} alt="GHE Declaration" className="block h-full w-full object-contain object-left" /></div>
    <div className="relative z-20 ml-auto flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#f4f6fb] px-5 py-8 sm:px-8 lg:w-[38%] lg:rounded-l-[3.5rem] lg:shadow-[-18px_0_45px_rgba(15,2,37,.22)]">
      <button type="button" aria-label="Help" className="group absolute bottom-5 right-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-300 text-white"><CircleHelp size={30} strokeWidth={3} /></button>
      <div className="w-full max-w-[320px]"><h1 className="text-3xl font-semibold tracking-tight text-slate-900">Welcome back!</h1><p className="mt-2 text-sm leading-6 text-slate-600">GHE Declaration Portal</p>
        <form onSubmit={handleSubmit} className="mt-8 space-y-4"><p className="text-sm text-slate-600">Sign in with your Microsoft Entra ID account.</p>{error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}<button type="submit" disabled={loading} className="h-11 w-full rounded-xl text-sm font-semibold text-white disabled:opacity-60" style={{ background: "linear-gradient(90deg, #30004F 0%, #6633A3 100%)" }}>{loading ? "Redirecting…" : "Sign in with Microsoft"}</button></form>
        {import.meta.env.DEV && <section aria-label="Developer testing" className="mt-6 space-y-3 border-t border-slate-200 pt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Developer testing</p>
          <label htmlFor="quick-login-user" className="sr-only">Test account</label>
          <select id="quick-login-user" value={quickLoginEmail} onChange={(event) => setQuickLoginEmail(event.target.value)} className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700">
            <option value="nomvula@hb.co.za">Nomvula Dlamini — Team Member</option>
            <option value="sipho@hb.co.za">Sipho Nkosi — Approver</option>
            <option value="lindiwe@hb.co.za">Lindiwe Zulu — HR Approver</option>
            <option value="admin@hb.co.za">System Admin</option>
          </select>
          <button type="button" onClick={() => void handleQuickLogin()} disabled={loading} className="h-10 w-full rounded-xl border border-purple-200 bg-white text-sm font-semibold text-purple-800 hover:bg-purple-50 disabled:opacity-60">{loading ? "Signing in…" : "Quick login"}</button>
        </section>}
      </div>
    </div>
  </div>;
}
