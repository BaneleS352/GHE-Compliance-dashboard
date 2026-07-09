import { Gift, FileText, Home, CheckSquare, Menu, ChevronLeft, Settings } from "lucide-react";
import { ImageWithFallback } from "../app/components/ImageWithFallback";
import logoImg from "../assets/Logo.png";
import { YELLOW } from "../config/theme";
import { Role, Screen } from "../types/declaration";

export function Sidebar({
  role,
  screen,
  onNavigate,
  collapsed,
  onToggle,
}: {
  role: Role;
  screen: Screen;
  onNavigate: (s: Screen) => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const links =
    role === "teamMember"
      ? [
          { screen: "new-declaration" as Screen, icon: Gift,        label: "New Declaration" },
          { screen: "my-declarations"  as Screen, icon: FileText,   label: "My Declarations" },
        ]
      : [
          { screen: "approver-dashboard" as Screen, icon: Home,        label: "Dashboard" },
          { screen: "approval-queue"     as Screen, icon: CheckSquare, label: "Approval Queue" },
          { screen: "my-declarations"    as Screen, icon: FileText,    label: "My Declarations" },
        ];

  return (
    <>
    <aside
      className={`hidden md:flex flex-shrink-0 flex-col transition-all duration-300 ${collapsed ? "w-16" : "w-56"}`}
      style={{ background: "linear-gradient(180deg, #0f0225 0%, #39156F 100%)" }}
    >
      <div
        className={`h-14 flex items-center border-b ${collapsed ? "justify-center px-0" : "justify-between px-4"}`}
        style={{ borderColor: "rgb(255 255 255 / 0.1)" }}
      >
        {!collapsed && (
          <ImageWithFallback src={logoImg} alt="Hollywoodbets" className="h-8 w-auto object-contain" />
        )}
        <button
          onClick={onToggle}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors text-[#c4b5fd] flex-shrink-0"
        >
          {collapsed ? <Menu size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="flex-1 py-5 px-2">
        {!collapsed && (
          <p
            className="text-[10px] font-bold uppercase tracking-widest px-3 pb-3"
            style={{ color: "rgb(237 232 255 / 0.45)" }}
          >
            {role === "teamMember" ? "Team Member" : "Approver"}
          </p>
        )}
        <div className="space-y-0.5">
          {links.map((link) => {
            const active =
              screen === link.screen ||
              (screen === "declaration-detail" && link.screen === "my-declarations");
            return (
              <button
                key={link.screen}
                onClick={() => onNavigate(link.screen)}
                title={collapsed ? link.label : undefined}
                className={`w-full flex items-center gap-3 rounded-xl text-sm transition-all ${
                  collapsed ? "justify-center p-2.5" : "px-3 py-2.5"
                } ${active ? "font-semibold" : "text-[#c4b5fd] hover:bg-white/10 font-medium"}`}
                style={active ? { background: YELLOW, color: "#1E1E2D" } : {}}
              >
                <link.icon size={16} className={active ? "" : "opacity-80"} />
                {!collapsed && link.label}
              </button>
            );
          })}
        </div>
      </nav>

      <div className="px-2 pb-5 border-t pt-4" style={{ borderColor: "rgb(255 255 255 / 0.1)" }}>
        <button
          title={collapsed ? "Settings" : undefined}
          className={`w-full flex items-center gap-3 rounded-xl text-sm text-[#c4b5fd] hover:bg-white/10 transition-colors font-medium ${
            collapsed ? "justify-center p-2.5" : "px-3 py-2.5"
          }`}
        >
          <Settings size={16} className="opacity-80" />
          {!collapsed && "Settings"}
        </button>
      </div>
    </aside>
    <nav className="md:hidden fixed inset-x-3 bottom-3 z-40 rounded-2xl border border-white/15 bg-[#16062f]/95 p-2 shadow-[0_18px_50px_rgba(15,2,37,0.35)] backdrop-blur-xl">
      <div className="flex items-center justify-around gap-1">
        {links.map((link) => {
          const active =
            screen === link.screen ||
            (screen === "declaration-detail" && link.screen === "my-declarations");
          return (
            <button
              key={link.screen}
              onClick={() => onNavigate(link.screen)}
              className={`min-w-0 flex-1 rounded-xl px-2 py-2 text-[11px] font-semibold transition-all ${
                active ? "text-[#1E1E2D]" : "text-[#c4b5fd] hover:bg-white/10"
              }`}
              style={active ? { background: YELLOW } : {}}
            >
              <link.icon size={16} className="mx-auto mb-1" />
              <span className="block truncate">{link.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
    </>
  );
}
