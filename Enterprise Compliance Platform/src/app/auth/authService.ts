import * as bcrypt from "bcryptjs";
import { User } from "../../types/declaration";
import { getUserByEmail, updateUser } from "../../data/db";

const DEFAULT_PASSWORD = "password";
const SALT_ROUNDS = 10;

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, SALT_ROUNDS);
}

function verifyPassword(password: string, user: User): boolean {
  const hash = user.passwordHash;
  if (!hash) {
    if (password !== DEFAULT_PASSWORD) return false;
    updateUser(user.id, { passwordHash: hashPassword(DEFAULT_PASSWORD) });
    return true;
  }
  try {
    return bcrypt.compareSync(password, hash);
  } catch {
    return false;
  }
}

export async function authenticate(email: string, password: string): Promise<User | null> {
  if (typeof email !== "string" || typeof password !== "string") return null;
  const normalizedEmail = email.toLowerCase();
  const user = getUserByEmail(normalizedEmail);
  if (!user) return null;
  if (!verifyPassword(password, user)) return null;
  return getUserByEmail(normalizedEmail);
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
