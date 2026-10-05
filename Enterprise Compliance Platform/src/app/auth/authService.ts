import { User } from "@/types/declaration";
import { api } from "@/services/httpClient";
import { activeAccount, signIn, signOut } from "./msal";
export async function authenticate(): Promise<void> { await signIn(); }
export function logoutFromIdentityProvider(): void { signOut(); }
export function isIdentityAuthenticated(): boolean { return !!activeAccount(); }
export async function fetchCurrentUser(): Promise<User | null> { try { return await api.get<User>("/api/auth/me"); } catch { return null; } }
export function canAccessScreen(user: User | null, screen: string): boolean {
  if (!user) return screen === "landing" || screen === "login";
  const role = user.role;
  if (screen === "admin-reports") return role === "admin" || role === "approver";
  if (screen.startsWith("admin-")) return role === "admin";
  if (["approver-dashboard", "approval-queue", "approval-detail"].includes(screen)) return role === "approver" || role === "admin";
  return ["teamMember", "approver", "admin"].includes(role);
}
