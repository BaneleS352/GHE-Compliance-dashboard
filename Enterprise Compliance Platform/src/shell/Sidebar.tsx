import { Gift, FileText, Home, CheckSquare, Menu, ChevronLeft, Settings, Users, Activity, List, BarChart3 } from "lucide-react";
import { ImageWithFallback } from "../app/components/ImageWithFallback";
import logoImg from "../assets/HB-Logo-NO-BG.png";
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
    role === "admin"
      ? [
          { screen: "admin-dashboard" as Screen, icon: Home,     label: "Dashboard" },
          { screen: "admin-users"     as Screen, icon: Users,    label: "Users" },
          { screen: "admin-workflows" as Screen, icon: Activity, label: "Workflows" },
          { screen: "admin-dropdowns" as Screen, icon: List,     label: "Dropdowns" },
          { screen: "admin-config"    as Screen, icon: Settings, label: "Config" },
          { screen: "admin-reports"   as Screen, icon: FileText, label: "Reports" },
        ]
      : role === "teamMember"
      ? [
          { screen: "new-declaration" as Screen, icon: Gift,        label: "New Declaration" },
          { screen: "my-declarations"  as Screen, icon: FileText,   label: "My Declarations" },
        ]
      : [
          { screen: "approver-dashboard" as Screen, icon: Home,        label: "Dashboard" },
          { screen: "new-declaration"    as Screen, icon: Gift,        label: "New Declaration" },
          { screen: "approval-queue"     as Screen, icon: CheckSquare, label: "Approval Queue" },
          { screen: "my-declarations"    as Screen, icon: FileText,    label: "All Declarations" },
          { screen: "admin-reports"      as Screen, icon: BarChart3,   label: "Reports" },
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
          <div className="flex-1 pr-3">
            <ImageWithFallback src={logoImg} alt="Hollywoodbets" className="h-10 w-full object-contain object-left" />
          </div>
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
            className="px-3 pb-3 text-[11px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: "rgb(245 243 255 / 0.78)" }}
          >
            {role === "admin" ? "Administrator" : role === "teamMember" ? "Team Member" : "Approver"}
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
                className={`w-full flex items-center gap-3 rounded-xl transition-all ${
                  collapsed ? "justify-center p-2.5 text-base" : "px-3 py-3 text-[16px]"
                } ${active ? "font-semibold" : "text-[#efe9ff] hover:bg-white/10 font-medium"}`}
                style={active ? { background: YELLOW, color: "#1E1E2D" } : {}}
              >
                <link.icon size={18} className={active ? "" : "opacity-90"} />
                {!collapsed && link.label}
              </button>
            );
          })}
        </div>
      </nav>

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
              className={`min-w-0 flex-1 rounded-xl px-2 py-2 text-sm font-semibold transition-all ${
                active ? "text-[#1E1E2D]" : "text-gray-100 hover:bg-white/10"
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
