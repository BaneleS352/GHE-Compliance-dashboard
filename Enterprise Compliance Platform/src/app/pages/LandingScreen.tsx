import { useState } from "react";
import { CircleHelp } from "lucide-react";
import { ImageWithFallback } from "@/app/components/ImageWithFallback";
import bannerImg from "@/assets/Button.png";
import { F } from "@/config/theme";
import { authenticate } from "@/app/auth/authService";

export function LandingScreen() {
  const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const handleSubmit = async (event: React.FormEvent) => { event.preventDefault(); setError(""); setLoading(true); try { await authenticate(); } catch { setError("Sign-in could not be started. Please contact support."); setLoading(false); } };
  return <div className="relative min-h-screen w-full overflow-hidden bg-[#0f0225]" style={F}>
    <div className="absolute inset-0 z-0"><ImageWithFallback src={bannerImg} alt="GHE Declaration" className="block h-full w-full object-contain object-left" /></div>
    <div className="relative z-20 ml-auto flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#f4f6fb] px-5 py-8 sm:px-8 lg:w-[38%] lg:rounded-l-[3.5rem] lg:shadow-[-18px_0_45px_rgba(15,2,37,.22)]">
      <button type="button" aria-label="Help" className="group absolute bottom-5 right-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-300 text-white"><CircleHelp size={30} strokeWidth={3} /></button>
      <div className="w-full max-w-[320px]"><h1 className="text-3xl font-semibold tracking-tight text-slate-900">Welcome back!</h1><p className="mt-2 text-sm leading-6 text-slate-600">GHE Declaration Portal</p>
        <form onSubmit={handleSubmit} className="mt-8 space-y-4"><p className="text-sm text-slate-600">Sign in with your Microsoft Entra ID account.</p>{error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}<button type="submit" disabled={loading} className="h-11 w-full rounded-xl text-sm font-semibold text-white disabled:opacity-60" style={{ background: "linear-gradient(90deg, #30004F 0%, #6633A3 100%)" }}>{loading ? "Redirecting…" : "Sign in with Microsoft"}</button></form>
      </div>
    </div>
  </div>;
}
