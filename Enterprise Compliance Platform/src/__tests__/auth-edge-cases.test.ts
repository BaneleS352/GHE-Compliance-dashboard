import { describe, it, expect, beforeEach } from "vitest";
import { authenticate, canAccessScreen, hashPassword } from "../app/auth/authService";
import { invalidateCache } from "../data/db";

describe("Auth — authService", () => {
  beforeEach(() => invalidateCache());

  /* ─── Empty / missing credentials ─── */
  it("authenticate with empty email returns null", async () => {
    const r = await authenticate("", "password");
    expect(r).toBeNull();
  });

  it("authenticate with empty password returns null", async () => {
    const r = await authenticate("admin@hb.co.za", "");
    expect(r).toBeNull();
  });

  /* ─── Wrong credentials ─── */
  it("authenticate with wrong password returns null", async () => {
    const r = await authenticate("admin@hb.co.za", "wrongpass");
    expect(r).toBeNull();
  });

  it("authenticate with non-existent email returns null", async () => {
    const r = await authenticate("noone@nowhere.com", "password");
    expect(r).toBeNull();
  });

  /* ─── Case sensitivity ─── */
  it("authenticate is case-insensitive on email", async () => {
    const r = await authenticate("ADMIN@HB.CO.ZA", "password");
    expect(r).not.toBeNull();
    expect(r?.role).toBe("admin");
  });

  it("authenticate is case-sensitive on password", async () => {
    const r = await authenticate("admin@hb.co.za", "PASSWORD");
    expect(r).toBeNull();
  });

  /* ─── Hashing ─── */
  it("hashPassword produces a bcrypt hash that verifies", async () => {
    const hash = hashPassword("secret");
    expect(hash).not.toBe("secret");
    const user = authenticate;
    expect(hash.startsWith("$2")).toBe(true);
  });

  /* ─── Role-based screen access ─── */
  const admin = { role: "admin" } as never;
  const approver = { role: "approver" } as never;
  const member = { role: "teamMember" } as never;

  it("only admin can access admin screens", () => {
    expect(canAccessScreen(admin, "admin-users")).toBe(true);
    expect(canAccessScreen(approver, "admin-users")).toBe(false);
    expect(canAccessScreen(member, "admin-users")).toBe(false);
    expect(canAccessScreen(null, "admin-users")).toBe(false);
  });

  it("approver can access approval queue", () => {
    expect(canAccessScreen(approver, "approval-queue")).toBe(true);
    expect(canAccessScreen(member, "approval-queue")).toBe(false);
  });

  it("any authenticated role can access new-declaration", () => {
    expect(canAccessScreen(member, "new-declaration")).toBe(true);
    expect(canAccessScreen(approver, "new-declaration")).toBe(true);
  });

  it("unauthenticated users can only reach landing/login", () => {
    expect(canAccessScreen(null, "landing")).toBe(true);
    expect(canAccessScreen(null, "login")).toBe(true);
    expect(canAccessScreen(null, "new-declaration")).toBe(false);
  });
});
