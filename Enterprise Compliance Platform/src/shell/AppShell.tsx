import React, { useState } from "react";
import { Sidebar } from "../shell/Sidebar";
import { TopBar } from "../shell/TopBar";
import { F } from "../config/theme";
import { Role, Screen, User } from "../types/declaration";

export function AppShell({
  role,
  screen,
  userName,
  onNavigate,
  onSignOut,
  children,
  user,
}: {
  role: Role;
  screen: Screen;
  userName: string;
  onNavigate: (s: Screen) => void;
  onSignOut: () => void;
  children: React.ReactNode;
  user?: User | null;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="fixed inset-0 flex overflow-hidden" style={{ ...F, background: "#FEFCF3" }}>
      {/* ambient gradient blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[10%] w-[40%] h-[40%] rounded-full bg-purple-400/20 blur-[120px]" />
        <div className="absolute top-[30%] right-[-5%] w-[30%] h-[50%] rounded-full bg-blue-400/15 blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[20%] w-[50%] h-[40%] rounded-full bg-fuchsia-400/15 blur-[120px]" />
      </div>

      <Sidebar
        role={role}
        screen={screen}
        onNavigate={onNavigate}
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        user={user}
      />

      <div className="flex flex-col flex-1 min-w-0 min-h-0 relative z-10">
        <TopBar userName={userName} role={role} onSignOut={onSignOut} />
        <main className="flex-1 min-h-0 overflow-y-auto px-3 pt-4 pb-4 max-md:pb-24 sm:px-4 lg:px-5 lg:py-5">{children}</main>
      </div>
    </div>
  );
}
