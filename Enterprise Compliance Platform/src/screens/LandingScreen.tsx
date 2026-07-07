import { useState } from "react";
import { ImageWithFallback } from "../app/components/figma/ImageWithFallback";
import logoImg from "../imports/Logo.png";
import bannerImg from "../imports/Button.png";
import { Sel } from "../components/Sel";
import { PURPLE, F, inp } from "../config/theme";
import { Role } from "../types/declaration";

export function LandingScreen({ onEnter }: { onEnter: (role: Role, name: string) => void }) {
  const [role, setRole] = useState<Role>("teamMember");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(
      () => onEnter(role, role === "approver" ? "Sipho Nkosi" : "Nomvula Dlamini"),
      800
    );
  };

  return (
    <div className="min-h-screen w-full flex" style={F}>
      {/* Left panel */}
      <div
        className="hidden lg:flex w-[58%] flex-col relative overflow-hidden"
        style={{
          background: `linear-gradient(145deg, #0f0225 0%, #39156F 35%, ${PURPLE} 70%, #6d28d9 100%)`,
        }}
      >
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div
            className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full opacity-20"
            style={{ background: `radial-gradient(circle, #F8D74A, transparent 70%)` }}
          />
          <div
            className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full opacity-15"
            style={{
              background: "radial-gradient(circle, #a78bfa, transparent 70%)",
              transform: "translate(20%,20%)",
            }}
          />
          <svg className="absolute bottom-0 left-0 w-full opacity-10" viewBox="0 0 800 120" preserveAspectRatio="none">
            <path d="M0,40 C200,90 400,0 600,50 C700,75 760,30 800,40 L800,120 L0,120 Z" fill="#EDE8FF" />
          </svg>
        </div>

        <div className="relative z-10 p-8 pb-0" />
        <div className="relative z-10 flex-1 flex flex-col justify-center px-10 py-8">
          <div className="rounded-2xl overflow-hidden mb-8" style={{ boxShadow: "0 20px 60px rgb(0 0 0 / 0.5)" }}>
            <ImageWithFallback
              src={bannerImg}
              alt="Gifting, Hospitality & Entertainment Declaration"
              className="w-full object-cover"
            />
          </div>
          <div className="mt-7 flex items-center gap-5">
            {[["🔒", "Secure & Encrypted"], ["📋", "Fully Audited"], ["✅", "Policy Compliant"]].map(
              ([icon, label]) => (
                <div key={label} className="flex items-center gap-1.5" />
              )
            )}
          </div>
        </div>
        <div className="relative z-10 px-10 pb-6">
          <p className="text-xs" style={{ color: "rgb(237 232 255 / 0.35)" }}>
            © 2024 Hollywoodbets Group. Authorised employees only.
          </p>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center bg-background px-8 py-10">
        <div className="w-full max-w-[380px]">
          <div className="lg:hidden mb-8">
            <ImageWithFallback src={logoImg} alt="Hollywoodbets" className="h-9 w-auto object-contain" />
          </div>
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>
            <p className="text-sm text-muted-foreground mt-1">Sign in to the GHE Declaration Portal</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">Username</label>
              <input type="text" placeholder="Enter your username" className={inp} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">Password</label>
              <input type="password" placeholder="Enter your password" className={inp} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">Sign in as</label>
              <Sel value={role} onChange={(v) => setRole(v as Role)}>
                <option value="teamMember">Team Member</option>
                <option value="approver">Approver</option>
              </Sel>
            </div>
            <div className="pt-1">
              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-xl text-sm font-semibold text-white hover:opacity-90 active:scale-[0.98] disabled:opacity-60 transition-all"
                style={{ background: `linear-gradient(135deg, ${PURPLE}, #6d28d9)` }}
              >
                {loading ? "Signing in…" : "Sign In"}
              </button>
            </div>
          </form>
          <div className="flex gap-2.5 mt-3">
            <button className="flex-1 h-9 rounded-xl text-xs font-semibold text-muted-foreground border border-border hover:bg-muted transition-colors">
              Forgot Password
            </button>
            <button className="flex-1 h-9 rounded-xl text-xs font-semibold text-muted-foreground border border-border hover:bg-muted transition-colors">
              Support
            </button>
          </div>
          <div className="mt-8 pt-6 border-t border-border">
            <p className="text-xs text-center text-muted-foreground">
              For access issues, contact your IT Helpdesk or HR representative.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
