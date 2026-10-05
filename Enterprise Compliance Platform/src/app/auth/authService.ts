import { User } from "@/types/declaration";
import { api } from "@/services/httpClient";
import { activeAccount, signIn, signOut } from "./msal";
export async function authenticate(): Promise<void> { await signIn(); }
export function logoutFromIdentityProvider(): void { signOut(); }
export function isIdentityAuthenticated(): boolean { return !!activeAccount(); }
export async function fetchCurrentUser(): Promise<User | null> {
  if (import.meta.env.DEV) {
    try {
      const injected = sessionStorage.getItem("e2e.auth.token");
      if (injected) return {
        id: 0,
        name: "E2E Test Identity",
        email: "e2e@test",
        role: "teamMember" as const,
        teamMemberNumber: "TM-000001",
        department: "Corporate",
        position: "Employee",
        lineManager: null,
      } as User;
    } catch {
      // Storage unavailable — fall through to API call below.
    }
  }
  try {
    return await api.get<User>("/api/auth/me");
  } catch {
    return null;
  }
}
export function canAccessScreen(user: User | null, screen: string): boolean {
  if (!user) return screen === "landing" || screen === "login";
  const role = user.role;
  if (screen === "admin-reports") return role === "admin" || role === "approver";
  if (screen.startsWith("admin-")) return role === "admin";
  if (["approver-dashboard", "approval-queue", "approval-detail"].includes(screen)) return role === "approver" || role === "admin";
  return ["teamMember", "approver", "admin"].includes(role);
}
