import { LogOut } from "lucide-react";
import { PURPLE } from "../config/theme";
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
  const headerText = 'Gift, Hospitality or Entertainment ("GHE") Declaration System';

  return (
    <header className="relative z-20 flex min-h-16 items-center justify-between gap-2 border-b border-white/60 bg-white/60 px-3 shadow-[0_2px_10px_rgba(0,0,0,0.02)] backdrop-blur-xl sm:gap-3 sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-3 sm:mr-3 lg:mr-6">
        <div className="flex min-w-0 flex-1 items-center justify-center gap-2 overflow-hidden rounded-full border border-[#6d28d9]/50 bg-gradient-to-r from-[#0f0225] via-[#2f0b63] to-[#4f1d95] px-3 py-2 shadow-[0_10px_24px_rgba(79,29,149,0.18)] transition-all hover:shadow-[0_14px_30px_rgba(79,29,149,0.25)] lg:px-8">
          <span className="hidden sm:block w-2.5 h-2.5 rounded-full bg-purple-600 animate-pulse shadow-[0_0_8px_rgba(147,51,234,0.6)] flex-shrink-0" />
          <div className="hidden min-w-0 flex-1 xl:flex xl:justify-center">
            <span className="text-[11px] font-black uppercase tracking-wide text-transparent bg-gradient-to-r from-purple-200 via-violet-300 to-purple-500 bg-clip-text drop-shadow-sm whitespace-nowrap sm:text-xs lg:text-sm lg:tracking-widest">
              {headerText}
            </span>
          </div>
          <div className="header-carousel-mask flex min-w-0 flex-1 xl:hidden">
            <div className="header-carousel-track">
              <span className="header-carousel-copy text-[11px] font-black uppercase tracking-wide text-transparent bg-gradient-to-r from-purple-200 via-violet-300 to-purple-500 bg-clip-text drop-shadow-sm sm:text-xs lg:text-sm lg:tracking-widest">
                {headerText}
              </span>
              <span aria-hidden className="header-carousel-copy text-[11px] font-black uppercase tracking-wide text-transparent bg-gradient-to-r from-purple-200 via-violet-300 to-purple-500 bg-clip-text drop-shadow-sm sm:text-xs lg:text-sm lg:tracking-widest">
                {headerText}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-shrink-0 items-center gap-2 sm:gap-4">
        <div className="hidden sm:block h-6 w-px bg-slate-200/80" />
        <div className="group flex items-center gap-2 rounded-full border border-white/80 bg-white/60 py-1.5 pl-1.5 pr-1.5 shadow-sm transition-colors hover:bg-white md:gap-3 md:pr-4">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md group-hover:scale-105 transition-transform"
            style={{ background: `linear-gradient(135deg, ${PURPLE}, #6d28d9)` }}
          >
            {initials}
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-bold text-slate-800 leading-none">{userName}</p>
            <p className="text-[10px] font-semibold text-purple-600 mt-0.5 uppercase tracking-wider">
              {role === "teamMember" ? "Team Member" : role === "admin" ? "Administrator" : "Approver"}
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
