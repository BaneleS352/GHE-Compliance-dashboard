import { useState } from "react";
import { ImageWithFallback } from "@/app/components/ImageWithFallback";
import bannerImg from "@/assets/Button.png";
import { F, inp, GRADIENT_PRIMARY } from "@/config/theme";
import { Role } from "@/types/declaration";
import { useUser } from "@/app/auth/UserContext";
import { authenticate } from "@/app/auth/authService";
 
const QUICK_LOGIN_USERS = [
  { label: "HB — Team Member — Nomvula Dlamini",  email: "nomvula@hb.co.za",  role: "teamMember" as const },
  { label: "HB — Line Manager — Sipho Nkosi",     email: "sipho@hb.co.za",    role: "approver" as const },
  { label: "NPN — Team Member — Kabelo Molefe",   email: "kabelo@npn.co.za",  role: "teamMember" as const },
  { label: "NPN — Line Manager — James van Wyk",  email: "james@npn.co.za",   role: "approver" as const },
  { label: "HR — Lindiwe Zulu (Global)",           email: "lindiwe@hb.co.za",  role: "approver" as const },
  { label: "Admin — System Admin (Global)",        email: "admin@hb.co.za",    role: "admin" as const },
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

    try {
      const user = await authenticate(email, password);
      if (!user) {
        setError("Invalid credentials. Default password: password");
        setLoading(false);
        return;
      }

      setUser(user);
      onEnter(user.role, user.name);
    } catch {
      setError("Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#0f0225]" style={F}>
      <div className="absolute inset-0 z-0">
        <ImageWithFallback src={bannerImg} alt="GHE Declaration" className="block w-full h-full object-contain object-left" />
      </div>
      <div className="absolute inset-0 z-10 pointer-events-none">
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="absolute -top-40 -left-32 w-[620px] h-[620px] rounded-full opacity-20"
            style={{ background: `radial-gradient(circle, #F8D74A, transparent 70%)` }} />
          <div className="absolute bottom-[-180px] right-[-100px] w-[700px] h-[700px] rounded-full opacity-25"
            style={{ background: "radial-gradient(circle, #a78bfa, transparent 70%)", transform: "translate(20%,20%)" }} />
          <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, rgba(255,255,255,.35) 0 1px, transparent 1.5px)", backgroundSize: "115px 115px" }} />
          <svg className="absolute bottom-0 left-0 w-full opacity-10" viewBox="0 0 800 120" preserveAspectRatio="none">
            <path d="M0,40 C200,90 400,0 600,50 C700,75 760,30 800,40 L800,120 L0,120 Z" fill="#EDE8FF" />
          </svg>
        </div>
        <div className="relative z-10 p-10 pb-0" />
        <div className="relative z-10 flex-1" aria-hidden />
      </div>

      <div className="relative z-20 ml-auto min-h-screen w-full lg:w-[calc(38%_-_180px)] xl:w-[calc(36%_-_180px)] flex items-center justify-center overflow-hidden border-[3px] border-transparent bg-[#f4f6fb] bg-clip-padding px-5 py-8 sm:px-8 sm:py-10 lg:rounded-l-[3.5rem] lg:shadow-[-18px_0_45px_rgba(15,2,37,.22)]" style={{ background: "linear-gradient(#f4f6fb, #f4f6fb) padding-box, linear-gradient(135deg, #5b21b6 0%, #d946ef 35%, #ec4899 55%, #f97316 82%, #facc15 100%) border-box" }}>
        <div className="absolute inset-0 opacity-50 pointer-events-none" aria-hidden style={{ backgroundImage: "linear-gradient(135deg, transparent 0 30%, rgba(79,29,149,.035) 30% 45%, transparent 45% 65%, rgba(79,29,149,.025) 65% 80%, transparent 80%)" }} />
        <div className="relative z-10 w-full max-w-[320px] rounded-[2rem] bg-white/45 px-1 py-2 sm:px-3 sm:py-5 lg:bg-transparent lg:px-0">
          <div className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Welcome back!</h1>
            <p className="text-sm text-slate-600 mt-2 leading-6">GHE Declaration Portal</p>
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
                style={{ background: GRADIENT_PRIMARY }}
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
