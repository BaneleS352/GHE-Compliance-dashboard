import type { Role, Screen, User } from "@/types/declaration";
import { canAccessScreen } from "@/app/auth/authService";

const ADMIN_SCREENS = new Set<Screen>([
  "admin-dashboard", "admin-users", "admin-workflows", "admin-dropdown-options",
  "admin-config", "admin-reports", "admin-approval-options",
]);
const APPROVER_SCREENS = new Set<Screen>(["approver-dashboard", "approval-queue", "approval-detail"]);

export function roleForScreen(screen: Screen): Role {
  if (ADMIN_SCREENS.has(screen)) return "admin";
  if (APPROVER_SCREENS.has(screen)) return "approver";
  return "teamMember";
}

export function landingScreenForUser(user: User): Screen {
  if (user.role === "admin") return "admin-dashboard";
  if (user.role === "approver") return "approver-dashboard";
  return "new-declaration";
}

export function canNavigateTo(user: User | null, screen: Screen): boolean {
  return canAccessScreen(user, screen);
}
