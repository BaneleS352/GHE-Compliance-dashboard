import { describe, it, expect, vi, beforeEach } from "vitest";
import { authenticate, canAccessScreen } from "../app/auth/authService";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("Auth — authService", () => {
  it("authenticate with empty email returns null", async () => {
    const r = await authenticate("", "password");
    expect(r).toBeNull();
  });

  it("authenticate with empty password returns null", async () => {
    const r = await authenticate("admin@hb.co.za", "");
    expect(r).toBeNull();
  });

  it("authenticate with wrong password returns null (HTTP 401)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false, status: 401, json: () => Promise.resolve({ error: "Invalid credentials" }),
      headers: new Headers(),
    } as Response);
    const r = await authenticate("admin@hb.co.za", "wrongpass");
    expect(r).toBeNull();
  });

  it("authenticate with non-existent email returns null (HTTP 401)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false, status: 401, json: () => Promise.resolve({ error: "Invalid credentials" }),
      headers: new Headers(),
    } as Response);
    const r = await authenticate("noone@nowhere.com", "password");
    expect(r).toBeNull();
  });

  it("authenticate returns user on success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true, status: 200,
      json: () => Promise.resolve({ token: "abc", user: { id: "u1", email: "admin@hb.co.za", role: "admin" } }),
      headers: new Headers(),
    } as Response);
    const r = await authenticate("admin@hb.co.za", "password");
    expect(r).not.toBeNull();
    expect(r!.role).toBe("admin");
  });

  it("authenticate returns null on network error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    const r = await authenticate("admin@hb.co.za", "password");
    expect(r).toBeNull();
  });

  it("only admin can access admin screens", () => {
    const admin = { role: "admin" } as never;
    const approver = { role: "approver" } as never;
    const member = { role: "teamMember" } as never;
    expect(canAccessScreen(admin, "admin-users")).toBe(true);
    expect(canAccessScreen(approver, "admin-users")).toBe(false);
    expect(canAccessScreen(member, "admin-users")).toBe(false);
    expect(canAccessScreen(null, "admin-users")).toBe(false);
  });

  it("approver can access approval queue", () => {
    const approver = { role: "approver" } as never;
    const member = { role: "teamMember" } as never;
    expect(canAccessScreen(approver, "approval-queue")).toBe(true);
    expect(canAccessScreen(member, "approval-queue")).toBe(false);
  });

  it("any authenticated role can access new-declaration", () => {
    const member = { role: "teamMember" } as never;
    const approver = { role: "approver" } as never;
    expect(canAccessScreen(member, "new-declaration")).toBe(true);
    expect(canAccessScreen(approver, "new-declaration")).toBe(true);
  });

  it("unauthenticated users can only reach landing/login", () => {
    expect(canAccessScreen(null, "landing")).toBe(true);
    expect(canAccessScreen(null, "login")).toBe(true);
    expect(canAccessScreen(null, "new-declaration")).toBe(false);
  });
});
