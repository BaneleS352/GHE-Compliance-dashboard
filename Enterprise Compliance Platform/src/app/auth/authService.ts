import { User } from "../../types/declaration";
import { api, setToken } from "../../services/httpClient";

export async function authenticate(email: string, password: string): Promise<User | null> {
  if (typeof email !== "string" || typeof password !== "string") return null;
  try {
    const res = await api.post<{ token: string; user: User }>("/api/auth/login", { email, password });
    setToken(res.token);
    return res.user;
  } catch {
    return null;
  }
}

export async function fetchCurrentUser(): Promise<User | null> {
  try {
    return await api.get<User>("/api/auth/me");
  } catch {
    return null;
  }
}

export function getUserRole(user: User): "teamMember" | "approver" | "admin" {
  return user.role;
}

export function canAccessScreen(user: User | null, screen: string): boolean {
  if (!user) return screen === "landing" || screen === "login";
  const role = user.role;
  if (screen === "admin-reports") return role === "admin" || (role === "approver" && user.position === "Group CEO");
  if (screen.startsWith("admin-")) return role === "admin";
  if (screen === "approver-dashboard" || screen === "approval-queue" || screen === "approval-detail") {
    return role === "approver" || role === "admin";
  }
  return role === "teamMember" || role === "approver" || role === "admin";
}
