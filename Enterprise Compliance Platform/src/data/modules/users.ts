import { User } from "../../types/declaration";
import { get, persist } from "../db";

export function getUsers(): User[] {
  return get().users;
}

export function getUserById(id: string): User | undefined {
  return get().users.find((u) => u.id === id);
}

export function getUserByEmail(email: string): User | undefined {
  const lower = email.toLowerCase();
  return get().users.find((u) => u.email.toLowerCase() === lower);
}

export function addUser(user: User) {
  const db = get();
  if (db.users.some((u) => u.id === user.id || u.email === user.email)) {
    throw new Error("User with this ID or email already exists.");
  }
  db.users.push(user);
  persist();
}

export function updateUser(id: string, updates: Partial<User>) {
  const db = get();
  const idx = db.users.findIndex((u) => u.id === id);
  if (idx !== -1) {
    db.users[idx] = { ...db.users[idx], ...updates };
    persist();
  }
}

export function deleteUser(id: string) {
  const db = get();
  const user = db.users.find((u) => u.id === id);
  if (!user) {
    throw new Error(`User with id "${id}" not found.`);
  }
  if (user.role === "admin") {
    const adminCount = db.users.filter((u) => u.role === "admin").length;
    if (adminCount <= 1) {
      throw new Error("Cannot delete the last admin user.");
    }
  }
  const orphaned = db.declarations.filter((d) => d.lineManager === user.name || d.employeeId === id);
  if (orphaned.length > 0) {
    for (const decl of orphaned) {
      const wf = db.workflowInstances.find((w) => w.declarationId === decl.id);
      if (wf && wf.steps.some((s) => s.status === "pending")) {
        throw new Error(
          `Cannot delete user "${user.name}". Declaration "${decl.id}" has pending approval steps.`
        );
      }
    }
  }
  db.users = db.users.filter((u) => u.id !== id);
  persist();
}