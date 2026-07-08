import { Bell, LogOut } from "lucide-react";
import { ImageWithFallback } from "../app/components/ImageWithFallback";
import { PURPLE, YELLOW } from "../config/theme";
import { Role } from "../types/declaration";

export function TopBar({
  userName,
  role,
  onSignOut,
}: {
  userName: string;
  role: Role;
  onSignOut: () => void;
}) {
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="min-h-16 bg-white/60 backdrop-blur-xl border-b border-white/60 flex items-center justify-between gap-3 px-4 sm:px-6 flex-shrink-0 relative z-20 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
      <div className="flex items-center gap-4 flex-1 min-w-0 sm:mr-3 lg:mr-6">
        <div className="hidden sm:flex flex-1 min-w-0 items-center justify-center gap-3 bg-gradient-to-r from-purple-100/50 via-[#5b21b6]/15 to-indigo-50/50 border border-purple-200/60 px-4 lg:px-8 py-2 rounded-full shadow-sm backdrop-blur-md hover:shadow-md transition-all">
          <span className="w-2.5 h-2.5 rounded-full bg-purple-600 animate-pulse shadow-[0_0_8px_rgba(147,51,234,0.6)] flex-shrink-0" />
          <span className="text-xs lg:text-sm font-black uppercase tracking-widest bg-gradient-to-r from-purple-700 via-purple-500 to-indigo-600 bg-clip-text text-transparent drop-shadow-sm animate-gradient-text truncate">
            Gift, Hospitality and Entertainment Declaration System
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
        <button className="relative w-10 h-10 flex items-center justify-center rounded-full bg-white/60 border border-white/80 shadow-sm hover:shadow-md hover:scale-105 transition-all text-slate-500 hover:text-purple-600">
          <Bell size={18} />
          <span
            className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full ring-2 ring-white"
            style={{ background: YELLOW }}
          />
        </button>
        <div className="hidden sm:block h-6 w-px bg-slate-200/80" />
        <div className="flex items-center gap-3 bg-white/60 border border-white/80 rounded-full pl-1.5 pr-1.5 md:pr-4 py-1.5 shadow-sm hover:bg-white transition-colors cursor-pointer group">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md group-hover:scale-105 transition-transform"
            style={{ background: `linear-gradient(135deg, ${PURPLE}, #6d28d9)` }}
          >
            {initials}
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-bold text-slate-800 leading-none">{userName}</p>
            <p className="text-[10px] font-semibold text-purple-600 mt-0.5 uppercase tracking-wider">
              {role === "teamMember" ? "Team Member" : "Approver"}
            </p>
          </div>
        </div>
        <button
          onClick={onSignOut}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/60 border border-white/80 shadow-sm hover:shadow-md hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition-all text-slate-500"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
