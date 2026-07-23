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
    <div className="fixed inset-0 flex overflow-hidden" style={{ ...F, background: "var(--background)" }}>

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
