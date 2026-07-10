import { useState } from "react";
import { ImageWithFallback } from "../components/ImageWithFallback";
import logoImg from "../../assets/Logo.png";
import bannerImg from "../../assets/Button.png";
import { PURPLE, F, inp } from "../../config/theme";
import { Role } from "../../types/declaration";
import { useUser } from "../auth/UserContext";
import { authenticate } from "../auth/authService";

const QUICK_LOGIN_USERS = [
  { label: "Team Member — Nomvula Dlamini",  email: "nomvula@hb.co.za",  role: "teamMember" as const },
  { label: "Line Manager — Sipho Nkosi",     email: "sipho@hb.co.za",    role: "approver" as const },
  { label: "HR — Lindiwe Zulu",              email: "lindiwe@hb.co.za",  role: "approver" as const },
  { label: "CEO — Sandile Shabalala",        email: "sandile@hb.co.za",  role: "approver" as const },
  { label: "Admin — System Admin",           email: "admin@hb.co.za",    role: "admin" as const },
];

export function LandingScreen({ onEnter }: { onEnter: (role: Role, name: string) => void }) {
  const { setUser } = useUser();
  const [selectedIdx, setSelectedIdx] = useState(0);
  const email = QUICK_LOGIN_USERS[selectedIdx].email;
  const role = QUICK_LOGIN_USERS[selectedIdx].role;
  const [password, setPassword] = useState("password");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    await new Promise((r) => setTimeout(r, 400));

    const user = await authenticate(email, password);
    if (!user) {
      setError("Invalid credentials. Default password: password");
      setLoading(false);
      return;
    }

    setUser(user);
    onEnter(user.role, user.name);
    setLoading(false);
  };

  return (
    <div className="min-h-screen w-full flex" style={F}>
      <div className="hidden lg:flex w-[58%] flex-col relative overflow-hidden"
        style={{ background: `linear-gradient(145deg, #0f0225 0%, #39156F 35%, ${PURPLE} 70%, #6d28d9 100%)` }}
      >
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full opacity-20"
            style={{ background: `radial-gradient(circle, #F8D74A, transparent 70%)` }} />
          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full opacity-15"
            style={{ background: "radial-gradient(circle, #a78bfa, transparent 70%)", transform: "translate(20%,20%)" }} />
          <svg className="absolute bottom-0 left-0 w-full opacity-10" viewBox="0 0 800 120" preserveAspectRatio="none">
            <path d="M0,40 C200,90 400,0 600,50 C700,75 760,30 800,40 L800,120 L0,120 Z" fill="#EDE8FF" />
          </svg>
        </div>
        <div className="relative z-10 p-8 pb-0" />
        <div className="relative z-10 flex-1 flex flex-col justify-center px-10 py-8">
          <div className="rounded-2xl overflow-hidden mb-8" style={{ boxShadow: "0 20px 60px rgb(0 0 0 / 0.5)" }}>
            <ImageWithFallback src={bannerImg} alt="GHE Declaration" className="w-full object-cover" />
          </div>
        </div>
        <div className="relative z-10 px-10 pb-6">
          <p className="text-xs" style={{ color: "rgb(237 232 255 / 0.35)" }}>© 2024 Hollywoodbets Group. Authorised employees only.</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center bg-background px-5 py-8 sm:px-8 sm:py-10">
        <div className="w-full max-w-[380px]">
          <div className="lg:hidden mb-8">
            <ImageWithFallback src={logoImg} alt="Hollywoodbets" className="h-9 w-auto object-contain" />
          </div>
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>
            <p className="text-sm text-muted-foreground mt-1">Sign in to the Gift, Hospitality and Entertainment Declaration Portal</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">Email</label>
              <input type="email" value={email} readOnly className={inp} />
            </div>

            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">Quick login as</label>
              <select value={selectedIdx} onChange={(e) => { setSelectedIdx(Number(e.target.value)); setPassword("password"); setError(""); }}
                className={`${inp} cursor-pointer`}
              >
                {QUICK_LOGIN_USERS.map((u, i) => <option key={i} value={i}>{u.label}</option>)}
              </select>
            </div>
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>
            )}
            <div className="pt-1">
              <button type="submit" disabled={loading}
                className="w-full h-11 rounded-xl text-sm font-semibold text-white hover:opacity-90 active:scale-[0.98] disabled:opacity-60 transition-all"
                style={{ background: `linear-gradient(135deg, ${PURPLE}, #6d28d9)` }}
              >
                {loading ? "Signing in…" : "Sign In"}
              </button>
            </div>
          </form>
          <div className="mt-6 pt-4 border-t border-border">
            <p className="text-xs text-center text-muted-foreground">
              For access issues, contact your IT Helpdesk or HR representative.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
